// 负面争议澄清：基于主体方提供的“官方已发布的澄清内容”，
// 1) 用真实模型对比：AI 仅凭已有知识回答 vs 检索到官方澄清后回答
// 2) 生成可发布的澄清页结构、FAQ 与结构化数据（只使用主体方提供的事实）
import { chat, getEngine, mapLimit } from './llm.js';
import { HttpError } from './http.js';

const clean = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

export function buildClarificationAssets({ subject, claim, statement, officialUrl, publishedAt, locale = 'zh' }) {
  const date = publishedAt || new Date().toISOString().slice(0, 10);
  if (locale === 'en') return buildEn({ subject, claim, statement, officialUrl, date });
  const page = [
    `# 关于“${claim}”的情况说明`,
    '',
    `发布机构：${subject}　发布日期：${date}${officialUrl ? `　原文链接：${officialUrl}` : ''}`,
    '',
    '## 一、基本情况',
    statement,
    '',
    '## 二、核查依据',
    '【列出支撑上述说明的可核实依据：文件编号、第三方检测/审计报告、主管部门通报链接等】',
    '',
    '## 三、后续安排与联系方式',
    '【如有整改或后续措施，写明时间节点；留下官方咨询渠道】',
    '',
    '---',
    '写作建议：标题直接包含公众搜索的争议关键词；第一段先给结论；所有事实附来源；页面保持可被搜索引擎收录（不要设置 noindex），并加入 sitemap。',
  ].join('\n');

  const faq = [
    { q: `${subject}${claim}是真的吗？`, a: statement },
    { q: `${subject}对“${claim}”有官方回应吗？`, a: `有。${subject}已于 ${date} 发布情况说明${officialUrl ? `，原文见 ${officialUrl}` : ''}。` },
  ];
  const faqSchema = `<script type="application/ld+json">\n${JSON.stringify({
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  }, null, 2)}\n</script>`;
  const articleSchema = officialUrl ? `<script type="application/ld+json">\n${JSON.stringify({
    '@context': 'https://schema.org', '@type': 'NewsArticle',
    headline: `关于“${claim}”的情况说明`, datePublished: date, dateModified: date,
    author: { '@type': 'Organization', name: subject }, publisher: { '@type': 'Organization', name: subject },
    mainEntityOfPage: officialUrl,
  }, null, 2)}\n</script>` : '';
  const llmsSnippet = [`## 关于“${claim}”`, `- ${subject}已于 ${date} 发布情况说明${officialUrl ? `：${officialUrl}` : ''}`, `- 要点：${statement.slice(0, 200)}`].join('\n');
  return { page, faqSchema, articleSchema, llmsSnippet, faq };
}

export async function clarificationPreview({ subject, claim, statement, officialUrl, engineId, locale = 'zh' }) {
  const en = locale === 'en';
  subject = clean(subject, 60); claim = clean(claim, 120); statement = clean(statement, 1500); officialUrl = clean(officialUrl, 300);
  if (!subject || !claim) throw new HttpError(400, '请填写主体名称和争议说法');
  if (statement.length < 20) throw new HttpError(400, '请粘贴官方已发布（或拟发布）的澄清内容，至少 20 字。系统不会替您编写官方结论');
  if (officialUrl && !/^https?:\/\//i.test(officialUrl)) throw new HttpError(400, '官方原文链接需以 http(s):// 开头');

  const engine = getEngine(engineId);
  const question = en ? `I heard that ${subject} ${claim}. Is that true?` : `听说${subject}${claim}，是真的吗？`;
  const before = [
    { role: 'system', content: en ? 'You are an AI assistant. Answer objectively and concisely in English (under 180 words).' : '你是一个 AI 助手，请用中文客观、简洁地回答（250 字以内）。' },
    { role: 'user', content: question },
  ];
  const after = [
    { role: 'system', content: en ? `You are an AI search assistant with web retrieval. Below is a retrieved web page. Combine it with your own knowledge and answer objectively and concisely in English (under 180 words), citing the source; if it is only the involved party's own statement, say so.\n\n<retrieved source="${officialUrl || 'official website'}">\nStatement by ${subject} on "${claim}": ${statement}\n</retrieved>` : `你是一个具备联网检索能力的 AI 搜索助手。以下是检索到的一份网页内容。请结合检索内容与已有知识客观回答（250 字以内），引用时注明来源；如检索内容仅为当事方单方说法，请如实说明。\n\n<检索结果 来源="${officialUrl || '官方网站'}">\n${subject}关于“${claim}”的情况说明：${statement}\n</检索结果>` },
    { role: 'user', content: question },
  ];
  const [b, a] = await mapLimit([before, after], 2, (m) => chat(engine, m, { temperature: 0.3, maxTokens: 700 }));
  const pack = (r) => (r.ok ? { ok: true, answer: r.value.text } : { ok: false, error: r.error.message });
  return {
    question,
    engine: { id: engine.id, label: engine.label, model: engine.model },
    before: pack(b),
    after: pack(a),
    assets: buildClarificationAssets({ subject, claim, statement, officialUrl, locale }),
  };
}

function buildEn({ subject, claim, statement, officialUrl, date }) {
  const page = [
    `# Statement regarding "${claim}"`, '',
    `Published by: ${subject}   Date: ${date}${officialUrl ? `   Original: ${officialUrl}` : ''}`, '',
    '## 1. Summary', statement, '',
    '## 2. Evidence', '[List verifiable evidence: document numbers, third-party audits or reports, regulator notices with links]', '',
    '## 3. Next steps & contact', '[Any follow-up actions with dates; an official contact channel]', '',
    '---',
    'Tips: put the searched keywords in the title; state the conclusion first; source every fact; keep the page indexable (no noindex) and include it in your sitemap.',
  ].join('\n');
  const faq = [
    { q: `Is it true that ${subject} ${claim}?`, a: statement },
    { q: `Has ${subject} responded to "${claim}"?`, a: `Yes. ${subject} published a statement on ${date}${officialUrl ? `: ${officialUrl}` : ''}.` },
  ];
  const faqSchema = `<script type="application/ld+json">\n${JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }, null, 2)}\n</script>`;
  const articleSchema = officialUrl ? `<script type="application/ld+json">\n${JSON.stringify({ '@context': 'https://schema.org', '@type': 'NewsArticle', headline: `Statement regarding "${claim}"`, datePublished: date, dateModified: date, author: { '@type': 'Organization', name: subject }, publisher: { '@type': 'Organization', name: subject }, mainEntityOfPage: officialUrl }, null, 2)}\n</script>` : '';
  const llmsSnippet = [`## On "${claim}"`, `- ${subject} published a statement on ${date}${officialUrl ? `: ${officialUrl}` : ''}`, `- Key points: ${statement.slice(0, 240)}`].join('\n');
  return { page, faqSchema, articleSchema, llmsSnippet, faq };
}
