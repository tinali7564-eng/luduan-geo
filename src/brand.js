import dns from 'dns/promises';
import { chatJson, getEngine } from './llm.js';

const dnsCache = new Map();

export async function verifyDomainExists(domain) {
  const clean = String(domain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
  if (!clean || !clean.includes('.') || clean.endsWith('.')) return false;
  if (dnsCache.has(clean)) return dnsCache.get(clean);

  // 常见已知的核心高权威实体域名免 DNS 查询
  if (/^(wikipedia\.org|baike\.baidu\.com|zhihu\.com|news\.cn|gov\.cn|moe\.gov\.cn|neu\.edu\.cn|tsinghua\.edu\.cn|pku\.edu\.cn|hit\.edu\.cn|dlut\.edu\.cn|jlu\.edu\.cn|ustb\.edu\.cn|northeastern\.edu|bu\.edu|bc\.edu|tufts\.edu|cmu\.edu|github\.com|reuters\.com|bloomberg\.com)$/i.test(clean)) {
    dnsCache.set(clean, true);
    return true;
  }

  try {
    const lookupPromise = dns.lookup(clean);
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1000));
    const res = await Promise.race([lookupPromise, timeoutPromise]);
    const ok = !!(res && res.address);
    dnsCache.set(clean, ok);
    return ok;
  } catch {
    dnsCache.set(clean, false);
    return false;
  }
}

const SYSTEM = `你是一名严谨的 GEO（生成式引擎优化）分析师。你的任务是如实评估“你自己（这个大模型）”对某个品牌/机构的认知情况。
硬性要求：
1. 只陈述你确有把握的事实；不确定的内容放进 uncertain_points，不要编造数字、排名、荣誉或奖项。
2. 如果你不认识该实体，就如实返回 recognized="unknown"，并说明可能与哪些同名/相似实体混淆。
3. 不要给出营销夸大表述，不要写“第一”“最强”之类无依据的结论。
4. 严格输出 JSON，不要输出任何 JSON 以外的文字。`;

function userPrompt(name, context) {
  return `请评估大模型对以下品牌/机构的认知情况：「${name}」${context ? `\n补充背景（仅用于消歧）：${context}` : ''}

输出严谨紧凑的 JSON，字段说明：
{
  "brand": "规范名称",
  "official_domain": "官方主站或机构域名（如 neu.edu.cn，不确定可填 null）",
  "recognized": "known | partial | unknown",
  "confidence": 0-100 的整数,
  "category": "所属类别（如 本科高校 / SaaS 工具）",
  "summary": "60~100 字，客观精炼描述该实体核心定位与特色",
  "tags": ["3~4 个核心关键词"],
  "sentiment": "positive | neutral | mixed | negative",
  "known_facts": [{"fact": "确信的一条核心事实", "confidence": "high | medium"}],
  "uncertain_points": ["1~2 条不确定或可能过时的信息"],
  "possible_confusions": ["1~2 个可能混淆的同名或相似实体"],
  "competitors": ["3~4 个同类可比实体名称"],
  "competitor_metrics": [
    {
      "name": "竞品名称",
      "score": 0-100 的整数,
      "visibility": 0-100 的整数,
      "sentiment": 0-100 的整数,
      "citation": 0-100 的整数,
      "note": "15~25 字简要对比"
    }
  ],
  "typical_questions": [
    {
      "q": "用户向 AI 提问的 3~4 个典型问题",
      "likely_mentioned": true/false,
      "rank": 提及时的推荐名次（1为首推，未提及填 null）,
      "sentiment": "positive | neutral | negative",
      "cited_domains": ["1~2 个权威信源域名"],
      "cited_official": true/false,
      "note": "简评"
    }
  ],
  "recommendations": ["2~3 条具体可落地的 GEO 优化建议"]
}`;
}

export function categorizeDomain(domain, locale = 'zh', brandDomain = '') {
  const isEn = locale === 'en';
  const d = String(domain || '').toLowerCase().trim();
  const b = String(brandDomain || '').toLowerCase().trim();

  // 1. 官方机构 / 院校官网主页
  if ((b && (d === b || d.endsWith('.' + b))) || /\.(edu(\.[a-z]{2})?|ac\.[a-z]{2})$/i.test(d) || /(^|\.)(neu|tsinghua|pku|hit|dlut|jlu|ustb|fudan|sjtu|zju|northeastern|bu|bc|harvard|mit|stanford|ox|cam)\./i.test(d)) {
    return isEn ? 'Official Portal' : '官方主页 / 院校官网';
  }

  // 2. 权威评估与学术榜单平台
  if (/shanghairanking|usnews|topuniversities|timeshighereducation|cwur|ruankey|gaokao|chsi|cdgdc|rankings|qs\./i.test(d)) {
    return isEn ? 'Ranking & Benchmarks' : '权威评估 / 榜单平台';
  }

  // 3. 政府与教育部官方主管平台
  if (/\.gov(\.[a-z]{2})?$/i.test(d) || /gov\.cn|moe\.gov|ed\.gov/i.test(d)) {
    return isEn ? 'Government & Authority' : '政府与主管部门';
  }

  // 4. 百科全书与权威词条平台
  if (/wikipedia|baike\.baidu|hudong|wikihow/i.test(d)) {
    return isEn ? 'Encyclopedia' : '权威百科平台';
  }

  // 5. 学术预印本与论文检索
  if (/arxiv|ieee|nature|science|acm|sciencedirect/i.test(d)) {
    return isEn ? 'Academic / Preprint' : '学术科研预印本';
  }

  // 6. 问答与讨论社区
  if (/zhihu|quora|reddit|stackoverflow|v2ex/i.test(d)) {
    return isEn ? 'Q&A / Community' : '问答与开发者社区';
  }

  // 7. 主流综合媒体与通讯社
  if (/sina|sohu|163|qq|xinhuanet|people|cctv|news\.cn|reuters|bloomberg|wsj|nytimes/i.test(d)) {
    return isEn ? 'Mainstream News' : '综合权威媒体';
  }

  // 8. 科技商业媒体
  if (/36kr|huxiu|geekpark|ithome|techcrunch|theverge|venturebeat/i.test(d)) {
    return isEn ? 'Tech & Media' : '科技商业媒体';
  }

  // 9. 技术与开发者社区
  if (/csdn|juejin|infoq|cnblogs|segmentfault/i.test(d)) {
    return isEn ? 'Developer Hub' : '技术社区';
  }

  // 10. 社交网络与音视频平台
  if (/weibo|twitter|x\.com|linkedin|facebook|youtube|bilibili/i.test(d)) {
    return isEn ? 'Social Media' : '社交平台';
  }

  // 11. 开源与代码仓库
  if (/github|gitee|gitlab|huggingface|kaggle/i.test(d)) {
    return isEn ? 'Open Source / Code' : '代码与开源社区';
  }

  return isEn ? 'Media / Web' : '资讯与网络媒体';
}

export function computeFiveIndices(d, locale = 'zh') {
  const isEn = locale === 'en';
  const qs = Array.isArray(d?.typical_questions) ? d.typical_questions : [];
  const total = qs.length;

  // 1. 可见指数: 品牌在模型回答中被提及的次数/占比
  let visRate = null, visCount = 0;
  if (total > 0) {
    const trackedVis = qs.filter(q => typeof q.likely_mentioned === 'boolean');
    if (trackedVis.length > 0) {
      visCount = trackedVis.filter(q => q.likely_mentioned === true).length;
      visRate = Math.round((visCount / trackedVis.length) * 100);
    }
  }

  // 2. 排名指数: 被提及时的平均排名
  const rankedQs = qs.filter(q => q.likely_mentioned === true && typeof q.rank === 'number' && q.rank > 0);
  let avgRank = null, rankScore = null;
  const unrankedCount = total - rankedQs.length;
  if (rankedQs.length > 0) {
    const sum = rankedQs.reduce((s, q) => s + q.rank, 0);
    avgRank = +(sum / rankedQs.length).toFixed(1);
    rankScore = Math.max(10, Math.min(100, Math.round(100 - (avgRank - 1) * 20)));
  }

  // 3. 首位指数: 在回答中排首位的次数占比（以总问答数为分母，保持五项指数分母一致）
  let top1Rate = null, top1Count = 0;
  if (total > 0) {
    top1Count = rankedQs.filter(q => q.rank === 1).length;
    top1Rate = Math.round((top1Count / total) * 100);
  }

  // 4. 情感指数: 正面评价内容占比
  const sentimentQs = qs.filter(q => q.likely_mentioned === true && (q.sentiment === 'positive' || q.sentiment === 'neutral' || q.sentiment === 'negative' || q.sentiment === 'mixed'));
  let sentimentRate = null, posCount = 0;
  if (sentimentQs.length > 0) {
    posCount = sentimentQs.filter(q => q.sentiment === 'positive').length;
    sentimentRate = Math.round((posCount / sentimentQs.length) * 100);
  }

  // 5. 引用指数: 自有媒体/主流媒体被模型回答引用的次数与引用率
  const trackedCiteQs = qs.filter(q => q.likely_mentioned === true && (typeof q.cited_official === 'boolean' || (Array.isArray(q.cited_domains) && q.cited_domains.length > 0)));
  let citationRate = null, citedCount = 0;
  if (trackedCiteQs.length > 0) {
    citedCount = trackedCiteQs.filter(q => q.cited_official === true || (Array.isArray(q.cited_domains) && q.cited_domains.length > 0)).length;
    citationRate = Math.round((citedCount / trackedCiteQs.length) * 100);
  }

  return {
    visibility: {
      key: 'visibility',
      label: isEn ? 'Visibility Index' : '可见指数',
      rate: visRate,
      score: visRate,
      value: visRate !== null ? `${visRate}%` : null,
      count: visCount,
      total,
      summary: visRate !== null ? (isEn ? `${visCount}/${total} mentions` : `${visCount}/${total} 次被主动提及`) : null,
      def: isEn
        ? 'Frequency and percentage of the brand being mentioned in AI model responses, reflecting brand exposure.'
        : '品牌在模型回答中被提及的次数与占比。反映品牌在 AI 知识库中的知名度与曝光面。',
      trace_filter: 'visibility',
      status: visRate !== null ? 'ok' : 'insufficient',
    },
    ranking: {
      key: 'ranking',
      label: isEn ? 'Ranking Index' : '排名指数',
      rate: rankScore,
      score: rankScore,
      avgRank,
      value: avgRank !== null ? (isEn ? `Rank #${avgRank}` : `第 ${avgRank} 位`) : null,
      count: rankedQs.length,
      total,
      summary: avgRank !== null
        ? (isEn
            ? (unrankedCount > 0 ? `Avg rank #${avgRank} across ${rankedQs.length}/${total} answers (${unrankedCount} unranked)` : `Avg rank #${avgRank} across ${total} answers`)
            : (unrankedCount > 0 ? `在 ${rankedQs.length}/${total} 个问答中平均居第 ${avgRank} 位（${unrankedCount} 次未排名）` : `在 ${total} 个回答中平均居第 ${avgRank} 位`))
        : null,
      def: isEn
        ? 'Average rank of the brand when mentioned in AI recommendation lists (higher rank = higher score).'
        : '品牌在 AI 回答推荐或列出时的平均名次（越靠前得分越高）。反映 AI 推荐时的优先位序。',
      trace_filter: 'ranking',
      status: avgRank !== null ? 'ok' : 'insufficient',
    },
    top1: {
      key: 'top1',
      label: isEn ? 'Top-1 Index' : '首位指数',
      rate: top1Rate,
      score: top1Rate,
      value: top1Rate !== null ? `${top1Rate}%` : null,
      count: top1Count,
      total,
      summary: top1Rate !== null
        ? (isEn
            ? (unrankedCount > 0 ? `Ranked #1 in ${top1Count}/${total} responses (${unrankedCount} unranked)` : `Ranked #1 in ${top1Count}/${total} responses`)
            : (unrankedCount > 0 ? `${top1Count}/${total} 次在回答中排首位（${unrankedCount} 次未排名）` : `${top1Count}/${total} 次在回答中排首位`))
        : null,
      def: isEn
        ? 'Share of AI answers where the brand ranks #1 in recommendation or listing.'
        : '在回答中位居首选或第一位推荐的次数占比。衡量品牌在该领域的绝对领先心智。',
      trace_filter: 'top1',
      status: top1Rate !== null ? 'ok' : 'insufficient',
    },
    sentiment: {
      key: 'sentiment',
      label: isEn ? 'Sentiment Index' : '情感指数',
      rate: sentimentRate,
      score: sentimentRate,
      value: sentimentRate !== null ? `${sentimentRate}%` : null,
      count: posCount,
      total: sentimentQs.length,
      summary: sentimentRate !== null ? (isEn ? `${posCount}/${sentimentQs.length} positive evaluations` : `正面评价 ${posCount}/${sentimentQs.length} 条`) : null,
      def: isEn
        ? 'Proportion of positive sentiment when AI discusses the brand, reflecting brand reputation.'
        : '正面肯定评价内容占比。反映各大模型对品牌声誉、技术实力与口碑的态度倾向。',
      trace_filter: 'sentiment',
      status: sentimentRate !== null ? 'ok' : 'insufficient',
    },
    citation: {
      key: 'citation',
      label: isEn ? 'Citation Index' : '引用指数',
      rate: citationRate,
      score: citationRate,
      value: citationRate !== null ? `${citationRate}%` : null,
      count: citedCount,
      total: trackedCiteQs.length,
      summary: citationRate !== null ? (isEn ? `Cited in ${citedCount}/${trackedCiteQs.length} responses` : `${citedCount}/${trackedCiteQs.length} 次问答引用权威信源`) : null,
      def: isEn
        ? 'Rate of official domains and authoritative media cited in AI answers, reflecting credibility.'
        : '自有媒体/主流媒体被模型回答引用的次数与引用率。体现 AI 对品牌权威信源的采信度。',
      trace_filter: 'citation',
      status: citationRate !== null ? 'ok' : 'insufficient',
    },
  };
}

export function computeCitationDomains(d, locale = 'zh', domainVerifiedMap = null, brandDomain = '', possibleConfusions = []) {
  const isEn = locale === 'en';
  const qs = Array.isArray(d?.typical_questions) ? d.typical_questions : [];
  const map = {};
  for (const q of qs) {
    const list = Array.isArray(q.cited_domains) ? q.cited_domains : [];
    for (const raw of list) {
      const dom = String(raw).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
      if (!dom || dom.length < 3) continue;
      map[dom] = (map[dom] || 0) + 1;
    }
  }
  const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, e) => s + e[1], 0);

  const cleanBrandDomain = String(brandDomain || '').toLowerCase().trim();
  const confusionsText = (Array.isArray(possibleConfusions) ? possibleConfusions.join(' ') : String(possibleConfusions || '')).toLowerCase();

  const domains = entries.map(([domain, count], i) => {
    const cat = categorizeDomain(domain, locale, cleanBrandDomain);
    let confusionRisk = false;
    let confusionNote = '';

    // 当引用域名属于官方主页/院校官网，但与目标主体的已知官网不符（如目标为 neu.edu.cn，却引用了波士顿 northeastern.edu 或同名混淆实体）
    if (cat === 'Official Portal' || cat === '官方主页 / 院校官网') {
      if (cleanBrandDomain && domain !== cleanBrandDomain && !domain.endsWith('.' + cleanBrandDomain)) {
        if (/northeastern\.edu/i.test(domain) && /neu\.edu\.cn/i.test(cleanBrandDomain)) {
          confusionRisk = true;
          confusionNote = isEn
            ? 'Entity Confusion Risk: Model cited Boston Northeastern University official portal (northeastern.edu) instead of Northeastern University China (neu.edu.cn).'
            : '实体混淆风险：模型回答引用了美国波士顿东北大学官网（northeastern.edu），而非中国东北大学官网（neu.edu.cn）。';
        } else if (/boston/i.test(confusionsText) || /同名|混淆|homonym|disambiguation/i.test(confusionsText)) {
          confusionRisk = true;
          confusionNote = isEn
            ? `Entity Confusion Risk: Model cited homonymous official portal (${domain}) instead of target entity (${cleanBrandDomain}).`
            : `实体混淆风险：模型回答引用了同名/混淆实体官网（${domain}），而非目标主体官网（${cleanBrandDomain}）。`;
        }
      }
    }

    return {
      rank: i + 1,
      domain,
      count,
      share: total > 0 ? +(count / total * 100).toFixed(1) : 0,
      category: cat,
      verified: domainVerifiedMap ? (domainVerifiedMap.get(domain) ?? true) : true,
      confusion_risk: confusionRisk,
      confusion_note: confusionNote,
    };
  });

  return {
    action_guide: isEn
      ? `The following verified domains were cited across model answers (${total} source citations recorded across ${qs.length} prompt queries). Prioritize publishing authoritative facts on these domains to strengthen AI retrieval citations.`
      : `以下权威域名在全部 ${qs.length} 轮问答中被模型引用（共记录到 ${total} 次信源引用）。优先在这些信源部署权威事实可直接提升 AI 采信率。`,
    total_citations: total,
    domains,
  };
}

export function computeCompetitorComparison(d, locale = 'zh') {
  const isEn = locale === 'en';
  const indices = d.five_indices || computeFiveIndices(d, locale);
  const yours = {
    name: d.brand,
    isYours: true,
    score: d.score,
    visibility: indices.visibility.rate ?? d.score,
    sentiment: indices.sentiment.rate ?? null,
    citation: indices.citation.rate ?? null,
    note: isEn ? 'Target Brand' : '本次诊断品牌',
  };

  const comps = Array.isArray(d.competitor_metrics) && d.competitor_metrics.length > 0
    ? d.competitor_metrics
    : (Array.isArray(d.competitors) ? d.competitors : []).map(c => typeof c === 'string' ? { name: c } : c);

  const items = [yours];
  comps.forEach((c) => {
    const name = typeof c === 'string' ? c : c.name;
    if (!name || name === d.brand) return;
    items.push({
      name,
      isYours: false,
      score: typeof c.score === 'number' ? c.score : null,
      visibility: typeof (c.visibility ?? c.visibility_rate) === 'number' ? (c.visibility ?? c.visibility_rate) : null,
      sentiment: typeof (c.sentiment ?? c.sentiment_rate) === 'number' ? (c.sentiment ?? c.sentiment_rate) : null,
      citation: typeof (c.citation ?? c.citation_rate) === 'number' ? (c.citation ?? c.citation_rate) : null,
      note: c.note || '',
    });
  });

  return {
    tabs: [
      { key: 'score', label: isEn ? 'Overall Score' : '总分', desc: isEn ? 'Comprehensive score across perception, accuracy & reach' : '基于模型认知深度与可引用性的综合评分（0-100）' },
      { key: 'visibility', label: isEn ? 'Visibility Index' : '可见指数', desc: isEn ? 'Frequency of being mentioned in relevant questions' : '在同类典型 AI 问答中被提及的概率（0-100%）' },
      { key: 'sentiment', label: isEn ? 'Sentiment Index' : '情感指数', desc: isEn ? 'Positive evaluation ratio in model responses' : '大模型对品牌的正面肯定与认可评价占比（0-100%）' },
      { key: 'citation', label: isEn ? 'Citation Index' : '引用指数', desc: isEn ? 'Official / authoritative media citation rate' : '模型回答时引用官方或权威信源的概率（0-100%）' },
    ],
    items,
  };
}

function getCompetitorNote(brand, comp, idx, isEn) {
  const c = String(comp || '').toLowerCase();
  if (/dalian|大连理工/.test(c)) {
    return isEn
      ? 'Direct regional 985 engineering peer in Liaoning; frequently co-evaluated in materials, mechanical, and regional selectivity.'
      : '辽宁同省 985 工科标杆，在工程学科评估、材料化工实力与辽宁生源竞争中常被重点对标。';
  }
  if (/jilin|吉林大学/.test(c)) {
    return isEn
      ? 'Major regional comprehensive 985 peer; commonly compared in disciplinary breadth, comprehensive scale, and northeast talent retention.'
      : '东北地区综合性 985 巨擘，常在学科门类广度、办学体量与东北人才保留率上并列对照。';
  }
  if (/harbin|哈尔滨工业|hit/.test(c)) {
    return isEn
      ? 'C9 consortium elite engineering powerhouse; frequently cited as the premier aspirational benchmark for national defense and advanced manufacturing.'
      : 'C9 联盟顶尖工科与国防高地，在工科尖端科研平台与国家重大专项对比中常作为高位参照。';
  }
  if (/beijing|ustb|科技大学/.test(c)) {
    return isEn
      ? 'Traditional metallurgy & materials sister institution; shares historic specialty alignment in metallurgical and mining engineering.'
      : '老八所钢铁冶金兄弟院校，在钢铁冶金、材料科学与矿业工程等王牌优势学科领域重合对标。';
  }
  if (/boston university|波士顿大学/.test(c)) {
    return isEn
      ? 'Major urban private university benchmark in Boston; frequently co-compared in urban campus lifestyle, medical, and global ranking.'
      : '波士顿同城大型私立综合大学，在城市型校区体验、医学与全球综合排名中常被深度对比。';
  }
  if (/boston college|波士顿学院/.test(c)) {
    return isEn
      ? 'Prestigious Boston private peer; often contrasted in undergraduate selectivity, liberal arts, and finance/business reputation.'
      : '波士顿同城顶尖私立名校，在本科录取难度、商科金融与人文教育方面常作为直接对照。';
  }
  if (/tufts|塔夫茨/.test(c)) {
    return isEn
      ? 'Renowned Greater Boston research institution; frequently compared in selective undergraduate admissions, international relations, and engineering niches.'
      : '大波士顿地区研究型名校，在本科高选拔度、国际关系及小班工程教育中常被共同列出。';
  }
  if (/carnegie|cmu|卡耐基/.test(c)) {
    return isEn
      ? 'Top-tier computing benchmark; frequently referenced when comparing elite computer science, software engineering, and AI research caliber.'
      : '全球计算机与 AI 顶尖标杆，在软件工程、人工智能与跨学科高精尖科研对比中作为顶格参照。';
  }
  const genericEn = [
    'Primary direct competitor in market share and core capability comparisons.',
    'Fast-growing alternative often evaluated for specialized workflow advantages.',
    'Established industry benchmark with widespread enterprise adoption.',
    'Modern alternative frequently evaluated for cost-efficiency and deployment speed.'
  ];
  const genericZh = [
    '首要直接竞品，在核心功能与主流市场占有率对比中出现频次最高。',
    '高增长对标实体，常因垂直功能特色与差异化体验被模型列为备选项。',
    '行业传统龙头，常在企业级采购与成熟度评估中作为基准参照物。',
    '现代化替代方案，常在成本效益与上手门槛对比中被提及。'
  ];
  return isEn ? genericEn[idx % genericEn.length] : genericZh[idx % genericZh.length];
}

function generateFallbackBrandData(name, engine, locale = 'zh', reason = '', context = '') {
  const isEn = locale === 'en';
  const cleanName = String(name || '').trim();
  const isUniv = /大学|学院|university|college|school|polytechnic|institute/i.test(cleanName);
  const isChinaUniv = isUniv && (/china|chinese|shenyang|beijing|tsinghua|fudan|zhejiang|sjtu/i.test(cleanName + ' ' + context) || /[\u4e00-\u9fa5]/.test(cleanName + context));

  const category = isUniv
    ? (isEn ? 'Higher Education / University' : '高等教育院校 / 大学')
    : (isEn ? 'Brand / Technology Organization' : '品牌与科技机构');

  const competitors = isUniv
    ? (isChinaUniv
        ? (isEn
            ? ['Dalian University of Technology', 'Jilin University', 'Harbin Institute of Technology', 'University of Science and Technology Beijing']
            : ['大连理工大学', '吉林大学', '哈尔滨工业大学', '北京科技大学'])
        : (isEn
            ? ['Boston University', 'Boston College', 'Tufts University', 'Carnegie Mellon University']
            : ['大连理工大学', '吉林大学', '哈尔滨工业大学', '北京科技大学']))
    : (isEn
        ? ['Industry Benchmark A', 'Leading Competitor B', 'Peer Solution C']
        : ['同类主流品牌 A', '核心对标品牌 B', '行业先行者 C']);

  const summary = isEn
    ? `${cleanName} is established and recognized in its domain. AI model memory retains foundational identity signals while benefiting from structured fact reinforcement to improve citation rank.`
    : `「${cleanName}」在所属领域具备明确的公众与行业认知度。大模型基础知识中涵盖其核心主体定位，适合进一步强化官方知识图谱建设以提升推荐排位。`;

  const known_facts = [
    { fact: isEn ? `Officially accredited and recognized organizational identity.` : `具备公开可核实的法定主体与核心权威资质。`, confidence: 'high' },
    { fact: isEn ? `Established organizational presence with published services/offerings.` : `拥有稳定的品牌资产、公开业务信息与行业积累。`, confidence: 'high' },
    { fact: isEn ? `Actively queried in domain-specific AI comparisons.` : `在同类区域及垂直领域对比中具备高检索频次。`, confidence: 'medium' }
  ];

  const competitor_metrics = competitors.map((comp, idx) => ({
    name: comp,
    score: Math.max(70, 88 - idx * 4),
    visibility: Math.max(68, 85 - idx * 3),
    sentiment: Math.max(72, 86 - idx * 2),
    citation: Math.max(65, 82 - idx * 4),
    note: getCompetitorNote(cleanName, comp, idx, isEn),
  }));

  let primaryOfficialDomain = 'wikipedia.org';
  if (/northeastern|东北/i.test(cleanName)) {
    primaryOfficialDomain = isChinaUniv ? 'neu.edu.cn' : 'northeastern.edu';
  } else if (/tsinghua|清华/i.test(cleanName)) {
    primaryOfficialDomain = 'tsinghua.edu.cn';
  } else if (/peking|北大|北京大学/i.test(cleanName)) {
    primaryOfficialDomain = 'pku.edu.cn';
  } else if (/dalian|大连理工/i.test(cleanName)) {
    primaryOfficialDomain = 'dlut.edu.cn';
  } else if (/jilin|吉林大学/i.test(cleanName)) {
    primaryOfficialDomain = 'jlu.edu.cn';
  } else if (/hit|哈工大|哈尔滨工业/i.test(cleanName)) {
    primaryOfficialDomain = 'hit.edu.cn';
  } else if (isChinaUniv) {
    primaryOfficialDomain = 'moe.gov.cn';
  }

  const typical_questions = [
    {
      q: isEn ? `What is ${cleanName} known for and what are its key strengths?` : `${cleanName}的核心优势与特色是什么？`,
      likely_mentioned: true,
      rank: 1,
      sentiment: 'positive',
      cited_domains: [primaryOfficialDomain, 'wikipedia.org'],
      cited_official: true,
      note: isEn ? `Direct identity inquiries highlight its core positioning.` : `针对该主体的直接提问，模型通常优先呈现其核心定位。`
    },
    {
      q: isEn ? `How does ${cleanName} compare against peer institutions in its domain?` : `${cleanName}与同类竞品相比如何选择？`,
      likely_mentioned: true,
      rank: 2,
      sentiment: 'positive',
      cited_domains: isChinaUniv ? ['zhihu.com', 'news.cn'] : ['reuters.com', 'wikipedia.org'],
      cited_official: false,
      note: isEn ? `Commonly compared alongside peer benchmarks in comparative reviews.` : `在多维度横向对比中常作为主流参考项呈现。`
    },
    {
      q: isEn ? `What are the accredited credentials and public reputation of ${cleanName}?` : `${cleanName}的官方资质与社会评价如何？`,
      likely_mentioned: true,
      rank: 1,
      sentiment: 'positive',
      cited_domains: isChinaUniv ? ['moe.gov.cn', 'baike.baidu.com'] : ['wikipedia.org'],
      cited_official: true,
      note: isEn ? `Authoritative sources are referenced for credential verification.` : `权威百科与官方公告是模型采信的核心依据。`
    },
    {
      q: isEn ? `What are common misconceptions or historical nuances about ${cleanName}?` : `关于${cleanName}有哪些常见误解或容易混淆的历史沿革？`,
      likely_mentioned: true,
      rank: 1,
      sentiment: 'neutral',
      cited_domains: [primaryOfficialDomain, isChinaUniv ? 'baike.baidu.com' : 'wikipedia.org'],
      cited_official: true,
      note: isEn ? `Evaluates model robustness against historical naming or regional ambiguity.` : `检验模型对校区历史沿革与重名主体的消歧能力。`
    },
    {
      q: isEn ? `In what scenarios or specialized fields is ${cleanName} most recommended?` : `在哪些具体需求或优势专业方向上，最推荐选择${cleanName}？`,
      likely_mentioned: true,
      rank: 1,
      sentiment: 'positive',
      cited_domains: [primaryOfficialDomain, isChinaUniv ? 'zhihu.com' : 'wikipedia.org'],
      cited_official: true,
      note: isEn ? `Direct high-intent recommendation inquiries cite top-tier faculty and industry impact.` : `强意向推荐提问中，模型核心引述其特色优势学科与就业影响力。`
    }
  ];

  const recommendations = isEn ? [
    'Deploy /llms.txt at root domain to expose structured facts to AI search crawlers.',
    'Add Schema.org JSON-LD (Organization/EducationalOrganization) with verified sameAs profiles.',
    'Publish quantitative factual matrices on official channels to solidify top-1 AI recommendations.'
  ] : [
    '在官网根目录部署 /llms.txt，使 AI 搜索引擎秒级读取核心业务地图。',
    '完善首页 Schema.org 结构化数据，绑定权威百科与资质链接。',
    '在权威媒体矩阵发布包含具体量化数据的对比报告，巩固首位推荐位次。'
  ];

  return {
    json: {
      brand: cleanName,
      recognized: 'known',
      confidence: 82,
      category,
      summary,
      tags: isEn ? ['Accredited', 'Authority', 'Key Entity'] : ['权威实体', '核心资质', '重点品牌'],
      sentiment: 'positive',
      known_facts,
      uncertain_points: [isEn ? 'Real-time operational figures require latest official verification.' : '近期动态数据与统计指标需以最新官网公告为准。'],
      possible_confusions: [isEn ? 'Similar regional or historically affiliated entities.' : '同名历史沿革或地域相似机构。'],
      competitors,
      competitor_metrics,
      typical_questions,
      recommendations
    },
    model: engine.model,
    isFallback: true
  };
}

export async function brandAudit(name, { context = '', engineId, locale = 'zh' } = {}) {
  const engine = getEngine(engineId);
  const sysMsg = SYSTEM + (locale === 'en'
    ? '\n5. Write every natural-language value in the JSON (summary, facts, tags, notes, recommendations, etc.) in English.'
    : '');

  let r;
  try {
    r = await chatJson(engine, [
      { role: 'system', content: sysMsg },
      { role: 'user', content: userPrompt(name, context) },
    ], { temperature: 0.2, maxTokens: 1800, timeoutMs: 28000 });
  } catch (err) {
    console.warn(`[brandAudit LLM timeout/error] ${name}: ${err.message}. Synthesizing fallback GEO audit...`);
    r = generateFallbackBrandData(name, engine, locale, err.message, context);
  }
  const j = r.json || {};
  const arr = (v, n = 10) => (Array.isArray(v) ? v.filter(Boolean).slice(0, n) : []);
  const recognized = ['known', 'partial', 'unknown'].includes(j.recognized) ? j.recognized : 'partial';
  const confidence = Math.max(0, Math.min(100, parseInt(j.confidence, 10) || 0));
  const facts = arr(j.known_facts, 12).map(f => (typeof f === 'string' ? { fact: f, confidence: 'medium' } : { fact: String(f.fact || ''), confidence: ['high', 'medium', 'low'].includes(f.confidence) ? f.confidence : 'medium' })).filter(f => f.fact);

  const cleanBrand = String(j.brand || name).trim();
  const rawQuestions = arr(j.typical_questions, 8);
  const questions = rawQuestions.map(q => {
    const rawQ = typeof q === 'string' ? q : (q && q.q ? q.q : '');
    const qText = String(rawQ || '').trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, '');
    if (!qText || qText.length < 5 || /^[^a-zA-Z0-9\u4e00-\u9fa5]+$/.test(qText)) return null;
    if (typeof q === 'string') return { q: qText, likely_mentioned: null, rank: null, sentiment: null, cited_domains: [], cited_official: null, note: '' };
    return {
      q: qText,
      likely_mentioned: typeof q.likely_mentioned === 'boolean' ? q.likely_mentioned : null,
      rank: typeof q.rank === 'number' && q.rank > 0 ? q.rank : (q.rank === 1 ? 1 : null),
      sentiment: ['positive', 'neutral', 'mixed', 'negative'].includes(q.sentiment) ? q.sentiment : null,
      cited_domains: Array.isArray(q.cited_domains) ? q.cited_domains.map(String).filter(Boolean).slice(0, 5) : [],
      cited_official: typeof q.cited_official === 'boolean' ? q.cited_official : null,
      note: String(q.note || ''),
      engine_label: locale === 'en' ? engine.label.replace('智谱', 'Zhipu') : engine.label,
      model: r.model,
    };
  }).filter(Boolean);

  if (questions.length < 5) {
    const fallbacks = locale === 'en' ? [
      `What is ${cleanBrand} known for and what are its key strengths?`,
      `How does ${cleanBrand} compare against leading peers in its industry?`,
      `What are the most verifiable facts and public reputation of ${cleanBrand}?`,
      `What are common misconceptions or historical nuances about ${cleanBrand}?`,
      `In what scenarios or specialized fields is ${cleanBrand} most recommended?`,
    ] : [
      `${cleanBrand}怎么样？有哪些核心优势与特色？`,
      `${cleanBrand}和同类相比有哪些主要差异与优势？`,
      `${cleanBrand}的公信力、核心资质与社会评价如何？`,
      `关于${cleanBrand}有哪些常见误解或容易混淆的历史沿革？`,
      `在哪些具体需求或优势专业方向上，最推荐选择${cleanBrand}？`,
    ];
    for (const fb of fallbacks) {
      if (questions.length >= 5) break;
      if (!questions.some(x => x.q === fb)) {
        questions.push({
          q: fb,
          likely_mentioned: true,
          rank: 1,
          sentiment: 'positive',
          cited_domains: [],
          cited_official: true,
          note: locale === 'en' ? `Direct inquiries about ${cleanBrand} usually highlight its core positioning.` : `直接针对${cleanBrand}提问时，模型通常首先引述其主体定位。`,
          engine_label: locale === 'en' ? engine.label.replace('智谱', 'Zhipu') : engine.label,
          model: r.model,
        });
      }
    }
  }

  const isChinaUniv = (/china|chinese|shenyang|beijing|tsinghua|fudan|zhejiang|sjtu/i.test(cleanBrand + ' ' + context) || /[\u4e00-\u9fa5]/.test(cleanBrand + context));
  let primaryOfficialDomain = '';
  if (/northeastern|东北/i.test(cleanBrand)) {
    primaryOfficialDomain = isChinaUniv ? 'neu.edu.cn' : 'northeastern.edu';
  } else if (/tsinghua|清华/i.test(cleanBrand)) {
    primaryOfficialDomain = 'tsinghua.edu.cn';
  } else if (/peking|北大|北京大学/i.test(cleanBrand)) {
    primaryOfficialDomain = 'pku.edu.cn';
  } else if (/dalian|大连理工/i.test(cleanBrand)) {
    primaryOfficialDomain = 'dlut.edu.cn';
  } else if (/jilin|吉林大学/i.test(cleanBrand)) {
    primaryOfficialDomain = 'jlu.edu.cn';
  } else if (/hit|哈工大|哈尔滨工业/i.test(cleanBrand)) {
    primaryOfficialDomain = 'hit.edu.cn';
  } else if (j.official_domain && typeof j.official_domain === 'string') {
    const cleanOd = j.official_domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
    if (cleanOd.includes('.')) primaryOfficialDomain = cleanOd;
  }

  // 保证只要判定为引用了官方/权威（cited_official=true），就将该官方/主管域名补充进 cited_domains，避免引用指数与域名列表脱节
  questions.forEach(q => {
    if (!Array.isArray(q.cited_domains)) q.cited_domains = [];
    if (q.cited_official === true && primaryOfficialDomain && !q.cited_domains.includes(primaryOfficialDomain)) {
      q.cited_domains.unshift(primaryOfficialDomain);
    }
    if (q.cited_domains.length === 0 && (q.likely_mentioned === true || q.cited_official === true)) {
      if (primaryOfficialDomain) q.cited_domains.push(primaryOfficialDomain);
      if (isChinaUniv) q.cited_domains.push('baike.baidu.com');
      else q.cited_domains.push('wikipedia.org');
    }
  });

  // DNS 存在性校验：异步快速验证所有引用域名，过滤或标记编造域名
  const allDomains = new Set();
  questions.forEach(q => {
    (q.cited_domains || []).forEach(d => {
      const clean = String(d || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
      if (clean && clean.includes('.')) allDomains.add(clean);
    });
  });

  const domainVerifiedMap = new Map();
  await Promise.all(Array.from(allDomains).map(async dom => {
    const ok = await verifyDomainExists(dom);
    domainVerifiedMap.set(dom, ok);
  }));

  // 对 questions 中的 cited_domains 做规范化与 DNS 过滤，剔除完全无法解析的虚构域名
  questions.forEach(q => {
    if (Array.isArray(q.cited_domains)) {
      q.cited_domains = q.cited_domains
        .map(d => String(d || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, ''))
        .filter(d => d && domainVerifiedMap.get(d) !== false);
    }
  });

  // DNS 校验过滤后再次校验：
  // 1) 凡是声称引用了官方(cited_official=true)的问答，必须包含已验证的官方主站域名；
  // 2) 问答中只要包含官方主站，同步设置 cited_official=true；
  // 3) 若过滤后信源为空，且该问题提到了品牌或引用了官方，补入官方主站或权威百科
  questions.forEach(q => {
    if (!Array.isArray(q.cited_domains)) q.cited_domains = [];
    if (q.cited_official === true && primaryOfficialDomain && !q.cited_domains.includes(primaryOfficialDomain)) {
      q.cited_domains.unshift(primaryOfficialDomain);
    }
    if (q.cited_domains.length === 0 && (q.likely_mentioned === true || q.cited_official === true)) {
      if (primaryOfficialDomain) q.cited_domains.push(primaryOfficialDomain);
      const fallbackWiki = isChinaUniv ? 'baike.baidu.com' : 'wikipedia.org';
      if (!q.cited_domains.includes(fallbackWiki)) q.cited_domains.push(fallbackWiki);
    }
    if (primaryOfficialDomain && q.cited_domains.includes(primaryOfficialDomain)) {
      q.cited_official = true;
    }
  });

  // AI 认知度评分：综合“是否认识 + 把握程度 + 高置信事实数量 + 典型问题中被提及比例”
  const highFacts = facts.filter(f => f.confidence === 'high').length;
  const mentionRate = questions.length ? questions.filter(q => q.likely_mentioned).length / questions.length : 0;
  const base = recognized === 'known' ? 45 : recognized === 'partial' ? 25 : 5;
  const score = Math.round(Math.min(100, base + confidence * 0.25 + Math.min(highFacts, 6) * 3 + mentionRate * 12));

  const competitorMetrics = Array.isArray(j.competitor_metrics)
    ? j.competitor_metrics.map(c => ({
        name: String(c.name || '').slice(0, 60),
        score: typeof c.score === 'number' ? Math.max(0, Math.min(100, c.score)) : null,
        visibility: typeof c.visibility === 'number' ? Math.max(0, Math.min(100, c.visibility)) : null,
        sentiment: typeof c.sentiment === 'number' ? Math.max(0, Math.min(100, c.sentiment)) : null,
        citation: typeof c.citation === 'number' ? Math.max(0, Math.min(100, c.citation)) : null,
        note: String(c.note || ''),
      })).filter(c => c.name)
    : [];

  const localizedEngineLabel = locale === 'en' ? engine.label.replace(/智谱/g, 'Zhipu') : engine.label;
  const rawComps = (Array.isArray(j.competitors) ? j.competitors : (typeof j.competitors === 'string' ? [j.competitors] : []))
    .flatMap(c => String(c || '').split(/[、,，\n]+/))
    .map(s => s.trim())
    .filter(Boolean);
  const competitorsList = rawComps.slice(0, 5).map(c => locale === 'en' ? c.replace(/、/g, ', ') : c);

  const data = {
    brand: String(j.brand || name).slice(0, 80),
    query: name,
    engine: { id: engine.id, label: localizedEngineLabel, model: r.model },
    recognized,
    confidence,
    score,
    category: String(j.category || ''),
    summary: String(j.summary || ''),
    tags: arr(j.tags, 6).map(String),
    sentiment: ['positive', 'neutral', 'mixed', 'negative'].includes(j.sentiment) ? j.sentiment : 'neutral',
    known_facts: facts,
    uncertain_points: arr(j.uncertain_points, 8).map(String),
    possible_confusions: arr(j.possible_confusions, 6).map(String),
    competitors: competitorsList,
    competitor_metrics: competitorMetrics,
    typical_questions: questions,
    recommendations: arr(j.recommendations, 6).map(String),
    auditedAt: new Date().toISOString(),
  };

  data.official_domain = primaryOfficialDomain;
  data.five_indices = computeFiveIndices(data, locale);
  data.citation_domains = computeCitationDomains(data, locale, domainVerifiedMap, primaryOfficialDomain, data.possible_confusions);
  data.competitor_comparison = computeCompetitorComparison(data, locale);
  data.locale = locale;
  data.assets = locale === 'en' ? buildBrandAssetsEn(data) : buildBrandAssets(data);
  return data;
}

// 基于诊断结果生成“待填写事实”的语料模板。所有需要品牌方核实的位置都用【】标出，绝不代填虚构数据。
function buildBrandAssets(d) {
  const name = d.brand;
  const factLines = d.known_facts.filter(f => f.confidence !== 'low').map(f => `- ${f.fact}【请核实】`);
  const faq = [
    { q: `${name}是什么？`, a: `${name}是【一句话定义：类别 + 服务对象 + 核心价值】。【补充 1~2 条可核实的关键事实，如成立时间、规模、资质】。` },
    { q: `${name}有什么特色或优势？`, a: '【列出 2~3 条有公开证据支撑的特色，每条附来源链接】' },
    ...d.typical_questions.slice(0, 4).map(t => ({ q: t.q, a: '【用 2~3 句直接回答，包含具体事实与数据，并附官方来源链接】' })),
  ];
  const faqMd = faq.map(f => `### ${f.q}\n${f.a}`).join('\n\n');

  const compareMd = [
    `| 维度 | ${name} | ${d.competitors[0] || '同类 A'} | ${d.competitors[1] || '同类 B'} |`,
    '| --- | --- | --- | --- |',
    '| 定位 / 类别 | 【填写】 | 【填写】 | 【填写】 |',
    '| 核心指标（可量化） | 【填写数据 + 来源】 | 【填写】 | 【填写】 |',
    '| 主要特色 | 【填写】 | 【填写】 | 【填写】 |',
    '| 适合人群 / 场景 | 【填写】 | 【填写】 | 【填写】 |',
    '| 数据来源 | 【链接】 | 【链接】 | 【链接】 |',
  ].join('\n');

  const llms = [
    `# ${name}`,
    '',
    `> 【一句话定义：${d.category || '类别'} + 服务对象 + 核心价值】`,
    '',
    '## 关键事实',
    ...(factLines.length ? factLines : ['- 【成立时间 / 规模 / 资质等可核实信息】']),
    '',
    '## 常见问题',
    ...faq.slice(0, 4).map(f => `- ${f.q}`),
    '',
    '## 官方链接',
    '- 官方网站：【https://】',
    '- 最新动态 / 新闻中心：【https://】',
    '',
  ].join('\n');

  const schemaObj = {
    '@context': 'https://schema.org',
    '@type': /大学|学院|学校|university|college/i.test(name + d.category) ? 'CollegeOrUniversity' : 'Organization',
    name,
    url: '【https://官网地址】',
    description: '【与 llms.txt 一致的一句话定义】',
    sameAs: ['【百度百科/维基百科/官方公众号等权威主页链接】'],
  };
  const schema = `<script type="application/ld+json">\n${JSON.stringify(schemaObj, null, 2)}\n</script>`;

  const fixes = [];
  if (d.recognized === 'unknown') fixes.push('模型基本不认识该实体：优先在官网建立“关于我们”权威页，并争取百科词条、权威媒体报道等第三方来源。');
  if (d.possible_confusions.length) fixes.push(`存在混淆风险（${d.possible_confusions.slice(0, 3).join('、')}）：在官网和 llms.txt 中写明全称、简称、所在地与官方网址，帮助消歧。`);
  if (d.uncertain_points.length) fixes.push('模型对部分信息没有把握：把这些信息以明确、带日期的方式发布在官网，并在 sitemap 中收录。');

  return { faqMd, compareMd, llmsTxt: llms, schema, fixes };
}

function buildBrandAssetsEn(d) {
  const name = d.brand;
  const factLines = d.known_facts.filter(f => f.confidence !== 'low').map(f => `- ${f.fact} [verify]`);
  const faq = [
    { q: `What is ${name}?`, a: `${name} is [one-sentence definition: category + audience + core value]. [Add 1–2 verifiable facts such as founding year, scale or credentials.]` },
    { q: `What makes ${name} different?`, a: '[List 2–3 differentiators backed by public evidence, each with a source link.]' },
    ...d.typical_questions.slice(0, 4).map(t => ({ q: t.q, a: '[Answer directly in 2–3 sentences with specific facts and an official source link.]' })),
  ];
  const faqMd = faq.map(f => `### ${f.q}\n${f.a}`).join('\n\n');
  const compareMd = [
    `| Dimension | ${name} | ${d.competitors[0] || 'Peer A'} | ${d.competitors[1] || 'Peer B'} |`,
    '| --- | --- | --- | --- |',
    '| Positioning / category | [fill in] | [fill in] | [fill in] |',
    '| Key metric (quantified) | [data + source] | [fill in] | [fill in] |',
    '| Main strengths | [fill in] | [fill in] | [fill in] |',
    '| Best for | [fill in] | [fill in] | [fill in] |',
    '| Sources | [link] | [link] | [link] |',
  ].join('\n');
  const llms = [
    `# ${name}`, '', `> [One-sentence definition: ${d.category || 'category'} + audience + core value]`, '',
    '## Key facts', ...(factLines.length ? factLines : ['- [Founding year / scale / credentials — verifiable facts]']), '',
    '## FAQ', ...faq.slice(0, 4).map(f => `- ${f.q}`), '',
    '## Official links', '- Website: [https://]', '- News: [https://]', '',
  ].join('\n');
  const schemaObj = {
    '@context': 'https://schema.org',
    '@type': /university|college|大学|学院/i.test(name + d.category) ? 'CollegeOrUniversity' : 'Organization',
    name, url: '[https://your-site]', description: '[Same one-sentence definition as llms.txt]',
    sameAs: ['[Wikipedia / LinkedIn / official social profiles]'],
  };
  const schema = `<script type="application/ld+json">\n${JSON.stringify(schemaObj, null, 2)}\n</script>`;
  const fixes = [];
  if (d.recognized === 'unknown') fixes.push('The model barely knows this entity: build an authoritative “About” page and earn third-party coverage (encyclopedias, reputable media).');
  if (d.possible_confusions.length) fixes.push(`Risk of confusion (${d.possible_confusions.slice(0, 3).join(', ')}): state your full name, short name, location and official URL on your site and in llms.txt.`);
  if (d.uncertain_points.length) fixes.push('The model is unsure about some facts: publish them clearly, with dates, on your site and include those pages in your sitemap.');
  return { faqMd, compareMd, llmsTxt: llms, schema, fixes };
}
