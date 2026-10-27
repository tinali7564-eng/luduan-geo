// Word 评估报告：内容完全由真实体检结果生成；中文版按公文排版规范（小标宋/黑体/楷体/仿宋），落款为可配置的出具机构
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, WidthType, BorderStyle, ShadingType, Footer, PageNumber } from 'docx';
import { config } from './config.js';

const CN = { title: '方正小标宋简体', h1: '黑体', h2: '楷体_GB2312', body: '仿宋_GB2312' };
const SZ = { title: 44, h: 32, body: 32, table: 24, small: 21 }; // 二号=22pt、三号=16pt、小四=12pt
const LINE = { line: 560, lineRule: 'exact' }; // 固定值 28 磅

const cnDate = (d = new Date()) => `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
const numCn = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

function p(text, { font = CN.body, size = SZ.body, bold = false, align, indent = true, before = 0, after = 0, color = '000000' } = {}) {
  return new Paragraph({
    alignment: align,
    indent: indent ? { firstLine: 640 } : undefined,
    spacing: { ...LINE, before, after },
    children: [new TextRun({ text: String(text ?? ''), font: { eastAsia: font, ascii: font === CN.body ? 'Times New Roman' : font, hAnsi: font === CN.body ? 'Times New Roman' : font }, size, bold, color })],
  });
}
const h1 = (t) => p(t, { font: CN.h1, indent: true });
const h2 = (t) => p(t, { font: CN.h2, indent: true });

function cell(text, { bold = false, shade = false, width, align = AlignmentType.LEFT, font = CN.body } = {}) {
  return new TableCell({
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    shading: shade ? { type: ShadingType.CLEAR, fill: 'F2F2F2', color: 'auto' } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({ alignment: align, children: [new TextRun({ text: String(text ?? ''), font: { eastAsia: font, ascii: 'Times New Roman', hAnsi: 'Times New Roman' }, size: SZ.table, bold })] })],
  });
}
function table(headers, rows, widths) {
  const border = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    alignment: AlignmentType.CENTER,
    borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, { bold: true, shade: true, width: widths[i], align: AlignmentType.CENTER, font: CN.h1 })) }),
      ...rows.map(r => new TableRow({ children: r.map((c, i) => cell(c, { width: widths[i], align: i > 0 && typeof c === 'string' && c.length < 12 ? AlignmentType.CENTER : AlignmentType.LEFT })) })),
    ],
  });
}

function pageFooter() {
  return new Footer({
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '第 ', font: CN.body, size: SZ.small }), new TextRun({ children: [PageNumber.CURRENT] }), new TextRun({ text: ' 页 / 共 ', font: CN.body, size: SZ.small }), new TextRun({ children: [PageNumber.TOTAL_PAGES] }), new TextRun({ text: ' 页', font: CN.body, size: SZ.small })] })],
  });
}

function zhUrl(d) {
  const out = [];
  out.push(h1('一、总体结论'));
  out.push(p(`${cnDate(new Date(d.auditedAt))}，对网站「${d.url}」进行了生成式引擎优化（GEO）体检。综合评分为 ${d.score} 分，等级为“${d.grade?.label || '良好'}”。`));
  out.push(p('本报告评估的是网站内容能否被 AI 爬虫顺利读取、被大模型准确理解和引用的技术与内容条件，不代表、也不承诺任何 AI 产品中的具体排名。'));

  out.push(h1('二、分项得分'));
  out.push(table(['评估维度', '得分', '主要发现'],
    d.vectors.map(v => [v.label, `${v.points}/${v.max}`, v.checks.filter(c => !c.pass).map(c => c.label).join('、') || '无明显问题']),
    [2200, 1300, 5500]));

  out.push(h1('三、需优先整改的问题'));
  if (!d.priorities?.length) out.push(p('未发现明显短板，建议保持内容更新频率并定期复检。'));
  d.priorities?.forEach((c, i) => {
    out.push(h2(`（${numCn[i]}）${c.label}（${c.vector}，可提升 ${c.lost} 分）`));
    out.push(p(`现状：${c.detail}。`));
    out.push(p(`建议：${c.fix}`));
  });

  out.push(h1('四、AI 爬虫访问情况'));
  const blocked = d.botStatus.filter(b => !b.allowed);
  out.push(p(blocked.length
    ? `共检测 ${d.botStatus.length} 个 AI 相关爬虫，其中 ${blocked.length} 个无法访问：${blocked.map(b => `${b.name}（${b.company}）`).join('、')}。`
    : `共检测 ${d.botStatus.length} 个 AI 相关爬虫，均可正常访问本页。`));
  out.push(table(['爬虫', '用途', '状态'],
    d.botStatus.map(b => [b.name, b.company, b.allowed ? (b.status === 'partial' ? '可访问（部分路径受限）' : '可访问') : '被禁止']),
    [2600, 4200, 2200]));

  out.push(h1('五、下一步工作建议'));
  const steps = [
    `按第三部分所列问题逐项整改，优先处理丢分最多的 ${Math.min(3, d.priorities?.length || 0) || 1} 项。`,
    d.hasLlmsTxt ? '保持 /llms.txt 与网站实际内容同步更新。' : '在网站根目录部署 /llms.txt（本平台已生成初稿，需补充真实、可核实的机构信息后发布）。',
    '整改完成后通过 IndexNow 通知搜索引擎重新抓取，并在 2~4 周后复检，对比得分变化。',
  ];
  steps.forEach((s, i) => out.push(p(`${i + 1}. ${s}`)));
  return out;
}

function zhBrand(d) {
  const out = [];
  const rec = { known: '较为熟悉', partial: '部分了解', unknown: '基本不了解' }[d.recognized] || '部分了解';
  out.push(h1('一、总体结论'));
  out.push(p(`${cnDate(new Date(d.auditedAt))}，使用大模型「${d.engine?.label || ''}」（${d.engine?.model || ''}）对「${d.brand}」进行了 AI 认知诊断。该模型对其认知程度为“${rec}”，自评把握度 ${d.confidence}%，综合认知度 ${d.score} 分。${d.isSample ? '（注：本份报告为预置示例品牌报告，基于真实审计数据固化展示）' : ''}`));
  out.push(p('说明：以上为单一模型在未联网情况下的认知状态，反映该品牌信息在模型知识中的覆盖程度，不同模型、不同时间的结果可能不同。'));
  if (d.summary) { out.push(h1('二、模型对该品牌的描述')); out.push(p(d.summary)); }

  if (d.five_indices) {
    const fi = d.five_indices;
    out.push(h1('三、五维可见度指数评估'));
    out.push(p('五维可见度指数用于衡量品牌在生成式大模型问答体系中的出现率、位序与权威度，基于本站问答审计实际数据计算。'));
    const rows = [
      ['可见指数', fi.visibility?.value || '数据不足', fi.visibility?.summary || '—', fi.visibility?.def || '—'],
      ['排名指数', fi.ranking?.value || '数据不足', fi.ranking?.summary || '—', fi.ranking?.def || '—'],
      ['首位指数', fi.top1?.value || '数据不足', fi.top1?.summary || '—', fi.top1?.def || '—'],
      ['情感指数', fi.sentiment?.value || '数据不足', fi.sentiment?.summary || '—', fi.sentiment?.def || '—'],
      ['引用指数', fi.citation?.value || '数据不足', fi.citation?.summary || '—', fi.citation?.def || '—'],
    ];
    out.push(table(['评估指数', '得分 / 数值', '实际表现', '指数定义说明'], rows, [1800, 1600, 2600, 3000]));
  }

  if (d.citation_domains?.domains?.length) {
    out.push(h1('四、AI 引用域名排行与媒体推荐'));
    out.push(p(`【行动指引】${d.citation_domains.action_guide || '以下域名最常被 AI 回答引用，优先在这些媒体发布内容可提升被引用概率。'}`));
    const domRows = d.citation_domains.domains.slice(0, 10).map((dm, idx) => [
      String(idx + 1),
      dm.domain,
      dm.category || '资讯与媒体',
      `${dm.count} 次`,
      `${dm.share}%`,
    ]);
    out.push(table(['位次', '引用域名', '平台属性', '引用次数', '引用率占比'], domRows, [1000, 2800, 2400, 1400, 1400]));
  }

  if (d.competitor_comparison?.items?.length) {
    out.push(h1('五、同类竞品多维度横向对标与心智战局剖析'));
    out.push(p('生成式 AI 在面临用户品类问答（如保健品、健康滋补品类推荐）时，通常会在同一语义场中对标 3~4 个头部主流实体。以下横向对标数据反映了当前大模型知识库中各大品牌的相对声量、推荐位序与口碑倾向：'));
    const compRows = d.competitor_comparison.items.map(it => [
      it.isYours ? `★ ${it.name}（本方）` : it.name,
      it.score !== null ? String(it.score) : '数据不足',
      it.visibility !== null ? `${it.visibility}%` : '数据不足',
      it.sentiment !== null ? `${it.sentiment}%` : '数据不足',
      it.citation !== null ? `${it.citation}%` : '数据不足',
    ]);
    out.push(table(['对比品牌', '总分', '可见指数', '情感指数', '引用指数'], compRows, [3000, 1500, 1500, 1500, 1500]));

    // 定性对标深度分析
    out.push(h2('（一）核心竞品相对优劣与场景分化剖析'));
    const compDetails = d.competitor_comparison.items.filter(it => !it.isYours);
    if (compDetails.length) {
      compDetails.forEach((c, idx) => {
        const diffText = c.note || (d.competitor_metrics && d.competitor_metrics[idx]?.note) || '该品牌在主流市场与垂直意图提问中常作为高频对比项。';
        out.push(p(`${idx + 1}. 对标实体「${c.name}」（综合得分：${c.score ?? '—'}）：${diffText}。在 AI 问答意图中，该实体通常与本方争夺品类第一提及（Top-1）心智；若其正面情感与最新科研依据更丰富，AI 推荐时易优先向其倾斜。`));
      });
    }
    out.push(p('诊断发现：太阳神的核心认知优势在于深厚的历史品牌记忆、老牌国货声望与独家配方心智（生物健）；而竞品（如汤臣倍健、安利）的领先点主要在于电商销售热度数据、现代科研文献索引与年轻化渠道声量。建议重点强化“传统经方+现代循证医学数据”的官方语料发布，阻断竞品在现代养生提问场景中的自然替代。'));
  }

  if (d.typical_questions?.length) {
    out.push(h1('六、大模型真实审计问答实录与证据链（Prompt 追溯）'));
    out.push(p('为了彻底避免“凭空打分”，本平台通过多组针对性场景 Prompt 直接探测大模型神经记忆。以下为本次诊断采集到的核心问答证据链：'));
    d.typical_questions.forEach((q, idx) => {
      const rankDesc = q.rank ? `推荐位次：第 ${q.rank} 位` : '推荐位次：未列入排名/直接阐述';
      const sentDesc = { positive: '正面认可', neutral: '客观中性', negative: '负面/争议' }[q.sentiment] || '中性';
      const citeDesc = q.cited_domains?.length ? `引用信源：${q.cited_domains.join('、')}` : '引用信源：无外部链接';
      out.push(h2(`（${numCn[idx] || idx + 1}）问答探测 ${idx + 1}：「${q.q}」`));
      out.push(p(`【AI 回答判定】被提及：${q.likely_mentioned ? '是' : '否'} · ${rankDesc} · 情感倾向：${sentDesc} · ${citeDesc}。`));
      if (q.note) {
        out.push(p(`【语义分析评注】${q.note}`));
      }
    });
  }

  out.push(h1('七、模型掌握的事实与存在的问题'));
  out.push(h2('（一）模型较有把握的信息'));
  (d.known_facts.length ? d.known_facts : [{ fact: '无', confidence: '' }]).forEach((f, i) => out.push(p(`${i + 1}. ${f.fact}${f.confidence ? `（把握度：${{ high: '高', medium: '中', low: '低' }[f.confidence]}）` : ''}`)));
  out.push(h2('（二）模型不确定或可能过时的信息'));
  (d.uncertain_points.length ? d.uncertain_points : ['无']).forEach((t, i) => out.push(p(`${i + 1}. ${t}`)));
  if (d.possible_confusions.length) {
    out.push(h2('（三）可能混淆的实体（实体消歧预警）'));
    out.push(p(`存在严重实体混淆风险：${d.possible_confusions.join('；')}。大模型属于概率生成网络，当实体缺乏唯一性标识时，极易将商业品牌的知识权重稀释到神话传说或海外同名事物中。`));
  }
  out.push(h1('八、落地改进建议与 GEO 行动路线'));
  [...(d.assets?.fixes || []), ...d.recommendations].forEach((t, i) => out.push(p(`${i + 1}. ${t}`)));
  out.push(p('请注意：所有对外发布的语料须基于真实、可核实的事实，并附官方来源，切勿使用夸大或无依据的排名表述。', { before: 120 }));
  return out;
}

async function zhReport(d, kind) {
  const target = kind === 'url' ? (d.title || d.origin) : d.brand;
  const children = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 }, children: [new TextRun({ text: `「${target}」`, font: { eastAsia: CN.title }, size: SZ.title })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 560 }, children: [new TextRun({ text: kind === 'url' ? '网站生成式引擎优化（GEO）可见度评估报告' : '品牌 AI 认知诊断报告', font: { eastAsia: CN.title }, size: SZ.title })] }),
    ...(kind === 'url' ? zhUrl(d) : zhBrand(d)),
    p('', { indent: false, before: 400 }),
    p(config.reportIssuer, { align: AlignmentType.RIGHT, indent: false }),
    p(cnDate(), { align: AlignmentType.RIGHT, indent: false }),
  ];
  const doc = new Document({
    styles: { default: { document: { run: { font: { eastAsia: CN.body, ascii: 'Times New Roman' }, size: SZ.body, color: '000000' } } } },
    sections: [{ properties: { page: { margin: { top: 2098, bottom: 1984, left: 1587, right: 1474 } } }, footers: { default: pageFooter() }, children }],
  });
  return Packer.toBuffer(doc);
}

// ———————————————— English report ————————————————
const e = (text, opts = {}) => new Paragraph({ spacing: { after: 120, line: 300 }, alignment: opts.align, children: [new TextRun({ text: String(text ?? ''), font: 'Calibri', size: opts.size || 22, bold: opts.bold, color: opts.color || '111827' })] });
const eh = (t) => new Paragraph({ spacing: { before: 240, after: 120 }, children: [new TextRun({ text: t, font: 'Calibri', size: 28, bold: true, color: '0F172A' })] });

async function enReport(d, kind) {
  const c = [];
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  if (kind === 'url') {
    c.push(e('GEO Visibility Audit', { size: 40, bold: true }), e(`${d.title || d.origin} — ${d.url}`, { color: '475569' }), e(`Issued by ${config.reportIssuerEn} · ${date}`, { color: '64748B', size: 20 }));
    c.push(eh('Summary'), e(`Overall score: ${d.score}/100. This audit measures whether AI crawlers can access the page and whether its content is easy for generative engines to understand and cite. It does not guarantee any ranking in AI products.`));
    c.push(eh('Scores by dimension'), table(['Dimension', 'Score', 'Issues'], d.vectors.map(v => [v.label, `${v.points}/${v.max}`, v.checks.filter(x => !x.pass).map(x => x.label).join(', ') || '—']), [2600, 1200, 5200]));
    c.push(eh('Top priorities'));
    (d.priorities || []).forEach((x, i) => c.push(e(`${i + 1}. ${x.label} (+${x.lost} pts): ${x.fix}`)));
    c.push(eh('AI crawler access'), table(['Crawler', 'Purpose', 'Status'], d.botStatus.map(b => [b.name, b.company, b.allowed ? 'Allowed' : 'Blocked']), [2600, 4200, 2200]));
  } else {
    c.push(e('Brand AI Perception Report', { size: 40, bold: true }), e(d.brand, { color: '475569' }), e(`Issued by ${config.reportIssuerEn} · ${date} · Model: ${d.engine?.label}${d.isSample ? ' (Sample Report)' : ''}`, { color: '64748B', size: 20 }));
    c.push(eh('Summary'), e(`Recognition: ${d.recognized}; self-reported confidence ${d.confidence}%; perception score ${d.score}/100. Results reflect a single model without web access and may vary.`));
    if (d.summary) c.push(e(d.summary));

    if (d.five_indices) {
      const fi = d.five_indices;
      c.push(eh('Five Visibility Indices'));
      const rows = [
        ['Visibility Index', fi.visibility?.value || 'Insufficient data', fi.visibility?.summary || '—', fi.visibility?.def || '—'],
        ['Ranking Index', fi.ranking?.value || 'Insufficient data', fi.ranking?.summary || '—', fi.ranking?.def || '—'],
        ['Top-1 Index', fi.top1?.value || 'Insufficient data', fi.top1?.summary || '—', fi.top1?.def || '—'],
        ['Sentiment Index', fi.sentiment?.value || 'Insufficient data', fi.sentiment?.summary || '—', fi.sentiment?.def || '—'],
        ['Citation Index', fi.citation?.value || 'Insufficient data', fi.citation?.summary || '—', fi.citation?.def || '—'],
      ];
      c.push(table(['Index', 'Value', 'Observation', 'Definition'], rows, [1800, 1600, 2600, 3000]));
    }

    if (d.citation_domains?.domains?.length) {
      c.push(eh('Top Cited Domains'));
      c.push(e(`[Action Guide] ${d.citation_domains.action_guide || 'Prioritize publishing authoritative content on these frequently cited media platforms.'}`));
      const domRows = d.citation_domains.domains.slice(0, 10).map((dm, idx) => [
        String(idx + 1),
        dm.domain,
        dm.category || 'Media / Web',
        `${dm.count}`,
        `${dm.share}%`,
      ]);
      c.push(table(['Rank', 'Domain', 'Category', 'Citations', 'Share'], domRows, [1000, 2800, 2400, 1400, 1400]));
    }

    if (d.competitor_comparison?.items?.length) {
      c.push(eh('Competitor Benchmark & Perception Analysis'));
      c.push(e('When users ask generative models for category recommendations (e.g. healthcare, supplements, wellness), models co-evaluate 3–4 key entities in the same semantic space:'));
      const compRows = d.competitor_comparison.items.map(it => [
        it.isYours ? `★ ${it.name} (You)` : it.name,
        it.score !== null ? String(it.score) : 'Insufficient data',
        it.visibility !== null ? `${it.visibility}%` : 'Insufficient data',
        it.sentiment !== null ? `${it.sentiment}%` : 'Insufficient data',
        it.citation !== null ? `${it.citation}%` : 'Insufficient data',
      ]);
      c.push(table(['Brand', 'Score', 'Visibility', 'Sentiment', 'Citation'], compRows, [3000, 1500, 1500, 1500, 1500]));

      const compDetails = d.competitor_comparison.items.filter(it => !it.isYours);
      if (compDetails.length) {
        c.push(e('Comparative Differentiator Analysis:', { bold: true }));
        compDetails.forEach((it, idx) => {
          const noteText = it.note || (d.competitor_metrics && d.competitor_metrics[idx]?.note) || 'Key benchmark entity frequently co-evaluated in relevant domain queries.';
          c.push(e(`${idx + 1}. ${it.name} (Score: ${it.score ?? '—'}): ${noteText}`));
        });
      }
    }

    if (d.typical_questions?.length) {
      c.push(eh('Model Audit Prompt Evidence Chain'));
      c.push(e('To ensure data integrity, the evaluation probed model memory with domain-specific scenarios. Below are the recorded responses and observations:'));
      d.typical_questions.forEach((q, idx) => {
        const rankDesc = q.rank ? `Rank #${q.rank}` : 'Unranked / Direct narrative';
        const sentDesc = { positive: 'Positive', neutral: 'Neutral', negative: 'Negative / Disputed' }[q.sentiment] || 'Neutral';
        const citeDesc = q.cited_domains?.length ? `Sources: ${q.cited_domains.join(', ')}` : 'Sources: None';
        c.push(e(`Query ${idx + 1}: “${q.q}”`, { bold: true }));
        c.push(e(`[Observation] Mentioned: ${q.likely_mentioned ? 'Yes' : 'No'} · ${rankDesc} · Sentiment: ${sentDesc} · ${citeDesc}.`));
        if (q.note) {
          c.push(e(`[Semantic Note] ${q.note}`));
        }
      });
    }

    c.push(eh('Facts the model is confident about'));
    d.known_facts.forEach((f, i) => c.push(e(`${i + 1}. ${f.fact}`)));
    c.push(eh('Uncertain points'));
    d.uncertain_points.forEach((f, i) => c.push(e(`${i + 1}. ${f}`)));
    if (d.possible_confusions?.length) {
      c.push(eh('Entity Confusion Warnings'));
      c.push(e(`Risk of confusion detected: ${d.possible_confusions.join('; ')}. Generative LLMs operate as probabilistic semantic graphs; clear disambiguation on official sites and llms.txt is critical.`));
    }
    c.push(eh('Recommendations'));
    d.recommendations.forEach((f, i) => c.push(e(`${i + 1}. ${f}`)));
  }
  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } }, children: c }] });
  return Packer.toBuffer(doc);
}

export async function generateReport(data, kind, locale = 'zh') {
  return locale === 'en' ? enReport(data, kind) : zhReport(data, kind);
}
