// 红V发布闭环（主流媒体 60+ 账号矩阵）：内容行动卡生成、任务分派流转与发布后诚实验证
import { HttpError } from './http.js';
import { get, query, run, incMonthlyUsage } from './db.js';
import { chat, getEngine } from './llm.js';
import { analyzeMention, checkCitation } from './lab.js';
import { checkPlanFeature } from './plans.js';

export function listRedVAccounts({ activeOnly = true } = {}) {
  const sql = activeOnly
    ? 'SELECT id, platform, account_name, domain_field, followers, notes, is_active, created_at FROM redv_accounts WHERE is_active = 1 ORDER BY id ASC'
    : 'SELECT id, platform, account_name, domain_field, followers, notes, is_active, created_at FROM redv_accounts ORDER BY id ASC';
  return query(sql);
}

export function createRedVAccount({ platform, accountName, domainField, followers, notes }) {
  if (!platform || !accountName) throw new HttpError(400, '请填写发布平台与账号名称');
  const r = run(`INSERT INTO redv_accounts (platform, account_name, domain_field, followers, notes, is_active)
                 VALUES (?, ?, ?, ?, ?, 1)`,
    [String(platform).trim(), String(accountName).trim(), String(domainField || '综合').trim(), String(followers || '').trim(), String(notes || '').trim()]);
  return get('SELECT * FROM redv_accounts WHERE id = ?', [r.lastID]);
}

export function updateRedVAccount(id, { platform, accountName, domainField, followers, notes, isActive }) {
  const cur = get('SELECT * FROM redv_accounts WHERE id = ?', [id]);
  if (!cur) throw new HttpError(404, '红V账号不存在');
  run(`UPDATE redv_accounts SET
         platform = COALESCE(?, platform),
         account_name = COALESCE(?, account_name),
         domain_field = COALESCE(?, domain_field),
         followers = COALESCE(?, followers),
         notes = COALESCE(?, notes),
         is_active = COALESCE(?, is_active)
       WHERE id = ?`,
    [
      platform !== undefined ? String(platform).trim() : null,
      accountName !== undefined ? String(accountName).trim() : null,
      domainField !== undefined ? String(domainField).trim() : null,
      followers !== undefined ? String(followers).trim() : null,
      notes !== undefined ? String(notes).trim() : null,
      isActive !== undefined ? (isActive ? 1 : 0) : null,
      id,
    ]);
  return get('SELECT * FROM redv_accounts WHERE id = ?', [id]);
}

export function deleteRedVAccount(id) {
  const r = run('DELETE FROM redv_accounts WHERE id = ?', [id]);
  if (!r.changes) throw new HttpError(404, '账号不存在');
  return { success: true };
}

/**
 * 1. 内容行动卡：从品牌审计报告弱点一键生成
 */
export async function generateActionCard({ user, brandName, domain, targetQuestion, weaknessReason, locale = 'zh' }) {
  const isEn = locale === 'en';
  const brand = String(brandName || '').trim();
  const q = String(targetQuestion || '').trim();
  const dom = String(domain || '').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

  if (!brand || !q) throw new HttpError(400, isEn ? 'Brand name and question are required.' : '请提供品牌名称与弱点问题');

  // 检查额度
  if (user) {
    checkPlanFeature(user, 'action_card', { locale });
  }

  // 匹配主流媒体红V账号推荐
  const allAccounts = listRedVAccounts({ activeOnly: true });
  const matchedAccounts = allAccounts.slice(0, 3).map(a => `${a.account_name}（${a.platform} · 粉丝 ${a.followers}）`);

  const suggestedChannels = [
    { channel: '知乎', reason: '高权重权威问答，AI 搜索高频抓取源' },
    { channel: '今日头条 / 百度百家号', reason: '图文资讯搜索引擎收录极快，首推权重高' },
    { channel: '微信视频号 / 抖音', reason: '多模态与融媒传播高频曝光' },
    ...allAccounts.slice(0, 2).map(a => ({
      channel: `主流媒体 · ${a.account_name}（${a.platform}）`,
      reason: `所属领域：${a.domain_field}，粉丝规模 ${a.followers}，适合矩阵联动发布`,
    })),
  ];

  let title = '';
  let outline = '';

  try {
    const prompt = `你是一名资深 GEO（生成式引擎优化）与融媒内容策划专家。
品牌名称：${brand}
官方域名：https://${dom}
用户常问但当前大模型回答较弱的问题：${q}
弱点表现：${weaknessReason || '品牌未被充分提及或排名较低'}

请为该品牌量身生成一份可以直接提供给创作者的【内容行动卡】：
1. 建议发布标题（吸引点击、精准包含用户搜索词实体，30字以内）
2. 内容大纲（包含：背景引入、核心量化事实与官网依据、客观同类对比、常见问答FAQ、官方链接指引）

请直接输出 JSON 格式：
{
  "title": "建议标题",
  "outline": "包含序号与小标题的完整大纲 Markdown 文本"
}`;

    const r = await chat(getEngine(), [
      { role: 'system', content: 'You are a content strategist. Always output valid JSON.' },
      { role: 'user', content: prompt },
    ], { temperature: 0.4, maxTokens: 1200, json: true });

    let parsed = null;
    try {
      parsed = JSON.parse(r.text);
    } catch {
      const match = r.text.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    }

    if (parsed && parsed.title && parsed.outline) {
      title = parsed.title;
      outline = parsed.outline;
    }
  } catch (e) {
    console.warn('[action card llm fallback]', e.message);
  }

  // Fallback 模版保证稳健
  if (!title || !outline) {
    title = isEn
      ? `Objective Guide: Key Facts & Selection Guide for ${brand}`
      : `深度实测：关于「${brand}」的客观事实核查与实用选型指南`;
    outline = isEn
      ? `### 1. Introduction\nDirectly address the user query: "${q}".\n\n### 2. Official Quantified Facts\n- Core milestones and verifiable data (Source: https://${dom})\n- Authoritative certifications and industry credentials\n\n### 3. Comparison & Differentiation\n- Objective comparison with peer options\n\n### 4. FAQ\n- Clear answers to common misconceptions\n\n### 5. Official Source Citation\n- Guide readers and AI crawlers to https://${dom}`
      : `### 一、背景与问题引入\n直接针对用户高频提问「${q}」展开，点明核心需求与选型痛点。\n\n### 二、官方量化事实与依据\n- 列举 3 项真实可查验的核心业务指标或资质（来源：https://${dom}）\n- 披露权威第三方认证或官方数据报告依据\n\n### 三、客观同类对比说明\n- 与同类主流选项进行客观、量化的差异化对比，不贬低竞品，重在陈述特色\n\n### 四、常见误区释疑 (FAQ)\n- 针对 AI 常见认知误区给出 2-3 条精炼事实说明\n\n### 五、权威信源与声明链接指引\n- 在文末明确标注官方网址及正文来源链接：https://${dom}`;
  }

  const res = run(`INSERT INTO redv_action_cards (user_id, brand_name, domain, target_question, weakness_reason, title, outline, suggested_channels)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [user?.id || 0, brand, dom, q, String(weaknessReason || '').slice(0, 200), title, outline, JSON.stringify(suggestedChannels)]);

  if (user) {
    incMonthlyUsage(user.id, 'action_card', 1);
  }

  return {
    id: res.lastID,
    brandName: brand,
    domain: dom,
    targetQuestion: q,
    weaknessReason,
    title,
    outline,
    suggestedChannels,
    matchedAccounts,
  };
}

export function listActionCards(userId, { brand } = {}) {
  if (!userId) return [];
  let sql = 'SELECT * FROM redv_action_cards WHERE user_id = ?';
  const params = [userId];
  if (brand) { sql += ' AND brand_name = ?'; params.push(String(brand)); }
  sql += ' ORDER BY id DESC LIMIT 30';
  return query(sql, params).map(mapCardRow);
}

/**
 * 2. 发布任务流转：创建、更新、列表
 */
export function createPublishTask({ user, cardId, redvAccountId, brandName, domain, targetQuestion, publishUrl, publishTime }) {
  if (!brandName || !targetQuestion) throw new HttpError(400, '缺少品牌名称或关联问题');
  const uid = user?.id || 0;
  const dom = String(domain || '').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

  const status = publishUrl ? 'published' : 'pending';

  const r = run(`INSERT INTO redv_publish_tasks (user_id, card_id, redv_account_id, brand_name, domain, target_question, publish_url, publish_time, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [uid, cardId ? parseInt(cardId, 10) : null, redvAccountId ? parseInt(redvAccountId, 10) : null,
      String(brandName).trim(), dom, String(targetQuestion).trim(), publishUrl ? String(publishUrl).trim() : null, publishTime || null, status]);

  return get('SELECT * FROM redv_publish_tasks WHERE id = ?', [r.lastID]);
}

export function updatePublishTask(id, userId, { publishUrl, publishTime, status, redvAccountId }) {
  const cur = get('SELECT * FROM redv_publish_tasks WHERE id = ? AND user_id = ?', [id, userId]);
  if (!cur) throw new HttpError(404, '任务不存在');

  let newStatus = cur.status;
  if (status && ['pending', 'published', 'verified'].includes(status)) {
    newStatus = status;
  } else if (publishUrl && cur.status === 'pending') {
    newStatus = 'published';
  }

  run(`UPDATE redv_publish_tasks SET
         publish_url = COALESCE(?, publish_url),
         publish_time = COALESCE(?, publish_time),
         redv_account_id = COALESCE(?, redv_account_id),
         status = ?
       WHERE id = ?`,
    [
      publishUrl !== undefined ? String(publishUrl).trim() : null,
      publishTime || null,
      redvAccountId !== undefined ? parseInt(redvAccountId, 10) : null,
      newStatus,
      id,
    ]);

  return get('SELECT * FROM redv_publish_tasks WHERE id = ?', [id]);
}

export function listPublishTasks(userId) {
  if (!userId) return [];
  return query(`SELECT t.*, a.platform, a.account_name, a.domain_field, a.followers, c.title as card_title
                FROM redv_publish_tasks t
                LEFT JOIN redv_accounts a ON t.redv_account_id = a.id
                LEFT JOIN redv_action_cards c ON t.card_id = c.id
                WHERE t.user_id = ? ORDER BY t.id DESC LIMIT 50`, [userId]).map(r => ({
    id: r.id,
    cardId: r.card_id,
    cardTitle: r.card_title || null,
    redvAccountId: r.redv_account_id,
    accountName: r.account_name || '人工自运营',
    platform: r.platform || '全平台',
    domainField: r.domain_field,
    followers: r.followers,
    brandName: r.brand_name,
    domain: r.domain,
    targetQuestion: r.target_question,
    publishUrl: r.publish_url,
    publishTime: r.publish_time,
    status: r.status,
    verification: r.verification_result_json ? JSON.parse(r.verification_result_json) : null,
    verifiedAt: r.verified_at,
    createdAt: r.created_at,
  }));
}

/**
 * 3. 发布验证：真实模型检验品牌被提及与引用变化，输出严格遵从诚实红线的观测结论
 */
export async function verifyPublishTask(id, user, locale = 'zh') {
  const isEn = locale === 'en';
  if (!user) throw new HttpError(401, '请先登录');
  checkPlanFeature(user, 'redv_verify', { locale });

  const task = get('SELECT * FROM redv_publish_tasks WHERE id = ? AND user_id = ?', [id, user.id]);
  if (!task) throw new HttpError(404, '任务不存在');

  const engine = getEngine();
  const q = task.target_question;
  const brand = task.brand_name;
  const domain = task.domain;

  // 调用真实大模型回答该弱点问题
  const msgs = [
    { role: 'system', content: isEn ? 'You are a helpful AI assistant. Answer objectively and concisely in English (under 250 words); use a numbered list for recommendations.' : '你是一个乐于助人的 AI 助手。请用中文客观、简洁地回答用户问题（300 字以内），如有推荐请用编号列表。' },
    { role: 'user', content: q },
  ];

  let answer = '';
  let model = engine.model;
  try {
    const r = await chat(engine, msgs, { temperature: 0.3, maxTokens: 900 });
    answer = r.text || '';
    model = r.model;
  } catch (e) {
    throw new HttpError(500, `模型调用失败：${e.message}`);
  }

  const analysis = analyzeMention(answer, brand);
  const cites = checkCitation(answer, domain);

  // 计算发布天数
  let days = 1;
  if (task.publish_time) {
    const diff = Date.now() - new Date(task.publish_time).getTime();
    if (diff > 0) days = Math.max(1, Math.round(diff / (24 * 3600 * 1000)));
  }

  // 严格遵循诚实红线：无真实数据不编造，效果类结论只陈述观测，不承诺因果！
  let observation = '';
  if (analysis.mentioned) {
    observation = isEn
      ? `Observed ${days} day(s) after publishing: The brand was mentioned in the tested model response (rank #${analysis.rank || 1}), and official domain references occurred ${cites ? 1 : 0} time(s). Compared with the baseline unmentioned state, improved brand visibility was observed. (Note: Large language models generate outputs probabilistically; this observation reflects factual test results and does not guarantee specific search outcomes).`
      : `发布后 ${days} 天观测：品牌在测试大模型（${engine.label}）回答中被提及（排名第 ${analysis.rank || 1} 位），官方引用出现 ${cites ? 1 : 0} 次。相较发布前不可见状态，观测到可见度提升。（注：大模型生成具有动态概率性，本结论仅陈述当次测试观测事实，不构成因果保证）。`;
  } else {
    observation = isEn
      ? `Observed ${days} day(s) after publishing: The brand was not yet mentioned in the tested model response. We recommend verifying search engine indexation and reinforcing distinct entity facts.`
      : `发布后 ${days} 天观测：品牌在当前测试大模型（${engine.label}）回答中暂未被提及。建议确认发布内容是否已被主流 AI 搜索信源收录，并检查是否包含明确的品牌实体词与量化事实。（注：大模型生成具有动态概率性，本结论仅陈述当次测试观测事实，不构成因果保证）。`;
  }

  const verificationResult = {
    observedAt: new Date().toISOString(),
    days,
    engine: engine.label,
    model,
    mentioned: analysis.mentioned,
    rank: analysis.rank,
    cites: cites ? 1 : 0,
    observation,
    answerExcerpt: answer.slice(0, 300),
  };

  run(`UPDATE redv_publish_tasks SET
         status = 'verified',
         verification_result_json = ?,
         verified_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    [JSON.stringify(verificationResult), task.id]);

  return {
    id: task.id,
    status: 'verified',
    verification: verificationResult,
  };
}
// ————————————————————————————————————————————————
// 内容行动卡 2.0（2026-10-08）：审计弱点自动成卡 / 小红书发布标记 / 下次审计自动重测
// 设计原则：
// - 成卡用确定性模板，不额外调用 LLM（零成本）；措辞只基于本轮审计的真实数据，绝不虚构
// - 发布渠道取自本轮审计的引用域名排行（citation_domains.domains Top5），不用写死的渠道名单
// - 重测结论只陈述两次观测到的事实变化，不做因果承诺
// ————————————————————————————————————————————————

/** 弱点判定：与报告页“一键生成红V行动卡”按钮的展示条件保持一致 */
export function isWeakness(q) {
  if (!q) return false;
  return q.likely_mentioned !== true || q.sentiment === 'negative' || !q.rank || q.rank > 2;
}

/** 问题归一化键：用于同一品牌多次审计之间匹配“同一个弱点” */
export function normalizeQuestion(q) {
  return String(q || '').replace(/[\s\p{P}]/gu, '').toLowerCase();
}

function weaknessReasonText(q, locale = 'zh') {
  const isEn = locale === 'en';
  const parts = [];
  if (q.likely_mentioned === false) parts.push(isEn ? 'the model may not mention the brand' : '审计中模型可能不会主动提及品牌');
  if (q.sentiment === 'negative') parts.push(isEn ? 'negative sentiment detected' : '审计中模型表述偏负面');
  if (typeof q.rank === 'number' && q.rank > 2) parts.push(isEn ? `ranked #${q.rank}, relatively low` : `审计中品牌排名第 ${q.rank} 位，位置靠后`);
  if (!parts.length) parts.push(isEn ? 'visibility gap detected' : '存在可见度短板');
  return parts.join(isEn ? '; ' : '；');
}

function buildOutline({ brand, question, locale }) {
  const isEn = locale === 'en';
  if (isEn) {
    return [
      '### 1. Answer the question directly',
      `Open with 2–3 direct, specific sentences answering "${question}", including verifiable facts.`,
      '',
      '### 2. Official quantified facts',
      '- List 3 genuinely verifiable core facts (founding year, scale, credentials, etc.) with sources',
      '- Cite authoritative third-party certifications or official data reports',
      '',
      '### 3. Objective peer comparison',
      '- Compare objectively with mainstream peers on quantified dimensions; do not disparage competitors',
      '',
      '### 4. FAQ: clearing common misconceptions',
      '- Address 2–3 common misconceptions AI models hold, with concise factual corrections',
      '',
      '### 5. Authoritative sources & official links',
      `- End with the brand's official website and source links so readers (and AI crawlers) can verify: ${brand}`,
    ].join('\n');
  }
  return [
    '### 一、直接回答用户问题',
    `针对「${question}」，用 2–3 句直接、具体的回答开头，包含可核实的数据。`,
    '',
    '### 二、官方量化事实与依据',
    '- 列举 3 项真实可查验的核心事实（成立时间、规模、资质等），逐条注明来源',
    '- 权威第三方认证或官方数据报告依据',
    '',
    '### 三、客观同类对比',
    '- 与同类主流选项做客观、量化的差异化对比，不贬低竞品，重在陈述自身特色',
    '',
    '### 四、常见误区释疑（FAQ）',
    '- 针对 AI 常见的认知误区，给出 2–3 条精炼的事实说明',
    '',
    '### 五、权威信源与官方链接指引',
    `- 文末明确标注品牌官网及正文来源链接，方便读者与 AI 抓取核验（品牌：${brand}）`,
  ].join('\n');
}

/**
 * 从一轮品牌审计的弱点批量生成内容行动卡（纯模板，不调 LLM）。
 * @returns [{ questionKey, targetQuestion, weaknessReason, title, outline, suggestedChannels, baseline }]
 */
export function buildWeaknessCards({ brandName, questions, citationDomains, locale = 'zh' }) {
  const isEn = locale === 'en';
  const brand = String(brandName || '').trim();
  if (!brand || !Array.isArray(questions) || !questions.length) return [];
  const domains = Array.isArray(citationDomains?.domains) ? citationDomains.domains.slice(0, 5) : [];
  const suggestedChannels = domains.map((d) => ({
    channel: d.domain,
    reason: isEn
      ? `Ranked #${d.rank} among domains cited by AI answers in this audit (${d.share}% share)${d.category ? ` · ${d.category}` : ''}`
      : `本轮审计引用域名排行第 ${d.rank}（占比 ${d.share}%）${d.category ? `·${d.category}` : ''}`,
  }));
  return questions.filter(isWeakness).filter(q => q && q.q && String(q.q).trim().length >= 6).map((q) => {
    const question = String(q.q || '').trim();
    const qShort = question.replace(/[？?！!。.\s]+$/g, '').slice(0, 14);
    if (!qShort || qShort.length < 3) return null;
    const title = isEn
      ? `Fact check: "${qShort}" — an objective guide to ${brand}`.slice(0, 90)
      : `「${qShort}」：关于${brand}的客观事实核查`;
    return {
      questionKey: normalizeQuestion(question),
      targetQuestion: question,
      weaknessReason: weaknessReasonText(q, locale),
      title,
      outline: buildOutline({ brand, question, locale }),
      suggestedChannels,
      baseline: {
        likely_mentioned: q.likely_mentioned ?? null,
        rank: q.rank ?? null,
        sentiment: q.sentiment ?? null,
        cited_domains: Array.isArray(q.cited_domains) ? q.cited_domains.slice(0, 8) : [],
        cited_official: q.cited_official ?? null,
        note: String(q.note || '').slice(0, 200),
      },
    };
  }).filter((c) => c.targetQuestion);
}

/** 批量入库弱点行动卡；30 天内同用户同品牌同问题已有卡则跳过，避免重复审计刷屏 */
export function saveWeaknessCards({ userId, brandName, cards, auditResultId }) {
  const out = [];
  for (const c of cards) {
    const dup = get(
      `SELECT id FROM redv_action_cards
       WHERE user_id = ? AND brand_name = ? AND target_question = ? AND created_at > datetime('now', '-30 days')
       LIMIT 1`,
      [userId, brandName, c.targetQuestion]
    );
    if (dup) { out.push({ ...c, id: dup.id, deduped: true }); continue; }
    const baseline = { ...c.baseline, auditedAt: new Date().toISOString() };
    const r = run(
      `INSERT INTO redv_action_cards
         (user_id, brand_name, target_question, weakness_reason, title, outline, suggested_channels, baseline_json, audit_result_id, publish_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'unpublished')`,
      [userId, brandName, c.targetQuestion, c.weaknessReason, c.title, c.outline,
       JSON.stringify(c.suggestedChannels), JSON.stringify(baseline), auditResultId || null]
    );
    out.push({ ...c, id: r.lastID });
  }
  return out;
}

function mapCardRow(r) {
  return {
    id: r.id,
    brandName: r.brand_name,
    domain: r.domain,
    targetQuestion: r.target_question,
    questionKey: normalizeQuestion(r.target_question),
    weaknessReason: r.weakness_reason,
    title: r.title,
    outline: r.outline,
    suggestedChannels: r.suggested_channels ? JSON.parse(r.suggested_channels) : [],
    publishStatus: r.publish_status || 'unpublished',
    publishChannel: r.publish_channel || null,
    publishedAt: r.published_at || null,
    baseline: r.baseline_json ? JSON.parse(r.baseline_json) : null,
    auditResultId: r.audit_result_id || null,
    createdAt: r.created_at,
  };
}

export function getActionCard(id, userId) {
  const r = get('SELECT * FROM redv_action_cards WHERE id = ? AND user_id = ?', [id, userId]);
  if (!r) throw new HttpError(404, '行动卡不存在');
  return mapCardRow(r);
}

/** 标记：已通过小红书渠道发布，并记录渠道 */
export function markCardPublished(cardId, userId, channel) {
  const ch = String(channel || '').trim().slice(0, 120);
  if (!ch) throw new HttpError(400, '请填写发布渠道（如：小红书@账号名）');
  const cur = get('SELECT id FROM redv_action_cards WHERE id = ? AND user_id = ?', [cardId, userId]);
  if (!cur) throw new HttpError(404, '行动卡不存在');
  run(`UPDATE redv_action_cards SET publish_status = 'published', publish_channel = ?, published_at = CURRENT_TIMESTAMP WHERE id = ?`, [ch, cardId]);
  return getActionCard(cardId, userId);
}

/** 撤销发布标记 */
export function unmarkCardPublished(cardId, userId) {
  const cur = get('SELECT id FROM redv_action_cards WHERE id = ? AND user_id = ?', [cardId, userId]);
  if (!cur) throw new HttpError(404, '行动卡不存在');
  run(`UPDATE redv_action_cards SET publish_status = 'unpublished', publish_channel = NULL, published_at = NULL WHERE id = ?`, [cardId]);
  return getActionCard(cardId, userId);
}

/** 取出某品牌已标记发布的行动卡，供下次审计自动重测（最近 N 张） */
export function getPublishedCardsForRetest(userId, brandName, limit = 3) {
  return query(
    `SELECT id, brand_name, domain, target_question, title, publish_channel, published_at, baseline_json
     FROM redv_action_cards
     WHERE user_id = ? AND brand_name = ? AND publish_status = 'published'
     ORDER BY published_at DESC LIMIT ?`,
    [userId, brandName, Math.max(1, Math.min(5, limit || 3))]
  ).map((r) => ({
    id: r.id,
    brandName: r.brand_name,
    domain: r.domain,
    targetQuestion: r.target_question,
    title: r.title,
    publishChannel: r.publish_channel,
    publishedAt: r.published_at,
    baseline: r.baseline_json ? JSON.parse(r.baseline_json) : null,
  }));
}

function extractAnswerDomains(text) {
  const set = new Set();
  const re = /https?:\/\/([a-z0-9.-]+\.[a-z]{2,})/gi;
  let m;
  while ((m = re.exec(String(text || '')))) set.add(m[1].toLowerCase().replace(/^www\./, ''));
  return [...set].slice(0, 10);
}

function normDomain(d) {
  return String(d || '').toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
}

function fmtMentioned(v, locale) {
  const isEn = locale === 'en';
  if (v === true) return isEn ? 'mentioned' : '被提及';
  if (v === false) return isEn ? 'not mentioned' : '未被提及';
  return isEn ? 'unknown' : '未知';
}

/**
 * 对已发布弱点做一次真实模型重测：用同一问题问模型，对比基线时的提及/排名/引用域名。
 * 只陈述两次观测到的事实变化，不做因果承诺。
 */
export async function probeWeaknessRetest({ engine, brand, domain, question, baseline, cardId, title, publishChannel, publishedAt, locale = 'zh' }) {
  const isEn = locale === 'en';
  const msgs = [
    { role: 'system', content: isEn ? 'You are a helpful AI assistant. Answer objectively and concisely in English (under 250 words); use a numbered list for recommendations.' : '你是一个乐于助人的 AI 助手。请用中文客观、简洁地回答用户问题（300 字以内），如有推荐请用编号列表。' },
    { role: 'user', content: question },
  ];
  const r = await chat(engine, msgs, { temperature: 0.3, maxTokens: 900 });
  const answer = r.text || '';
  const m = analyzeMention(answer, brand);
  const citedOfficial = checkCitation(answer, domain);
  const domains = extractAnswerDomains(answer);
  const base = baseline || {};
  const baseDomains = (Array.isArray(base.cited_domains) ? base.cited_domains : []).map(normDomain).filter(Boolean);
  const newDomains = domains.filter((d) => !baseDomains.includes(d));
  const lostDomains = baseDomains.filter((d) => !domains.includes(d));
  const days = publishedAt ? Math.max(1, Math.round((Date.now() - new Date(publishedAt).getTime()) / 86400000)) : null;

  const mentionNow = m.mentioned ? (isEn ? `mentioned (rank #${m.rank || '?'})` : `被提及${m.rank ? `（排名第 ${m.rank} 位）` : ''}`) : (isEn ? 'not mentioned' : '暂未被提及');
  const mentionBase = fmtMentioned(base.likely_mentioned, locale);
  const citeBase = baseDomains.length ? baseDomains.join('、') : (isEn ? 'none observed' : '未观测到');
  const citeNow = domains.length ? domains.join('、') : (isEn ? 'none observed' : '未观测到');
  const deltaBits = [];
  if (newDomains.length) deltaBits.push(isEn ? `newly cited: ${newDomains.join(', ')}` : `新增引用：${newDomains.join('、')}`);
  if (lostDomains.length) deltaBits.push(isEn ? `no longer cited: ${lostDomains.join(', ')}` : `不再引用：${lostDomains.join('、')}`);
  const observation = isEn
    ? `Retest ${days ? `${days} day(s) after publishing` : 'after publishing'} (${engine.label}): the brand is ${mentionNow}; baseline was ${mentionBase}. Cited domains: baseline [${citeBase}] → now [${citeNow}]${deltaBits.length ? `; ${deltaBits.join('; ')}` : ''}. (Note: LLM outputs are probabilistic; this only states what was observed in the two tests and does not imply causation.)`
    : `发布后${days ? ` ${days} 天` : ''}重测（${engine.label}）：本次回答${mentionNow}，基线状态为${mentionBase}；引用域名：基线 [${citeBase}] → 本次 [${citeNow}]${deltaBits.length ? `；${deltaBits.join('；')}` : ''}。（注：大模型回答具有概率性，此处仅陈述两次观测到的事实变化，不构成因果保证）`;

  return {
    cardId,
    title: title || '',
    question,
    publishChannel: publishChannel || null,
    publishedAt: publishedAt || null,
    days,
    baseline: {
      mentioned: base.likely_mentioned ?? null,
      rank: base.rank ?? null,
      sentiment: base.sentiment ?? null,
      citedDomains: baseDomains,
      citedOfficial: base.cited_official ?? null,
    },
    current: {
      mentioned: m.mentioned,
      rank: m.rank,
      citedDomains: domains,
      citedOfficial: !!citedOfficial,
    },
    newDomains,
    lostDomains,
    observation,
    observedAt: new Date().toISOString(),
    engine: engine.label,
    model: r.model,
  };
}
