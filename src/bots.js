// AI 爬虫清单。只有官方公开文档中出现过的 User-Agent 才参与评分（verified: true）。
// 国内部分大模型厂商尚未公开爬虫 UA，仅在生成的 robots.txt 中作预防性声明，不计分。
export const AI_BOTS = [
  // —— AI 搜索 / 实时引用（影响“被 AI 搜到并引用”）——
  { name: 'OAI-SearchBot', vendorEn: 'OpenAI · ChatGPT search', vendor: 'OpenAI · ChatGPT 搜索', category: 'search', verified: true },
  { name: 'PerplexityBot', vendorEn: 'Perplexity search', vendor: 'Perplexity 搜索', category: 'search', verified: true },
  { name: 'Claude-SearchBot', vendorEn: 'Anthropic · Claude search', vendor: 'Anthropic · Claude 搜索', category: 'search', verified: true },
  { name: 'Bingbot', vendorEn: 'Microsoft Bing (source for Copilot)', traditional: true, vendor: '微软 Bing（Copilot 的检索来源）', category: 'search', verified: true },
  { name: 'Googlebot', vendorEn: 'Google Search / AI Overviews', traditional: true, vendor: 'Google 搜索 / AI Overviews', category: 'search', verified: true },
  { name: 'Baiduspider', vendorEn: 'Baidu search / ERNIE-related retrieval', traditional: true, vendor: '百度搜索 / 文心相关检索', category: 'search', verified: true },
  { name: 'Bytespider', vendorEn: 'ByteDance (Toutiao search / Doubao-related)', vendor: '字节跳动（头条搜索 / 豆包相关）', category: 'search', verified: true },
  { name: 'YisouSpider', vendorEn: 'Shenma search (Alibaba · Quark/UC)', traditional: true, vendor: '神马搜索（阿里 · 夸克/UC）', category: 'search', verified: true },
  { name: 'Applebot', vendorEn: 'Apple (Siri / Spotlight search)', traditional: true, vendor: 'Apple（Siri / Spotlight 搜索）', category: 'search', verified: true },
  // —— 用户触发（用户在对话中贴链接/让 AI 打开网页时）——
  { name: 'ChatGPT-User', vendorEn: 'OpenAI · user-triggered visits', vendor: 'OpenAI · 用户触发访问', category: 'user', verified: true },
  { name: 'Claude-User', vendorEn: 'Anthropic · user-triggered visits', vendor: 'Anthropic · 用户触发访问', category: 'user', verified: true },
  { name: 'Perplexity-User', vendorEn: 'Perplexity · user-triggered visits', vendor: 'Perplexity · 用户触发访问', category: 'user', verified: true },
  // —— 模型训练数据采集（屏蔽不影响 AI 搜索引用）——
  { name: 'GPTBot', vendorEn: 'OpenAI · model training', vendor: 'OpenAI · 模型训练', category: 'training', verified: true },
  { name: 'ClaudeBot', vendorEn: 'Anthropic · model training', vendor: 'Anthropic · 模型训练', category: 'training', verified: true },
  { name: 'Google-Extended', vendorEn: 'Google · Gemini training control token', vendor: 'Google · Gemini 训练控制标记', category: 'training', verified: true },
  { name: 'Applebot-Extended', vendorEn: 'Apple · model training control token', vendor: 'Apple · 模型训练控制标记', category: 'training', verified: true },
  { name: 'CCBot', vendorEn: 'Common Crawl (training data for many models)', vendor: 'Common Crawl（众多模型的训练语料来源）', category: 'training', verified: true },
  { name: 'meta-externalagent', vendorEn: 'Meta · model training', vendor: 'Meta · 模型训练', category: 'training', verified: true },
  { name: 'Amazonbot', vendorEn: 'Amazon · Alexa / models', vendor: 'Amazon · Alexa / 模型', category: 'training', verified: true },
];

// 厂商未公开、仅作预防性声明的 UA（不参与评分）
export const UNVERIFIED_BOTS = ['DeepSeekBot', 'MoonshotBot', 'ZhipuAI-Spider', 'MiniMaxBot', 'TencentSearchSpider'];

export const CATEGORY_LABEL = {
  search: 'AI 搜索 / 引用',
  user: '用户触发访问',
  training: '模型训练采集',
};

// 生成 robots 策略分组
export function aiRobotsBlock({ allowTraining, locale = 'zh' }) {
  const en = locale === 'en';
  // 传统搜索引擎爬虫（Googlebot/Bingbot/百度等）沿用站点原有规则，不单独改写，避免意外放开后台等受限路径
  const byCat = (c) => AI_BOTS.filter(b => b.category === c && !b.traditional).map(b => b.name);
  return [
    { comment: en ? 'AI search & citation crawlers: allowed so AI search can find and cite you' : 'AI 搜索与实时引用爬虫：放行，确保能被 AI 搜索检索和引用', agents: byCat('search'), allow: true },
    { comment: en ? 'Agents used when a user asks an AI to open your page: allowed' : '用户在 AI 对话中主动打开您网页时使用的代理：放行', agents: byCat('user'), allow: true },
    {
      comment: allowTraining
        ? (en ? 'Model training crawlers: allowed (content may be used to train models)' : '模型训练采集：放行（内容可能被用于训练大模型）')
        : (en ? 'Model training crawlers: blocked (does not affect AI search citation)' : '模型训练采集：禁止（不影响 AI 搜索引用，保护内容版权）'),
      agents: byCat('training'), allow: !!allowTraining,
    },
    { comment: en ? 'Vendors without published user agents — precautionary (harmless for existing crawlers)' : '国内厂商尚未公开 UA，预防性声明（写了不影响任何现有爬虫）', agents: UNVERIFIED_BOTS, allow: true },
  ];
}
