// AI 舆情认知监测：围绕一个主体/事件生成标准问题 → 用多个真实大模型作答 → 由评审模型逐条分析 → 计算风险与可见度与趋势
import crypto from 'crypto';
import { chat, chatJson, getEngine, judgeEngine, mapLimit } from './llm.js';
import { get, query, run, addNotification } from './db.js';
import { calculateRiskAndVisibility } from './risk_score.js';
import { config, r2Configured } from './config.js';
import { uploadToR2 } from './r2.js';
import { sendTelegramAlert } from './alerts.js';
import { checkPlanFeature } from './plans.js';

export const CATEGORY_LABELS = {
  fact_check: '事实确认',
  evaluation: '评价判断',
  recommendation: '选择推荐',
  risk_spread: '风险扩散',
};

export const CATEGORY_LABELS_EN = {
  fact_check: 'Fact check',
  evaluation: 'Evaluation',
  recommendation: 'Recommendation',
  risk_spread: 'Risk spread',
};

function generateQuestionsEn(s, c, industry) {
  const peer = industry === 'education' ? 'similar universities' : 'similar organizations or products';
  const qs = [
    { category: 'evaluation', question: `What is ${s} like? How is its reputation?` },
    { category: 'recommendation', question: `When choosing among ${peer}, would you recommend ${s}? Pros and cons?` },
    { category: 'risk_spread', question: `What negative news or controversies has ${s} had recently?` },
    { category: 'recommendation', question: `What are good alternatives to ${s}?` },
  ];
  if (c) {
    qs.unshift(
      { category: 'fact_check', question: `I heard that ${s} ${c}. Is that true? Is there an official statement?` },
      { category: 'fact_check', question: `What exactly happened with ${s} regarding "${c}"?` },
    );
    qs.push({ category: 'evaluation', question: `How did ${s} respond to the "${c}" controversy, and how well was it handled?` });
  } else {
    qs.unshift({ category: 'fact_check', question: `Please give an overview of ${s}.` });
  }
  return qs.slice(0, 7);
}

export function generateQuestions(subject, claim, industry, locale = 'zh') {
  if (locale === 'en') return generateQuestionsEn(subject, claim, industry);
  const s = subject; const c = claim;
  const peer = industry === 'education' ? '同类高校' : '同类机构或产品';
  const qs = [
    { category: 'evaluation', question: `${s}怎么样？口碑和整体评价如何？` },
    { category: 'recommendation', question: `在选择${peer}时，推荐${s}吗？有哪些优缺点？` },
    { category: 'risk_spread', question: `${s}最近有哪些负面新闻或争议？` },
    { category: 'recommendation', question: `有哪些可以替代${s}的选择？` },
  ];
  if (c) {
    qs.unshift(
      { category: 'fact_check', question: `听说“${s}${c}”，这是真的吗？有官方说法吗？` },
      { category: 'fact_check', question: `关于${s}“${c}”的事情，具体是怎么回事？` },
    );
    qs.push({ category: 'evaluation', question: `${s}是如何回应“${c}”相关争议的？处理得怎么样？` });
  } else {
    qs.unshift({ category: 'fact_check', question: `请介绍一下${s}的基本情况。` });
  }
  return qs.slice(0, 7);
}

const JUDGE_SYSTEM = `你是舆情分析员，负责客观分析某个 AI 助手对问题的回答。只根据“回答原文”判断，不要引入你自己的知识。严格输出 JSON。`;

async function judge({ subject, claim, officialStatement, domain, question, answer, locale = 'zh' }) {
  const prompt = `监测主体：${subject}
${claim ? `网络争议说法：${claim}\n` : ''}${officialStatement ? `官方已发布的说法（由主体方提供）：${officialStatement}\n` : ''}${domain ? `官方网站域名：${domain}\n` : ''}
问题：${question}

回答原文：
"""
${answer.slice(0, 4000)}
"""

请输出 JSON：
{
  "mentioned": true/false,               // 回答是否提到了监测主体
  "sentiment": "positive|neutral|negative", // 回答对监测主体的整体倾向
  "repeats_claim_as_fact": true/false,   // 是否把网络争议说法当作既定事实陈述（没有争议说法时填 false）
  "mentions_official": true/false,       // 是否引用或转述了主体方的官方回应、官网或官方渠道信息（仅说“未见官方回应”不算）
  "consistent_with_official": true/false/null, // 与官方说法是否一致（未提供官方说法填 null）
  "recommended": true/false,             // 是否把监测主体作为推荐选项
  "cited_domains": ["回答中出现的网址或网站域名"],
  "summary": "30 字以内概括该回答对主体的描述"
}${locale === 'en' ? '\n\nWrite the "summary" value in English (under 20 words).' : ''}`;
  const r = await chatJson(judgeEngine(), [
    { role: 'system', content: JUDGE_SYSTEM },
    { role: 'user', content: prompt },
  ], { temperature: 0, maxTokens: 600 });
  return r.json || {};
}

export function createRun({ user, userId, subject, domain, claim, officialStatement, riskLevel, industry, engineIds, locale = 'zh' }) {
  const uid = user?.id || userId;
  // 免费用户每周 1 次频率核查
  if (user) {
    checkPlanFeature(user, 'risk_run', { locale });
  }

  const engines = [...new Set(engineIds)].map(id => getEngine(id)).filter((e, i, a) => a.findIndex(x => x.id === e.id) === i);
  let subj = get('SELECT * FROM geo_sentiment_subjects WHERE user_id = ? AND name = ?', [uid, subject]);
  if (!subj) {
    const r = run('INSERT INTO geo_sentiment_subjects (user_id, name, aliases, domain, industry, risk_threshold) VALUES (?, ?, ?, ?, ?, 60)',
      [uid, subject, subject, domain || '', industry]);
    subj = get('SELECT * FROM geo_sentiment_subjects WHERE id = ?', [r.lastID]);
  } else if (domain && domain !== subj.domain) {
    run('UPDATE geo_sentiment_subjects SET domain = ?, industry = ? WHERE id = ?', [domain, industry, subj.id]);
    subj.domain = domain;
  }
  const code = `EVT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const ev = run(`INSERT INTO geo_sentiment_events (subject_id, event_code, title, main_claim, risk_level, sentiment, source_types, article_count)
                  VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [subj.id, code, claim || (locale === 'en' ? `${subject} · routine check` : `${subject} 常规认知监测`), officialStatement || '', riskLevel, claim ? 'negative' : 'neutral', 'user_input']);
  const questions = generateQuestions(subject, claim, industry, locale).map(q => {
    const r = run('INSERT INTO geo_event_questions (event_id, category, question, status) VALUES (?, ?, ?, ?)', [ev.lastID, q.category, q.question, 'pending']);
    return { id: r.lastID, ...q };
  });
  const runRow = run('INSERT INTO risk_runs (user_id, subject_id, event_id, status, engines, total, done) VALUES (?, ?, ?, ?, ?, ?, 0)',
    [uid, subj.id, ev.lastID, 'queued', JSON.stringify(engines.map(e => ({ id: e.id, label: e.label, model: e.model, web: e.web }))), questions.length * engines.length]);
  const runId = runRow.lastID;

  // 后台执行，接口立即返回任务 ID，前端轮询进度
  setImmediate(() => executeRun({ runId, subj, eventId: ev.lastID, eventCode: code, claim, officialStatement, questions, engines, locale })
    .catch(e => {
      console.error('[risk run]', e);
      run("UPDATE risk_runs SET status = 'failed', error = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?", [String(e.message).slice(0, 300), runId]);
    }));
  return { runId, eventCode: code, total: questions.length * engines.length };
}

async function executeRun({ runId, subj, eventId, eventCode, claim, officialStatement, questions, engines, locale = 'zh' }) {
  run("UPDATE risk_runs SET status = 'running' WHERE id = ?", [runId]);
  const tasks = questions.flatMap(q => engines.map(e => ({ q, e })));
  const domain = (subj.domain || '').toLowerCase();

  await mapLimit(tasks, Math.min(config.llm.concurrency, 3), async ({ q, e }) => {
    let answer = '', model = e.model, analysis = {}, error = null;
    try {
      const r = await chat(e, [
        { role: 'system', content: locale === 'en' ? 'You are an AI assistant. Answer the user objectively in English (under 250 words).' : '你是一个 AI 助手，请用中文客观回答用户的问题（400 字以内）。' },
        { role: 'user', content: q.question },
      ], { temperature: 0.3, maxTokens: 900 });
      answer = r.text; model = r.model;
    } catch (err) {
      error = err.message;
    }

    if (answer && !error) {
      try {
        analysis = await judge({ subject: subj.name, claim, officialStatement, domain, question: q.question, answer, locale });
      } catch (jErr) {
        console.warn(`[judge warning for ${e.label}]`, jErr.message);
        analysis = {
          mentioned: answer.includes(subj.name),
          sentiment: 'neutral',
          repeats_claim_as_fact: claim ? answer.includes(claim) : false,
          mentions_official: domain ? answer.includes(domain) : false,
          summary: answer.slice(0, 50),
        };
      }
    }
    const domains = Array.isArray(analysis.cited_domains) ? analysis.cited_domains.map(String).slice(0, 10) : [];
    const citedOfficial = !!(domain && (answer.toLowerCase().includes(domain) || domains.some(d => d.toLowerCase().includes(domain))));
    const r2Key = r2Configured() && answer ? `raw/ai/${new Date().toISOString().slice(0, 10)}/${eventCode}/${e.id}_q${q.id}.json` : null;
    run(`INSERT INTO geo_ai_audits (question_id, platform, brand_mentioned, mention_rank, is_recommended, sentiment, is_hallucinated,
          cited_official, cited_domains, r2_raw_key, summary, run_id, engine_label, model, answer_text, analysis_json, error)
         VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      q.id, e.id,
      analysis.mentioned === false ? 0 : (error ? 0 : 1),
      analysis.recommended ? 1 : 0,
      error ? 'neutral' : (['positive', 'neutral', 'negative'].includes(analysis.sentiment) ? analysis.sentiment : 'neutral'),
      analysis.repeats_claim_as_fact ? 1 : 0,
      citedOfficial || analysis.mentions_official ? 1 : 0,
      domains.join(', '),
      r2Key,
      String(analysis.summary || '').slice(0, 200),
      runId, e.label, model, answer, JSON.stringify(analysis), error,
    ]);
    if (r2Key) uploadToR2(r2Key, { eventCode, subject: subj.name, engine: e.label, model, question: q.question, answer, analysis, at: new Date().toISOString() }).catch(() => {});
    run('UPDATE risk_runs SET done = done + 1 WHERE id = ?', [runId]);
  });

  for (const q of questions) run("UPDATE geo_event_questions SET status = 'completed' WHERE id = ?", [q.id]);

  const audits = query('SELECT * FROM geo_ai_audits WHERE run_id = ? AND error IS NULL', [runId]);
  if (!audits.length) {
    const firstErr = get('SELECT error FROM geo_ai_audits WHERE run_id = ? AND error IS NOT NULL LIMIT 1', [runId]);
    throw new Error(`所有模型调用均失败：${firstErr?.error || '未知错误'}`);
  }
  const evaluation = calculateRiskAndVisibility({
    sentimentEvents: [get('SELECT * FROM geo_sentiment_events WHERE id = ?', [eventId])],
    aiAudits: audits,
    subjectDomain: subj.domain,
  });
  // 各引擎分项
  evaluation.byEngine = engines.map(e => {
    const list = audits.filter(a => a.platform === e.id);
    const n = list.length || 1;
    return {
      id: e.id, label: e.label, answered: list.length,
      negativeRate: Math.round(list.filter(a => a.sentiment === 'negative').length / n * 100),
      claimRepeatRate: Math.round(list.filter(a => a.is_hallucinated).length / n * 100),
      officialRate: Math.round(list.filter(a => a.cited_official).length / n * 100),
    };
  });
  const alert = evaluation.comprehensiveRiskScore >= (subj.risk_threshold || 60) ? 1 : 0;
  run(`INSERT INTO geo_risk_snapshots (subject_id, event_id, comprehensive_risk_score, visibility_score, quadrant, ai_pollution_rate, official_absent_rate, alert_triggered)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [subj.id, eventId, evaluation.comprehensiveRiskScore, evaluation.visibilityScore, evaluation.quadrant, evaluation.aiPollutionRate, evaluation.officialAbsentRate, alert]);
  run("UPDATE risk_runs SET status = 'done', evaluation_json = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?", [JSON.stringify(evaluation), runId]);

  // Wave 2 阈值告警与站内通知
  try {
    const negRate = evaluation.breakdown?.aiNegativeRate || 0;
    // 1. 负面情感占比突增（如单轮 >30%）
    if (negRate >= 30) {
      addNotification(subj.user_id, {
        type: 'risk_alert',
        title: `【舆情告警】主体「${subj.name}」负面倾向达 ${negRate}%`,
        message: `在最新监测中，大模型回答负面情感占比已达 ${negRate}%（超过 30% 预警阈值），请进入详情页核实具体提问。`,
        link: `#/risk?runId=${runId}`,
      });
    }

    // 2. 提及率/可见度环比骤降（如 -50%）
    const prevRun = get(`SELECT evaluation_json FROM risk_runs
                         WHERE user_id = ? AND subject_id = ? AND id < ? AND status = 'done'
                         ORDER BY id DESC LIMIT 1`, [subj.user_id, subj.id, runId]);
    if (prevRun?.evaluation_json) {
      const prevEv = JSON.parse(prevRun.evaluation_json);
      const prevVis = prevEv.visibilityScore || 0;
      const curVis = evaluation.visibilityScore || 0;
      if (prevVis >= 20 && (prevVis - curVis) / prevVis >= 0.5) {
        addNotification(subj.user_id, {
          type: 'risk_alert',
          title: `【舆情告警】主体「${subj.name}」AI 可见度骤降`,
          message: `主体 AI 可见度从 ${prevVis} 降至 ${curVis}（环比降幅达 ${Math.round((prevVis - curVis) / prevVis * 100)}%），曝光度显著下降。`,
          link: `#/risk?runId=${runId}`,
        });
      }
    }

    // 3. 竞品被提及而本方未被提及告警
    const compAudits = audits.filter(a => a.cited_domains && a.cited_domains.length > 0 && !a.brand_mentioned);
    if (compAudits.length >= 2) {
      addNotification(subj.user_id, {
        type: 'risk_alert',
        title: `【舆情告警】第三方竞品被推荐而「${subj.name}」缺席`,
        message: `在相关选型问题中模型推荐了第三方竞品而未包含本方，存在核心业务词被竞品替代的风险。`,
        link: `#/risk?runId=${runId}`,
      });
    }
  } catch (alertErr) {
    console.error('[risk alert error]', alertErr.message);
  }

  if (alert) {
    sendTelegramAlert({
      subjectName: subj.name, eventTitle: claim || '常规监测', riskScore: evaluation.comprehensiveRiskScore,
      quadrant: evaluation.quadrant, aiPollutionRate: evaluation.aiPollutionRate, officialAbsentRate: evaluation.officialAbsentRate,
      details: [`负面回答占比 ${evaluation.breakdown.aiNegativeRate}%`, `把争议说法当事实的回答占比 ${evaluation.breakdown.aiHallucinationRate}%`, `未提及官方信息的回答占比 ${evaluation.breakdown.officialAbsentRate}%`],
    }).catch(() => {});
  }
}

export function getRun(runId, userId, locale = 'zh') {
  const LABELS = locale === 'en' ? CATEGORY_LABELS_EN : CATEGORY_LABELS;
  const r = get(`SELECT r.*, s.name AS subject_name, s.domain AS subject_domain, e.main_claim AS claim_official, e.title AS event_title, e.event_code, e.risk_level
                 FROM risk_runs r JOIN geo_sentiment_subjects s ON r.subject_id = s.id JOIN geo_sentiment_events e ON r.event_id = e.id
                 WHERE r.id = ? AND r.user_id = ?`, [runId, userId]);
  if (!r) return null;
  const questions = query('SELECT id, category, question FROM geo_event_questions WHERE event_id = ? ORDER BY id', [r.event_id]);
  const audits = query(`SELECT id, question_id, platform, engine_label, model, sentiment, brand_mentioned, is_recommended, is_hallucinated, cited_official,
                        cited_domains, summary, error, substr(answer_text, 1, 260) AS excerpt FROM geo_ai_audits WHERE run_id = ? ORDER BY id`, [runId]);
  return {
    id: r.id, status: r.status, total: r.total, done: r.done, error: r.error,
    subject: r.subject_name, domain: r.subject_domain, claim: r.event_title, officialStatement: r.claim_official, riskLevel: r.risk_level, eventCode: r.event_code,
    engines: JSON.parse(r.engines || '[]'), createdAt: r.created_at, finishedAt: r.finished_at,
    evaluation: r.evaluation_json ? JSON.parse(r.evaluation_json) : null,
    questions: questions.map(q => ({ ...q, categoryLabel: LABELS[q.category] || q.category })),
    audits,
  };
}

export function listRuns(userId) {
  return query(`SELECT r.id, r.status, r.total, r.done, r.created_at, r.evaluation_json, s.name AS subject, e.title AS claim
                FROM risk_runs r JOIN geo_sentiment_subjects s ON r.subject_id = s.id JOIN geo_sentiment_events e ON r.event_id = e.id
                WHERE r.user_id = ? ORDER BY r.id DESC LIMIT 30`, [userId]).map(r => {
    const ev = r.evaluation_json ? JSON.parse(r.evaluation_json) : null;
    return { id: r.id, status: r.status, total: r.total, done: r.done, createdAt: r.created_at, subject: r.subject, claim: r.claim,
      risk: ev?.comprehensiveRiskScore ?? null, visibility: ev?.visibilityScore ?? null, quadrant: ev?.quadrant ?? null };
  });
}

/**
 * Wave 2 趋势分析：获取主体随时间演进的提及率与负面情感曲线数据
 */
export function getRiskTrends(userId, subjectName = null) {
  const params = [userId];
  let sql = `SELECT r.id, r.created_at, r.finished_at, r.evaluation_json, s.name AS subject, e.title AS claim
             FROM risk_runs r
             JOIN geo_sentiment_subjects s ON r.subject_id = s.id
             JOIN geo_sentiment_events e ON r.event_id = e.id
             WHERE r.user_id = ? AND r.status = 'done'`;
  if (subjectName) {
    sql += ' AND s.name = ?';
    params.push(subjectName);
  }
  sql += ' ORDER BY r.id ASC LIMIT 30';

  return query(sql, params).map(r => {
    const ev = r.evaluation_json ? JSON.parse(r.evaluation_json) : {};
    const b = ev.breakdown || {};
    return {
      id: r.id,
      date: (r.finished_at || r.created_at || '').slice(0, 16),
      subject: r.subject,
      claim: r.claim,
      riskScore: ev.comprehensiveRiskScore ?? 0,
      visibilityScore: ev.visibilityScore ?? 0,
      negativeRate: b.aiNegativeRate ?? 0,
      hallucinationRate: b.aiHallucinationRate ?? 0,
      officialAbsentRate: b.officialAbsentRate ?? 0,
      quadrant: ev.quadrant || 'low_vis_low_risk',
    };
  });
}

export function getAudit(auditId, userId, locale = 'zh') {
  const a = get(`SELECT a.*, q.question, q.category FROM geo_ai_audits a
                 JOIN geo_event_questions q ON a.question_id = q.id
                 JOIN geo_sentiment_events e ON q.event_id = e.id
                 JOIN geo_sentiment_subjects s ON e.subject_id = s.id
                 WHERE a.id = ? AND s.user_id = ?`, [auditId, userId]);
  if (!a) return null;
  return {
    id: a.id, engine: a.engine_label || a.platform, model: a.model, question: a.question, category: (locale === 'en' ? CATEGORY_LABELS_EN : CATEGORY_LABELS)[a.category] || a.category,
    answer: a.answer_text || a.summary, analysis: a.analysis_json ? JSON.parse(a.analysis_json) : null, error: a.error, createdAt: a.created_at,
  };
}
