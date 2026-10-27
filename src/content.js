// 内容可引用性检查：粘贴一段正文，检查 AI 引用友好度；可选让模型给出改写稿（不编造事实，缺数据处用【】标注）
import { countWords } from './audit_engine.js';
import { chat, getEngine } from './llm.js';

const STAT_RE = /(\d{1,3}(?:[,，]\d{3})+|\d+(?:\.\d+)?)\s?(%|％|倍|万|亿|个|项|家|所|名|位|人|次|篇|元|小时|分钟|秒|天|周|月|年|ms|gb|mb|times|percent|years?|users?)/gi;
const Q_LINE = /^(#{1,4}\s*)?.{2,80}(\?|？)\s*$/;

export function analyzeContent(text, locale = 'zh') {
  const t = String(text || '');
  const words = countWords(t);
  const stats = (t.match(STAT_RE) || []).length;
  const density = stats / Math.max(words, 1) * 1000;
  const lines = t.split(/\n/).map(l => l.trim()).filter(Boolean);
  const questions = lines.filter(l => Q_LINE.test(l)).length;
  const headings = lines.filter(l => /^#{1,4}\s/.test(l)).length;
  const links = (t.match(/https?:\/\/[^\s)）\]]+/g) || []).length;
  const listItems = lines.filter(l => /^([-*•]|\d+[.、)])\s*/.test(l)).length;
  const tableRows = lines.filter(l => /^\|.*\|$/.test(l)).length;
  const firstPara = lines.find(l => !/^#/.test(l)) || '';
  const hype = (t.match(/(第一|最强|最好|顶级|领先|唯一|最佳|No\.?\s?1|#1|首选|遥遥领先|全网最|best-in-class|world-class|the best|leading|unrivaled|unmatched)/gi) || []);

  const L = (zh, en) => (locale === 'en' ? en : zh);
  const hypeList = [...new Set(hype)].slice(0, 4);
  const checks = [
    { key: 'length', label: L('信息量', 'Length'), pass: words >= 300, detail: L(`约 ${words} 字`, `~${words} words`), fix: L('内容偏短，AI 难以从中提取完整答案。建议补充到 300 字以上。', 'Too short for AI to extract a complete answer. Aim for 300+ words.') },
    { key: 'stats', label: L('具体数据', 'Specific data'), pass: density >= 5, detail: L(`${stats} 处数据（每千字 ${density.toFixed(1)} 处）`, `${stats} data points (${density.toFixed(1)} per 1,000 words)`), fix: L('补充可核实的数字：规模、时间、指标、对比结果，并注明来源。', 'Add verifiable numbers — scale, dates, metrics, comparisons — with sources.') },
    { key: 'answer_first', label: L('开门见山', 'Answer first'), pass: firstPara.length >= 20 && firstPara.length <= 200, detail: firstPara ? L(`首段 ${firstPara.length} 字`, `First paragraph: ${firstPara.length} chars`) : L('无正文首段', 'No opening paragraph'), fix: L('第一段用 1~2 句话直接给出结论/定义，便于 AI 直接摘取。', 'Open with a 1–2 sentence answer or definition that AI can quote directly.') },
    { key: 'questions', label: L('问答结构', 'Q&A structure'), pass: questions >= 2, detail: L(`${questions} 个问句式标题`, `${questions} question headings`), fix: L('加入用户会问 AI 的问题作为小标题，每个问题下紧跟直接回答。', 'Use questions people ask AI as subheadings, each followed by a direct answer.') },
    { key: 'structure', label: L('层次结构', 'Structure'), pass: headings >= 2 || listItems >= 3 || tableRows >= 3, detail: L(`${headings} 个标题、${listItems} 个列表项、${tableRows} 行表格`, `${headings} headings, ${listItems} list items, ${tableRows} table rows`), fix: L('用小标题、列表或表格组织内容，结构化信息更容易被引用。', 'Organize with subheadings, lists or tables — structured content is easier to cite.') },
    { key: 'sources', label: L('来源引用', 'Sources'), pass: links >= 1, detail: L(`${links} 个来源链接`, `${links} source links`), fix: L('为关键事实附上来源链接（官方文件、权威媒体、研究报告）。', 'Link key facts to sources (official documents, reputable media, research).') },
    { key: 'hype', label: L('避免空泛夸大', 'No empty superlatives'), pass: hype.length <= 1, detail: hype.length ? L(`出现 ${hype.length} 处绝对化用语（${hypeList.join('、')}）`, `${hype.length} superlative(s): ${hypeList.join(', ')}`) : L('未发现绝对化用语', 'No superlatives found'), fix: L('“第一/最强/唯一”等无依据的绝对化表述会被 AI 视为营销噪音，也可能违反《广告法》，请替换为可核实的具体事实。', 'Unsupported claims like “best” or “#1” read as marketing noise to AI and may breach advertising rules — replace them with verifiable facts.') },
  ];
  const score = Math.round(checks.filter(c => c.pass).length / checks.length * 100);
  return { words, score, checks };
}

export async function rewriteContent(text, { brand = '', engineId, locale = 'zh' } = {}) {
  const engine = getEngine(engineId);
  const r = await chat(engine, [
    { role: 'system', content: `你是 GEO 内容编辑。请把用户提供的内容改写成更容易被 AI 搜索引擎准确理解和引用的版本。
规则：
1. 只能使用原文中已有的事实，绝对不能编造数字、排名、奖项、引语或来源。
2. 需要补充数据或来源的地方，用【待补充：说明需要什么数据】标注。
3. 结构：开头 1~2 句直接给出结论；使用小标题；包含 3 个左右“问题式小标题 + 直接回答”；适当使用列表。
4. 删除“第一、最强、唯一”等无依据的绝对化用语。
5. 输出 Markdown，不要额外解释。${locale === 'en' ? '\n6. Write the entire rewrite in English, and mark gaps as [TODO: what data is needed].' : ''}` },
    { role: 'user', content: `${brand ? `品牌/主体：${brand}\n` : ''}原文：\n${String(text).slice(0, 6000)}` },
  ], { temperature: 0.4, maxTokens: 2500 });
  return { text: r.text, engine: { id: engine.id, label: engine.label, model: r.model } };
}
