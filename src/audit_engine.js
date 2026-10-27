// 网站 AI 可见度体检引擎（体检 / 竞品对比 / 托管巡检共用同一套评分，保证分数一致）
import * as cheerio from 'cheerio';
import { safeFetch, BROWSER_UA, BOT_UA, FetchError } from './net.js';
import { parseRobots, botAccess, mergeAiRules } from './robots.js';
import { AI_BOTS, aiRobotsBlock } from './bots.js';

const CJK = /[㐀-鿿豈-﫿]/g;

// 中英文混排的“字数”估算：中文按字计，英文按词计
export function countWords(text) {
  const cjk = (text.match(CJK) || []).length;
  const latin = text.replace(CJK, ' ').split(/\s+/).filter(w => /[a-z0-9]/i.test(w)).length;
  return cjk + latin;
}

// 统计型数据点：数字 + 单位/百分号/年份等（兼容中文，无需单词边界）
const STAT_RE = /(\d{1,3}(?:[,，]\d{3})+|\d+(?:\.\d+)?)\s?(%|％|‰|倍|万|亿|千|百|余|多|个|项|家|所|名|位|人|次|篇|条|款|元|美元|小时|分钟|秒|天|周|月|年|ms|kb|mb|gb|tb|x\b|times|percent|years?|months?|days?|hours?|minutes?|users?|customers?|million|billion|k\b)/gi;
const YEAR_RE = /(19|20)\d{2}\s?年/g;

const QUESTION_HEAD = /(\?|？)\s*$|^(how|why|what|when|where|which|who|can|does|is|are|should)\b|^(如何|怎么|怎样|为什么|为何|什么|哪|是否|能否|可以|多少|是不是)/i;

function collectJsonLd($) {
  const types = new Set();
  const blocks = [];
  let invalid = 0;
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(walk);
    const t = node['@type'];
    if (t) (Array.isArray(t) ? t : [t]).forEach(x => types.add(String(x)));
    for (const v of Object.values(node)) if (v && typeof v === 'object') walk(v);
  };
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    try { const j = JSON.parse(raw); blocks.push(j); walk(j); } catch { invalid++; }
  });
  $('[itemtype]').each((_, el) => {
    const t = String($(el).attr('itemtype') || '').split('/').pop();
    if (t) types.add(t);
  });
  return { types: [...types], blocks, invalid };
}

async function fetchText(url, ua = BOT_UA, timeoutMs = 8000) {
  try {
    const r = await safeFetch(url, { headers: { 'User-Agent': ua, Accept: 'text/plain,*/*;q=0.8' }, timeoutMs, maxBytes: 512 * 1024 });
    return r;
  } catch { return null; }
}

function looksLikeHtml(t) { return /<!doctype html|<html[\s>]|<head[\s>]|<body[\s>]/i.test(String(t).slice(0, 2000)); }

// 去除网页标题中重复出现的品牌名/标语（例如 GitHub · Change is constant... · GitHub · GitHub）
export function dedupeTitle(t) {
  if (!t) return '';
  const parts = String(t).split(/\s*[-_|·•｜—–]\s*/).map(p => p.trim()).filter(Boolean);
  if (parts.length <= 1) return String(t).trim();
  const seen = new Set();
  const deduped = [];
  for (const p of parts) {
    const key = p.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(p);
    }
  }
  return deduped.join(' · ');
}

function check(key, label, max, points, detail, fix, extra = {}) {
  return { key, label, max, points: Math.max(0, Math.min(max, Math.round(points))), pass: points >= max * 0.99, detail, fix: points >= max * 0.99 ? '' : fix, ...extra };
}

/**
 * 体检一个网址。light=true 时跳过生成代码等重型输出（用于竞品对比/托管巡检）
 */
export async function auditUrl(inputUrl, { light = false, locale = 'zh' } = {}) {
  const L = (zh, en) => (locale === 'en' ? en : zh);
  let page;
  try {
    page = await safeFetch(inputUrl, {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8', 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8' },
      timeoutMs: 15000,
    });
  } catch (e) {
    // https 失败时自动尝试 http（部分政企/高校站点仍未启用 HTTPS）
    if (inputUrl.startsWith('https://') && e instanceof FetchError && ['ETLS', 'EREFUSED', 'ENET'].includes(e.code)) {
      page = await safeFetch('http://' + inputUrl.slice(8), {
        headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html,*/*;q=0.8' }, timeoutMs: 12000,
      });
    } else throw e;
  }
  if (page.status >= 400) {
    const err = new FetchError(page.status >= 500
      ? L(`目标网站返回服务器错误（HTTP ${page.status}），请稍后重试`, `The site returned a server error (HTTP ${page.status}). Please try again later.`)
      : page.status === 403 ? L('目标网站拒绝了访问（HTTP 403），可能开启了防火墙/反爬策略——这同样会拦住 AI 爬虫', 'The site refused access (HTTP 403), likely due to a firewall or anti-bot rule — which blocks AI crawlers too.')
      : L(`目标网页无法访问（HTTP ${page.status}）`, `The page could not be loaded (HTTP ${page.status}).`), 'EHTTP');
    err.httpStatus = page.status;
    throw err;
  }
  const finalUrl = new URL(page.url);
  const origin = finalUrl.origin;
  const html = page.text || '';

  // 并行抓取 robots / llms.txt / sitemap
  const [robotsRes, llmsRes, llmsFullRes] = await Promise.all([
    fetchText(`${origin}/robots.txt`),
    fetchText(`${origin}/llms.txt`),
    fetchText(`${origin}/llms-full.txt`),
  ]);
  const robotsTxt = robotsRes && robotsRes.ok && !looksLikeHtml(robotsRes.text) ? robotsRes.text : '';
  const llmsOk = (r) => r && r.ok && r.text && r.text.trim().length > 30 && !looksLikeHtml(r.text);
  const hasLlmsTxt = llmsOk(llmsRes);
  const hasLlmsFull = llmsOk(llmsFullRes);
  const robots = parseRobots(robotsTxt);

  let sitemapUrl = robots.sitemaps[0] || `${origin}/sitemap.xml`;
  let hasSitemap = false;
  const sm = await fetchText(sitemapUrl, BOT_UA, 6000);
  if (sm && sm.ok && /<(urlset|sitemapindex)[\s>]/i.test(sm.text)) hasSitemap = true;

  // —— 解析页面 ——
  const $ = cheerio.load(html);
  const rawTitle = $('title').first().text().trim();
  const title = dedupeTitle(rawTitle);
  const metaDesc = ($('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '').trim();
  const lang = $('html').attr('lang') || '';
  const metaRobots = ($('meta[name="robots"]').attr('content') || '').toLowerCase();
  const xRobots = String(page.headers['x-robots-tag'] || '').toLowerCase();
  const noindex = /noindex/.test(metaRobots) || /noindex/.test(xRobots);
  const canonical = $('link[rel="canonical"]').attr('href') || '';
  const hreflangCount = $('link[hreflang]').length;
  const og = ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'].filter(p => $(`meta[property="${p}"]`).attr('content'));
  const hasAuthor = $('meta[name="author"], link[rel="author"], [itemprop="author"], [rel="author"], .author, .byline').length > 0;
  const hasDate = $('meta[property="article:published_time"], meta[property="article:modified_time"], time[datetime], [itemprop="datePublished"], [itemprop="dateModified"]').length > 0 || /"date(Published|Modified)"/.test(html);
  const h1 = $('h1').length, h2 = $('h2').length, h3 = $('h3').length;
  const ld = collectJsonLd($);
  const scripts = $('script').length;

  const questionHeads = [];
  $('h2, h3, h4, dt, summary').each((_, el) => {
    const t = $(el).text().trim().replace(/\s+/g, ' ');
    if (t.length >= 4 && t.length <= 120 && QUESTION_HEAD.test(t)) {
      let ans = '';
      const next = $(el).nextAll('p, div, dd').first();
      if (next.length) ans = next.text().trim().replace(/\s+/g, ' ').slice(0, 400);
      questionHeads.push({ q: t, a: ans });
    }
  });
  const tableCount = $('table').filter((_, t) => $(t).find('tr').length >= 2).length;
  const listCount = $('ul, ol').filter((_, l) => $(l).children('li').length >= 3 && $(l).closest('nav, header, footer').length === 0).length;
  const quoteCount = $('blockquote, q, cite').length;

  // 外链引用（引用权威来源）
  const outbound = new Set();
  const internalLinks = [];
  $('a[href]').each((_, a) => {
    const href = $(a).attr('href');
    try {
      const u = new URL(href, finalUrl);
      if (!/^https?:$/.test(u.protocol)) return;
      if (u.hostname !== finalUrl.hostname && !u.hostname.endsWith('.' + finalUrl.hostname.replace(/^www\./, ''))) {
        if ($(a).closest('nav, header, footer').length === 0) outbound.add(u.hostname);
      } else {
        const text = $(a).text().trim().replace(/\s+/g, ' ');
        if (text && text.length <= 40) internalLinks.push({ text, url: u.origin + u.pathname, nav: $(a).closest('nav, header').length > 0 });
      }
    } catch { /* 忽略非法链接 */ }
  });

  const outline = [];
  $('h1, h2, h3').each((_, el) => {
    const t = $(el).text().trim().replace(/\s+/g, ' ');
    if (t && outline.length < 14) outline.push({ level: Number(el.tagName.slice(1)), text: t.slice(0, 80) });
  });
  $('script, style, noscript, svg, template').remove();
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const wordCount = countWords(bodyText);
  const statCount = (bodyText.match(STAT_RE) || []).length + (bodyText.match(YEAR_RE) || []).length;
  const statDensity = statCount / Math.max(wordCount, 1) * 1000;
  const jsHeavy = wordCount < 120 && scripts >= 5;

  // —— AI 爬虫矩阵 ——
  const pagePath = finalUrl.pathname + finalUrl.search;
  const botStatus = AI_BOTS.map(b => {
    const acc = botAccess(robots, b.name, pagePath);
    let reason;
    if (acc.status === 'blocked') reason = acc.explicit ? L(`robots.txt 中对 ${b.name} 设置了 Disallow: /`, `robots.txt sets Disallow: / for ${b.name}`) : L('被通配规则 User-agent: * 全站禁止', 'Blocked site-wide by User-agent: *');
    else if (acc.status === 'page_blocked') reason = L('当前页面路径被 robots.txt 禁止', 'This page path is disallowed in robots.txt');
    else if (acc.status === 'partial') reason = L(`可访问，部分路径受限（${acc.disallowSample.join('，')}）`, `Allowed, some paths restricted (${acc.disallowSample.join(', ')})`);
    else reason = acc.explicit ? L(`robots.txt 明确放行 ${b.name}`, `Explicitly allowed in robots.txt`) : (robotsTxt ? L('按通配规则 User-agent: * 放行', 'Allowed by User-agent: *') : L('未发现 robots.txt，默认放行', 'No robots.txt — allowed by default'));
    return { name: b.name, company: locale === 'en' ? (b.vendorEn || b.vendor) : b.vendor, category: b.category, allowed: acc.allowed, status: acc.status, explicit: acc.explicit, reason };
  });
  const searchBots = botStatus.filter(b => b.category === 'search');
  const searchAllowed = searchBots.filter(b => b.allowed).length;
  const userBots = botStatus.filter(b => b.category === 'user');
  const userAllowed = userBots.filter(b => b.allowed).length;

  // ————————————————— 四维评分 —————————————————
  // 1. 技术可达性（20）
  const blockedNames = searchBots.filter(b => !b.allowed).map(b => b.name);
  const tech = [
    check('crawlable', L('AI 搜索爬虫可访问', 'AI search crawlers allowed'), 8, 8 * (searchAllowed / searchBots.length),
      L(`${searchAllowed}/${searchBots.length} 个 AI 搜索相关爬虫可访问本页`, `${searchAllowed}/${searchBots.length} AI search crawlers can access this page`),
      L(`robots.txt 拦截了 ${blockedNames.join('、')}。被拦截的爬虫无法读取页面，AI 搜索中就不会引用您。可使用下方生成的 robots.txt。`,
        `robots.txt blocks ${blockedNames.join(', ')}. Blocked crawlers can’t read the page, so AI search won’t cite you. Use the generated robots.txt below.`)),
    check('indexable', L('页面允许被索引', 'Page is indexable'), 4, noindex ? 0 : 4,
      noindex ? L('检测到 noindex 标记', 'noindex detected') : L('未发现 noindex 限制', 'No noindex restriction'),
      L('页面带有 noindex（meta robots 或 X-Robots-Tag），搜索引擎和 AI 搜索都会跳过它。除非有意隐藏，请移除 noindex。', 'The page carries noindex (meta robots or X-Robots-Tag), so search engines and AI search skip it. Remove it unless intentional.')),
    check('render', L('正文无需 JS 即可读取', 'Content readable without JS'), 4, jsHeavy ? 0 : 4,
      jsHeavy ? L(`服务端返回的正文仅约 ${wordCount} 字，内容疑似依赖 JavaScript 渲染`, `Server HTML has only ~${wordCount} words; content likely requires JavaScript`) : L(`服务端 HTML 中可直接读取约 ${wordCount} 字正文`, `~${wordCount} words readable in server HTML`),
      L('多数 AI 爬虫不执行 JavaScript。请对核心页面启用服务端渲染（SSR）或预渲染，保证 HTML 源码里就有正文。', 'Most AI crawlers don’t run JavaScript. Use server-side rendering or prerendering so key content is in the HTML.')),
    check('sitemap', L('Sitemap 可被发现', 'Sitemap discoverable'), 2, hasSitemap ? 2 : 0,
      hasSitemap ? L(`已找到 sitemap：${sitemapUrl}`, `Sitemap found: ${sitemapUrl}`) : L('未找到有效的 sitemap.xml', 'No valid sitemap.xml found'),
      L('提供 sitemap.xml 并在 robots.txt 中用 “Sitemap:” 声明，帮助爬虫发现全部页面。', 'Provide sitemap.xml and declare it in robots.txt with “Sitemap:” so crawlers find every page.')),
    check('llms', L('llms.txt（新兴规范）', 'llms.txt (emerging)'), 2, hasLlmsTxt ? 2 : 0,
      hasLlmsTxt ? L(`已部署 /llms.txt${hasLlmsFull ? ' 与 /llms-full.txt' : ''}`, `/llms.txt deployed${hasLlmsFull ? ' with /llms-full.txt' : ''}`) : L('未部署 /llms.txt', 'No /llms.txt'),
      L('llms.txt 是给大模型读的站点说明（新兴规范，部分 AI 工具已支持，主流搜索引擎尚未承诺使用）。成本很低，建议部署，下方已为您生成。', 'llms.txt is a site summary for LLMs (emerging; some AI tools read it, major search engines haven’t committed). It’s cheap to add — a draft is generated below.')),
  ];
  // 2. 内容可引用性（35）
  const citab = [
    check('depth', L('正文信息量', 'Content depth'), 7, wordCount >= 1500 ? 7 : wordCount >= 800 ? 5 : wordCount >= 300 ? 3 : 0,
      L(`正文约 ${wordCount} 字`, `~${wordCount} words`), L('正文过短，AI 很难从中提取可引用的完整答案。核心页面建议 800 字以上，把关键事实写清楚。', 'Too thin for AI to extract a complete answer. Aim for 800+ words on key pages with clear facts.')),
    check('stats', L('具体数据与事实', 'Specific data & facts'), 8, statDensity >= 8 ? 8 : statDensity >= 3 ? 5 : statCount > 0 ? 2 : 0,
      L(`检测到 ${statCount} 处数据/数字表述（每千字 ${statDensity.toFixed(1)} 处）`, `${statCount} data points (${statDensity.toFixed(1)} per 1,000 words)`),
      L('补充可核实的具体数据（规模、年份、指标、对比结果）。研究表明，含统计数据的内容在生成式引擎中更容易被引用。', 'Add verifiable specifics (scale, years, metrics, comparisons). Research shows statistics make content more likely to be cited by generative engines.')),
    check('structure', L('表格与列表', 'Tables & lists'), 7, Math.min(7, (tableCount >= 1 ? 4 : 0) + (listCount >= 2 ? 3 : listCount === 1 ? 1 : 0)),
      L(`${tableCount} 个数据表格、${listCount} 个正文列表`, `${tableCount} tables, ${listCount} content lists`),
      L('把参数、对比、步骤整理成表格或列表。结构化内容最容易被 AI 直接摘取为答案。', 'Put specs, comparisons and steps into tables or lists — the easiest format for AI to quote.')),
    check('qa', L('问答式标题', 'Question headings'), 7, questionHeads.length >= 4 ? 7 : questionHeads.length >= 2 ? 4 : questionHeads.length === 1 ? 2 : 0,
      L(`${questionHeads.length} 个问句式小标题`, `${questionHeads.length} question-style headings`),
      L('用用户会问 AI 的问题作小标题（如“XX 怎么收费？”），紧跟 1–2 句直接回答。', 'Use the questions people ask AI as headings (e.g. “How much does X cost?”), each followed by a 1–2 sentence answer.')),
    check('sources', L('引用外部来源', 'Cites sources'), 6, Math.min(6, outbound.size * 2 + (quoteCount > 0 ? 2 : 0)),
      L(`正文链接到 ${outbound.size} 个外部站点，${quoteCount} 处引用标记`, `Links to ${outbound.size} external sites, ${quoteCount} quote/cite marks`),
      L('为关键结论标注来源链接（官方文件、权威媒体、研究报告），可信度越高越容易被引用。', 'Link key claims to sources (official documents, reputable media, research). Credibility drives citation.')),
  ];
  // 3. 结构化数据（20）
  const tset = new Set(ld.types.map(t => t.toLowerCase()));
  const entityTypes = ['organization', 'corporation', 'localbusiness', 'educationalorganization', 'collegeoruniversity', 'governmentorganization', 'website', 'webapplication', 'softwareapplication', 'product', 'person', 'ngo'];
  const contentTypes = ['article', 'newsarticle', 'blogposting', 'faqpage', 'howto', 'qapage', 'product', 'service', 'event', 'course', 'breadcrumblist'];
  const schema = [
    check('entity_schema', L('实体定义 Schema', 'Entity schema'), 8, entityTypes.some(t => tset.has(t)) ? 8 : 0,
      ld.types.length ? L(`已识别类型：${ld.types.slice(0, 8).join(', ')}`, `Types found: ${ld.types.slice(0, 8).join(', ')}`) : L('未检测到 JSON-LD / Microdata', 'No JSON-LD / Microdata found'),
      L('添加 Organization / WebSite（或 EducationalOrganization 等）JSON-LD，明确“你是谁”，下方已生成可直接粘贴的代码。', 'Add Organization / WebSite (or EducationalOrganization etc.) JSON-LD to state who you are — ready-to-paste code is below.')),
    check('content_schema', L('内容类型 Schema', 'Content schema'), 8, contentTypes.some(t => tset.has(t)) ? 8 : 0,
      contentTypes.filter(t => tset.has(t)).join(', ') || L('未检测到 Article / FAQPage 等内容类型标记', 'No Article / FAQPage or similar markup'),
      L('为文章加 Article、为问答加 FAQPage、为产品加 Product 标记，帮助引擎理解页面内容。', 'Mark up articles with Article, Q&A with FAQPage and products with Product.')),
    check('schema_valid', L('Schema 语法有效', 'Valid schema syntax'), 4, ld.invalid === 0 && ld.blocks.length > 0 ? 4 : ld.blocks.length > 0 ? 2 : 0,
      ld.invalid ? L(`${ld.invalid} 段 JSON-LD 存在语法错误`, `${ld.invalid} JSON-LD block(s) have syntax errors`) : (ld.blocks.length ? L(`${ld.blocks.length} 段 JSON-LD 语法正确`, `${ld.blocks.length} valid JSON-LD block(s)`) : L('无 JSON-LD', 'No JSON-LD')),
      ld.invalid ? L('修复 JSON-LD 语法错误（可用 Google 富媒体搜索结果测试工具校验）。', 'Fix JSON-LD syntax errors (validate with Google’s Rich Results Test).') : L('添加至少一段 JSON-LD。', 'Add at least one JSON-LD block.')),
  ];
  // 4. 实体与信任信号（25）
  const titleOk = title.length >= 8 && title.length <= 70;
  const https = finalUrl.protocol === 'https:';
  const entity = [
    check('title', L('标题清晰', 'Clear title'), 4, titleOk ? 4 : title ? 2 : 0, title ? L(`标题 ${title.length} 字：${title.slice(0, 40)}`, `${title.length} chars: ${title.slice(0, 40)}`) : L('缺少 <title>', 'Missing <title>'),
      L('标题建议 8–70 字，包含品牌名和核心业务。', 'Keep titles 8–70 characters, including your brand and core offering.')),
    check('description', L('Meta 描述', 'Meta description'), 4, metaDesc.length >= 30 ? 4 : metaDesc ? 2 : 0, metaDesc ? L(`描述 ${metaDesc.length} 字`, `${metaDesc.length} chars`) : L('缺少 meta description', 'Missing meta description'),
      L('写一段 30–160 字的描述，用一句话说清“是什么、为谁、有什么不同”。', 'Write 30–160 characters saying what it is, who it’s for and what’s different.')),
    check('author', L('作者/机构署名', 'Author / publisher'), 5, hasAuthor ? 5 : 0, hasAuthor ? L('检测到作者或署名信息', 'Author information found') : L('未检测到作者/署名', 'No author information'),
      L('为内容标注作者或发布机构（meta author 或页面署名），这是可信度的重要信号。', 'Name the author or publishing organization (meta author or a byline) — a key trust signal.')),
    check('freshness', L('发布/更新日期', 'Published / updated date'), 4, hasDate ? 4 : 0, hasDate ? L('检测到日期标记', 'Date markup found') : L('未检测到发布或更新时间', 'No publish or update date'),
      L('标注发布与更新日期（<time datetime> 或 Schema 中的 datePublished/dateModified），AI 更偏好时效明确的内容。', 'Mark publish/update dates (<time datetime> or datePublished/dateModified); AI prefers clearly dated content.')),
    check('og', L('社交分享元数据', 'Social metadata'), 4, Math.round(og.length / 5 * 4), `Open Graph ${og.length}/5`,
      L('补全 og:title / og:description / og:image / og:url / og:type。', 'Complete og:title / og:description / og:image / og:url / og:type.')),
    check('canonical', L('规范网址与 HTTPS', 'Canonical & HTTPS'), 4, (canonical ? 2 : 0) + (https ? 2 : 0),
      L(`${canonical ? '有 canonical' : '无 canonical'}，${https ? '已启用 HTTPS' : '未启用 HTTPS'}`, `${canonical ? 'canonical present' : 'no canonical'}, ${https ? 'HTTPS on' : 'no HTTPS'}`),
      `${canonical ? '' : L('添加 <link rel="canonical">，避免重复页面分散权重。', 'Add <link rel="canonical"> to consolidate duplicates. ')}${https ? '' : L('启用 HTTPS。', 'Enable HTTPS.')}`),
  ];

  const sum = (arr) => arr.reduce((s, c) => s + c.points, 0);
  const vectors = [
    { vector: 'technical', label: L('技术可达性', 'Reachability'), points: sum(tech), max: 20, checks: tech },
    { vector: 'citability', label: L('内容可引用性', 'Citability'), points: sum(citab), max: 35, checks: citab },
    { vector: 'schema', label: L('结构化数据', 'Structured data'), points: sum(schema), max: 20, checks: schema },
    { vector: 'entity', label: L('实体与信任信号', 'Entity & trust'), points: sum(entity), max: 25, checks: entity },
  ];
  const score = vectors.reduce((s, v) => s + v.points, 0);

  // 优先整改项：按丢分多少排序
  const priorities = vectors.flatMap(v => v.checks.map(c => ({ ...c, vector: v.label, lost: c.max - c.points })))
    .filter(c => c.lost > 0)
    .sort((a, b) => b.lost - a.lost)
    .slice(0, 5)
    .map(({ key, label, vector, lost, fix, detail }) => ({ key, label, vector, lost, fix, detail }));

  // 兼容报告生成器的旧字段
  const breakdown = vectors.map(v => ({
    item: v.label,
    points: v.points,
    max: v.max,
    passed: v.points >= v.max * 0.75,
    tip: v.checks.filter(c => !c.pass).map(c => c.fix).filter(Boolean).slice(0, 2).join(' ') || L('该维度表现良好。', 'This dimension looks good.'),
  }));

  const result = {
    url: page.url,
    origin,
    title,
    metaDesc,
    lang,
    score,
    grade: gradeOf(score, locale),
    locale,
    vectors,
    breakdown,
    priorities,
    botStatus,
    wildcardDisallows: robots.groups.filter(g => g.agents.includes('*')).flatMap(g => g.rules).filter(r => r.type === 'disallow' && r.path).map(r => r.path).slice(0, 8),
    hasLlmsTxt,
    hasSitemap,
    sitemapUrl: hasSitemap ? sitemapUrl : null,
    jsonLdTypes: ld.types,
    stats: { wordCount, statCount, tableCount, listCount, questionCount: questionHeads.length, outboundCount: outbound.size, h1Count: h1, h2Count: h2, h3Count: h3, responseMs: page.ms, httpStatus: page.status, redirects: page.redirects },
    aiView: { textPreview: bodyText.slice(0, 480), outline },
    auditedAt: new Date().toISOString(),
  };
  if (light) return result;

  result.generated = generateArtifacts({ locale, origin, finalUrl, title, metaDesc, lang, og: $, internalLinks, questionHeads, robotsTxt, ldTypes: ld.types });
  return result;
}

export function gradeOf(score, locale = 'zh') {
  const en = locale === 'en';
  if (score >= 85) return { key: 'excellent', label: en ? 'Excellent' : '优秀', desc: en ? 'Very friendly to AI crawlers and generative engines' : '对 AI 爬虫和生成式引擎非常友好' };
  if (score >= 70) return { key: 'good', label: en ? 'Good' : '良好', desc: en ? 'Solid foundation — fix a few gaps' : '基础扎实，补齐少数短板即可' };
  if (score >= 50) return { key: 'fair', label: en ? 'Fair' : '一般', desc: en ? 'Clear gaps; AI citation is less likely' : '存在明显短板，AI 引用概率偏低' };
  return { key: 'poor', label: en ? 'Poor' : '较差', desc: en ? 'Key elements missing; AI will struggle to understand and cite you' : '多项关键要素缺失，AI 很难准确理解和引用' };
}

function generateArtifacts({ locale = 'zh', origin, finalUrl, title, metaDesc, lang, og: $, internalLinks, questionHeads, robotsTxt, ldTypes }) {
  const siteName = ($('meta[property="og:site_name"]').attr('content') || title.split(/\s*[-_|｜—–]\s*/)[0] || finalUrl.hostname).trim();
  const L = (zh, en) => (locale === 'en' ? en : zh);
  const desc = metaDesc || L(`${siteName} 官方网站`, `Official website of ${siteName}`);
  const image = $('meta[property="og:image"]').attr('content');
  const text = `${title} ${metaDesc}`;
  const isTool = /tool|app|converter|generator|calculator|工具|生成器|转换|计算器|在线/i.test(text);
  const isEdu = /大学|学院|学校|university|college|school|\.edu/i.test(text + finalUrl.hostname);

  // llms.txt（遵循 llmstxt.org 格式）
  const seen = new Set();
  const links = internalLinks
    .filter(l => { const k = l.url; if (seen.has(k) || k === origin + '/') return false; seen.add(k); return true; })
    .sort((a, b) => Number(b.nav) - Number(a.nav))
    .slice(0, 20);
  const llms = [
    `# ${siteName}`,
    '',
    `> ${desc}`,
    '',
    L('<!-- 请用 3~5 句话补充：机构/产品是什么、服务对象、核心事实（成立时间、规模、资质等可核实信息）。只写真实、可查证的内容。 -->',
      '<!-- Add 3–5 sentences: what the organization/product is, who it serves, and key verifiable facts (founding year, scale, credentials). Only include true, checkable information. -->'),
    '',
    L('## 主要页面', '## Key pages'),
    ...(links.length ? links.map(l => `- [${l.text}](${l.url})`) : [`- [${L('首页', 'Home')}](${origin}/)`]),
    '',
    L('## 官方信息', '## Official information'),
    `- ${L('官方网站：', 'Website: ')}${origin}/`,
    ...(lang ? [`- ${L('主要语言：', 'Language: ')}${lang}`] : []),
    '',
  ].join('\n');

  // JSON-LD（用 JSON.stringify 生成，避免引号/换行导致语法错误）
  const orgType = isEdu ? 'CollegeOrUniversity' : 'Organization';
  const graph = [
    { '@type': orgType, '@id': `${origin}/#organization`, name: siteName, url: `${origin}/`, description: desc, ...(image ? { logo: new URL(image, origin).toString() } : {}), sameAs: [] },
    { '@type': 'WebSite', '@id': `${origin}/#website`, url: `${origin}/`, name: siteName, publisher: { '@id': `${origin}/#organization` }, ...(lang ? { inLanguage: lang } : {}) },
  ];
  if (isTool) graph.push({ '@type': 'WebApplication', name: title || siteName, url: finalUrl.toString(), applicationCategory: 'UtilitiesApplication', operatingSystem: 'Any', offers: { '@type': 'Offer', price: '0', priceCurrency: locale === 'en' ? 'USD' : 'CNY' } });
  const schema = `<script type="application/ld+json">\n${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2)}\n</script>`;

  // FAQPage（从页面中已有的问句标题抽取，答案取其后首段）
  const faqItems = questionHeads.filter(q => q.a && q.a.length >= 10).slice(0, 10);
  const faqSchema = faqItems.length && !ldTypes.map(t => t.toLowerCase()).includes('faqpage')
    ? `<script type="application/ld+json">\n${JSON.stringify({
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: faqItems.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    }, null, 2)}\n</script>`
    : '';

  return {
    llmsTxt: llms,
    schema,
    faqSchema,
    robots: mergeAiRules(robotsTxt, aiRobotsBlock({ allowTraining: true, locale }), origin, locale),
    robotsPrivacy: mergeAiRules(robotsTxt, aiRobotsBlock({ allowTraining: false, locale }), origin, locale),
    robotsHadExisting: !!robotsTxt,
  };
}
