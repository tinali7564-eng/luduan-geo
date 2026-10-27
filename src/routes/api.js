import express from 'express';
import crypto from 'crypto';
import { config } from '../config.js';
import { ah, bad, HttpError, rateLimit, str, normalizeDomain, escapeHtml } from '../http.js';
import { optionalAuth, requireAuth, withQuota, logScan } from '../auth.js';
import { auditUrl } from '../audit_engine.js';
import { normalizeInputUrl, safeFetch, BOT_UA, FetchError } from '../net.js';
import { brandAudit } from '../brand.js';
import { getSampleReport } from '../sample_report.js';
import { analyzeContent, rewriteContent } from '../content.js';
import { buildCapsule, simulate, runExperiment, listExperiments, getExperiment } from '../lab.js';
import { createRun, getRun, listRuns, getAudit, getRiskTrends } from '../risk.js';
import { clarificationPreview } from '../remediation.js';
import { generateReport } from '../report.js';
import { assertLlm, listEngines, mapLimit } from '../llm.js';
import { newIndexNowKey, verifyKey, checkSite, pushIndexNow, siteView, getOwnedSite, getSiteLogs } from '../sites.js';
import { PLANS, planSiteLimit, planQuota, checkPlanFeature, ADDON_PACKS } from '../plans.js';
import { get, query, run, getUnreadNotificationsCount, listNotifications, markNotificationRead, markAllNotificationsRead, getMonthlyUsage, incMonthlyUsage } from '../db.js';
import { listRedVAccounts, listActionCards, generateActionCard, listPublishTasks, createPublishTask, updatePublishTask, verifyPublishTask,
         buildWeaknessCards, saveWeaknessCards, markCardPublished, unmarkCardPublished, getPublishedCardsForRetest, probeWeaknessRetest } from '../redv.js';
import { getEngine } from '../llm.js';

const r = express.Router();
r.use(optionalAuth);

const newId = () => crypto.randomBytes(12).toString('base64url');
function saveResult(req, kind, target, score, data, id = newId()) {
  run('INSERT INTO audit_results (id, user_id, kind, target, score, data_json) VALUES (?, ?, ?, ?, ?, ?)',
    [id, req.user?.id || 0, kind, String(target).slice(0, 300), Number.isFinite(score) ? score : null, JSON.stringify(data)]);
  return id;
}
const quotaOut = (req) => req.quota ? { remaining: req.quota.remaining, limit: req.quota.limit } : undefined;

function friendlyFetchError(e) {
  if (e instanceof FetchError) return new HttpError(400, e.message, e.code);
  return e;
}

// ———————— 站内通知中心 ————————
r.get('/notifications', requireAuth, (req, res) => {
  res.json({
    success: true,
    data: {
      unreadCount: getUnreadNotificationsCount(req.user.id),
      list: listNotifications(req.user.id, 30),
    },
  });
});
r.post('/notifications/:id/read', requireAuth, ah(async (req, res) => {
  markNotificationRead(parseInt(req.params.id, 10), req.user.id);
  res.json({ success: true });
}));
r.post('/notifications/read-all', requireAuth, ah(async (req, res) => {
  markAllNotificationsRead(req.user.id);
  res.json({ success: true });
}));

// ———————— 网站体检 ————————
r.post('/audit', rateLimit({ windowMs: 60000, max: 10 }), withQuota(1), ah(async (req, res) => {
  const url = normalizeInputUrl(req.body?.url);
  if (!url) throw bad('请输入正确的网址，例如 https://example.com');
  let data;
  try { data = await auditUrl(url, { locale: req.locale }); } catch (e) { throw friendlyFetchError(e); }
  const id = saveResult(req, 'url', data.url, data.score, data);
  logScan(req, 'URL_AUDIT', data.url, data.score, data.title);
  res.json({ success: true, id, data, quota: quotaOut(req) });
}));

// ———————— 竞品对比 ————————
r.post('/compare', rateLimit({ windowMs: 60000, max: 5 }),
  withQuota((req) => 1 + Math.min(4, (req.body?.competitors || []).filter(Boolean).length)),
  ah(async (req, res) => {
    const main = normalizeInputUrl(req.body?.url);
    const comps = (Array.isArray(req.body?.competitors) ? req.body.competitors : []).map(normalizeInputUrl).filter(Boolean).slice(0, 4);
    if (!main) throw bad('请输入您的网址');
    if (!comps.length) throw bad('请至少输入 1 个竞品网址');
    const list = [main, ...comps];
    const results = await mapLimit(list, 3, (u) => auditUrl(u, { light: true, locale: req.locale }));
    const rows = results.map((x, i) => {
      if (!x.ok) return { url: list[i], error: x.error.message };
      const v = x.value;
      const tech = (v.vectors || []).find(vec => vec.vector === 'technical') || { points: 0, max: 20 };
      const citab = (v.vectors || []).find(vec => vec.vector === 'citability') || { points: 0, max: 35 };
      const entity = (v.vectors || []).find(vec => vec.vector === 'entity') || { points: 0, max: 25 };
      const visibility = Math.round(((tech.points + entity.points) / (tech.max + entity.max)) * 100);
      const sentiment = Math.min(100, Math.round(50 + (entity.points / entity.max) * 45));
      const citation = Math.round((citab.points / citab.max) * 100);
      return {
        url: v.url,
        title: v.title,
        score: v.score,
        metrics: { score: v.score, visibility, sentiment, citation },
        vectors: v.vectors.map(vec => ({ vector: vec.vector, label: vec.label, points: vec.points, max: vec.max })),
        hasLlmsTxt: v.hasLlmsTxt,
        jsonLdTypes: v.jsonLdTypes.slice(0, 6)
      };
    });
    const yours = rows[0];
    const gaps = [];
    if (!yours.error) {
      for (const c of rows.slice(1).filter(c => !c.error)) {
        for (const v of c.vectors) {
          const mine = yours.vectors.find(x => x.vector === v.vector);
          if (mine && v.points - mine.points >= 3) gaps.push({ competitor: c.title || c.url, label: v.label, theirs: v.points, yours: mine.points, max: v.max });
        }
      }
    }
    gaps.sort((a, b) => (b.theirs - b.yours) - (a.theirs - a.yours));
    logScan(req, 'COMPARE', main, yours.score, `vs ${comps.length}`);
    res.json({ success: true, data: { yours, competitors: rows.slice(1), gaps: gaps.slice(0, 8) }, quota: quotaOut(req) });
  }));

// ———————— 内容可引用性检查 ————————
r.post('/content/check', rateLimit({ windowMs: 60000, max: 30 }), ah(async (req, res) => {
  const text = str(req.body?.text, 20000);
  if (text.length < 50) throw bad('请粘贴至少 50 字的正文');
  res.json({ success: true, data: analyzeContent(text, req.locale) });
}));
r.post('/content/rewrite', rateLimit({ windowMs: 60000, max: 5 }), withQuota(1), ah(async (req, res) => {
  assertLlm();
  const text = str(req.body?.text, 8000);
  if (text.length < 50) throw bad('请粘贴至少 50 字的正文');
  const out = await rewriteContent(text, { brand: str(req.body?.brand, 60), engineId: str(req.body?.engine, 40), locale: req.locale });
  res.json({ success: true, data: { ...out, after: analyzeContent(out.text, req.locale) }, quota: quotaOut(req) });
}));

// ———————— 品牌 AI 认知诊断 ————————
r.post('/brand-audit', rateLimit({ windowMs: 60000, max: 6 }), withQuota(1), ah(async (req, res) => {
  assertLlm();
  const rawKeyword = String(req.body?.keyword || '').trim();
  if (rawKeyword.length < 2) throw bad('请输入品牌或机构名称');
  if (rawKeyword.length > 60) throw bad('品牌名称已达 60 字上限，请精简后重试');
  const keyword = rawKeyword;
  const data = await brandAudit(keyword, { context: str(req.body?.context, 300), engineId: str(req.body?.engine, 40), locale: req.locale });
  const id = newId();

  // —— 内容行动卡：审计弱点自动成卡（确定性模板，不额外调用 LLM）——
  const weaknessCards = buildWeaknessCards({
    brandName: data.brand,
    questions: data.typical_questions,
    citationDomains: data.citation_domains,
    locale: req.locale,
  });
  let embeddedCards = weaknessCards.map((c) => ({ ...c, id: null, publishStatus: 'unpublished', publishChannel: null, publishedAt: null }));
  if (req.user && weaknessCards.length) {
    try {
      const saved = saveWeaknessCards({ userId: req.user.id, brandName: data.brand, cards: weaknessCards, auditResultId: id });
      embeddedCards = saved.map((c) => ({
        id: c.id, questionKey: c.questionKey, targetQuestion: c.targetQuestion,
        weaknessReason: c.weaknessReason, title: c.title, outline: c.outline,
        suggestedChannels: c.suggestedChannels,
        publishStatus: 'unpublished', publishChannel: null, publishedAt: null,
      }));
    } catch (e) { console.warn('[weakness cards save]', e.message); }
  }
  data.action_cards = embeddedCards;

  // —— 下次审计自动重测：已标记“在小红书发布”的弱点，用真实模型重测引用变化 ——
  if (req.user) {
    try {
      const published = getPublishedCardsForRetest(req.user.id, data.brand, 3);
      if (published.length) {
        const engine = getEngine(str(req.body?.engine, 40));
        const retests = [];
        for (const card of published) {
          try {
            retests.push(await probeWeaknessRetest({
              engine, brand: data.brand, domain: card.domain, question: card.targetQuestion,
              baseline: card.baseline, cardId: card.id, title: card.title,
              publishChannel: card.publishChannel, publishedAt: card.publishedAt, locale: req.locale,
            }));
          } catch (e) { console.warn('[retest probe] card', card.id, e.message); }
        }
        if (retests.length) data.publish_retests = retests;
      }
    } catch (e) { console.warn('[retest]', e.message); }
  }

  saveResult(req, 'brand', data.brand, data.score, data, id);
  logScan(req, 'BRAND_AUDIT', keyword, data.score, data.summary);
  res.json({ success: true, id, data, quota: quotaOut(req) });
}));

// ———————— 历史记录 ————————
r.get('/history', ah(async (req, res) => {
  if (req.user) {
    const rows = query('SELECT id, kind, target, score, created_at FROM audit_results WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', [req.user.id]);
    return res.json({ success: true, data: rows });
  }
  const idsStr = String(req.query?.ids || '').trim();
  if (!idsStr) return res.json({ success: true, data: [] });
  const ids = idsStr.split(',').map(s => s.trim()).filter(Boolean).slice(0, 50);
  if (!ids.length) return res.json({ success: true, data: [] });
  const placeholders = ids.map(() => '?').join(',');
  const rows = query(`SELECT id, kind, target, score, created_at FROM audit_results WHERE id IN (${placeholders}) ORDER BY created_at DESC LIMIT 50`, ids);
  res.json({ success: true, data: rows });
}));

// ———————— 结果回看与报告导出 ————————
function loadResult(req) {
  const id = String(req.params.id);
  if (id === 'sample-deepseek' || id === 'sample-brand' || id === 'demo-deepseek') {
    const locale = req.query?.locale === 'en' ? 'en' : req.locale || 'zh';
    return {
      id,
      kind: 'brand',
      user_id: 0,
      data_json: JSON.stringify(getSampleReport(locale)),
      created_at: '2026-10-08 03:07:28',
    };
  }
  const row = get('SELECT * FROM audit_results WHERE id = ?', [id]);
  if (!row) throw new HttpError(404, '结果不存在或已过期，请重新体检');
  if (row.user_id && (!req.user || (req.user.id !== row.user_id && req.user.role !== 'admin'))) throw new HttpError(404, '结果不存在或已过期');
  return row;
}

r.get('/results/sample', (req, res) => {
  const locale = req.query?.locale === 'en' ? 'en' : req.locale || 'zh';
  res.json({ success: true, id: 'sample-deepseek', kind: 'brand', isSample: true, data: getSampleReport(locale) });
});

r.get('/results/:id', ah(async (req, res) => {
  const row = loadResult(req);
  res.json({ success: true, id: row.id, kind: row.kind, data: JSON.parse(row.data_json), createdAt: row.created_at });
}));

// Word 报告导出（带按月额度与按次核查）
r.get('/results/:id/report.docx', rateLimit({ windowMs: 60000, max: 10 }), ah(async (req, res) => {
  const row = loadResult(req);
  const locale = req.query.locale === 'en' ? 'en' : req.query.locale === 'zh' ? 'zh' : req.locale;

  // 权益校验：已登录用户核查月度导出限额
  if (req.user) {
    checkPlanFeature(req.user, 'word_export', { locale });
  }

  const data = JSON.parse(row.data_json);
  const buf = await generateReport(data, row.kind, locale);

  if (req.user) {
    incMonthlyUsage(req.user.id, 'word_export', 1);
  }

  const base = (row.kind === 'url' ? (data.title || data.origin) : data.brand) || 'report';
  const name = `${locale === 'en' ? 'GEO_Report_' : 'GEO评估报告_'}${base.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40)}.docx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="report.docx"; filename*=UTF-8''${encodeURIComponent(name)}`);
  res.send(buf);
}));

// ———————— llms.txt 部署检测 ————————
r.post('/tools/check-llms', rateLimit({ windowMs: 60000, max: 10 }), ah(async (req, res) => {
  const domain = normalizeDomain(req.body?.domain);
  if (!domain) throw bad('请输入正确的域名');
  const url = `https://${domain}/llms.txt`;
  let deployed = false; let message; let preview = null;
  try {
    const x = await safeFetch(url, { headers: { 'User-Agent': BOT_UA }, timeoutMs: 8000, maxBytes: 256 * 1024 });
    const t = x.text || '';
    if (x.status !== 200) message = `未找到 ${url}（HTTP ${x.status}）`;
    else if (/<html|<!doctype/i.test(t.slice(0, 500))) message = '返回的是网页 HTML 而不是纯文本，常见原因是站点把所有路径都重定向到了首页';
    else if (t.trim().length < 30) message = '文件内容过短';
    else { deployed = true; preview = t.slice(0, 600); message = `已检测到 ${url}${/^#\s/m.test(t) ? '，格式符合 llms.txt 规范（以 # 标题开头）' : '，建议以“# 站点名称”开头'}`; }
  } catch (e) { message = `无法访问 ${url}：${e.message}`; }
  res.json({ success: true, data: { deployed, message, preview, url } });
}));

// ———————— 首推实验室 ————————
r.post('/lab/capsule', rateLimit({ windowMs: 60000, max: 20 }), ah(async (req, res) => {
  const cap = buildCapsule(req.body || {}, req.locale);
  if (req.user) {
    run('INSERT INTO top1_simulations (user_id, brand_name, domain, target_keyword, capsule_markdown, prompts_json) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, cap.brand, cap.domain, cap.keyword || '', cap.capsule, JSON.stringify(cap.questions)]);
  }
  res.json({ success: true, data: cap });
}));

r.post('/lab/simulate', rateLimit({ windowMs: 60000, max: 8 }), withQuota(1), ah(async (req, res) => {
  assertLlm();
  const b = req.body || {};
  const out = await simulate({
    question: str(b.question, 300), capsule: str(b.capsule, 8000), brand: str(b.brand, 60),
    domain: normalizeDomain(b.domain) || str(b.domain, 120), competitors: Array.isArray(b.competitors) ? b.competitors.map(c => str(c, 60)) : [],
    engineId: str(b.engine, 40), locale: req.locale,
  });
  logScan(req, 'LAB_SIMULATE', b.brand || '', out.after?.analysis?.mentioned ? 1 : 0, out.question);
  res.json({ success: true, data: out, quota: quotaOut(req) });
}));

// Wave 2 真实模型 A/B 对比实验接口
r.post('/lab/experiment', requireAuth, rateLimit({ windowMs: 60000, max: 5 }), ah(async (req, res) => {
  assertLlm();
  const b = req.body || {};
  const out = await runExperiment({
    user: req.user,
    brand: str(b.brand, 60),
    domain: normalizeDomain(b.domain) || str(b.domain, 120),
    competitors: Array.isArray(b.competitors) ? b.competitors.map(c => str(c, 60)) : (typeof b.competitors === 'string' ? b.competitors.split(/[,，\s]+/).filter(Boolean).map(c => str(c, 60)) : []),
    versionA: str(b.versionA || b.textA, 8000),
    versionB: str(b.versionB || b.textB, 8000),
    questions: Array.isArray(b.questions) ? b.questions : (typeof b.questions === 'string' ? b.questions.split(/\n+/) : []),
    engineIds: Array.isArray(b.engines) ? b.engines : [],
    rounds: parseInt(b.rounds, 10) || 3,
    locale: req.locale,
  });
  res.json({ success: true, data: out });
}));

r.get('/lab/experiments', requireAuth, ah(async (req, res) => {
  res.json({ success: true, data: listExperiments(req.user.id) });
}));
r.get('/lab/experiments/:id', requireAuth, ah(async (req, res) => {
  res.json({ success: true, data: getExperiment(parseInt(req.params.id, 10), req.user.id) });
}));

// 临时预览链接：把语料托管 7 天，方便在联网 AI（如 ChatGPT 浏览模式）中实测“AI 读到这份资料后怎么回答”
r.post('/lab/share', requireAuth, rateLimit({ windowMs: 60 * 60 * 1000, max: 20 }), ah(async (req, res) => {
  const b = req.body || {};
  const brand = str(b.brand, 60); const capsule = str(b.capsule, 8000); const domain = normalizeDomain(b.domain);
  if (!brand || !capsule || !domain) throw bad('请先生成语料');
  const token = 'src_' + crypto.randomBytes(9).toString('hex');
  run(`INSERT INTO ephemeral_grounding_sources (token, brand_name, domain, target_keyword, question, entity_type, content_markdown, schema_json, user_id, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [token, brand, domain, str(b.keyword, 80), '', 'capsule', capsule, null, req.user.id, Date.now() + 7 * 86400000]);
  res.json({ success: true, data: { url: `${config.publicUrl}/s/${token}`, expiresInDays: 7 } });
}));

// ———————— AI 舆情认知监测 ————————
r.post('/risk/runs', requireAuth, rateLimit({ windowMs: 60 * 60 * 1000, max: 10, key: 'user' }),
  withQuota((req) => Math.max(1, Math.min(6, (req.body?.engines || []).length || 1)) * 2),
  ah(async (req, res) => {
    assertLlm();
    const b = req.body || {};
    const subject = str(b.subject, 60);
    if (subject.length < 2) throw bad('请输入监测主体名称');
    const available = listEngines().map(e => e.id);
    let engineIds = (Array.isArray(b.engines) ? b.engines : []).map(String).filter(id => available.includes(id)).slice(0, 6);
    if (!engineIds.length) engineIds = available.slice(0, 3);
    const industry = ['education', 'healthcare', 'government', 'tech', 'general'].includes(b.industry) ? b.industry
      : /大学|学院|学校/.test(subject) ? 'education' : /医院|医疗|药/.test(subject) ? 'healthcare' : 'general';
    const out = createRun({
      user: req.user,
      userId: req.user.id, subject, domain: normalizeDomain(b.domain), claim: str(b.claim, 120),
      officialStatement: str(b.officialStatement, 1000), riskLevel: ['low', 'medium', 'high'].includes(b.riskLevel) ? b.riskLevel : 'medium',
      industry, engineIds, locale: req.locale,
    });
    logScan(req, 'RISK_RUN', subject, null, b.claim || '');
    res.json({ success: true, data: out, quota: quotaOut(req) });
  }));
r.get('/risk/runs', requireAuth, (req, res) => res.json({ success: true, data: listRuns(req.user.id) }));
r.get('/risk/runs/:id', requireAuth, (req, res) => {
  const data = getRun(parseInt(req.params.id, 10), req.user.id, req.locale);
  if (!data) return res.status(404).json({ success: false, error: '任务不存在' });
  res.json({ success: true, data });
});
r.get('/risk/audits/:id', requireAuth, (req, res) => {
  const data = getAudit(parseInt(req.params.id, 10), req.user.id, req.locale);
  if (!data) return res.status(404).json({ success: false, error: '记录不存在' });
  res.json({ success: true, data });
});
r.get('/risk/trends', requireAuth, (req, res) => {
  res.json({ success: true, data: getRiskTrends(req.user.id, req.query?.subject ? str(req.query.subject, 60) : null) });
});

// ———————— 争议澄清 ————————
r.post('/remediation/preview', requireAuth, rateLimit({ windowMs: 60000, max: 5, key: 'user' }), withQuota(1), ah(async (req, res) => {
  assertLlm();
  const b = req.body || {};
  const out = await clarificationPreview({ subject: b.subject, claim: b.claim, statement: b.statement, officialUrl: b.officialUrl, engineId: str(b.engine, 40), locale: req.locale });
  res.json({ success: true, data: out, quota: quotaOut(req) });
}));
r.post('/remediation/lead', rateLimit({ windowMs: 60 * 60 * 1000, max: 5, message: '提交过于频繁，请稍后再试' }), ah(async (req, res) => {
  const b = req.body || {};
  const clientName = str(b.clientName, 60); const contact = str(b.contactInfo, 120);
  const subject = str(b.subjectName, 80); const issue = str(b.negativeIssue, 2000);
  if (!clientName || !contact || !subject || !issue) throw bad('请完整填写称呼、联系方式、主体名称和需求描述');
  const x = run(`INSERT INTO custom_remediation_requests (user_id, client_name, contact_info, subject_name, domain, negative_issue, target_engines, expected_effect, budget_tier, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
  [req.user?.id || 0, clientName, contact, subject, normalizeDomain(b.domain) || '', issue, str(b.targetEngines, 200), str(b.expectedEffect, 500), ['standard', 'enterprise', 'retain'].includes(b.budgetTier) ? b.budgetTier : 'standard']);
  console.log(`[lead] #${x.lastID} ${clientName} / ${subject}`);
  res.json({ success: true, requestId: x.lastID, message: '已收到您的需求，我们会在 1 个工作日内通过您留下的联系方式与您沟通。' });
}));

// ———————— 站点托管 ————————
r.get('/sites', requireAuth, (req, res) => {
  const sites = query('SELECT * FROM monitored_sites WHERE user_id = ? ORDER BY id DESC', [req.user.id]);
  res.json({ success: true, data: sites.map(siteView), limit: planSiteLimit(req.user.plan), plan: req.user.plan });
});
r.post('/sites', requireAuth, rateLimit({ windowMs: 60000, max: 10 }), ah(async (req, res) => {
  const domain = normalizeDomain(req.body?.domain);
  if (!domain) throw bad('请输入正确的域名，例如 example.com');
  let sitemapUrl = str(req.body?.sitemapUrl, 500);
  if (sitemapUrl) {
    try { const u = new URL(sitemapUrl); if (!/^https?:$/.test(u.protocol)) throw 0; if (!u.hostname.endsWith(domain.replace(/^www\./, '').replace(/:\d+$/, ''))) throw bad('Sitemap 必须属于该域名'); } catch (e) { if (e instanceof HttpError) throw e; throw bad('Sitemap 网址格式不正确'); }
  } else sitemapUrl = `https://${domain}/sitemap.xml`;

  const count = get('SELECT count(*) AS c FROM monitored_sites WHERE user_id = ?', [req.user.id]).c;
  checkPlanFeature(req.user, 'site_limit', { locale: req.locale, currentCount: count });

  if (get('SELECT id FROM monitored_sites WHERE user_id = ? AND domain = ?', [req.user.id, domain])) throw bad('该域名已在托管列表中');
  const x = run('INSERT INTO monitored_sites (user_id, domain, sitemap_url, auto_indexnow, indexnow_key, key_verified) VALUES (?, ?, ?, 1, ?, 0)',
    [req.user.id, domain, sitemapUrl, newIndexNowKey()]);
  res.json({ success: true, data: siteView(get('SELECT * FROM monitored_sites WHERE id = ?', [x.lastID])) });
}));
r.patch('/sites/:id', requireAuth, ah(async (req, res) => {
  const s = getOwnedSite(req.params.id, req.user.id);
  if (typeof req.body?.autoIndexNow === 'boolean') {
    if (req.body.autoIndexNow) {
      checkPlanFeature(req.user, 'auto_site_check', { locale: req.locale });
    }
    run('UPDATE monitored_sites SET auto_indexnow = ? WHERE id = ?', [req.body.autoIndexNow ? 1 : 0, s.id]);
  }
  res.json({ success: true, data: siteView(get('SELECT * FROM monitored_sites WHERE id = ?', [s.id])) });
}));
r.delete('/sites/:id', requireAuth, ah(async (req, res) => {
  const s = getOwnedSite(req.params.id, req.user.id);
  run('DELETE FROM monitored_sites WHERE id = ?', [s.id]);
  res.json({ success: true });
}));
r.post('/sites/:id/verify', requireAuth, rateLimit({ windowMs: 60000, max: 10 }), ah(async (req, res) => {
  const s = getOwnedSite(req.params.id, req.user.id);
  const v = await verifyKey(s);
  res.json({ success: true, data: { ...v, site: siteView(get('SELECT * FROM monitored_sites WHERE id = ?', [s.id])) } });
}));
r.post('/sites/:id/check', requireAuth, rateLimit({ windowMs: 10 * 60000, max: 5, message: '巡检过于频繁，请 10 分钟后再试' }), ah(async (req, res) => {
  const s = getOwnedSite(req.params.id, req.user.id);
  const out = await checkSite(s, { userId: req.user.id });
  res.json({ success: true, data: { ...out, newUrls: out.newUrls.slice(0, 100), site: siteView(get('SELECT * FROM monitored_sites WHERE id = ?', [s.id])) } });
}));
r.get('/sites/:id/logs', requireAuth, ah(async (req, res) => {
  const s = getOwnedSite(req.params.id, req.user.id);
  res.json({ success: true, data: getSiteLogs(s.id, req.user.id) });
}));
r.post('/sites/:id/push', requireAuth, rateLimit({ windowMs: 60000, max: 6 }), ah(async (req, res) => {
  const s = getOwnedSite(req.params.id, req.user.id);
  const urls = (Array.isArray(req.body?.urls) ? req.body.urls : String(req.body?.urls || '').split(/\s+/)).map(u => str(u, 2000)).filter(Boolean);
  const out = await pushIndexNow({ userId: req.user.id, site: s, urls });
  res.json({ success: out.ok, data: out, error: out.ok ? undefined : out.message });
}));

// ———————— Wave 2 红V发布闭环 ————————
r.get('/redv/accounts', requireAuth, ah(async (req, res) => {
  res.json({ success: true, data: listRedVAccounts({ activeOnly: true }) });
}));
r.get('/redv/cards', requireAuth, ah(async (req, res) => {
  res.json({ success: true, data: listActionCards(req.user.id, { brand: str(req.query?.brand, 80) || undefined }) });
}));
r.post('/redv/cards/:id/mark-published', requireAuth, rateLimit({ windowMs: 60000, max: 20 }), ah(async (req, res) => {
  const card = markCardPublished(parseInt(req.params.id, 10), req.user.id, str(req.body?.channel, 120));
  res.json({ success: true, data: card });
}));
r.post('/redv/cards/:id/unmark-published', requireAuth, rateLimit({ windowMs: 60000, max: 20 }), ah(async (req, res) => {
  const card = unmarkCardPublished(parseInt(req.params.id, 10), req.user.id);
  res.json({ success: true, data: card });
}));
r.post('/redv/cards/generate', requireAuth, rateLimit({ windowMs: 60000, max: 10 }), ah(async (req, res) => {
  assertLlm();
  const b = req.body || {};
  const card = await generateActionCard({
    user: req.user,
    brandName: str(b.brandName || b.brand, 60),
    domain: normalizeDomain(b.domain) || str(b.domain, 120),
    targetQuestion: str(b.targetQuestion || b.question || b.target_issue, 300),
    weaknessReason: str(b.weaknessReason || b.suggested_angle, 200),
    locale: req.locale,
  });
  res.json({ success: true, data: card });
}));
r.get('/redv/tasks', requireAuth, ah(async (req, res) => {
  res.json({ success: true, data: listPublishTasks(req.user.id) });
}));
r.post('/redv/tasks', requireAuth, rateLimit({ windowMs: 60000, max: 15 }), ah(async (req, res) => {
  const b = req.body || {};
  const task = createPublishTask({
    user: req.user,
    cardId: b.cardId || b.card_id,
    redvAccountId: b.redvAccountId || b.redv_account_id,
    brandName: str(b.brandName || b.brand, 60),
    domain: normalizeDomain(b.domain) || str(b.domain, 120),
    targetQuestion: str(b.targetQuestion || b.question || b.query_prompt, 300),
    publishUrl: str(b.publishUrl || b.publish_url, 1000),
    publishTime: b.publishTime || b.publish_time,
  });
  res.json({ success: true, data: task });
}));
r.patch('/redv/tasks/:id', requireAuth, ah(async (req, res) => {
  const b = req.body || {};
  const task = updatePublishTask(parseInt(req.params.id, 10), req.user.id, {
    publishUrl: b.publishUrl !== undefined ? str(b.publishUrl, 1000) : (b.publish_url !== undefined ? str(b.publish_url, 1000) : undefined),
    publishTime: b.publishTime || b.publish_time,
    status: b.status,
    redvAccountId: b.redvAccountId || b.redv_account_id,
  });
  res.json({ success: true, data: task });
}));
r.post('/redv/tasks/:id/verify', requireAuth, rateLimit({ windowMs: 60000, max: 6 }), ah(async (req, res) => {
  assertLlm();
  const result = await verifyPublishTask(parseInt(req.params.id, 10), req.user, req.locale);
  res.json({ success: true, data: result });
}));

// ———————— 套餐与订单 ————————
r.get('/billing/plans', (req, res) => {
  let userUsage = null;
  if (req.user) {
    userUsage = {
      labRuns: getMonthlyUsage(req.user.id, 'lab_run'),
      wordExports: getMonthlyUsage(req.user.id, 'word_export'),
      actionCards: getMonthlyUsage(req.user.id, 'action_card'),
    };
  }
  res.json({
    success: true,
    data: {
      plans: Object.values(PLANS),
      addonPacks: ADDON_PACKS,
      payContact: req.locale === 'en' ? config.payContactEn : config.payContact,
      payQrUrl: config.payQrUrl || null,
      demoPayments: config.demoPayments,
      userUsage,
    },
  });
});
r.get('/billing/orders', requireAuth, (req, res) => {
  res.json({ success: true, data: query('SELECT order_no, plan_type, period, amount, status, created_at, pay_time, expires_at FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 20', [req.user.id]) });
});
r.post('/billing/orders', requireAuth, rateLimit({ windowMs: 60 * 60 * 1000, max: 10 }), ah(async (req, res) => {
  const plan = PLANS[req.body?.plan];
  if (!plan || plan.id === 'free') throw bad('请选择要开通的套餐');
  const period = req.body?.period === 'yearly' ? 'yearly' : 'monthly';
  const amount = period === 'yearly' ? plan.priceYearly : plan.priceMonthly;
  const orderNo = 'GEO' + new Date().toISOString().replace(/\D/g, '').slice(0, 14) + crypto.randomInt(1000, 9999);
  run(`INSERT INTO orders (user_id, order_no, plan_type, period, amount, status, payment_method) VALUES (?, ?, ?, ?, ?, 'pending', 'offline')`,
    [req.user.id, orderNo, plan.id, period, amount]);
  console.log(`[order] ${orderNo} user=${req.user.username} ${plan.id}/${period} ¥${amount}`);
  res.json({ success: true, data: { orderNo, plan: plan.id, planName: req.locale === 'en' ? plan.nameEn : plan.name, period, amount, payContact: req.locale === 'en' ? config.payContactEn : config.payContact, payQrUrl: config.payQrUrl || null, demoPayments: config.demoPayments } });
}));

export function activateOrder(order) {
  const now = new Date();
  const user = get('SELECT plan, plan_expires_at FROM users WHERE id = ?', [order.user_id]);
  // 续费同一套餐时在原到期日基础上顺延
  let start = now;
  if (user?.plan === order.plan_type && user.plan_expires_at) {
    const cur = new Date(user.plan_expires_at.replace(' ', 'T') + 'Z');
    if (cur > now) start = cur;
  }
  const exp = new Date(start);
  if (order.period === 'yearly') exp.setFullYear(exp.getFullYear() + 1); else exp.setMonth(exp.getMonth() + 1);
  const expStr = exp.toISOString().replace('T', ' ').slice(0, 19);
  run("UPDATE orders SET status = 'paid', pay_time = CURRENT_TIMESTAMP, expires_at = ? WHERE id = ?", [expStr, order.id]);
  run('UPDATE users SET plan = ?, plan_expires_at = ?, quota_daily = ? WHERE id = ?', [order.plan_type, expStr, planQuota(order.plan_type), order.user_id]);
  return expStr;
}

// 演示支付：仅在 DEMO_PAYMENTS=1 时可用（用于线下演示），生产环境默认关闭
r.post('/billing/mock-pay', requireAuth, ah(async (req, res) => {
  if (!config.demoPayments) throw new HttpError(403, '在线支付暂未开通，请按页面提示联系客服完成付款');
  const o = get("SELECT * FROM orders WHERE order_no = ? AND user_id = ? AND status = 'pending'", [str(req.body?.orderNo, 40), req.user.id]);
  if (!o) throw bad('订单不存在或已处理');
  const exp = activateOrder(o);
  res.json({ success: true, data: { plan: o.plan_type, expiresAt: exp } });
}));

// ———————— 引擎列表 ————————
r.get('/engines', (req, res) => res.json({ success: true, data: listEngines() }));

// 公共：临时语料预览页（HTML 全部转义；禁止搜索引擎收录，避免被滥用做 SEO 垃圾页）
export function sourcePage(req, res) {
  const rec = get('SELECT * FROM ephemeral_grounding_sources WHERE token = ?', [String(req.params.token)]);
  if (!rec || !rec.expires_at || rec.expires_at < Date.now()) return res.status(410).type('text/plain').send('This preview link has expired.');
  run('UPDATE ephemeral_grounding_sources SET access_count = access_count + 1, last_accessed_at = CURRENT_TIMESTAMP WHERE id = ?', [rec.id]);
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (!String(req.headers.accept || '').includes('text/html')) return res.type('text/plain; charset=utf-8').send(rec.content_markdown);
  res.type('html').send(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>${escapeHtml(rec.brand_name)} · 语料预览</title>
<style>body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;max-width:760px;margin:0 auto;padding:24px 16px;color:#0f172a;line-height:1.7;background:#fff}
.note{font-size:13px;color:#475569;background:#f1f5f9;border-radius:8px;padding:10px 12px;margin-bottom:16px}pre{white-space:pre-wrap;word-break:break-word;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;font-size:14px}</style></head>
<body><div class="note">这是由用户在 DailyToolbox GEO 生成的语料预览，内容由「${escapeHtml(rec.brand_name)}」方提供，非第三方核实信息，7 天后自动失效。正式内容请以 https://${escapeHtml(rec.domain)} 为准。</div>
<pre>${escapeHtml(rec.content_markdown)}</pre></body></html>`);
}

export default r;
