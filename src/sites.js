import crypto from 'crypto';
import zlib from 'zlib';
import { HttpError } from './http.js';
import { get, query, run, addNotification } from './db.js';
import { safeFetch, BOT_UA } from './net.js';
import { config } from './config.js';
import { parseRobots, botAccess } from './robots.js';
import { AI_BOTS } from './bots.js';

const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
const MAX_URLS = 50000;

export const newIndexNowKey = () => crypto.randomBytes(16).toString('hex');

// 站点根地址：sitemap 与域名同主机时沿用其协议，否则默认 https
export function siteBase(site) {
  try {
    const u = new URL(site.sitemap_url);
    if (u.host === site.domain || u.hostname === site.domain || u.hostname === `www.${site.domain}`) return u.origin;
  } catch { /* 忽略 */ }
  return `https://${site.domain}`;
}

export function siteView(s) {
  const logs = query('SELECT url_count, status_code, created_at FROM indexnow_push_logs WHERE site_id = ? ORDER BY id DESC LIMIT 5', [s.id]);
  const latestCheck = get('SELECT * FROM site_check_logs WHERE site_id = ? ORDER BY id DESC LIMIT 1', [s.id]);
  return {
    id: s.id,
    domain: s.domain,
    sitemapUrl: s.sitemap_url,
    autoIndexNow: !!s.auto_indexnow,
    indexNowKey: s.indexnow_key,
    keyVerified: !!s.key_verified,
    keyFileUrl: `${siteBase(s)}/${s.indexnow_key}.txt`,
    lastCheckAt: s.last_check_at,
    lastUrlCount: s.last_url_count,
    lastNewCount: s.last_new_count,
    lastError: s.last_error,
    healthScore: s.last_health_score,
    hasLlmsTxt: s.has_llms_txt === null ? null : !!s.has_llms_txt,
    createdAt: s.created_at,
    recentPushes: logs,
    latestCheck: latestCheck ? {
      urlCount: latestCheck.url_count,
      newUrlsCount: latestCheck.new_urls_count,
      hasLlmsTxt: !!latestCheck.has_llms_txt,
      llmsStatus: latestCheck.llms_status,
      robotsStatus: latestCheck.robots_status,
      robotsBlockedBots: latestCheck.robots_blocked_bots ? JSON.parse(latestCheck.robots_blocked_bots) : [],
      sitemapStatus: latestCheck.sitemap_status,
      schemaStatus: latestCheck.schema_status ? JSON.parse(latestCheck.schema_status) : [],
      healthScore: latestCheck.health_score,
      error: latestCheck.error,
      createdAt: latestCheck.created_at,
    } : null,
  };
}

export async function verifyKey(site) {
  if (!site.indexnow_key) {
    site.indexnow_key = newIndexNowKey();
    run('UPDATE monitored_sites SET indexnow_key = ? WHERE id = ?', [site.indexnow_key, site.id]);
  }
  const url = `${siteBase(site)}/${site.indexnow_key}.txt`;
  let ok = false; let detail;
  try {
    const r = await safeFetch(url, { headers: { 'User-Agent': BOT_UA }, timeoutMs: 8000, maxBytes: 4096 });
    if (r.status === 200 && r.text.trim() === site.indexnow_key) {
      ok = true; detail = '验证通过：Key 文件可访问且内容正确';
    } else if (r.status === 200) {
      detail = `文件可访问，但内容不是该 Key（请确认文件内容只有这一行：${site.indexnow_key}）`;
    } else {
      detail = `无法访问 ${url}（HTTP ${r.status}），请确认文件已上传到网站根目录`;
    }
  } catch (e) {
    detail = `无法访问 ${url}：${e.message}`;
  }
  run('UPDATE monitored_sites SET key_verified = ? WHERE id = ?', [ok ? 1 : 0, site.id]);
  return { ok, detail, url };
}

async function fetchSitemapUrls(sitemapUrl, depth = 0, acc = new Set()) {
  if (depth > 2 || acc.size >= MAX_URLS) return acc;
  const r = await safeFetch(sitemapUrl, { headers: { 'User-Agent': BOT_UA }, timeoutMs: 15000, maxBytes: 20 * 1024 * 1024, raw: true });
  if (r.status !== 200) throw new Error(`Sitemap 无法访问（HTTP ${r.status}）：${sitemapUrl}`);
  let buf = r.buffer;
  if (buf[0] === 0x1f && buf[1] === 0x8b) buf = zlib.gunzipSync(buf);
  const xml = buf.toString('utf8');
  const locs = [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)\s*(?:\]\]>)?\s*<\/loc>/gi)].map(m => m[1].replace(/&amp;/g, '&'));
  if (/<sitemapindex[\s>]/i.test(xml)) {
    for (const child of locs.slice(0, 20)) {
      try { await fetchSitemapUrls(child, depth + 1, acc); } catch { /* 单个子 sitemap 失败不影响整体 */ }
      if (acc.size >= MAX_URLS) break;
    }
  } else {
    for (const l of locs) { acc.add(l); if (acc.size >= MAX_URLS) break; }
  }
  return acc;
}

export async function pushIndexNow({ userId, site, urls }) {
  if (!site.key_verified) throw new HttpError(400, '请先完成 IndexNow Key 验证（在网站根目录放置 Key 文件）');
  const host = site.domain;
  const list = [...new Set(urls)].filter(u => {
    try { const x = new URL(u); const h = x.hostname; return x.host === host || h === host || h === `www.${host}` || `www.${h}` === host; } catch { return false; }
  }).slice(0, 10000);
  if (!list.length) throw new HttpError(400, `没有可推送的网址（网址必须属于 ${host}）`);
  let status = 0; let body = '';
  try {
    const r = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: new URL(list[0]).hostname, key: site.indexnow_key, keyLocation: `${siteBase(site)}/${site.indexnow_key}.txt`, urlList: list }),
      signal: AbortSignal.timeout(15000),
    });
    status = r.status; body = (await r.text()).slice(0, 500);
  } catch (e) { status = 0; body = e.message; }
  run('INSERT INTO indexnow_push_logs (user_id, site_id, url_count, urls_json, status_code, response_body) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, site.id, list.length, JSON.stringify(list.slice(0, 200)), status, body]);
  const ok = status === 200 || status === 202;
  const messages = {
    200: '推送成功，搜索引擎已接收', 202: '已接收，搜索引擎将验证 Key 后处理',
    400: '请求格式有误', 403: 'Key 验证失败：请确认 Key 文件可访问', 422: '网址与站点不匹配或 Key 不匹配', 429: '推送过于频繁，请稍后再试',
  };
  return { ok, status, count: list.length, message: messages[status] || (status ? `IndexNow 返回 HTTP ${status}` : `网络错误：${body}`) };
}

/**
 * Wave 2 站点托管深度巡检：
 * 1. llms.txt 存在性与可读性
 * 2. robots.txt 对 14 种 AI 爬虫放行状态
 * 3. Sitemap 可达性与新网址发现
 * 4. 首页 JSON-LD 结构化数据
 * 5. 异常项与上次对比，发生异常时发送站内通知
 */
export async function checkSite(site, { userId, allowPush = true } = {}) {
  const result = {
    urlCount: 0,
    newUrls: [],
    pushed: null,
    health: 0,
    hasLlmsTxt: false,
    llmsStatus: 'unknown',
    robotsStatus: 'unknown',
    blockedBots: [],
    sitemapStatus: 'unknown',
    schemaTypes: [],
    error: null,
    baseline: false,
  };

  const base = siteBase(site);
  let sitemapOk = false;
  let robotsOk = false;
  let llmsOk = false;
  let schemaOk = false;

  // 1. Sitemap 巡检
  try {
    const sitemapUrl = site.sitemap_url || `${base}/sitemap.xml`;
    const urls = await fetchSitemapUrls(sitemapUrl);
    result.urlCount = urls.size;
    result.sitemapStatus = `可访问（共 ${urls.size} 个有效网址）`;
    sitemapOk = true;

    const prev = site.last_snapshot_urls ? new Set(JSON.parse(site.last_snapshot_urls)) : null;
    if (!prev) {
      result.baseline = true;
    } else {
      result.newUrls = [...urls].filter(u => !prev.has(u));
    }
    run('UPDATE monitored_sites SET last_snapshot_urls = ?, last_url_count = ?, last_new_count = ? WHERE id = ?',
      [JSON.stringify([...urls]), urls.size, result.newUrls.length, site.id]);

    if (allowPush && result.newUrls.length && site.key_verified && site.auto_indexnow) {
      result.pushed = await pushIndexNow({ userId: userId ?? site.user_id, site, urls: result.newUrls });
    }
  } catch (e) {
    result.sitemapStatus = `Sitemap 抓取异常：${e.message}`;
    result.error = e.message;
  }

  // 2. llms.txt 巡检
  try {
    const llmsUrl = `${base}/llms.txt`;
    const r = await safeFetch(llmsUrl, { headers: { 'User-Agent': BOT_UA }, timeoutMs: 8000, maxBytes: 256 * 1024 });
    const text = r.text || '';
    if (r.status === 200 && text.trim().length >= 30 && !/<html|<!doctype/i.test(text.slice(0, 500))) {
      result.hasLlmsTxt = true;
      llmsOk = true;
      result.llmsStatus = `已部署（${text.length} 字符${/^#\s/m.test(text) ? '，格式规范' : ''}）`;
    } else if (r.status === 200 && /<html|<!doctype/i.test(text.slice(0, 500))) {
      result.hasLlmsTxt = false;
      result.llmsStatus = '返回 HTML 网页（疑似首页重定向，非有效纯文本）';
    } else {
      result.hasLlmsTxt = false;
      result.llmsStatus = `未找到（HTTP ${r.status}）`;
    }
  } catch (e) {
    result.hasLlmsTxt = false;
    result.llmsStatus = `访问失败：${e.message}`;
  }

  // 3. robots.txt AI 爬虫放行状态巡检
  try {
    const robotsUrl = `${base}/robots.txt`;
    const r = await safeFetch(robotsUrl, { headers: { 'User-Agent': BOT_UA }, timeoutMs: 8000, maxBytes: 128 * 1024 });
    const parsed = parseRobots(r.text || '');
    const verifiedBots = AI_BOTS.filter(b => b.verified);
    const blocked = [];
    for (const b of verifiedBots) {
      const access = botAccess(parsed, b.name);
      if (!access.allowed) blocked.push(b.name);
    }
    result.blockedBots = blocked;
    if (blocked.length === 0) {
      robotsOk = true;
      result.robotsStatus = `全面放行（已验证 ${verifiedBots.length} 种主流 AI 爬虫均可正常访问）`;
    } else {
      const isSearchBlocked = blocked.some(n => ['OAI-SearchBot', 'PerplexityBot', 'Bingbot', 'Googlebot', 'Bytespider'].includes(n));
      result.robotsStatus = isSearchBlocked
        ? `存在关键拦截（${blocked.length} 个爬虫受限：${blocked.slice(0, 4).join(', ')}${blocked.length > 4 ? '等' : ''}）`
        : `部分训练爬虫拦截（${blocked.length} 个受限，核心搜索爬虫已放行）`;
      robotsOk = !isSearchBlocked;
    }
  } catch (e) {
    result.robotsStatus = `robots.txt 访问异常：${e.message}`;
  }

  // 4. 首页结构化数据 (JSON-LD) 巡检
  try {
    const r = await safeFetch(`${base}/`, { headers: { 'User-Agent': BOT_UA }, timeoutMs: 10000, maxBytes: 512 * 1024 });
    const html = r.text || '';
    const scriptMatches = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    const types = new Set();
    for (const m of scriptMatches) {
      try {
        const parsed = JSON.parse(m[1].trim());
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of arr) {
          if (item && item['@type']) {
            if (Array.isArray(item['@type'])) item['@type'].forEach(t => types.add(t));
            else types.add(item['@type']);
          }
        }
      } catch { /* 忽略非法 json */ }
    }
    result.schemaTypes = [...types];
    if (result.schemaTypes.length > 0) {
      schemaOk = true;
    }
  } catch (e) {
    // 首页请求失败忽略
  }

  // 计算健康评分 (0-100)
  let score = 0;
  if (sitemapOk) score += 25;
  if (robotsOk) score += 35; else if (result.blockedBots.length < 5) score += 15;
  if (llmsOk) score += 25;
  if (schemaOk) score += 15;
  result.health = score;

  // 5. 异常告警：比对上一次巡检记录，如果此前正常项变为异常，写入站内通知
  try {
    const prevLog = get('SELECT * FROM site_check_logs WHERE site_id = ? ORDER BY id DESC LIMIT 1', [site.id]);
    if (prevLog) {
      // llms.txt 从正常变为异常
      if (prevLog.has_llms_txt === 1 && !result.hasLlmsTxt) {
        addNotification(site.user_id, {
          type: 'site_alert',
          title: `【托管告警】${site.domain} 的 llms.txt 无法访问`,
          message: `此前正常的 llms.txt 当前状态为：${result.llmsStatus}。建议尽快排查以确保 AI 搜索正常检索官方事实。`,
          link: '#/monitor',
        });
      }
      // robots.txt 从完全放行变为新增拦截关键 AI 爬虫
      const prevBlocked = prevLog.robots_blocked_bots ? JSON.parse(prevLog.robots_blocked_bots) : [];
      const newBlocked = result.blockedBots.filter(b => !prevBlocked.includes(b));
      if (newBlocked.length > 0) {
        addNotification(site.user_id, {
          type: 'site_alert',
          title: `【托管告警】${site.domain} 的 robots.txt 新增拦截规则`,
          message: `检测到 robots.txt 新增拦截了 AI 爬虫：${newBlocked.join(', ')}。请确认是否为有意屏蔽。`,
          link: '#/monitor',
        });
      }
      // Sitemap 从正常变为抓取异常
      if (!prevLog.error && result.error) {
        addNotification(site.user_id, {
          type: 'site_alert',
          title: `【托管告警】${site.domain} 的 Sitemap 无法访问`,
          message: `Sitemap 抓取失败（${result.error}），新内容自动推送将受阻。`,
          link: '#/monitor',
        });
      }
    }
  } catch (alertErr) {
    console.error('[site alert check]', alertErr.message);
  }

  // 6. 存档本次巡检结果
  run(`INSERT INTO site_check_logs (site_id, user_id, url_count, new_urls_count, has_llms_txt, llms_status, robots_status, robots_blocked_bots, sitemap_status, schema_status, health_score, error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      site.id,
      site.user_id,
      result.urlCount,
      result.newUrls.length,
      result.hasLlmsTxt ? 1 : 0,
      result.llmsStatus,
      result.robotsStatus,
      JSON.stringify(result.blockedBots),
      result.sitemapStatus,
      JSON.stringify(result.schemaTypes),
      result.health,
      result.error,
    ]);

  // 更新 monitored_sites 概览字段
  run('UPDATE monitored_sites SET last_check_at = CURRENT_TIMESTAMP, last_error = ?, last_health_score = ?, has_llms_txt = ? WHERE id = ?',
    [result.error, result.health, result.hasLlmsTxt ? 1 : 0, site.id]);

  return result;
}

export function getSiteLogs(siteId, userId) {
  return query(`SELECT id, url_count, new_urls_count, has_llms_txt, llms_status, robots_status, robots_blocked_bots, sitemap_status, schema_status, health_score, error, created_at
                FROM site_check_logs WHERE site_id = ? AND user_id = ? ORDER BY id DESC LIMIT 15`, [siteId, userId]).map(row => ({
    id: row.id,
    urlCount: row.url_count,
    newUrlsCount: row.new_urls_count,
    hasLlmsTxt: !!row.has_llms_txt,
    llmsStatus: row.llms_status,
    robotsStatus: row.robots_status,
    blockedBots: row.robots_blocked_bots ? JSON.parse(row.robots_blocked_bots) : [],
    sitemapStatus: row.sitemap_status,
    schemaTypes: row.schema_status ? JSON.parse(row.schema_status) : [],
    healthScore: row.health_score,
    error: row.error,
    createdAt: row.created_at,
  }));
}

// 后台定时任务：付费套餐站点按 check_interval_hours 自动巡检
let running = false;
export function startScheduler() {
  if (!config.schedulerEnabled) return;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const due = query(`SELECT s.* FROM monitored_sites s JOIN users u ON s.user_id = u.id
        WHERE u.plan IN ('standard','enterprise') AND (u.disabled IS NULL OR u.disabled = 0)
          AND (s.last_check_at IS NULL OR datetime(s.last_check_at, '+' || COALESCE(s.check_interval_hours, 24) || ' hours') <= datetime('now'))
        ORDER BY s.last_check_at IS NOT NULL, s.last_check_at LIMIT 20`);
      for (const site of due) {
        const r = await checkSite(site);
        console.log(`[scheduler] ${site.domain}: score=${r.health}, urls=${r.urlCount}, llms=${r.hasLlmsTxt}${r.pushed ? `, pushed ${r.pushed.status}` : ''}${r.error ? `, error: ${r.error}` : ''}`);
      }
    } catch (e) {
      console.error('[scheduler]', e);
    } finally { running = false; }
  };
  setTimeout(tick, 30 * 1000).unref();
  setInterval(tick, 10 * 60 * 1000).unref();
}

export function getOwnedSite(id, userId) {
  const s = get('SELECT * FROM monitored_sites WHERE id = ? AND user_id = ?', [id, userId]);
  if (!s) throw new HttpError(404, '站点不存在');
  return s;
}
