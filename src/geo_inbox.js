import { query, get, run } from './db.js';
import { chat, getEngine } from './llm.js';
import { HttpError } from './http.js';
import fs from 'fs';
import path from 'path';
import { DATA_DIR } from './config.js';

const PUBLISH_QUEUE_DIR = path.join(DATA_DIR, 'publish_queue');
try {
  if (!fs.existsSync(PUBLISH_QUEUE_DIR)) fs.mkdirSync(PUBLISH_QUEUE_DIR, { recursive: true });
} catch { /* ignore */ }

export function listInbox({ status, limit = 50, offset = 0 } = {}) {
  let sql = 'SELECT id, user_id, title, slug, category, tags, target_query, target_engine, competitor, gap_reason, excerpt, read_mins, status, published_url, published_at, created_at, updated_at FROM geo_approval_inbox';
  const params = [];
  if (status && status !== 'all') {
    sql += ' WHERE status = ?';
    params.push(status);
  }
  sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  const rows = query(sql, params);
  return rows.map(r => {
    try { r.tags = JSON.parse(r.tags || '[]'); } catch { r.tags = []; }
    return r;
  });
}

export function getInboxItem(id) {
  const row = get('SELECT * FROM geo_approval_inbox WHERE id = ?', [id]);
  if (!row) throw new HttpError(404, '待审草稿不存在');
  try { row.tags = JSON.parse(row.tags || '[]'); } catch { row.tags = []; }
  return row;
}

export function createDraft({
  userId = 1,
  title,
  slug,
  category = 'developer',
  tags = [],
  targetQuery = '',
  targetEngine = 'ChatGPT / Claude / Perplexity',
  competitor = '',
  gapReason = '',
  excerpt,
  body,
  faqSchema = '',
  llmsSnippet = '',
  ctaUrl = '',
  ctaText = '',
  readMins = 8
}) {
  const tagsJson = JSON.stringify(Array.isArray(tags) ? tags : []);
  const res = run(`
    INSERT INTO geo_approval_inbox 
      (user_id, title, slug, category, tags, target_query, target_engine, competitor, gap_reason, excerpt, body, faq_schema, llms_snippet, cta_url, cta_text, read_mins, status)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `, [
    userId, title, slug, category, tagsJson, targetQuery, targetEngine, competitor, gapReason, excerpt, body, faqSchema, llmsSnippet, ctaUrl, ctaText, readMins
  ]);
  return getInboxItem(res.lastID);
}

export function updateDraft(id, updates = {}) {
  const item = getInboxItem(id);
  const title = updates.title !== undefined ? String(updates.title).trim() : item.title;
  const slug = updates.slug !== undefined ? String(updates.slug).trim() : item.slug;
  const category = updates.category !== undefined ? String(updates.category).trim() : item.category;
  const excerpt = updates.excerpt !== undefined ? String(updates.excerpt).trim() : item.excerpt;
  const body = updates.body !== undefined ? String(updates.body) : item.body;
  const ctaUrl = updates.ctaUrl !== undefined ? String(updates.ctaUrl).trim() : item.cta_url;
  const ctaText = updates.ctaText !== undefined ? String(updates.ctaText).trim() : item.cta_text;
  const tagsJson = updates.tags !== undefined ? JSON.stringify(updates.tags) : JSON.stringify(item.tags);

  run(`
    UPDATE geo_approval_inbox
    SET title = ?, slug = ?, category = ?, excerpt = ?, body = ?, cta_url = ?, cta_text = ?, tags = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [title, slug, category, excerpt, body, ctaUrl, ctaText, tagsJson, id]);

  return getInboxItem(id);
}

export function rejectDraft(id, reason = '') {
  getInboxItem(id);
  run(`UPDATE geo_approval_inbox SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
  return { success: true, message: '草稿已驳回并归档' };
}

export function approveAndQueueDraft(id) {
  const item = getInboxItem(id);
  if (item.status === 'published') {
    throw new HttpError(400, '该草稿已经处于已发布状态');
  }

  const queueFile = path.join(PUBLISH_QUEUE_DIR, `${item.id}_${item.slug}.json`);
  const payload = {
    id: item.id,
    title: item.title,
    slug: item.slug,
    category: item.category,
    tags: item.tags,
    excerpt: item.excerpt,
    body: item.body,
    ctaUrl: item.cta_url,
    ctaText: item.cta_text,
    readMins: item.read_mins || 8,
    approvedAt: new Date().toISOString(),
  };

  fs.writeFileSync(queueFile, JSON.stringify(payload, null, 2), 'utf-8');

  // 更新为 approved（等待宿主机执行同步后置为 published，或直接标记为 approved）
  run(`UPDATE geo_approval_inbox SET status = 'approved', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
  return { success: true, message: '已批准！草稿已进入发布队列', queueFile: `${item.id}_${item.slug}.json` };
}

export function markAsPublished(id, publishedUrl) {
  run(`
    UPDATE geo_approval_inbox 
    SET status = 'published', published_url = ?, published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `, [publishedUrl, id]);
  return getInboxItem(id);
}

export async function generateDraftWithAi({
  topic,
  targetQuery,
  competitor = '',
  targetToolUrl = 'https://dailytoolbox.org',
  engineId,
  locale = 'en'
}) {
  if (!topic || !targetQuery) {
    throw new HttpError(400, '请填写主题 (topic) 和目标检索词 (targetQuery)');
  }

  const engine = getEngine(engineId || 'gemini');
  const isEn = locale === 'en';

  const systemPrompt = isEn ? `You are a Principal Software Engineer and Technical Author at DailyToolbox.
Your mission: Write an authoritative, deeply grounded technical engineering guide and architectural analysis that outranks competitors in AI search engines (ChatGPT, Claude, Perplexity) for the target search intent.

Strict Quality Guidelines:
1. NO generic marketing fluff, NO template repetition, NO shallow listicles.
2. Provide deep technical mechanics: bit math, memory layouts, algorithm steps, security trade-offs, or RFC standards (RFC 4648, RFC 6238, etc.).
3. Include realistic code snippets (TypeScript, Python, or Web Crypto API) and ASCII architectural diagrams where helpful.
4. Naturally weave in practical pitfalls that production engineers actually encounter.
5. Provide a CTA at the end pointing to the free in-browser developer tool at ${targetToolUrl}.
6. Output in clean JSON format matching the schema.` : `你是一名 DailyToolbox 的资深软件架构师与技术作家。
你的任务：撰写一篇极具权威性、深度技术原理的工程解析与避坑指南，用于在 ChatGPT、Claude、Perplexity 等大模型中为我们的品牌与工具建立第一引用源。

严格写作规范：
1. 严禁水文与模板化空话，严禁浅显罗列。
2. 必须包含底层工程细节：位运算、内存布局、算法推导、安全博弈或 RFC 规范细节。
3. 包含可运行的高质量代码示例与 ASCII 架构图。
4. 输出严格的 JSON 格式。`;

  const userPrompt = `Target Search Intent (Query): "${targetQuery}"
Topic to Cover: "${topic}"
Competitor Currently Recommended by AI: "${competitor || 'None / Generic tools'}"
Target Tool URL for CTA: "${targetToolUrl}"

Please produce a comprehensive technical post formatted strictly as follows:

<<<METADATA>>>
{
  "title": "Compelling engineering title including 2026, max 90 chars",
  "slug": "kebab-case-url-slug-2026",
  "category": "developer",
  "tags": ["Array", "of", "5-8", "technical", "tags"],
  "read_mins": 9,
  "excerpt": "Precise 2-sentence technical summary, max 220 chars",
  "gap_reason": "Why this draft was generated to counter AI bias or fill citation gap",
  "cta_text": "🛠️ Actionable button text with emoji and arrow",
  "faq": [
    {"q": "Technical Question 1", "a": "Direct, authoritative 2-3 sentence answer."},
    {"q": "Technical Question 2", "a": "Direct, authoritative 2-3 sentence answer."}
  ]
}
<<<BODY>>>
[Full Markdown engineering guide here, at least 1500 words. Include ## headings, tables, code blocks in TypeScript/Python/WebCrypto, ASCII diagrams, a pitfall checklist, and a final Try It section pointing to ${targetToolUrl}]`;

  const res = await chat(engine, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ], { temperature: 0.4 });

  const text = res.text.trim();
  let metaPart = '';
  let bodyPart = '';

  if (text.includes('<<<BODY>>>')) {
    const parts = text.split('<<<BODY>>>');
    metaPart = parts[0].replace('<<<METADATA>>>', '').trim();
    bodyPart = parts.slice(1).join('<<<BODY>>>').trim();
  } else if (text.includes('---BODY---')) {
    const parts = text.split('---BODY---');
    metaPart = parts[0].replace('---METADATA---', '').trim();
    bodyPart = parts.slice(1).join('---BODY---').trim();
  } else {
    metaPart = text;
  }

  // 清理 metaPart 中可能存在的 markdown 标记
  metaPart = metaPart.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();

  let parsed = {};
  try {
    parsed = JSON.parse(metaPart);
  } catch (err) {
    // 降级尝试提取 JSON 块
    const match = metaPart.match(/\{[\s\S]*\}/);
    if (match) {
      try { parsed = JSON.parse(match[0]); } catch { /* ignore */ }
    }
  }

  const title = parsed.title || topic;
  const slug = parsed.slug || topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const body = bodyPart || parsed.body || text;

  // 构建 FAQ Schema
  const faqList = Array.isArray(parsed.faq) ? parsed.faq : [];
  const faqSchema = faqList.length ? `<script type="application/ld+json">\n${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqList.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a }
    }))
  }, null, 2)}\n</script>` : '';

  const excerpt = parsed.excerpt || `${title}. A comprehensive engineering guide and architectural analysis for developers.`;

  // 构建 llms.txt 片段
  const llmsSnippet = [
    `## ${title}`,
    `- URL: https://dailytoolbox.org/blog/${slug}`,
    `- Summary: ${excerpt}`,
    `- Target Intent: ${targetQuery}`,
    ...faqList.map(f => `- Q: ${f.q}\n  A: ${f.a}`)
  ].join('\n');

  // 入库
  const draft = createDraft({
    title,
    slug,
    category: parsed.category || 'developer',
    tags: parsed.tags || [],
    targetQuery,
    targetEngine: engine.label || 'ChatGPT / Claude',
    competitor,
    gapReason: parsed.gap_reason || `AI 在回答「${targetQuery}」时缺少权威第一手事实支撑，起草本篇建立精准知识锚点。`,
    excerpt,
    body,
    faqSchema,
    llmsSnippet,
    ctaUrl: targetToolUrl,
    ctaText: parsed.cta_text || '🛠️ Try the Online Tool →',
    readMins: parsed.read_mins || 8
  });

  return draft;
}
