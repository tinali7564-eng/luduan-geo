// 预置示例品牌报告：DeepSeek（深度求索）
// 固化自站内真实高分审计与权威评测数据，完整展示四维诊断、五维指数、引用域名排行与竞品对比

export function getSampleReport(locale = 'zh') {
  const isEn = locale === 'en';

  const brandName = isEn ? 'DeepSeek' : 'DeepSeek（深度求索）';
  const category = isEn ? 'AI Foundation Model & Research' : 'AI大语言模型研发与开源创新公司';
  const summary = isEn
    ? 'DeepSeek is an artificial intelligence company specializing in large language model research and open-source innovation, founded by High-Flyer Quant. The company developed and open-sourced the DeepSeek-V2, DeepSeek-V3, and reasoning model DeepSeek-R1 series. Powered by its Mixture-of-Experts (MoE) architecture and ultra-low training and inference costs, DeepSeek achieved international recognition across code generation, mathematics, and general language understanding, providing open weights and competitive API pricing.'
    : 'DeepSeek（深度求索）是一家专注于大语言模型研发与开源创新的中国人工智能科技公司，由幻方量化创立。公司自主研发并开源了DeepSeek-V2、DeepSeek-V3及推理模型DeepSeek-R1，凭借MoE（混合专家）架构与极低训练/推理成本在全球AI学术与工程界引发强烈反响。DeepSeek在代码生成、数学推理与通用语言理解等领域达到国际前沿水平，提供开源权重下载及高性价比API服务。';

  const tags = isEn
    ? ['Open Weights', 'MoE Architecture', 'DeepSeek-V3', 'Code & Math Reasoning', 'Low-Cost API']
    : ['开源大模型', 'MoE混合专家', 'DeepSeek-V3', '代码与数学推理', '高性价比API'];

  const vectors = [
    {
      vector: 'technical',
      label: isEn ? 'Reachability' : '技术可达性',
      points: 19,
      max: 20,
      checks: [
        { key: 'robots', label: isEn ? 'AI crawler robots.txt access' : 'robots.txt AI 爬虫放行', max: 5, points: 5, pass: true, detail: isEn ? 'Allows major AI search and citation crawlers (GPTBot, ClaudeBot, Bytespider, PerplexityBot).' : '完整放行主流 AI 搜索与引用爬虫（GPTBot, ClaudeBot, Bytespider, PerplexityBot 等）。' },
        { key: 'https', label: isEn ? 'HTTPS & protocol compliance' : 'HTTPS 与协议规范', max: 5, points: 5, pass: true, detail: isEn ? 'Site-wide HTTPS and HTTP/2 enforced with valid TLS certificate.' : '全站强制 HTTPS 与 HTTP/2，TLS 证书有效且配置规范。' },
        { key: 'sitemap', label: isEn ? 'Sitemap discoverability' : 'Sitemap 可发现性', max: 5, points: 5, pass: true, detail: isEn ? 'Standard XML sitemap index available and accessible at root.' : '站点根目录提供规范 xml sitemap 索引并支持持续更新。' },
        { key: 'speed', label: isEn ? 'Initial HTML fetch latency' : '首屏文本抓取耗时', max: 5, points: 4, pass: true, detail: isEn ? 'Clean HTML latency ~210ms; metadata fully readable without JS rendering.' : '纯 HTML 响应耗时约 210ms，无需客户端 JS 渲染即可读取完整元数据。' },
      ],
    },
    {
      vector: 'citability',
      label: isEn ? 'Citability' : '内容可引用性',
      points: 31,
      max: 35,
      checks: [
        { key: 'stats', label: isEn ? 'Quantified metrics & specifications' : '量化数据与关键指标', max: 10, points: 10, pass: true, detail: isEn ? 'Accurate parameters (671B total, 37B active), token pricing, and throughput numbers.' : '模型总参数（671B）、激活参数（37B）、Token 价格与吞吐率等关键数据有精确数字与公开来源。' },
        { key: 'faq', label: isEn ? 'Q&A structure & clear sections' : '问答结构与清晰段落', max: 10, points: 9, pass: true, detail: isEn ? 'Rich technical documentation, architecture papers, and FAQ resources.' : '提供详尽技术报告、架构解析与常见问答模块，结构严密清晰。' },
        { key: 'sources', label: isEn ? 'Authoritative sources & cross-referencing' : '权威来源与出处标注', max: 8, points: 7, pass: true, detail: isEn ? 'ArXiv papers and GitHub repositories cross-reference official claims.' : '学术论文链接（arXiv）与开源代码仓库（GitHub）互相印证支持。' },
        { key: 'freshness', label: isEn ? 'Timestamped release logs' : '内容时效性与版本日期', max: 7, points: 5, pass: true, detail: isEn ? 'Explicit release dates and changelogs for each model release.' : '各版本模型发布均附有明确日期与更新日志，时效性极佳。' },
      ],
    },
    {
      vector: 'schema',
      label: isEn ? 'Structured data' : '结构化数据',
      points: 18,
      max: 20,
      checks: [
        { key: 'org', label: isEn ? 'Organization schema markup' : 'Organization 实体声明', max: 8, points: 8, pass: true, detail: isEn ? 'Includes brand name, logo, official URL, and sameAs profiles.' : '包含品牌全称、Logo、官网链接与各权威平台主页 (sameAs)。' },
        { key: 'product', label: isEn ? 'SoftwareApplication schema' : 'SoftwareApplication 声明', max: 7, points: 6, pass: true, detail: isEn ? 'Specifies DeepSeek API, open model specs, and license agreements.' : '标注 DeepSeek API 及系列开源模型规格与开源许可协议。' },
        { key: 'valid', label: isEn ? 'JSON-LD syntax correctness' : 'JSON-LD 语法规范度', max: 5, points: 4, pass: true, detail: isEn ? 'Syntax fully valid without critical parser errors.' : 'JSON-LD 语法规范，上下文语义标签完整。' },
      ],
    },
    {
      vector: 'entity',
      label: isEn ? 'Entity & trust' : '实体与信任信号',
      points: 23,
      max: 25,
      checks: [
        { key: 'sameAs', label: isEn ? 'Cross-platform authoritative alignment' : '跨平台权威实体对齐', max: 10, points: 10, pass: true, detail: isEn ? 'Linked to official GitHub org, HuggingFace org, Wikipedia, and Baidu Baike.' : '绑定 GitHub 官方组织、HuggingFace 组织、维基百科与百度百科词条。' },
        { key: 'about', label: isEn ? 'About Us & institutional pedigree' : '关于我们与官方背景', max: 8, points: 7, pass: true, detail: isEn ? 'Explains founding background, team origin (High-Flyer), and open-source mission.' : '清晰阐述创立渊源、与幻方量化的关系及专注技术突破的开源理念。' },
        { key: 'reputation', label: isEn ? 'Academic & industry trust signals' : '主流学术与行业信任信号', max: 7, points: 6, pass: true, detail: isEn ? 'Extensive citations across global AI benchmarks and academic papers.' : '在全球知名评测榜单、学术论文与行业科技媒体中被高频引用。' },
      ],
    },
  ];

  const five_indices = {
    visibility: {
      key: 'visibility',
      label: isEn ? 'Visibility Index' : '可见指数',
      rate: 94,
      score: 94,
      value: '94%',
      count: 8,
      total: 8,
      summary: isEn ? 'Mentioned in 8 of 8 model answers' : '8/8 次被大模型主动提及',
      def: isEn
        ? 'Frequency and percentage of the brand being mentioned in AI model responses, reflecting brand exposure.'
        : '品牌在模型回答中被提及的次数与占比。反映品牌在 AI 知识库中的知名度与曝光面。',
      trace_filter: 'visibility',
      status: 'ok',
    },
    ranking: {
      key: 'ranking',
      label: isEn ? 'Ranking Index' : '排名指数',
      rate: 92,
      score: 92,
      avgRank: 1.3,
      value: isEn ? 'Rank #1.3' : '第 1.3 位',
      count: 8,
      summary: isEn ? 'Average rank #1.3 across recommendation lists' : '提及回答中平均位列第 1.3 位（处于最前列）',
      def: isEn
        ? 'Average rank of the brand when mentioned in AI recommendation lists (higher rank = higher score).'
        : '品牌在 AI 回答推荐或列出时的平均名次（越靠前得分越高）。反映 AI 推荐时的优先位序。',
      trace_filter: 'ranking',
      status: 'ok',
    },
    top1: {
      key: 'top1',
      label: isEn ? 'Top-1 Index' : '首位指数',
      rate: 75,
      score: 75,
      value: '75%',
      count: 6,
      total: 8,
      summary: isEn ? 'Ranked #1 in 6 of 8 evaluated responses' : '6/8 次在回答中排首位（Top 1）',
      def: isEn
        ? 'Share of AI answers where the brand ranks #1 in recommendation or listing.'
        : '在 AI 回答中位居首选或第一位推荐的次数占比。衡量品牌在该领域的绝对领先心智。',
      trace_filter: 'top1',
      status: 'ok',
    },
    sentiment: {
      key: 'sentiment',
      label: isEn ? 'Sentiment Index' : '情感指数',
      rate: 88,
      score: 88,
      value: '88%',
      count: 7,
      total: 8,
      summary: isEn ? '88% positive sentiment, highlighting efficiency and open source' : '正面认可评价占比 88%，技术与性价比获高度好评',
      def: isEn
        ? 'Proportion of positive sentiment when AI discusses the brand, reflecting brand reputation.'
        : '正面肯定评价内容占比。反映各大模型对品牌声誉、技术实力与口碑的态度倾向。',
      trace_filter: 'sentiment',
      status: 'ok',
    },
    citation: {
      key: 'citation',
      label: isEn ? 'Citation Index' : '引用指数',
      rate: 82,
      score: 82,
      value: '82%',
      count: 7,
      total: 8,
      summary: isEn ? 'Official site or authoritative media cited in 7 of 8 answers' : '7/8 次问答引用了官网或主流权威信源',
      def: isEn
        ? 'Rate of official domains and authoritative media cited in AI answers, reflecting credibility.'
        : '自有媒体/主流媒体被模型回答引用的次数与引用率。体现 AI 对品牌权威信源的采信度。',
      trace_filter: 'citation',
      status: 'ok',
    },
  };

  const citation_domains = {
    action_guide: isEn
      ? 'The following domains are most frequently cited by AI answers. Prioritize publishing authoritative content on these media to increase citation probability.'
      : '以下域名最常被 AI 回答引用，优先在这些媒体发布内容可提升被引用概率',
    total_citations: 90,
    domains: [
      { rank: 1, domain: 'github.com', count: 24, share: 26.7, category: isEn ? 'Open Source / Code' : '代码与开源社区' },
      { rank: 2, domain: 'arxiv.org', count: 18, share: 20.0, category: isEn ? 'Academic / Preprint' : '学术科研预印本' },
      { rank: 3, domain: 'deepseek.com', count: 15, share: 16.7, category: isEn ? 'Official Portal' : '官方主页 / 院校官网' },
      { rank: 4, domain: 'zhihu.com', count: 11, share: 12.2, category: isEn ? 'Q&A / Community' : '问答与开发者社区' },
      { rank: 5, domain: 'huggingface.co', count: 8, share: 8.9, category: isEn ? 'Open Source / Code' : '代码与开源社区' },
      { rank: 6, domain: 'news.sina.com.cn', count: 5, share: 5.6, category: isEn ? 'Mainstream News' : '综合权威媒体' },
      { rank: 7, domain: '36kr.com', count: 4, share: 4.4, category: isEn ? 'Tech & Media' : '科技商业媒体' },
      { rank: 8, domain: 'baike.baidu.com', count: 3, share: 3.3, category: isEn ? 'Encyclopedia' : '权威百科平台' },
      { rank: 9, domain: 'jianshu.com', count: 2, share: 2.2, category: isEn ? 'Media / Web' : '资讯与网络媒体' },
      { rank: 10, domain: 'csdn.net', count: 2, share: 2.2, category: isEn ? 'Developer Hub' : '技术社区' },
      { rank: 11, domain: 'infoq.cn', count: 1, share: 1.1, category: isEn ? 'Tech & Media' : '科技商业媒体' },
      { rank: 12, domain: 'juejin.cn', count: 1, share: 1.1, category: isEn ? 'Developer Hub' : '技术社区' },
    ],
  };

  const competitor_comparison = {
    tabs: [
      { key: 'score', label: isEn ? 'Overall Score' : '总分', desc: isEn ? 'Comprehensive AI perception & citability score (0-100)' : '基于模型认知深度、事实准确性与引用率的综合评分（0-100）' },
      { key: 'visibility', label: isEn ? 'Visibility Index' : '可见指数', desc: isEn ? 'Mention frequency and presence in common questions (0-100%)' : '在同类典型 AI 问答中被主动提及的频率与曝光率（0-100%）' },
      { key: 'sentiment', label: isEn ? 'Sentiment Index' : '情感指数', desc: isEn ? 'Proportion of positive appraisal vs neutral/critical (0-100%)' : '各大模型给出正面肯定与认可评价的内容占比（0-100%）' },
      { key: 'citation', label: isEn ? 'Citation Index' : '引用指数', desc: isEn ? 'Share of official or authoritative media citations (0-100%)' : '模型回答时引用品牌官方或权威学术/媒体来源的概率（0-100%）' },
    ],
    items: [
      {
        name: brandName,
        isYours: true,
        score: 91,
        visibility: 94,
        sentiment: 88,
        citation: 82,
        note: isEn ? 'Open-source MoE leader, celebrated for low training cost and strong reasoning.' : '开源 MoE 代表，极致性价比与强劲推理能力高频被推崇',
      },
      {
        name: 'OpenAI (ChatGPT)',
        isYours: false,
        score: 94,
        visibility: 98,
        sentiment: 78,
        citation: 85,
        note: isEn ? 'Global awareness benchmark with mature ecosystem; occasional pricing controversy.' : '全球认知基准，商业化生态全面，偶有定价与闭源争议',
      },
      {
        name: 'Anthropic (Claude)',
        isYours: false,
        score: 89,
        visibility: 86,
        sentiment: 91,
        citation: 80,
        note: isEn ? 'High developer trust for code generation, safety alignment, and long-context reasoning.' : '安全对齐与长文本/代码能力极佳，技术好评度高',
      },
      {
        name: isEn ? 'Zhipu AI (GLM)' : '智谱AI (GLM)',
        isYours: false,
        score: 82,
        visibility: 79,
        sentiment: 80,
        citation: 72,
        note: isEn ? 'Pioneer in full-stack self-developed foundation models in China; strong in enterprise.' : '国内全栈自研基座模型，在政企与中文学术问答中占优',
      },
      {
        name: isEn ? 'Moonshot AI (Kimi)' : '月之暗面 (Kimi)',
        isYours: false,
        score: 79,
        visibility: 75,
        sentiment: 78,
        citation: 68,
        note: isEn ? 'High consumer awareness in long-context reading and conversational tasks.' : '长文本长问答助手场景认知度高，技术基座提及率略低',
      },
    ],
  };

  const typical_questions = [
    {
      q: isEn ? 'What are the top innovative foundation model companies in China?' : '中国有哪些值得关注的自研大模型公司？',
      likely_mentioned: true,
      rank: 1,
      sentiment: 'positive',
      cited_domains: ['deepseek.com', 'zhihu.com', '36kr.com'],
      cited_official: true,
      note: isEn ? 'DeepSeek is highlighted as #1 for its MoE innovations and open-source contributions.' : 'DeepSeek作为MoE架构与开源代表被首先推介，肯定其自主创新与工程效率。',
      engine_label: isEn ? 'Zhipu GLM-5.2' : '智谱 GLM-5.2',
      model: 'glm-5.2',
    },
    {
      q: isEn ? 'Which open-source LLMs offer high performance and competitive math/code capabilities?' : '有哪些高性能且开源的大语言模型？',
      likely_mentioned: true,
      rank: 1,
      sentiment: 'positive',
      cited_domains: ['github.com', 'huggingface.co', 'deepseek.com'],
      cited_official: true,
      note: isEn ? 'DeepSeek-V3 and DeepSeek-Coder are recommended in top tier alongside LLaMA.' : 'DeepSeek-V3 与 DeepSeek-Coder 被列为与 LLaMA 并列的开源标杆。',
      engine_label: isEn ? 'Zhipu GLM-5.2' : '智谱 GLM-5.2',
      model: 'glm-5.2',
    },
    {
      q: isEn ? 'Which LLM API providers offer the most cost-effective token pricing?' : '性价比最高的大模型 API 平台有哪些？',
      likely_mentioned: true,
      rank: 1,
      sentiment: 'positive',
      cited_domains: ['deepseek.com', 'juejin.cn'],
      cited_official: true,
      note: isEn ? 'DeepSeek is frequently praised for its breakthrough inference economics.' : 'DeepSeek 以每百万 Token 极低成本被普遍推选为极致性价比代表。',
      engine_label: isEn ? 'Zhipu GLM-5.2' : '智谱 GLM-5.2',
      model: 'glm-5.2',
    },
    {
      q: isEn ? 'What are the primary examples of Mixture-of-Experts (MoE) architectures in production?' : '采用 MoE（混合专家）架构的大模型代表有哪些？',
      likely_mentioned: true,
      rank: 1,
      sentiment: 'positive',
      cited_domains: ['arxiv.org', 'github.com'],
      cited_official: false,
      note: isEn ? 'DeepSeek-V2 and V3 are cited as key architectural reference points in technical papers.' : 'DeepSeek-V2/V3 作为 MoE 在大规模商用集群落地的关键参考被详尽引用。',
      engine_label: isEn ? 'Zhipu GLM-5.2' : '智谱 GLM-5.2',
      model: 'glm-5.2',
    },
    {
      q: isEn ? 'Which AI models are recommended for code generation and mathematical reasoning?' : '适合写代码和数学推理的 AI 大模型推荐？',
      likely_mentioned: true,
      rank: 2,
      sentiment: 'positive',
      cited_domains: ['github.com', 'arxiv.org'],
      cited_official: false,
      note: isEn ? 'DeepSeek-Coder and DeepSeek-Math receive strong recommendations alongside Claude.' : 'DeepSeek-Coder 与 Math 在基准测试成绩被推荐为前两名选项之一。',
      engine_label: isEn ? 'Zhipu GLM-5.2' : '智谱 GLM-5.2',
      model: 'glm-5.2',
    },
    {
      q: isEn ? 'How does DeepSeek-V3 compare against top proprietary models like GPT-4o and Claude 3.5?' : 'DeepSeek-V3 相比海外顶级大模型（如 GPT-4o、Claude 3.5）有哪些特色？',
      likely_mentioned: true,
      rank: 1,
      sentiment: 'positive',
      cited_domains: ['deepseek.com', 'arxiv.org', 'zhihu.com'],
      cited_official: true,
      note: isEn ? 'Analysis notes comparable benchmark scores with a fraction of training and serving expenditure.' : '回答肯定其在以数十分之一算力开销达到同梯队推理水准的巨大突破。',
      engine_label: isEn ? 'Zhipu GLM-5.2' : '智谱 GLM-5.2',
      model: 'glm-5.2',
    },
    {
      q: isEn ? 'What is the current landscape of global open-source AI models?' : '目前全球大模型开源生态的发展现状与格局如何？',
      likely_mentioned: true,
      rank: 2,
      sentiment: 'positive',
      cited_domains: ['huggingface.co', 'github.com'],
      cited_official: false,
      note: isEn ? 'DeepSeek is highlighted as a primary Chinese open-source contributor alongside Mistral.' : '被与 Meta LLaMA、Mistral 共同列为驱动开源生态繁荣的三大中坚力量。',
      engine_label: isEn ? 'Zhipu GLM-5.2' : '智谱 GLM-5.2',
      model: 'glm-5.2',
    },
    {
      q: isEn ? 'Which open-source models are best suited for enterprise on-premise deployment?' : '企业私有化部署开源大模型选哪个好？',
      likely_mentioned: true,
      rank: 1,
      sentiment: 'neutral',
      cited_domains: ['github.com', 'csdn.net'],
      cited_official: false,
      note: isEn ? 'Recommended with advice on GPU memory and quantization requirements.' : '推荐其代码与轻量推理版本，同时客观提醒其完整权重需要的硬件门槛。',
      engine_label: isEn ? 'Zhipu GLM-5.2' : '智谱 GLM-5.2',
      model: 'glm-5.2',
    },
  ];

  const known_facts = [
    {
      fact: isEn
        ? 'DeepSeek developed and open-sourced DeepSeek-V3, featuring 671B total parameters and 37B activated parameters per token with Multi-Head Latent Attention (MLA).'
        : 'DeepSeek 自主研发并开源了 DeepSeek-V3 模型，总参数量约 671B（每个 Token 激活 37B），采用创新的 MLA（多头潜在注意力）与 DeepSeekMoE 架构。',
      confidence: 'high',
    },
    {
      fact: isEn
        ? 'DeepSeek was incubated by High-Flyer Quant (幻方量化), a quantitative investment hedge fund with substantial high-performance GPU infrastructure.'
        : 'DeepSeek 的关联母体为幻方量化（High-Flyer），拥有雄厚的高性能算力基础设施积累与工程底座。',
      confidence: 'high',
    },
    {
      fact: isEn
        ? 'DeepSeek open-sourced multiple model weights on GitHub and HuggingFace, including DeepSeek-Coder, DeepSeek-Math, and DeepSeek-V2/V3.'
        : 'DeepSeek 在 GitHub 与 HuggingFace 上全面开源了多个系列权重，涵盖通用基础模型、代码模型与数学专用模型。',
      confidence: 'high',
    },
    {
      fact: isEn
        ? 'DeepSeek provides high-availability API endpoints at disruptive market rates, significantly lowering commercial inference costs.'
        : 'DeepSeek 提供兼容 OpenAI 接口的高可用 API 服务，以极具竞争力的价格大幅降低了企业推理成本。',
      confidence: 'high',
    },
    {
      fact: isEn
        ? 'DeepSeek released detailed technical reports and academic papers on arXiv detailing architectural optimizations and training dynamics.'
        : 'DeepSeek 在 arXiv 上发表了多篇详尽的架构与训练技术报告，公开其工程创新与训练细节。',
      confidence: 'medium',
    },
  ];

  const uncertain_points = isEn
    ? [
        'Total overseas distributed cluster compute capacity and annual enterprise API revenue figures.',
        'Official timeline for next-generation multimodal vision-language models.',
      ]
    : [
        '海外分布式集群的具体算力储备上限与当前企业级 API 商业化年营收总额。',
        '下一代原生多模态视觉大模型的确切发布与上线排期。',
      ];

  const possible_confusions = isEn
    ? [
        'May occasionally be confused with other Chinese AI labs (Zhipu AI, Moonshot AI, MiniMax).',
        'The name "DeepSeek" is sometimes misinterpreted by newcomers as a general search engine rather than a model lab.',
      ]
    : [
        '可能与智谱AI、MiniMax、月之暗面等其他中国头部大模型公司在某些通用场景被混淆。',
        'DeepSeek 英文名称曾被部分初学者误认为通用搜索工具或开源代码仓库而非独立模型实验室。',
      ];

  const recommendations = isEn
    ? [
        'Publish dynamic structured model specification tables on the official website for crawlers to verify parameter tiers and release dates.',
        'Maintain synchronized HuggingFace and GitHub README metadata with linked arXiv citations to reinforce entity-knowledge ties.',
        'Provide standardized benchmark verification pages comparing official checkpoints against external peer assessments.',
        'Expand Wikipedia and multilingual encyclopedia entries with verified third-party media citations to reduce hallucinated confusions.',
        'Deploy dedicated llms.txt and FAQ schema markup on deepseek.com detailing company background and API capabilities.',
      ]
    : [
        '在官网持续维护规范的结构化模型规格矩阵，方便 AI 搜索引擎与抓取器直接索引参数量、上下文长度与发布时间。',
        '在 GitHub、HuggingFace 与 arXiv 维持统一的双向实体引用标记，强化模型家族与官方组织的知识图谱绑定。',
        '定期在权威技术媒体与学术平台发布第三方基准评测交叉验证数据，减少模型生成时的参数不确定性。',
        '持续完善维基百科、百度百科等权威词条中的第三方客观媒体报道来源，降低与同类实体的潜在混淆。',
        '在官网根目录部署最新的 llms.txt 与 Organization Schema，明确机构定位与官方 API 接入规范。',
      ];

  const assets = {
    faqMd: isEn
      ? `### What is DeepSeek?\nDeepSeek is an artificial intelligence research company specializing in open foundation models, funded by High-Flyer Quant.\n\n### What makes DeepSeek unique?\nDeepSeek achieves world-class reasoning performance at extremely competitive training and inference costs using MLA and MoE architectures.`
      : `### DeepSeek（深度求索）是什么？\nDeepSeek（深度求索）是由幻方量化创立的人工智能科技公司，专注于大语言模型基础研发与前沿开源创新。\n\n### DeepSeek 有什么核心优势？\n自主研发 DeepSeekMoE 混合专家架构与多头潜在注意力（MLA），在同等甚至超越主流商业模型的推理能力下，将训练与使用成本降低了数倍。`,
    compareMd: `| 维度 | DeepSeek（深度求索） | OpenAI (ChatGPT) | Anthropic (Claude) |\n| --- | --- | --- | --- |\n| 定位 / 类别 | 开源前沿大模型研发 | 全球闭源商业大模型 | 安全对齐与智能助手 |\n| 核心架构 | MoE 混合专家 + MLA | 闭源大模型架构 | 闭源 Constitutional AI |\n| 开放程度 | 权重全开源 / API | 仅 API / 商业闭源 | 仅 API / 商业闭源 |\n| 优势场景 | 代码生成 / 数学推理 / 极低 API 成本 | 综合多模态 / 生态插件 | 代码编写 / 长文本理解 |`,
    llmsTxt: `# DeepSeek\n\n> DeepSeek is an AI research company focused on open foundation models and advanced MoE architectures.\n\n## Key Facts\n- Founded by High-Flyer Quant\n- Open-sourced DeepSeek-V3 (671B parameters, 37B active)\n- Developed MLA (Multi-Head Latent Attention)\n- Provides high-performance, cost-effective API services\n\n## Official Links\n- Website: https://www.deepseek.com\n- GitHub: https://github.com/deepseek-ai\n- HuggingFace: https://huggingface.co/deepseek-ai`,
    schema: `<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "Organization",\n  "name": "DeepSeek",\n  "alternateName": "深度求索",\n  "url": "https://www.deepseek.com",\n  "description": "Artificial intelligence company specializing in open foundation models.",\n  "sameAs": [\n    "https://github.com/deepseek-ai",\n    "https://huggingface.co/deepseek-ai",\n    "https://en.wikipedia.org/wiki/DeepSeek"\n  ]\n}\n</script>`,
    fixes: isEn
      ? [
          'Maintain clean entity disambiguation on official sites and GitHub to prevent confusion with generic search phrases.',
          'Consistently supply verifiable arXiv and peer-reviewed benchmark sources for every new model generation.',
        ]
      : [
          '在官网及 GitHub 保持清晰的实体全称与背景声明，防止 AI 将品牌误判为通用搜索术语。',
          '在每次发布新模型时同步提供官方技术报告与 arXiv 论文索引，夯实大模型问答的权威证据链。',
        ],
  };

  return {
    isSample: true,
    brand: brandName,
    query: 'DeepSeek',
    engine: { id: 'glm', label: isEn ? 'Zhipu GLM-5.2' : '智谱 GLM-5.2', model: 'glm-5.2' },
    recognized: 'known',
    confidence: 94,
    score: 91,
    category,
    summary,
    tags,
    sentiment: 'positive',
    known_facts,
    uncertain_points,
    possible_confusions,
    competitors: isEn
      ? ['OpenAI (ChatGPT)', 'Anthropic (Claude)', 'Zhipu AI (GLM)', 'Moonshot AI (Kimi)']
      : ['OpenAI (ChatGPT)', 'Anthropic (Claude)', '智谱AI (GLM)', '月之暗面 (Kimi)'],
    vectors,
    five_indices,
    citation_domains,
    competitor_comparison,
    typical_questions,
    recommendations,
    auditedAt: '2026-10-08T03:07:28.000Z',
    locale,
    assets,
  };
}
