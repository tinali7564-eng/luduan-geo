// 首推实验室：真实大模型 A/B 对比测试（版本 A vs 版本 B）与语料胶囊构建
import { chat, getEngine, mapLimit } from './llm.js';
import { HttpError } from './http.js';
import { get, query, run, incMonthlyUsage } from './db.js';
import { checkPlanFeature } from './plans.js';

const clean = (s, n = 200) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

export function buildCapsule(input, locale = 'zh') {
  const en = locale === 'en';
  const brand = clean(input.brand, 60);
  const domain = clean(input.domain, 120).replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const category = clean(input.category, 60);
  const keyword = clean(input.keyword, 80);
  const audience = clean(input.audience, 120);
  const facts = (Array.isArray(input.facts) ? input.facts : String(input.facts || '').split(/\n+/))
    .map(f => clean(f.replace(/^\s*(?:[-*•]|\d{1,2}[.、)）])\s*/, ''), 240)).filter(f => f.length >= 4).slice(0, 12);
  const competitors = (Array.isArray(input.competitors) ? input.competitors : String(input.competitors || '').split(/[,，、\n]/))
    .map(c => clean(c, 60)).filter(Boolean).slice(0, 5);
  const faqs = (Array.isArray(input.faqs) ? input.faqs : []).map(f => ({ q: clean(f.q, 120), a: clean(f.a, 500) })).filter(f => f.q && f.a).slice(0, 8);

  if (!brand || !domain) throw new HttpError(400, '请填写品牌名称和官网域名');
  if (facts.length < 2) throw new HttpError(400, '请至少填写 2 条真实、可核实的关键事实（每行一条），实验室只使用您提供的事实');

  const url = `https://${domain}`;
  const capsule = en ? [
    `# ${brand}`,
    '',
    `> ${brand}${category ? ` is ${/^[aeiou]/i.test(category) ? 'an' : 'a'} ${category}` : ''}${keyword ? ` focused on ${keyword}` : ''}${audience ? `, serving ${audience}` : ''}. Official website: ${url}`,
    '',
    '## Key facts',
    ...facts.map(f => `- ${f}`),
    ...(faqs.length ? ['', '## FAQ', ...faqs.flatMap(f => [`### ${f.q}`, f.a, ''])] : []),
    ...(competitors.length ? ['', '## Comparisons', `- Often compared with: ${competitors.join(', ')}`, '- [Suggested: add objective, quantified differences with sources]'] : []),
    '',
    '## Official links',
    `- Website: ${url}`,
    `- This file: ${url}/llms.txt`,
    '',
  ].join('\n') : [
    `# ${brand}`,
    '',
    `> ${brand}${category ? `是${category}` : ''}${keyword ? `，专注于「${keyword}」` : ''}${audience ? `，主要服务${audience}` : ''}。官方网站：${url}`,
    '',
    '## 关键事实',
    ...facts.map(f => `- ${f}`),
    ...(faqs.length ? ['', '## 常见问题', ...faqs.flatMap(f => [`### ${f.q}`, f.a, ''])] : []),
    ...(competitors.length ? ['', '## 同类对比说明', `- 常被拿来比较的对象：${competitors.join('、')}`, '- 【建议补充：与上述对象在可量化指标上的客观差异，并附来源】'] : []),
    '',
    '## 官方链接',
    `- 官网：${url}`,
    `- 本文件：${url}/llms.txt`,
    '',
  ].join('\n');

  const subject = category || (en ? 'options' : '机构/产品');
  const questions = en ? [
    keyword ? `Which ${subject} would you recommend for ${keyword}? Please list them with reasons.` : `What ${subject} would you recommend?`,
    `What do you know about ${brand}? What stands out?`,
    competitors[0] ? `How does ${brand} compare with ${competitors[0]}? Pros and cons?` : `What should I consider before choosing ${brand}?`,
  ] : [
    keyword ? `在「${keyword}」方面，有哪些值得推荐的${subject}？请列出并说明理由。` : `有哪些值得推荐的${subject}？`,
    `${brand}怎么样？有什么特点？`,
    competitors[0] ? `${brand}和${competitors[0]}相比，各有什么优缺点？` : `选择${brand}需要注意什么？`,
  ];

  const schema = `<script type="application/ld+json">\n${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': /大学|学院|学校|university|college/i.test(brand + category) ? 'CollegeOrUniversity' : 'Organization',
    name: brand, url, description: `${brand}${category ? `，${category}` : ''}`,
  }, null, 2)}\n</script>`;

  return { brand, domain, category, keyword, facts, competitors, faqs, capsule, questions, schema, locale };
}

// 分析回答中品牌出现的位置（是否被提及、在推荐列表里排第几）
export function analyzeMention(answer, brand, competitors = []) {
  const text = String(answer || '');
  const cleanBrand = String(brand || '').trim();
  const aliases = [cleanBrand, cleanBrand.replace(/(大学|学院|有限公司|公司|集团)$/, '')].filter(a => a && a.length >= 2);
  const idx = Math.min(...aliases.map(a => { const i = text.toLowerCase().indexOf(a.toLowerCase()); return i === -1 ? Infinity : i; }));
  const mentioned = Number.isFinite(idx);
  // 在编号/列表项中定位排名
  let rank = null;
  const items = text.split(/\n/).filter(l => /^\s*(\d+[.、)）]|[-*•]|#{2,4}\s|第[一二三四五六七八九十]+)/.test(l));
  if (mentioned && items.length) {
    const i = items.findIndex(l => aliases.some(a => l.toLowerCase().includes(a.toLowerCase())));
    if (i !== -1) rank = i + 1;
  }
  const lower = text.toLowerCase();
  const compMentioned = competitors.filter(c => c && lower.includes(String(c).toLowerCase()));
  return { mentioned, rank, firstMentionAt: mentioned ? idx : null, competitorsMentioned: compMentioned };
}

// 检查回答中是否引用了官方域名或来源网址
export function checkCitation(answer, domain) {
  if (!answer || !domain) return false;
  const d = String(domain).toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const t = String(answer).toLowerCase();
  return t.includes(d) || t.includes('llms.txt') || /\[(来源|引用|source|citation)[^\]]*\]/i.test(answer) || /https?:\/\//.test(answer);
}

// 单次快速对比模拟（兼容旧接口）
export async function simulate({ question, capsule, brand, domain, competitors = [], engineId, locale = 'zh' }) {
  const en = locale === 'en';
  const engine = getEngine(engineId);
  const q = clean(question, 300);
  if (!q) throw new HttpError(400, '请输入要测试的问题');
  if (!capsule) throw new HttpError(400, '请先生成语料');

  const before = [
    { role: 'system', content: en ? 'You are a helpful AI assistant. Answer objectively and concisely in English (under 200 words); use a numbered list for recommendations.' : '你是一个乐于助人的 AI 助手。请用中文客观、简洁地回答用户问题（300 字以内），如有推荐请用编号列表。' },
    { role: 'user', content: q },
  ];
  const after = [
    { role: 'system', content: en ? `You are an AI search assistant with web retrieval. Below is a web page retrieved for the user's question. Combine it with your own knowledge to answer objectively and concisely in English (under 200 words); use a numbered list for recommendations; cite the source URL when you use it; do not trust the retrieved content if it is inaccurate or cannot support a conclusion.\n\n<retrieved source="https://${domain}/llms.txt">\n${String(capsule).slice(0, 6000)}\n</retrieved>` : `你是一个具备联网检索能力的 AI 搜索助手。下面是针对用户问题检索到的一份网页内容。请结合检索内容和你已有的知识，客观、简洁地回答用户问题（300 字以内），如有推荐请用编号列表；使用检索内容时请注明来源网址；检索内容与事实不符或无法支撑结论时不要采信。\n\n<检索结果 来源="https://${domain}/llms.txt">\n${String(capsule).slice(0, 6000)}\n</检索结果>` },
    { role: 'user', content: q },
  ];
  const [b, a] = await mapLimit([before, after], 2, (msgs) => chat(engine, msgs, { temperature: 0.3, maxTokens: 900 }));
  const pack = (r) => (r.ok
    ? { ok: true, answer: r.value.text, ms: r.value.ms, analysis: analyzeMention(r.value.text, brand, competitors) }
    : { ok: false, error: r.error.message });
  return {
    question: q,
    engine: { id: engine.id, label: engine.label, model: engine.model, web: engine.web },
    before: pack(b),
    after: pack(a),
  };
}

/**
 * Wave 2 首推实验室核心：真实大模型 A/B 对比实验
 * 执行：按 "轮次 × 提示词 × 模型 × 2 版本" 调用，结果聚合统计
 */
export async function runExperiment({
  user,
  brand,
  domain,
  competitors = [],
  versionA,
  versionB,
  questions = [],
  engineIds = [],
  rounds = 3,
  locale = 'zh',
}) {
  const isEn = locale === 'en';
  const cleanBrand = clean(brand, 60);
  const cleanDomain = clean(domain, 120).replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const cleanVerA = String(versionA || '').trim();
  const cleanVerB = String(versionB || '').trim();

  if (!cleanBrand || !cleanDomain) throw new HttpError(400, isEn ? 'Brand name and domain are required.' : '请填写品牌名称和官网域名');
  if (!cleanVerA || !cleanVerB) throw new HttpError(400, isEn ? 'Both Version A and Version B texts are required.' : '请输入版本 A 和版本 B 的内容文本');

  // 权益额度核查（按次扣费）
  if (user) {
    checkPlanFeature(user, 'lab_experiment', { locale });
  }

  // 提示词集清理：1-8 个问题
  const qs = (Array.isArray(questions) ? questions : String(questions || '').split(/\n+/))
    .map(q => clean(q, 300)).filter(q => q.length >= 3).slice(0, 8);
  if (!qs.length) throw new HttpError(400, isEn ? 'Please provide at least 1 test question.' : '请至少选择或输入 1 个测试提示词');

  // 模型清单清理：1-4 个
  const validEngineIds = (Array.isArray(engineIds) ? engineIds : []).filter(Boolean);
  const engines = validEngineIds.map(id => {
    try { return getEngine(id); } catch { return null; }
  }).filter(Boolean);
  if (!engines.length) {
    // 默认回落到默认引擎
    engines.push(getEngine());
  }

  // 轮次控制：1-5，默认 3
  const rCount = Math.max(1, Math.min(5, parseInt(rounds, 10) || 3));

  // 组装全部调用任务：轮次 × 问题 × 模型 × 2 版本
  const tasks = [];
  for (let round = 1; round <= rCount; round++) {
    for (const q of qs) {
      for (const eng of engines) {
        tasks.push({ round, question: q, engine: eng, version: 'A', text: cleanVerA });
        tasks.push({ round, question: q, engine: eng, version: 'B', text: cleanVerB });
      }
    }
  }

  const sysPrompt = (content) => (isEn
    ? `You are an AI search assistant with web retrieval. Below is a web page retrieved for the user's question. Combine it with your own knowledge to answer objectively and concisely in English (under 250 words); use a numbered list for recommendations; cite the source URL when you use it; do not trust retrieved content if it cannot support a conclusion.\n\n<retrieved source="https://${cleanDomain}/llms.txt">\n${String(content).slice(0, 5000)}\n</retrieved>`
    : `你是一个具备联网检索能力的 AI 搜索助手。下面是针对用户问题检索到的网页内容。请结合检索内容和你已有的知识，客观、简洁地回答用户问题（300 字以内），如有推荐请用编号列表；使用检索内容时请注明来源网址；检索内容与事实不符或无法支撑结论时不要采信。\n\n<检索结果 来源="https://${cleanDomain}/llms.txt">\n${String(content).slice(0, 5000)}\n</检索结果>`);

  // 并发调用大模型，控制并发度为 3
  const results = await mapLimit(tasks, 3, async (task) => {
    try {
      const msgs = [
        { role: 'system', content: sysPrompt(task.text) },
        { role: 'user', content: task.question },
      ];
      const r = await chat(task.engine, msgs, { temperature: 0.35, maxTokens: 900 });
      const ans = r.text || '';
      const mention = analyzeMention(ans, cleanBrand, competitors);
      const cited = checkCitation(ans, cleanDomain);
      return {
        ok: true,
        round: task.round,
        question: task.question,
        engineId: task.engine.id,
        engineLabel: task.engine.label,
        version: task.version,
        answer: ans,
        ms: r.ms,
        mention,
        cited,
      };
    } catch (err) {
      return {
        ok: false,
        round: task.round,
        question: task.question,
        engineId: task.engine.id,
        engineLabel: task.engine.label,
        version: task.version,
        error: err.message,
      };
    }
  });

  // 聚合统计结果
  const totalCalls = tasks.length;
  const pairCount = totalCalls / 2;

  let mentionsA = 0, mentionsB = 0;
  let ranksA = [], ranksB = [];
  let citesA = 0, citesB = 0;
  let winsA = 0, winsB = 0, ties = 0;

  const pairs = [];
  for (let round = 1; round <= rCount; round++) {
    for (const q of qs) {
      for (const eng of engines) {
        const itemA = results.find(x => x.round === round && x.question === q && x.engineId === eng.id && x.version === 'A') || { ok: false };
        const itemB = results.find(x => x.round === round && x.question === q && x.engineId === eng.id && x.version === 'B') || { ok: false };

        if (itemA.ok && itemA.mention?.mentioned) {
          mentionsA++;
          if (itemA.mention.rank) ranksA.push(itemA.mention.rank);
        }
        if (itemA.ok && itemA.cited) citesA++;

        if (itemB.ok && itemB.mention?.mentioned) {
          mentionsB++;
          if (itemB.mention.rank) ranksB.push(itemB.mention.rank);
        }
        if (itemB.ok && itemB.cited) citesB++;

        // 单题对决打分
        let scoreA = 0, scoreB = 0;
        if (itemA.ok && itemA.mention?.mentioned) scoreA += 10;
        if (itemA.ok && itemA.mention?.rank) scoreA += Math.max(0, 6 - itemA.mention.rank);
        if (itemA.ok && itemA.cited) scoreA += 4;

        if (itemB.ok && itemB.mention?.mentioned) scoreB += 10;
        if (itemB.ok && itemB.mention?.rank) scoreB += Math.max(0, 6 - itemB.mention.rank);
        if (itemB.ok && itemB.cited) scoreB += 4;

        let pairWinner = 'TIE';
        if (scoreB > scoreA) { winsB++; pairWinner = 'B'; }
        else if (scoreA > scoreB) { winsA++; pairWinner = 'A'; }
        else { ties++; }

        pairs.push({
          round,
          question: q,
          engineLabel: eng.label,
          winner: pairWinner,
          a: itemA,
          b: itemB,
        });
      }
    }
  }

  const mentionRateA = pairCount ? Math.round((mentionsA / pairCount) * 100) : 0;
  const mentionRateB = pairCount ? Math.round((mentionsB / pairCount) * 100) : 0;
  const avgRankA = ranksA.length ? Number((ranksA.reduce((a, b) => a + b, 0) / ranksA.length).toFixed(1)) : null;
  const avgRankB = ranksB.length ? Number((ranksB.reduce((a, b) => a + b, 0) / ranksB.length).toFixed(1)) : null;
  const citationRateA = pairCount ? Math.round((citesA / pairCount) * 100) : 0;
  const citationRateB = pairCount ? Math.round((citesB / pairCount) * 100) : 0;

  const winner = winsB > winsA ? 'B' : winsA > winsB ? 'A' : 'TIE';

  // 人话建议
  let humanAdvice = '';
  if (winner === 'B') {
    humanAdvice = isEn
      ? `Version B performed better in ${winsB} of ${pairCount} test runs (mention rate ${mentionRateB}% vs ${mentionRateA}%${avgRankB ? `, avg rank #${avgRankB}` : ''}). We recommend deploying Version B.`
      : `版本 B 在 ${pairCount} 个测试样本中 ${winsB} 次表现更优（提及率 ${mentionRateB}% vs ${mentionRateA}%${avgRankB ? `，平均推荐排名第 ${avgRankB} 位` : ''}），建议采用版本 B。`;
  } else if (winner === 'A') {
    humanAdvice = isEn
      ? `Version A performed better in ${winsA} of ${pairCount} test runs (mention rate ${mentionRateA}% vs ${mentionRateB}%). We recommend keeping Version A or refining key facts in Version B.`
      : `版本 A 在 ${pairCount} 个测试样本中 ${winsA} 次表现更优（提及率 ${mentionRateA}% vs ${mentionRateB}%），建议暂保留版本 A 或对版本 B 进行量化事实提炼后重试。`;
  } else {
    humanAdvice = isEn
      ? `Both versions showed comparable visibility across models (mention rate ${mentionRateB}% vs ${mentionRateA}%). Choose according to your brand voice.`
      : `两版本在多模型多轮测试中整体表现接近（提及率 ${mentionRateB}% vs ${mentionRateA}%），均能被 AI 检索有效提取，可根据品牌文风自由选用。`;
  }

  // 诚实红线标注
  const honestDisclaimer = isEn
    ? `Conducted ${rCount} sampling round(s) across ${engines.length} model(s) (${totalCalls} LLM invocations total). Single-run model outputs exhibit random variance. Results are observational and provided for optimization reference only; they do not constitute a performance or ranking guarantee.`
    : `报告已执行 ${rCount} 轮采样、跨 ${engines.length} 个大模型（共完成 ${totalCalls} 次模型真实调用）。大模型单轮输出具有随机性与噪声，本次对比结果仅陈述客观观测，供优化参考，不构成任何搜索或模型推荐效果的因果保证。`;

  const stats = {
    totalCalls,
    pairCount,
    rounds: rCount,
    engines: engines.map(e => e.label),
    winner,
    a: {
      mentions: mentionsA,
      mentionRate: mentionRateA,
      avgRank: avgRankA,
      citations: citesA,
      citationRate: citationRateA,
      wins: winsA,
    },
    b: {
      mentions: mentionsB,
      mentionRate: mentionRateB,
      avgRank: avgRankB,
      citations: citesB,
      citationRate: citationRateB,
      wins: winsB,
    },
    ties,
  };

  // 成功完成后扣减月度额度
  if (user) {
    incMonthlyUsage(user.id, 'lab_run', 1);
  }

  // 存盘归档
  let expId = null;
  if (user) {
    const r = run(`INSERT INTO lab_experiments (user_id, brand_name, domain, version_a, version_b, questions_json, engines_json, rounds, stats_json, summary_text, winner)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user.id, cleanBrand, cleanDomain, cleanVerA, cleanVerB, JSON.stringify(qs), JSON.stringify(engines.map(e => e.id)), rCount, JSON.stringify(stats), humanAdvice, winner]);
    expId = r.lastID;
  }

  return {
    id: expId,
    brand: cleanBrand,
    domain: cleanDomain,
    rounds: rCount,
    engines: engines.map(e => e.label),
    stats,
    summary: stats,
    winner,
    advice: humanAdvice,
    disclaimer: honestDisclaimer,
    noiseDisclaimer: honestDisclaimer,
    pairs,
    samples: pairs,
    totalSamples: totalCalls,
  };
}

export function listExperiments(userId) {
  if (!userId) return [];
  return query(`SELECT id, brand_name, domain, rounds, winner, summary_text, created_at, stats_json
                FROM lab_experiments WHERE user_id = ? ORDER BY id DESC LIMIT 20`, [userId]).map(r => ({
    id: r.id,
    brand: r.brand_name,
    domain: r.domain,
    rounds: r.rounds,
    winner: r.winner,
    summary: r.summary_text,
    createdAt: r.created_at,
    stats: r.stats_json ? JSON.parse(r.stats_json) : null,
  }));
}

export function getExperiment(id, userId) {
  const row = get('SELECT * FROM lab_experiments WHERE id = ? AND user_id = ?', [id, userId]);
  if (!row) throw new HttpError(404, '实验记录不存在');
  return {
    id: row.id,
    brand: row.brand_name,
    domain: row.domain,
    versionA: row.version_a,
    versionB: row.version_b,
    rounds: row.rounds,
    winner: row.winner,
    advice: row.summary_text,
    stats: row.stats_json ? JSON.parse(row.stats_json) : null,
    questions: JSON.parse(row.questions_json || '[]'),
    engines: JSON.parse(row.engines_json || '[]'),
    createdAt: row.created_at,
  };
}
