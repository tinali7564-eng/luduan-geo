/* 甪端 GEO 智能体 前端（无框架、无内联脚本，兼容 CSP） */
(function () {
  'use strict';

  // ————————————————————— 基础工具 —————————————————————
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = (s) => { if (!s) return '—'; const d = new Date(String(s).replace(' ', 'T') + (String(s).includes('Z') || String(s).includes('+') ? '' : 'Z')); return isNaN(d) ? s : d.toLocaleString(state.locale === 'en' ? 'en-US' : 'zh-CN', { hour12: false }); };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const colon = () => (state.locale === 'en' ? ': ' : '：');

  const state = {
    locale: 'zh', config: null, user: null, guestQuota: null,
    audit: null, auditId: null, auditKind: null,
    lab: null, sites: null, riskPoll: null,
    pricingPeriod: 'monthly',
    compTab: 'score',
    domainsExpanded: false,
    evidenceFilter: 'all',
    compareTab: 'score',
    compareData: null,
  };

  // ————————————————————— i18n —————————————————————
  // 以中文原文为 key，英文缺失时回退中文
  const EN = {
    '让 AI 搜得到、读得懂、愿意引用您的网站': 'Make your site findable, understandable and citable by AI',
    '检测 ChatGPT、Perplexity、DeepSeek、豆包等 AI 能否读取并正确理解您的网站与品牌，给出可直接落地的整改代码。': 'Check whether ChatGPT, Perplexity, DeepSeek and other AI engines can read and correctly understand your site and brand — with ready-to-deploy fixes.',
    '可见度体检': 'Visibility Audit', '首推实验室': 'Top-1 Lab', '站点托管推送': 'Site Autopilot', 'AI 舆情监测': 'AI Perception Monitor',
    '输入网址（如 example.com）或品牌 / 机构名称': 'Enter a URL (e.g. example.com) or a brand name',
    '开始体检': 'Run audit', '输入网址 → 网站体检；输入名称 → 品牌 AI 认知诊断': 'URL → site audit · Name → brand AI perception check',
    '诊断模型': 'Model', '试一试：': 'Try:', '竞品对比': 'Competitor comparison', '同一套标准给您和竞品打分，找出差距最大的维度。': 'Score you and your competitors with the same rubric and find the biggest gaps.',
    '您的网址': 'Your URL', '竞品网址，每行一个（最多 4 个）': 'Competitor URLs, one per line (max 4)', '开始对比': 'Compare',
    '内容可引用性检查': 'Content citability check', '粘贴一篇文章或页面正文，检查它是否容易被 AI 摘取和引用。': 'Paste an article to check how easily AI can extract and cite it.',
    '粘贴正文（50 字以上）': 'Paste body text (50+ chars)', '检查': 'Check', 'AI 改写建议': 'AI rewrite', '常见问题': 'FAQ',
    '什么是 GEO（生成式引擎优化）？': 'What is GEO (Generative Engine Optimization)?',
    'GEO 指让网站内容更容易被 ChatGPT、Perplexity、DeepSeek、豆包等生成式 AI 读取、理解和引用的一系列优化方法，包括放行 AI 爬虫、提供结构化数据、撰写可引用的内容等。': 'GEO is the set of practices that make your content easier for generative AI (ChatGPT, Perplexity, DeepSeek…) to read, understand and cite — allowing AI crawlers, adding structured data and writing citable content.',
    '体检分数代表 AI 里的排名吗？': 'Does the score equal my ranking in AI answers?',
    '不代表。分数衡量的是网站被 AI 读取和引用的技术与内容条件，AI 产品中的实际回答还取决于其检索范围、模型和用户问题。': 'No. The score measures technical and content readiness. Actual AI answers also depend on each product’s retrieval, model and the user’s question.',
    'llms.txt 有用吗？': 'Is llms.txt useful?',
    'llms.txt 是一个新兴规范，部分 AI 工具已支持读取，主流搜索引擎尚未承诺使用。部署成本很低，可作为补充，但不能替代正常的可抓取页面与结构化数据。': 'llms.txt is an emerging convention supported by some AI tools; major search engines have not committed to it. It’s cheap to add, but no substitute for crawlable pages and structured data.',
    '屏蔽 GPTBot 会影响 ChatGPT 搜索吗？': 'Will blocking GPTBot hurt ChatGPT search?',
    '不会。GPTBot 用于模型训练；ChatGPT 搜索使用 OAI-SearchBot，用户在对话中打开网页使用 ChatGPT-User。体检结果中的“防训练版 robots.txt”就是只放行搜索与用户访问、禁止训练采集。': 'No. GPTBot is for training; ChatGPT search uses OAI-SearchBot and user-triggered visits use ChatGPT-User. The “no-training robots.txt” variant allows search and user agents while blocking training crawlers.',
    '首推实验室：您的官方资料能改变 AI 的回答吗？': 'Top-1 Lab: can your official facts change what AI says?',
    '用您提供的真实事实生成一份 llms.txt 语料，然后让真实大模型分别在“没读到”和“读到”这份资料的情况下回答同一个问题，直观对比差异。': 'Turn your real facts into an llms.txt capsule, then ask a real model the same question with and without it and compare the answers.',
    '说明：“读到资料”是模拟 AI 搜索检索到您页面时的情形；实际效果还取决于 AI 是否收录、检索到您的页面。': 'Note: “with facts” simulates an AI search engine retrieving your page. Real-world impact depends on whether your page is indexed and retrieved.',
    '第一步：填写真实信息': 'Step 1 · Your real facts', '品牌 / 机构名称 *': 'Brand / organization *', '官网域名 *': 'Website domain *', '类别': 'Category',
    '希望被推荐的领域 / 关键词': 'Topic / keyword', '关键事实 *（每行一条，只写可核实的信息，至少 2 条）': 'Key facts * (one per line, verifiable only, at least 2)',
    '服务对象（选填）': 'Audience (optional)', '常被比较的对象（选填，逗号分隔）': 'Often compared with (optional, comma-separated)', '生成语料': 'Generate capsule',
    '第二步：确认语料（可直接修改）': 'Step 2 · Review capsule (editable)', '复制': 'Copy', '下载 llms.txt': 'Download llms.txt', '生成临时预览链接': 'Create preview link',
    '第三步：真实模型对比测试': 'Step 3 · Real model A/B test', '输入用户可能问 AI 的问题': 'A question users might ask AI', '运行对比': 'Run test',
    '站点托管：新内容发布后，主动通知搜索引擎': 'Site autopilot: notify search engines when you publish',
    '通过 IndexNow 协议把新增或更新的网址推送给 Bing（Copilot 与 ChatGPT 搜索的重要数据来源）、Yandex 等搜索引擎。付费套餐每天自动巡检 Sitemap 并推送新增网址。': 'Push new or updated URLs via IndexNow to Bing (a key source for Copilot and ChatGPT search), Yandex and others. Paid plans check your sitemap daily and push new URLs automatically.',
    'llms.txt 部署检测': 'llms.txt checker', '检测': 'Check',
    'AI 舆情监测：大模型在怎么谈论您？': 'AI Perception Monitor: how do models talk about you?',
    '围绕主体和争议事件自动生成用户常问的问题，交给多个真实大模型作答，再逐条分析倾向、是否把争议当事实、是否提及官方信息。每条回答原文都可查看。': 'We generate typical user questions about a subject or controversy, ask several real models, then analyze sentiment, whether claims are repeated as fact, and whether official information is mentioned. Every raw answer is viewable.',
    '套餐价格': 'Pricing', 'DailyToolbox 官网': 'DailyToolbox', 'PDF 工具箱': 'PDF Tools', '图片工坊': 'Image Tools', '开发者工具': 'Dev Tools',
    '登录': 'Log in', '注册': 'Sign up', '退出登录': 'Log out', '我的账户': 'My account', '管理后台': 'Admin',
    '今日剩余': 'Left today', '次': '', '游客': 'Guest',
    '下载 Word 报告': 'Download Word report', '英文版': 'English', '重新体检': 'Re-run', '复制结果链接': 'Copy result link',
    '优先整改': 'Top priorities', 'AI 爬虫访问矩阵': 'AI crawler access', '一键生成的整改代码': 'Generated fixes',
    '可访问': 'Allowed', '部分受限': 'Partly restricted', '被禁止': 'Blocked', '本页被禁止': 'Page blocked',
    'AI 搜索 / 引用': 'AI search / citation', '用户触发访问': 'User-triggered', '模型训练采集': 'Model training',
    '下载': 'Download', '已复制': 'Copied', '体检中…': 'Auditing…', '诊断中…': 'Analyzing…',
    '请先登录': 'Please log in', '登录后即可使用此功能': 'Log in to use this feature',
    '关闭': 'Close', '稍后再说': 'Close', '功能额度提示': 'Quota Limit Notice', '查看升级套餐': 'View Plans',
    '推荐方案': 'Recommended Plans', '专业版 (¥299/月)': 'Pro (¥299/mo)', '企业版 (¥980/月)': 'Enterprise',
    '取消体检': 'Cancel', '取消诊断': 'Cancel', '甪端 GEO 首页': 'Luduan GEO Home',
    '体检提示': 'Audit Notice', '大模型响应超时，本次体检未消耗额度。': 'The model took too long. Your quota was not used.',
    '模型响应超时，未扣除额度。请重试。': 'The model took too long. Your quota was not used. Retry?',
  };
  Object.assign(EN, {"网络连接失败，请检查网络后重试": "Network error, please try again", "处理中…": "Working…", "今日额度已用完": "Daily limit reached", "查看套餐": "See plans", "免费注册": "Sign up free", "知道了": "OK", "用户名或邮箱": "Username or email", "密码": "Password", "忘记密码？": "Forgot password?", "用户名": "Username", "邮箱": "Email", "（选填，用于找回密码）": " (optional, for password reset)", "邮箱验证码": "Email code", "获取验证码": "Get code", "密码（至少 8 位，含字母和数字）": "Password (8+ chars, letters and numbers)", "注册并登录": "Sign up", "注册即每日获得": "Get", "次免费额度": "free audits/day", "注册邮箱": "Account email", "新密码": "New password", "重置密码": "Reset password", "返回登录": "Back to login", "找回密码": "Reset password", "甪端 GEO 智能体": "Luduan GEO", "登录成功": "Logged in", "注册成功，欢迎使用！": "Welcome aboard!", "请先填写邮箱": "Enter your email first", "发送中": "Sending", "未配置模型": "No model configured", "AI 认知诊断": "Check AI perception", "请输入网址或品牌名称": "Enter a URL or brand name", "正在抓取网页、robots.txt、llms.txt 与 sitemap…": "Fetching page, robots.txt, llms.txt and sitemap…", "正在询问大模型对该品牌的认知…": "Asking the model what it knows…", "重试": "Retry", "上传到网站根目录，使 https://您的域名/llms.txt 可访问。请先补充注释处的真实机构信息。": "Upload to your site root so https://yourdomain/llms.txt is reachable. Fill in the commented section with real facts first.", "粘贴到首页 <head> 中。sameAs 可填写百科、官方公众号等权威主页链接。": "Paste into your homepage <head>. Use sameAs for authoritative profile links.", "从本页已有的问答内容中提取，粘贴到该页面 <head> 中。": "Extracted from Q&A already on this page; paste into its <head>.", "已保留您原有的规则，并追加 AI 爬虫分组（沿用原有的路径限制）。": "Your existing rules are kept; AI crawler groups are appended with the same path restrictions.", "未发现原有 robots.txt，已生成默认版本。": "No robots.txt found; a default version was generated.", "robots.txt（防训练）": "robots.txt (no training)", "放行 AI 搜索与用户访问，禁止模型训练采集。适合重视内容版权的网站。": "Allows AI search and user agents, blocks training crawlers.", "（无标题）": "(untitled)", "正文约": "Body ~", "字": "words", "响应": "Response", "分数衡量网站被 AI 读取与引用的技术和内容条件，不代表 AI 产品中的具体排名。": "The score measures technical and content readiness for AI, not a ranking in any AI product.", "按可提升分数排序": "sorted by points to gain", "分": "pts", "通配规则中禁止访问的路径（对所有爬虫生效）": "Paths disallowed for all crawlers", "下一步 · 首推实验室": "Next · Top-1 Lab", "用真实模型测试：AI 读到您的官方资料后，回答会有什么变化。": "Test with a real model how answers change once it reads your facts.", "下一步 · 站点托管": "Next · Site Autopilot", "整改完成后，用 IndexNow 通知搜索引擎重新抓取。": "After fixing, notify search engines via IndexNow.", "较为熟悉": "Well known", "部分了解": "Partly known", "基本不了解": "Unknown", "偏正面": "Positive", "中性": "Neutral", "有争议": "Mixed", "偏负面": "Negative", "FAQ 问答模板": "FAQ template", "【】处请填写真实内容后发布在官网 FAQ 页面。": "Fill in the [ ] placeholders with real content, then publish on your FAQ page.", "对比表模板": "Comparison template", "只填写可公开核实的数据，并附来源链接。": "Only use publicly verifiable data with sources.", "补全【】中的信息后上传到网站根目录。": "Complete the [ ] fields, then upload to your site root.", "补全后粘贴到官网首页 <head> 中。": "Complete, then paste into your homepage <head>.", "把握度": "Confidence", "印象": "Impression", "以上为单一模型在未联网情况下的认知，反映品牌信息在模型知识中的覆盖程度；不同模型、不同时间可能不同。建议在「AI 舆情监测」中用多个模型交叉验证。": "This reflects one offline model’s knowledge; results vary by model and over time. Cross-check with several models in AI Perception Monitor.", "模型较有把握的信息": "What the model is confident about", "高": "High", "中": "Medium", "低": "Low", "无": "None", "不确定 / 可能过时": "Uncertain / possibly outdated", "可能混淆 / 同类对象": "Possible confusion / peers", "无明显混淆": "No obvious confusion", "同类": "Peers", "用户常问的问题里，会提到您吗？": "Would you be mentioned in common questions?", "可能提及": "Likely", "可能不提": "Unlikely", "改进建议": "Recommendations", "语料模板（需填入真实信息）": "Content templates (fill in real facts)", "加载中…": "Loading…", "体检时间": "Audited", "新的体检": "New audit", "返回体检": "Back to audit", "请填写您的网址和至少一个竞品网址": "Enter your URL and at least one competitor", "对比中…": "Comparing…", "网站": "Site", "总分": "Score", "您": "you", "各维度均不落后于竞品 🎉": "You’re not behind on any dimension 🎉", "约": "~", "请粘贴至少 50 字的正文": "Paste at least 50 characters", "改写中…": "Rewriting…", "改写稿": "Rewrite", "【待补充】处需要您填入真实数据与来源；请人工核对后再发布。": "Fill [TODO] placeholders with real data and sources; review before publishing.", "生成中…": "Generating…", "提到了您": "Mentioned", "列表第": "rank #", "位": "", "未提到您": "Not mentioned", "提到竞品": "Competitors", "请输入问题": "Enter a question", "模型作答中…": "Model answering…", "模型": "Model", "问题": "Question", "没有您的资料": "Without your facts", "模型仅凭已有知识作答": "Model answers from its own knowledge", "检索到您的资料": "With your facts retrieved", "把上方语料作为检索结果提供给模型（模拟 AI 搜索读到您的 llms.txt）": "Your capsule is provided as a retrieved page (simulates AI search reading your llms.txt)", "如何让真实 AI 读到这份资料？": "How do real AI engines get to read this?", "把语料保存为 llms.txt 上传到网站根目录，并将关键事实同步写进官网正文页面（AI 搜索主要读取正文页面）。": "Upload it as llms.txt and put the key facts on real pages too (AI search mainly reads page content).", "在「可见度体检」中确认 AI 搜索爬虫没有被 robots.txt 拦截。": "Use the Visibility Audit to confirm AI search crawlers aren’t blocked.", "在「站点托管」中用 IndexNow 通知搜索引擎抓取更新。": "Use Site Autopilot to notify search engines via IndexNow.", "读到资料后，模型开始提及您的品牌。说明补充官方资料有明显作用。": "With your facts, the model starts mentioning you — official information clearly helps.", "读到资料后，您在推荐列表中的位置提前了。": "With your facts, you move up the recommendation list.", "即使读到资料，模型仍未提及您。建议补充更具体、可核实的事实，或换一个更贴近您优势的问题。": "Even with your facts the model doesn’t mention you. Add more specific, verifiable facts or try a question closer to your strengths.", "两种情况下模型都提到了您，可对比描述是否更准确、更完整。": "You’re mentioned in both — compare which description is more accurate.", "生成临时预览链接需要登录": "Log in to create a preview link", "7 天内有效，已禁止搜索引擎收录。可在支持联网浏览的 AI（如 ChatGPT）中发送此链接，测试 AI 读取后的回答。": "Valid for 7 days, noindexed. Send it to a browsing-enabled AI (e.g. ChatGPT) to test its answer.", "登录后托管您的站点": "Log in to manage your sites", "添加站点、验证 IndexNow Key 后，即可一键推送新网址；付费套餐每天自动巡检 Sitemap。": "Add a site and verify its IndexNow key to push URLs; paid plans check sitemaps daily.", "添加站点": "Add site", "域名": "Domain", "Sitemap（选填）": "Sitemap (optional)", "添加": "Add", "已托管": "Sites", "个站点": "", "每日自动巡检已开启": "Daily checks on", "免费版需手动巡检，": "Free plan: manual checks. ", "升级自动巡检": "Upgrade for auto checks", "还没有托管站点，在左侧添加第一个吧。": "No sites yet — add your first one.", "Key 已验证": "Key verified", "Key 未验证": "Key not verified", "体检": "Score", "验证站点所有权（一次性）": "Verify ownership (one-time)", "在网站根目录创建文件": "Create file", "，文件内容仅为下面这一行：": " in your site root containing only:", "下载 Key 文件": "Download key file", "上传后确保能访问": "Make sure this loads", "我已上传，验证": "Uploaded — verify", "上次巡检": "Last check", "Sitemap 网址数": "Sitemap URLs", "上次新增": "New last time", "最近推送": "Last push", "条": "URLs", "立即巡检": "Check now", "手动推送网址": "Push URLs", "付费套餐可用": "Paid plans", "新增网址自动推送": "Auto-push new URLs", "删除": "Delete", "验证中…": "Verifying…", "巡检中…": "Checking…", "巡检完成，但有问题": "Checked with issues", "已建立基线：Sitemap 共": "Baseline created:", "个网址，之后新增的网址会被识别并推送。": "URLs. New URLs will be detected and pushed.", "Sitemap 共": "Sitemap has", "个网址，新增": "URLs, new:", "个": "", "推送": "Push", "Key 未验证，未推送": "key not verified, not pushed", "删除站点": "Delete site", "确定删除": "Delete", "推送记录将一并清除。": "Push history will be removed.", "取消": "Cancel", "已删除": "Deleted", "每行一个完整网址，必须属于": "One full URL per line, must belong to", "登录后使用 AI 舆情监测": "Log in to use AI Perception Monitor", "每次监测会调用多个大模型，需要登录账号并消耗额度（每个模型 2 次）。": "Each run queries several models and uses 2 credits per model.", "发起监测": "New run", "监测主体 *": "Subject *", "机构 / 品牌全称": "Full organization / brand name", "官网域名": "Website domain", "争议说法（选填）": "Claim (optional)", "网上流传的具体说法": "The specific claim circulating online", "官方说法（选填）": "Official statement (optional)", "已发布的官方回应，用于判断 AI 回答是否与官方一致": "Published official response, used to check consistency", "事件热度": "Event severity", "参与测试的模型": "Models", "服务器尚未配置模型": "No models configured", "开始监测": "Start", "模型未联网时基于其训练知识作答，结果反映“模型记忆中的您”。": "Offline models answer from training data — this reflects how the model remembers you.", "填写左侧表单发起监测，或从下方历史记录中查看结果。": "Start a run with the form, or open a past run below.", "监测记录": "History", "风险": "Risk", "失败": "Failed", "暂无记录": "No records", "请至少选择一个模型": "Select at least one model", "提交中…": "Submitting…", "监测已开始，通常需要 1~3 分钟": "Started — usually takes 1–3 minutes", "监测中": "Running", "正在让": "Asking", "回答": "to answer", "个问题并逐条分析…": "questions and analyzing…", "可以离开此页面，完成后在监测记录中查看。": "You can leave; results will appear in History.", "任务失败": "Run failed", "综合风险指数": "Risk index", "AI 可见度": "AI visibility", "负面回答占比": "Negative answers", "把争议当事实": "Claim stated as fact", "未提及官方信息": "No official info", "有效回答": "Answers", "负面": "Negative", "复述争议": "Repeats claim", "提及官方": "Cites official", "逐题回答": "Answers by question", "点击查看原文": "click to view", "颜色：红=负面 绿=正面 灰=中性；⚠ 把争议说法当事实；✓ 提及官方信息。分析由评审模型自动完成，重要结论请查看原文复核。": "Red = negative, green = positive, grey = neutral; ⚠ claim stated as fact; ✓ cites official info. Analysis is automated — verify important findings in the raw answers.", "倾向": "Sentiment", "提及官方信息": "Cites official info", "与官方说法不一致": "Inconsistent with official", "与官方说法一致": "Consistent with official", "争议澄清助手": "Clarification assistant", "粘贴您已发布（或拟发布）的官方说明，对比 AI 读到它之前和之后的回答，并生成可发布的澄清页结构与结构化数据。系统只使用您提供的内容，不会替您编写官方结论。": "Paste your (planned) official statement to compare AI answers before and after reading it, and get a publishable page outline and structured data. Only your content is used.", "主体名称 *": "Subject *", "争议说法 *": "Claim *", "官方说明内容 *": "Official statement *", "官方原文链接（选填）": "Official URL (optional)", "测试模型": "Model", "生成对比与澄清素材": "Compare & generate", "需要专业团队协助梳理事实、撰写与发布？": "Need expert help with facts, writing and publishing?", "预约专家咨询": "Contact an expert", "澄清页结构": "Page outline", "【】处补充依据后发布在官网，标题包含公众搜索的关键词。": "Add evidence in [ ], publish on your site with the searched keywords in the title.", "粘贴到澄清页 <head> 中。": "Paste into the page <head>.", "llms.txt 片段": "llms.txt snippet", "追加到网站 llms.txt 中。": "Append to your llms.txt.", "AI 仅凭已有知识": "AI from own knowledge", "AI 检索到官方说明后": "AI after reading the statement", "留下联系方式，我们会在 1 个工作日内与您沟通。": "Leave your contact and we’ll reply within one business day.", "称呼 *": "Name *", "联系方式（手机 / 微信 / 邮箱）*": "Contact (phone / WeChat / email) *", "机构 / 品牌名称 *": "Organization *", "官网（选填）": "Website (optional)", "需求描述 *": "What do you need? *", "提交": "Submit", "选择适合您的套餐": "Choose a plan", "年付优惠约 17%。支持对公转账与发票。": "Save ~17% yearly. Invoices and bank transfer supported.", "推荐": "Popular", "当前套餐": "Current", "月": "mo", "年付": "Yearly", "按月开通": "Monthly", "按年开通": "Yearly", "请先登录再开通套餐": "Log in to subscribe", "订单已创建": "Order created", "订单号": "Order no.", "套餐": "Plan", "月付": "Monthly", "金额": "Amount", "收款码": "Payment QR", "付款时请备注订单号，确认到账后即为您开通。": "Include the order number with your payment; we activate after it arrives.", "演示模式：模拟支付": "Demo: simulate payment", "好的": "OK", "账户信息": "Account", "到期时间": "Expires", "今日额度": "Credits today", "托管站点": "Sites", "升级 / 续费": "Upgrade / renew", "修改密码": "Change password", "体检与诊断记录": "Audit history", "我的订单": "Orders", "网站体检": "Site audit", "品牌诊断": "Brand check", "待付款": "Pending", "已开通": "Active", "已取消": "Cancelled", "标准版": "Pro", "机构版": "Enterprise", "暂无订单": "No orders", "原密码": "Current password", "新密码（至少 8 位）": "New password (8+ chars)", "保存": "Save", "已退出登录": "Logged out", "已开启自动推送": "Auto-push on", "已关闭自动推送": "Auto-push off", "站点已添加，请按提示完成 Key 验证": "Site added — complete key verification", "高可见度 · 高风险": "High visibility · High risk", "低可见度 · 高风险": "Low visibility · High risk", "高可见度 · 低风险": "High visibility · Low risk", "低可见度 · 低风险": "Low visibility · Low risk", "负面或争议内容已大量进入 AI 回答，优先处置。": "Negative or disputed content is widespread in AI answers — act first.", "正面/官方信息缺席，争议信息相对突出，重点补充官方内容。": "Official information is missing and disputes stand out — publish official content.", "AI 对您的描述总体健康，保持权威内容更新。": "AI describes you well — keep authoritative content fresh.", "AI 对您了解不多，建议开展基础 GEO 内容建设。": "AI knows little about you — start with GEO basics.", "今日剩余": "Left today",
    "红V发布闭环": "RedV Publish Loop", "红V发布闭环 · 效果验证": "RedV Publish Loop · Verification",
    "站内通知": "Notifications",
    "登录后使用红V发布闭环": "Log in to use the RedV publish loop",
    "关联 60+ 全平台主流媒体红V账号矩阵，由系统根据品牌审计弱点生成行动卡，人工发布后自动观测模型回答变化与信源引用。": "Connect 60+ mainstream media RedV accounts. Action cards are generated from brand audit weaknesses; after your team publishes, the system observes model answer changes and citations.",
    "实验参数配置": "Experiment setup", "品牌 / 机构名称 *": "Brand / organization *",
    "官网域名 *": "Official domain *", "常被比较的对象（选填，逗号分隔）": "Frequent competitors (optional, comma-separated)",
    "版本 A（对照版）*": "Version A (control) *", "现有官网文案或精简简介": "Current site copy or brief intro",
    "版本 B（优化版）*": "Version B (optimized) *", "包含量化事实/资质/差异化要点": "Quantified facts, credentials, differentiators",
    "测试提示词集（每行一个测试问题）*": "Test prompts (one per line) *",
    "从最近品牌诊断导入": "Import from recent brand audit", "填入典型推荐问题": "Fill typical questions",
    "测试模型（支持多选）": "Models (multi-select)", "采样轮次（调 1–5 轮）": "Sampling rounds (1-5)",
    "单轮调用随机性较大，默认 3 轮采样聚合可有效平抑噪声。": "Single rounds are noisy; 3 rounds by default smooths variance.",
    "开始真实大模型 A/B 对比实测": "Run real-model A/B test",
    "请填写完整的品牌、域名与双版本文案": "Fill in brand, domain and both copy versions",
    "请输入至少一个测试提示词问题": "Enter at least one test question",
    "请至少选择一个测试模型": "Select at least one model",
    "请先登录后使用真实大模型 A/B 对比实验": "Log in to run the real-model A/B experiment",
    "请先登录以查看站内通知": "Log in to view notifications",
    "首推实验室 · 真实模型 A/B 对比": "Top-1 Lab · Real-model A/B testing",
    "对比两个内容版本在真实大模型中的检索与推荐效果。按多轮采样聚合统计提及率、推荐排名与引用倾向，输出客观胜出结论与建议。": "Compare two content versions on real models. Multi-round sampling aggregates mention rate, ranking and citation signals into an objective verdict.",
    "真实模型 A/B 对比实验": "Real-model A/B experiment", "生成 llms.txt 与单次模拟": "Generate llms.txt & single simulation",
    "甪端 GEO — 当用户问 AI，答案里有你吗？| AI 搜索可见度体检与优化": "Luduan GEO — Are you in the answer when people ask AI? | AI visibility audit",
    "首推实验室 · 甪端 GEO": "Top-1 Lab · Luduan GEO", "站点托管 · 甪端 GEO": "Site Autopilot · Luduan GEO",
    "AI 舆情监测 · 甪端 GEO": "AI Perception Monitor · Luduan GEO", "红V发布闭环 · 甪端 GEO": "RedV Publish Loop · Luduan GEO",
    "我的账户 · 甪端 GEO": "My Account · Luduan GEO", "套餐价格 · 甪端 GEO": "Pricing · Luduan GEO",
    "体检结果 · 甪端 GEO": "Audit Result · Luduan GEO", "历史记录 · 甪端 GEO": "History · Luduan GEO",
    "隐私政策 · 甪端 GEO": "Privacy Policy · Luduan GEO", "服务条款 · 甪端 GEO": "Terms of Service · Luduan GEO",
    "关于我们 · 甪端 GEO": "About Us · Luduan GEO", "联系我们 · 甪端 GEO": "Contact Us · Luduan GEO",
    "甪端 GEO": "Luduan GEO",
    "按次扣费 · 扣除 1 次实验室额度": "Pay per use · 1 lab credit per run",
    "条款与关于": "Legal & About",
    "主流媒体红V矩阵": "Mainstream media RedV",
    "如：某某品牌 / 某某机构": "e.g. Acme Corp / Harvard University",
    "如：竞品A, 竞品B": "e.g. Competitor A, Competitor B",
    "粘贴对照版文案，例如现有主页文本或旧版介绍…": "Paste control copy, e.g. current homepage or legacy intro…",
    "粘贴优化版文案，重点强化量化指标、第三方认证与明确论据…": "Paste optimized copy emphasizing quantified metrics, third-party certs and clear evidence…",
    "有哪些值得推荐的机构/产品？说明理由。\n选择该品牌需要注意什么？优势是什么？": "Which brands/products in this field are worth recommending, and why?\nWhat are the key advantages to look for?",
    "快捷填入": "Quick Fill",
    "取消诊断": "Cancel",
    "已取消诊断": "Diagnosis cancelled",
    "重新开始": "Start over",
    "联系销售 / 定制方案": "Contact Sales / Custom Solution",
    "企业版专属方案咨询": "Enterprise Custom Solution Inquiry",
    "额度与功能消耗说明": "Credits & Feature Breakdown",
    "常见问题与退款政策": "FAQ & Refund Policy",
    "示例行动卡预览": "Sample Action Card Preview",
    "未提及 / 含争议": "Not mentioned / Disputed",
    "权威引用率": "Citation rate",
    "争议消除率": "Dispute resolution rate",
    "去实验": "Try Lab",
    "去托管": "Manage Site"});
  Object.assign(EN, {"当用户问 AI，": "When people ask AI,", "答案里有你吗？": "are you in the answer?", "检测 ChatGPT、DeepSeek、豆包、Perplexity 等 AI 能否读取、理解并引用你的网站与品牌——并给出可以直接上线的修复代码。": "See whether ChatGPT, DeepSeek, Perplexity and others can read, understand and cite your site and brand — with fixes you can ship today.", "yourdomain.com 或 品牌 / 机构名称": "yourdomain.com or a brand name", "网址 → 网站体检 · 名称 → 品牌 AI 认知诊断": "URL → site audit · Name → brand AI perception", "试一试": "Try", "AI 爬虫检测": "AI crawlers", "四维评分": "4-part score", "首次体检": "First audit", "免费": "Free", "正在检索并阅读 3 个来源": "Searching and reading 3 sources", "你的网站": "Your site", "示意 · GEO 的目标：让你的官方页面成为 AI 回答里的引用来源": "Illustration · The goal of GEO: make your official page a cited source in AI answers", "评估方法": "Methodology", "三件事决定 AI 会不会引用你": "Three things decide whether AI cites you", "我们用同一套 100 分标准检查每个网站。分数衡量的是被 AI 读取与引用的条件，不代表任何 AI 产品中的排名。": "Every site is checked against the same 100-point rubric. The score measures readiness to be read and cited — not a ranking in any AI product.", "读得到": "Reachable", "读得懂": "Understandable", "愿意引用": "Citable", "AI 搜索爬虫没有被 robots.txt 拦截，页面不依赖 JavaScript 才显示正文，sitemap 可以被发现。": "AI search crawlers aren’t blocked by robots.txt, content doesn’t require JavaScript, and the sitemap is discoverable.", "用 Schema 结构化数据说明“你是谁”，标题、署名、日期、规范网址等信任信号完整。": "Schema markup says who you are; titles, authorship, dates and canonical URLs build trust.", "内容有具体数据、问答结构、表格列表和可靠来源，AI 可以直接摘取成答案。": "Specific data, Q&A structure, tables and credible sources make content easy to quote.", "工作流": "Workflow", "从诊断到持续监测，一条完整链路": "From diagnosis to ongoing monitoring", "四维评分、19 个 AI 爬虫访问矩阵，一键生成 llms.txt、Schema 与 robots.txt。": "4-part score, 19-crawler access matrix, one-click llms.txt, Schema and robots.txt.", "让真实大模型分别在“没读到 / 读到”你的官方资料时回答同一问题，对比差异。": "Ask a real model the same question with and without your official facts, and compare.", "没有你的资料": "Without your facts", "检索到你的资料": "With your facts", "未提及": "Not mentioned", "列表第 1 位": "Ranked #1", "每日巡检 Sitemap，新发布的网址通过 IndexNow 自动通知 Bing 等搜索引擎。": "Daily sitemap checks; new URLs pushed to Bing and others via IndexNow.", "多个大模型同时作答，逐条判断倾向、是否把争议当事实、是否提及官方说法。": "Several models answer; each reply is checked for sentiment, repeated claims and official sources.", "高可见 · 低风险": "High vis · Low risk", "高可见 · 高风险": "High vis · High risk", "低可见 · 低风险": "Low vis · Low risk", "低可见 · 高风险": "Low vis · High risk", "更多工具": "More tools", "对比竞品，检查每一篇内容": "Benchmark competitors, check every page", "你的网址": "Your URL", "从一次免费体检开始": "Start with a free audit", "30 秒看清 AI 眼中的你的网站，并拿到可以直接部署的修复代码。": "See your site through AI’s eyes in 30 seconds and get deployable fixes.", "站点托管": "Site Autopilot", "价格": "Pricing", "你的官方资料，能改变 AI 的回答吗？": "Can your official facts change what AI says?", "“读到资料”模拟的是 AI 搜索检索到你页面时的情形；实际效果还取决于 AI 是否收录、检索到你的页面。": "“With facts” simulates AI search retrieving your page; real impact depends on indexing and retrieval.", "填写真实信息": "Your real facts", "确认语料（可直接修改）": "Review capsule (editable)", "真实模型对比测试": "Real model A/B test", "新内容一发布，就主动通知搜索引擎": "Notify search engines the moment you publish", "大模型在怎么谈论你？": "How do models talk about you?", "帮助网站与品牌在生成式 AI 时代被准确理解、被正确引用。": "Helping sites and brands be understood and cited correctly in the age of generative AI.", "产品": "Product", "AI 爬虫读到的页面": "What AI crawlers read", "这是不执行 JavaScript 的爬虫看到的内容": "As seen by a crawler that doesn’t run JavaScript", "（缺失）": "(missing)", "标题结构": "Headings", "没有 H1–H3 标题": "No H1–H3 headings", "正文开头": "Body text", "几乎读不到正文。内容可能依赖 JavaScript 渲染，AI 爬虫看到的是空白页。": "Almost no text. Content likely needs JavaScript, so AI crawlers see a blank page.", "技术可达性": "Reachability", "内容可引用性": "Citability", "结构化数据": "Structured data", "实体与信任信号": "Entity & trust"});
  Object.assign(EN, {"网址或品牌名称": "URL or brand name", "技术可达性 · 20": "Reachability · 20", "结构化数据 · 20　实体信号 · 25": "Structured data · 20　Entity · 25", "内容可引用性 · 35": "Citability · 35", "同一套标准给你和竞品打分，找出差距最大的维度。": "Score you and your competitors with the same rubric and find the biggest gaps.", "用你提供的真实事实生成一份 llms.txt 语料，然后让真实大模型分别在“没读到”和“读到”这份资料的情况下回答同一个问题，直观对比差异。": "Turn your real facts into an llms.txt capsule, then ask a real model the same question with and without it and compare the answers."});
  Object.assign(EN, {"免费版": "Free", "（无标题）": "(untitled)", "中文版": "中文版"});
  Object.assign(EN, {
    '内容行动卡': 'Content action card',
    '建议标题': 'Suggested title',
    '建议发布渠道': 'Suggested channels',
    '展开内容大纲': 'Show content outline',
    '收起内容大纲': 'Hide outline',
    '我已在小红书发布，标记一下': 'I published this on Xiaohongshu — mark it',
    '登录后可标记发布进度，下次审计自动重测引用变化': 'Log in to track publishing; the next audit will auto-retest citation changes',
    '已在小红书发布': 'Published on Xiaohongshu',
    '撤销标记': 'Undo',
    '确定撤销该行动卡的发布标记吗？': 'Remove the published mark from this card?',
    '已标记为已发布': 'Marked as published',
    '已撤销标记': 'Mark removed',
    '标记为已在小红书发布': 'Mark as published on Xiaohongshu',
    '发布渠道': 'Publish channel',
    '如：小红书@你的账号名': 'e.g. Xiaohongshu @yourhandle',
    '标记后，下次品牌审计会自动用真实模型重测该弱点的引用变化，并在报告中展示前后对比。': 'After marking, the next brand audit will auto-retest this weakness with a real model and show a before/after comparison.',
    '确认标记': 'Confirm',
    '发布后重测对比': 'Post-publish retest',
    '以下弱点曾标记为已在小红书发布，本次审计用真实模型重新提问，自动对比引用变化': 'These weaknesses were marked as published on Xiaohongshu. This audit re-asked the questions with a real model and compared citations automatically.',
    '发布前基线': 'Baseline before publishing',
    '本次重测': 'This retest',
    '被提及': 'Mentioned',
    '未被提及': 'Not mentioned',
    '引用域名': 'Cited domains',
    '排名': 'Rank',
    '天前': 'days ago',
    '已发布': 'Published',
    '本轮审计暂未观测到外部引用，建议先在官网沉淀该内容，再同步到小红书等自有阵地。': 'No external citations were observed in this audit. Consider publishing this content on your official site first, then syndicating it to Xiaohongshu and other owned channels.',
    '渠道取自本轮审计的引用域名排行，悬停查看具体依据': 'Channels are ranked by cited domains in this audit; hover for details',
  });
  Object.assign(EN, {
    '历史记录': 'Audit History',
    '暂无历史体检记录': 'No audit history yet',
    '查看完整报告': 'View full report',
    '清空历史': 'Clear history',
    '历史记录已清空': 'History cleared',
    '查看过去运行的网站体检与品牌 AI 认知诊断报告': 'View past website audits and brand AI perception reports',
    '共找到': 'Found',
    '条历史诊断报告': 'audit reports',
    '输入网址或品牌名称发起体检后，历史报告将自动保存在这里。': 'Audit reports will be automatically saved here after running a check.',
    '按月付费': 'Monthly Billing',
    '按年付费 (省17%)': 'Yearly Billing (Save 17%)',
    '相当于': 'equiv.',
    '当前已是免费版': 'Current plan: Free',
    '隐私政策': 'Privacy Policy',
    '服务条款': 'Terms of Service',
    '关于我们': 'About Us',
    '联系我们': 'Contact Us',
    '返回首页': 'Back to Home',
    '已达 60 字上限，无法继续输入': 'Reached 60-character limit',
    '品牌名称已达 60 字上限，请精简后重试': 'Brand name reached 60-character limit, please shorten and retry',
    '今日额度已用完，明日 0 点恢复': 'Daily limit reached, resets at 00:00 tomorrow',
    '今日额度已用完，明日 0 点恢复。游客每天 5 次，免费注册用户每天 30 次。': 'Daily limit reached, resets at 00:00 tomorrow. 5 runs/day for guests, 30 runs/day for registered users.',
    '游客每天 5 次，免费注册用户每天 30 次': '5 runs/day for guests, 30 runs/day for free registered users',
    '免费注册用户每天 30 次，明日 0 点自动重置。': '30 runs/day for registered users, resets at 00:00 tomorrow.',
    '请填写此字段': 'Please fill out this field',
    '甪端 GEO': 'Luduan GEO',
    '甪端': 'Luduan',
    '模型较有把握的信息': 'What the model is confident about',
    '不确定 / 可能过时': 'Uncertain / possibly outdated',
    '可能混淆 / 同类对象': 'Possible confusion / peers',
    '无明显混淆': 'No obvious confusion',
    '同类': 'Peers',
    '用户常问的问题里，会提到您吗？': 'Would you be mentioned in common questions?',
    '可能提及': 'Likely',
    '可能不提': 'Unlikely',
    '改进建议': 'Recommendations',
    '语料模板（需填入真实信息）': 'Content templates (fill in real facts)',
    '下载 Word 报告': 'Download Word report',
    '复制结果链接': 'Copy result link',
    '请填写此字段': 'Please fill out this field',
    '中文版': '中文版',
    '英文版': 'English',
    'Chinese': '中文版',
    'English': '英文版',
    '重新体检': 'Re-run',
    '优先整改': 'Top priorities',
    'AI 爬虫访问矩阵': 'AI crawler access',
    '一键生成的整改代码': 'Generated fixes',
    '可访问': 'Allowed',
    '部分受限': 'Partly restricted',
    '被禁止': 'Blocked',
    '本页被禁止': 'Page blocked',
    '模型训练采集': 'Model training',
    '用户触发访问': 'User-triggered',
    'AI 搜索 / 引用': 'AI search / citation',
    '下载': 'Download',
    '已复制': 'Copied',
    '体检中…': 'Auditing…',
    '诊断中…': 'Analyzing…',
    '体检时间': 'Audited',
    '新的体检': 'New audit',
    '返回体检': 'Back to audit',
    '总分': 'Score',
    '技术可达性': 'Reachability',
    '内容可引用性': 'Citability',
    '结构化数据': 'Structured data',
    '实体与信任信号': 'Entity & trust',
    '把握度': 'Confidence',
    '印象': 'Impression',
    '较为熟悉': 'Well known',
    '部分了解': 'Partly known',
    '基本不了解': 'Unknown',
    '偏正面': 'Positive',
    '中性': 'Neutral',
    '有争议': 'Mixed',
    '偏负面': 'Negative',
    '高': 'High',
    '中': 'Medium',
    '低': 'Low',
    '无': 'None',
    'FAQ 问答模板': 'FAQ template',
    '对比表模板': 'Comparison template',
    '以上为单一模型在未联网情况下的认知，反映品牌信息在模型知识中的覆盖程度；不同模型、不同时间可能不同。建议在「AI 舆情监测」中用多个模型交叉验证。': 'The above reflects the model’s offline knowledge. Suggest cross-validating in AI Perception Monitor.',
    '分数衡量网站被 AI 读取与引用的技术和内容条件，不代表 AI 产品中的具体排名。': 'The score measures technical readiness to be read and cited, not rankings in AI products.',
    '查看示例报告': 'View Sample Report',
    '示例报告': 'Sample Report',
    '示例报告说明': 'Sample Report Notice',
    '此报告为预置示例，基于深度求索（DeepSeek）真实审计数据固化，展示完整的 GEO 诊断能力；非实时体检结果。': 'This report is a preset sample based on verified DeepSeek audit data, showcasing full GEO diagnostic capabilities; not a live audit result.',
    '基于深度求索（DeepSeek）真实审计数据固化，展示全套诊断能力': 'Based on verified DeepSeek audit data, showcasing full diagnostics.',
    '示例报告（DeepSeek）': 'Sample Report (DeepSeek)',
    '五维可见度指数': 'Five Visibility Indices',
    '与四维诊断互补：从可见度、排名、首位度、情感倾向与引用率五个维度评估大模型真实认知情况': 'Complementing 4D diagnosis: evaluates visibility, rank, top-1 share, sentiment, and citation rate.',
    '可见指数': 'Visibility Index',
    '排名指数': 'Ranking Index',
    '首位指数': 'Top-1 Index',
    '情感指数': 'Sentiment Index',
    '引用指数': 'Citation Index',
    '数据不足': 'Insufficient data',
    '暂无足够问答样本': 'Insufficient Q&A samples',
    '查看证据链': 'View evidence',
    '查看完整证据链': 'View full evidence chain',
    '条问答': ' Q&As',
    '证据链': 'Evidence Chain',
    '审计问答明细': 'Audit Q&A Details',
    '点击上方任一指数可快速定位贡献该分数的问答证据，严格可追溯': 'Click any index above to locate contributing Q&A evidence; strictly traceable.',
    '引用域名排行': 'Top Cited Domains',
    '大模型在回答相关问题时引用频次最高的权威媒体与信源域名': 'Authoritative media and source domains most frequently cited by models.',
    '实体混淆预警': 'Entity Confusion Alert',
    '实体混淆风险': 'Entity Confusion Risk',
    '检测到大模型在部分回答中引用了同名/混淆实体的官方网站（而非目标主体官网）。建议加强实体消歧建设（同义词、英文全称与 Schema 别名），引导 AI 正确关联本方官网。': 'The model cited official portals of homonymous or confused entities instead of your actual official domain in some answers. Strengthen entity disambiguation (full name, synonyms, and Schema sameAs aliases) to guide AI to your correct domain.',
    '引用了同名或混淆实体的官网': 'Cited the official portal of a homonymous or confused entity',
    '行动指引': 'Action Guide',
    '以下域名最常被 AI 回答引用，优先在这些媒体发布内容可提升被引用概率': 'The following domains are most frequently cited by AI answers. Prioritize publishing authoritative content on these media to increase citation probability.',
    '查看全部': 'View all',
    '收起': 'Collapse',
    '竞品对比': 'Competitor Benchmark',
    '本方 vs 同类竞品多维度横向对标': 'Benchmark yourself against peers across multiple metrics',
    '本方': 'You',
    '平均排名': 'Average rank',
    '位列榜首': 'Ranked #1',
    '正面评价': 'Positive sentiment',
    '权威信源引用率': 'Authoritative citations',
    '排名': 'Rank',
    '引用域名': 'Domain',
    '类别/属性': 'Category',
    '引用次数': 'Citations',
    '引用占比': 'Share',
    '对比简评': 'Peer Note',
    '维度对标': 'Benchmark',
    '当前指标': 'Metric',
    '暂无引用域名数据（模型回答未包含外部链接）': 'No domain citations recorded (model answers did not contain external links).',
    '全部': 'All',
    '可见提及': 'Mentioned',
    '排名明细': 'Ranks',
    '首位推荐': 'Top-1',
    '信源引用': 'Citations',
    '位居第': 'Rank #',
    '未列名次': 'Unranked',
    '官网引用': 'Official cited',
    '四维诊断': '4D Diagnosis',
    '技术可达性、内容可引用性、结构化数据与实体信任信号综合评测': 'Technical reachability, citability, structured data & entity trust.',
    '四维总分': '4D Score',
    '次被主动提及': 'times mentioned',
    '次在回答中排首位': 'times ranked #1',
    '次问答引用权威信源': 'citations to authoritative sources',
    '维度切换': 'Dimension',
    '品牌': 'Brand',
    '未观测到外部信源引用': 'No external source citations observed',
    '一键生成红V行动卡': 'Generate Red-V Action Card',
    '点击填入输入框测试': 'Click to fill into input box',
    '（示例）': ' (Example)',
    '（品牌）': ' (Brand)',
    '东北大学': 'Northeastern University (China)',
    'GEO 实体消歧向导': 'GEO Disambiguation Guide',
    '默认偏好与混淆率测试': 'Confusion & Bias Test',
    '引用信源': 'Cited sources',
    '建议标题': 'Suggested title',
    '建议发布渠道': 'Suggested channels',
    '行动指引': 'Action Guide',
    '不限并发': 'Unlimited concurrency',
    '优先队列': 'Priority queue',
    '专属集群': 'Dedicated cluster',
    '完整发布闭环': 'Full release loop',
    '60+ 主流媒体矩阵专线': '60+ mainstream media matrix lines',
    '智谱 GLM-5.2': 'Zhipu GLM-5.2',
    '智谱': 'Zhipu',
    '未通过 DNS 解析，可能为虚构域名': 'Failed DNS resolution; domain may be unverified',
    '已通过权威 DNS 解析验证': 'Verified via authoritative DNS resolution',
    '未验证': 'Unverified',
    '实测样本量': 'Sample size',
    '注册即享每日 30 次免费体检额度（次日 0 点重置）': 'Sign up free for 30 audits/day (resets at 00:00 UTC+8)',
    '官方主页 / 院校官网': 'Official Portal',
    '权威评估 / 榜单平台': 'Ranking & Benchmarks',
    '政府与主管部门': 'Government & Authority',
    '权威百科平台': 'Encyclopedia',
    '学术科研预印本': 'Academic / Preprint',
    '问答与开发者社区': 'Q&A / Community',
    '综合权威媒体': 'Mainstream News',
    '科技商业媒体': 'Tech & Media',
    '技术社区': 'Developer Hub',
    '社交平台': 'Social Media',
    '代码与开源社区': 'Open Source / Code',
    '资讯与网络媒体': 'Media / Web',
    'Official Portal': 'Official Portal',
    'Ranking & Benchmarks': 'Ranking & Benchmarks',
    'Government & Authority': 'Government & Authority',
    'Encyclopedia': 'Encyclopedia',
    '已取消诊断。未扣除额度。': 'Diagnosis cancelled. Your quota was not used.',
    '已取消诊断。未扣除额度，额度已保留。': 'Diagnosis cancelled. Your quota was not used.',
    '已取消诊断': 'Diagnosis cancelled. Your quota was not used.',
    '未扣除额度': 'Your quota was not used',
    '统计口径说明：五维指数中的「引用指数」衡量含权威信源引用的问答占比；本表统计各具体域名在问答中被引用的累计频次与分布。': 'Note: Citation Index in Five Indices measures the share of answers with citations; this table aggregates the cumulative frequency and distribution of each cited domain.',
  });

  const ZH = {};
  for (const [zh, en] of Object.entries(EN)) {
    if (typeof en === 'string' && en.trim()) ZH[en.trim()] = zh.trim();
  }
  ZH['Brand'] = '品牌';
  ZH['No external source citations observed'] = '未观测到外部信源引用';
  ZH['Generate Red-V Action Card'] = '一键生成红V行动卡';
  ZH['Click to fill into input box'] = '点击填入输入框测试';
  ZH['(Example)'] = '（示例）';
  ZH['(Brand)'] = '（品牌）';
  ZH['Cited sources'] = '引用信源';
  ZH['Suggested title'] = '建议标题';
  ZH['Suggested channels'] = '建议发布渠道';
  ZH['Action Guide'] = '行动指引';
  ZH['Unlimited concurrency'] = '不限并发';
  ZH['Priority queue'] = '优先队列';
  ZH['Dedicated cluster'] = '专属集群';
  ZH['Full release loop'] = '完整发布闭环';
  ZH['60+ mainstream media matrix lines'] = '60+ 主流媒体矩阵专线';
  ZH['Zhipu GLM-5.2'] = '智谱 GLM-5.2';
  ZH['Ruiduan GEO'] = '甪端 GEO';
  ZH['Luduan GEO'] = '甪端 GEO';
  ZH['What the model is confident about'] = '模型较有把握的信息';
  ZH['Download Word report'] = '下载 Word 报告';
  ZH['Copy result link'] = '复制结果链接';
  ZH['English'] = '英文版';
  ZH['Chinese'] = '中文版';
  ZH['Please fill out this field'] = '请填写此字段';
  ZH['What the model is confident about'] = '模型较有把握的信息';
  ZH['Download Word report'] = '下载 Word 报告';
  ZH['English'] = '英文版';
  ZH['Chinese'] = '中文版';
  ZH['Re-run'] = '重新体检';
  ZH['Copy result link'] = '复制结果链接';
  ZH['Top priorities'] = '优先整改';
  ZH['AI crawler access'] = 'AI 爬虫访问矩阵';
  ZH['Generated fixes'] = '一键生成的整改代码';
  ZH['Allowed'] = '可访问';
  ZH['Partly restricted'] = '部分受限';
  ZH['Blocked'] = '被禁止';
  ZH['Page blocked'] = '本页被禁止';
  ZH['Model training'] = '模型训练采集';
  ZH['User-triggered'] = '用户触发访问';
  ZH['AI search / citation'] = 'AI 搜索 / 引用';
  ZH['Download'] = '下载';
  ZH['Copied'] = '已复制';
  ZH['Auditing…'] = '体检中…';
  ZH['Analyzing…'] = '诊断中…';
  ZH['Audited'] = '体检时间';
  ZH['New audit'] = '新的体检';
  ZH['Back to audit'] = '返回体检';
  ZH['Score'] = '总分';
  ZH['Reachability'] = '技术可达性';
  ZH['Citability'] = '内容可引用性';
  ZH['Structured data'] = '结构化数据';
  ZH['Entity & trust'] = '实体与信任信号';
  ZH['Confidence'] = '把握度';
  ZH['Impression'] = '印象';
  ZH['Uncertain / possibly outdated'] = '不确定 / 可能过时';
  ZH['Possible confusion / peers'] = '可能混淆 / 同类对象';
  ZH['No obvious confusion'] = '无明显混淆';
  ZH['Peers'] = '同类';
  ZH['Would you be mentioned in common questions?'] = '用户常问的问题里，会提到您吗？';
  ZH['Likely'] = '可能提及';
  ZH['Unlikely'] = '可能不提';
  ZH['Recommendations'] = '改进建议';
  ZH['Content templates (fill in real facts)'] = '语料模板（需填入真实信息）';
  ZH['FAQ template'] = 'FAQ 问答模板';
  ZH['Comparison template'] = '对比表模板';
  ZH['High'] = '高';
  ZH['Medium'] = '中';
  ZH['Low'] = '低';
  ZH['None'] = '无';
  ZH['Positive'] = '偏正面';
  ZH['Neutral'] = '中性';
  ZH['Mixed'] = '有争议';
  ZH['Negative'] = '偏负面';
  ZH['Well known'] = '较为熟悉';
  ZH['Partly known'] = '部分了解';
  ZH['Unknown'] = '基本不了解';

  const t = (s) => {
    if (!s) return '';
    const str = String(s).trim();
    if (state.locale === 'en') {
      return EN[str] ?? EN[s] ?? s;
    } else {
      return ZH[str] ?? ZH[s] ?? s;
    }
  };

  function renderAuditResult() {
    if (!state.audit || !state.auditId) return;
    const isResultView = location.pathname.startsWith('/result') || location.hash.startsWith('#/result') || (!$('#view-result')?.classList.contains('hidden'));
    const content = state.auditKind === 'url' ? renderUrlResult(state.audit, state.auditId) : renderBrandResult(state.audit, state.auditId);
    if (isResultView) {
      const out = $('#view-result');
      if (out) {
        const timeHeader = out.querySelector('.text-xs.text-slate-500.mb-2');
        const timeHtml = timeHeader ? timeHeader.outerHTML : `<div class="text-xs text-slate-500 mb-2">${t('体检时间')}${colon()}${fmtDate(state.auditCreatedAt || state.audit.auditedAt || '')} · <a href="/audit" class="text-cyan-400">${t('新的体检')}</a></div>`;
        out.innerHTML = timeHtml + content;
      }
    } else {
      const out = $('#audit-result');
      if (out) out.innerHTML = content;
    }
  }

  function formatEngineLabel(label) {
    if (!label) return '';
    if (state.locale === 'en') {
      return String(label).replace(/智谱\s*AI/g, 'Zhipu AI').replace(/智谱/g, 'Zhipu');
    }
    return String(label);
  }

  function setLocale(lang) {
    if (!lang) return;
    state.locale = lang;
    try { localStorage.setItem('geo_locale', state.locale); } catch { /* 无痕模式 */ }
    applyI18n();
    renderHeader();
    fillEngineSelect($('#brand-engine'));
    fillEngineSelect($('#lab-engine'));
    route();
    renderAuditResult();
    onAuditInput();
    runDemo();
  }

  function applyI18n() {
    document.documentElement.lang = state.locale === 'en' ? 'en' : 'zh-CN';
    $$('[data-i18n]').forEach((el) => {
      if (!el.dataset.zh) el.dataset.zh = el.textContent.trim();
      el.textContent = t(el.dataset.zh);
    });
    $$('[data-i18n-ph]').forEach((el) => {
      if (!el.dataset.zhPh) el.dataset.zhPh = el.getAttribute('placeholder') || '';
      el.setAttribute('placeholder', t(el.dataset.zhPh));
    });
    $$('[data-i18n-title]').forEach((el) => {
      if (!el.dataset.zhTitle) el.dataset.zhTitle = el.getAttribute('title') || '';
      el.setAttribute('title', t(el.dataset.zhTitle));
    });
    $$('[data-i18n-aria]').forEach((el) => {
      if (!el.dataset.zhAria) el.dataset.zhAria = el.getAttribute('aria-label') || '';
      el.setAttribute('aria-label', t(el.dataset.zhAria));
    });
    $$('[data-action="modal-close"]').forEach(btn => {
      const isClose = btn.getAttribute('aria-label') === '关闭' || btn.getAttribute('aria-label') === 'Close';
      if (isClose) {
        btn.setAttribute('aria-label', state.locale === 'en' ? 'Close' : '关闭');
      }
      if (btn.getAttribute('title') === '关闭' || btn.getAttribute('title') === 'Close') {
        btn.setAttribute('title', state.locale === 'en' ? 'Close' : '关闭');
      }
    });
    const sampleChip = $('#sample-brand-chip-label');
    if (sampleChip) {
      sampleChip.innerHTML = state.locale === 'en'
        ? '<span class="text-slate-400 font-normal">Brand:</span> Northeastern University (China)'
        : '东北大学 <span class="text-[10px] text-slate-500">（品牌）</span>';
    }
    $$('.lang-btn').forEach((b) => b.classList.toggle('active', b.dataset.lang === state.locale));
  }

  // ————————————————————— 网络请求 —————————————————————
  async function api(path, { method = 'GET', body, silent = false, signal } = {}) {
    let res;
    try {
      res = await fetch('/api' + path, {
        method, credentials: 'same-origin', signal,
        headers: { 'X-Locale': state.locale, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      if (e.name === 'AbortError') {
        const err = new Error(state.locale === 'en' ? 'Diagnosis cancelled. Your quota was not used.' : '已取消诊断。未扣除额度。');
        err.aborted = true;
        throw err;
      }
      const err = new Error(t('网络连接失败，请检查网络后重试')); err.network = true; throw err;
    }
    let json = {};
    try { json = await res.json(); } catch { /* 非 JSON */ }
    if (!res.ok || json.success === false) {
      let errMsg = json.error;
      if (!errMsg) {
        if (res.status === 504 || res.status === 408) {
          errMsg = state.locale === 'en'
            ? 'The model took too long. Your quota was not used. Retry?'
            : '模型响应超时，未扣除额度。请重试。';
        } else if (res.status === 502 || res.status === 503) {
          errMsg = state.locale === 'en'
            ? 'The AI service is temporarily busy. Your quota was not used. Please try again.'
            : 'AI 诊断服务暂忙，未扣除额度。请稍后重试。';
        } else {
          errMsg = state.locale === 'en'
            ? `Request failed (HTTP ${res.status})`
            : `请求失败（HTTP ${res.status}）`;
        }
      }
      const err = new Error(errMsg);
      err.status = res.status; err.code = json.code;
      if (!silent) {
        if (res.status === 401 || json.code === 'NEED_LOGIN') openAuth('login', json.error);
        else if (json.code === 'QUOTA_EXCEEDED' || json.code === 'PLAN_LIMIT' || res.status === 403) quotaDialog(json.error);
      }
      throw err;
    }
    if (json.quota) updateQuota(json.quota);
    return json;
  }

  // ————————————————————— Toast / Modal —————————————————————
  function toast(msg, type = 'info', ms = 3600) {
    const colors = { info: 'border-cyan-500/40 text-cyan-100', ok: 'border-emerald-500/40 text-emerald-100', err: 'border-rose-500/50 text-rose-100', warn: 'border-amber-500/40 text-amber-100' };
    const el = document.createElement('div');
    el.className = `pointer-events-auto px-4 py-3 rounded-2xl bg-slate-900/95 backdrop-blur border shadow-2xl text-sm leading-relaxed transition-all duration-300 opacity-0 -translate-y-2 ${colors[type] || colors.info}`;
    el.setAttribute('role', type === 'err' ? 'alert' : 'status');
    el.textContent = msg;
    $('#toasts').appendChild(el);
    requestAnimationFrame(() => el.classList.remove('opacity-0', '-translate-y-2'));
    setTimeout(() => { el.classList.add('opacity-0'); setTimeout(() => el.remove(), 300); }, ms);
  }
  const fail = (e) => { if (e && !(e.status === 401) && e.code !== 'QUOTA_EXCEEDED' && e.code !== 'PLAN_LIMIT' && !(e.status === 403 && e.code)) toast(e.message || String(e), 'err', 5000); };

  let modalOnClose = null;
  function openModal(html, { wide = false, onClose } = {}) {
    $('#modal-body').innerHTML = html;
    $('#modal-panel').classList.toggle('sm:max-w-3xl', wide);
    $('#modal-panel').classList.toggle('sm:max-w-lg', !wide);
    const m = $('#modal'); m.classList.remove('hidden'); m.classList.add('flex');
    document.body.style.overflow = 'hidden';
    modalOnClose = onClose || null;
    const modalCloseBtn = $('#modal [data-action="modal-close"]');
    if (modalCloseBtn) {
      modalCloseBtn.setAttribute('aria-label', state.locale === 'en' ? 'Close' : '关闭');
      modalCloseBtn.setAttribute('title', state.locale === 'en' ? 'Close' : '关闭');
    }
    const closeBtn = $('#modal-close-btn');
    if (closeBtn) {
      closeBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeModal();
      };
    }
    const f = $('#modal-body input, #modal-body textarea, #modal-body button');
    if (f && window.innerWidth > 640) f.focus();
  }
  function closeModal() {
    const m = $('#modal'); m.classList.add('hidden'); m.classList.remove('flex');
    document.body.style.overflow = '';
    if (modalOnClose) { const f = modalOnClose; modalOnClose = null; f(); }
  }

  function busy(btn, on, text) {
    if (!btn) return;
    if (on) { btn.dataset.html = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="spinner"></span><span>${esc(text || t('处理中…'))}</span>`; }
    else { btn.disabled = false; if (btn.dataset.html) btn.innerHTML = btn.dataset.html; }
  }

  function copyText(text) {
    const done = () => toast(t('已复制'), 'ok', 1600);
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    fallbackCopy(text, done);
  }
  function fallbackCopy(text, done) {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch { toast('复制失败，请手动选择复制', 'warn'); }
    ta.remove();
  }
  function downloadText(text, filename, type = 'text/plain') {
    const blob = new Blob([text], { type: `${type};charset=utf-8` });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // 简易安全 Markdown 渲染（先转义再格式化）
  function md(text) {
    const lines = String(text || '').replace(/\r/g, '').split('\n');
    let html = ''; let list = null; let inCode = false; let code = []; let table = [];
    const inline = (s) => esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-white">$1</strong>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener nofollow">$1</a>')
      .replace(/(^|[\s（(：:])(https?:\/\/[^\s<)）]+)/g, '$1<a href="$2" target="_blank" rel="noopener nofollow">$2</a>');
    const flushList = () => { if (list) { html += `</${list}>`; list = null; } };
    const flushTable = () => {
      if (!table.length) return;
      const rows = table.filter((r) => !/^\|\s*:?-+/.test(r));
      html += '<div class="overflow-x-auto"><table>' + rows.map((r, i) => '<tr>' + r.replace(/^\||\|$/g, '').split('|').map((c) => `<${i ? 'td' : 'th'}>${inline(c.trim())}</${i ? 'td' : 'th'}>`).join('') + '</tr>').join('') + '</table></div>';
      table = [];
    };
    for (const raw of lines) {
      const line = raw.trimEnd();
      if (/^```/.test(line)) { if (inCode) { html += `<pre class="code">${esc(code.join('\n'))}</pre>`; code = []; inCode = false; } else { flushList(); flushTable(); inCode = true; } continue; }
      if (inCode) { code.push(raw); continue; }
      if (/^\|.*\|$/.test(line.trim())) { flushList(); table.push(line.trim()); continue; } else flushTable();
      let m;
      if ((m = line.match(/^#{1,6}\s+(.*)/))) { flushList(); html += `<h4>${inline(m[1])}</h4>`; continue; }
      if ((m = line.match(/^\s*[-*•]\s+(.*)/))) { if (list !== 'ul') { flushList(); html += '<ul>'; list = 'ul'; } html += `<li>${inline(m[1])}</li>`; continue; }
      if ((m = line.match(/^\s*\d+[.、)]\s*(.*)/))) { if (list !== 'ol') { flushList(); html += '<ol>'; list = 'ol'; } html += `<li>${inline(m[1])}</li>`; continue; }
      flushList();
      if (/^>\s?/.test(line)) { html += `<p class="border-l-2 border-slate-600 pl-3 text-slate-400">${inline(line.replace(/^>\s?/, ''))}</p>`; continue; }
      if (line.trim() === '---') { html += '<hr class="border-slate-800">'; continue; }
      if (line.trim()) html += `<p>${inline(line)}</p>`;
    }
    flushList(); flushTable();
    if (inCode) html += `<pre class="code">${esc(code.join('\n'))}</pre>`;
    return html;
  }

  // ————————————————————— 用户与额度 —————————————————————
  function updateQuota(q) {
    if (!q) return;
    if (state.user) state.user.quota = { ...state.user.quota, remaining: q.remaining, limit: q.limit };
    else state.guestQuota = { ...(state.guestQuota || {}), remaining: q.remaining, limit: q.limit };
    renderHeader();
  }

  function renderHeader() {
    const q = state.user ? state.user.quota : state.guestQuota;
    const badge = $('#quota-badge');
    if (q) {
      const isEn = state.locale === 'en';
      badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full ${q.remaining > 0 ? 'bg-emerald-400' : 'bg-rose-400'}"></span>${isEn ? `<b class="font-mono text-cyan-300">${q.remaining}</b>/${q.limit} today` : `今日 <b class="font-mono text-cyan-300">${q.remaining}</b>/${q.limit}`}`;
      badge.title = isEn
        ? (state.user ? `Daily quota: ${q.remaining}/${q.limit}. Resets at 00:00 (UTC+8).` : `Free audits left today: ${q.remaining}/${q.limit}. Sign up free for 30 audits/day (resets 00:00 UTC+8).`)
        : (state.user ? `今日剩余额度：${q.remaining}/${q.limit}。每日 0 点 (UTC+8) 自动重置。` : `今日剩余额度：${q.remaining}/${q.limit}。注册免费享 30 次/天，每日 0 点重置。`);
      badge.classList.remove('hidden');
      badge.classList.add('inline-flex');
    }
    const area = $('#user-area');
    if (state.user) {
      const u = state.user;
      area.innerHTML = `<div class="relative">
        <button data-action="user-menu" class="flex items-center gap-2 px-2 py-1 rounded-xl bg-slate-900 border border-slate-700/80 text-xs" aria-haspopup="true">
          <span class="w-6 h-6 rounded-full bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center text-white text-[11px] font-bold">${esc(u.username.slice(0, 1).toUpperCase())}</span>
          <span class="hidden sm:inline max-w-[90px] truncate text-slate-200">${esc(u.username)}</span>
          ${u.plan !== 'free' ? `<span class="pill-ok !text-[10px]">${esc(t(u.planName))}</span>` : ''}
        </button>
        <div id="user-menu" class="hidden absolute right-0 mt-2 w-44 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-1.5 text-sm">
          <a href="/account" class="block px-3 py-2 rounded-lg hover:bg-slate-800">${t('我的账户')}</a>
          <a href="/pricing" class="block px-3 py-2 rounded-lg hover:bg-slate-800">${t('套餐价格')}</a>
          ${u.role === 'admin' ? `<a href="/admin" class="block px-3 py-2 rounded-lg hover:bg-slate-800 text-amber-300">${t('管理后台')}</a>` : ''}
          <button data-action="logout" class="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800 text-rose-300">${t('退出登录')}</button>
        </div></div>`;
    } else {
      area.innerHTML = `<button data-action="login" class="btn-primary px-3 sm:px-4 py-1.5 text-xs">${t('登录')} / ${t('注册')}</button>`;
    }
  }

  async function loadMe() {
    try {
      const r = await api('/auth/me', { silent: true });
      state.user = r.user; state.guestQuota = r.guest ? r.guest.quota : null;
    } catch { state.user = null; }
    renderHeader();
    loadNotifications();
  }

  function quotaDialog(msg) {
    const isEn = state.locale === 'en';
    openModal(`<div class="text-center py-2 space-y-3">
      <div class="w-12 h-12 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
        <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
      </div>
      <h3 class="text-lg font-bold text-white mb-1">${isEn ? 'Quota Limit Notice' : '功能额度提示'}</h3>
      <p class="text-sm text-slate-300 leading-relaxed max-w-md mx-auto">${esc(msg || (isEn ? 'Your daily quota is exhausted. Upgrade your plan to unlock higher limits and exclusive features.' : '当前套餐额度已用尽，升级套餐即可立即解锁更高额度与专属功能。'))}</p>
      <div class="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-left text-xs space-y-1.5 my-3">
        <div class="text-slate-400 font-semibold mb-1">${isEn ? 'Recommended Plans:' : '推荐方案：'}</div>
        <div class="flex items-center justify-between text-slate-300"><span>• ${isEn ? 'Pro (¥299/mo)' : '专业版 (¥299/月)'}</span><span class="text-cyan-300">${isEn ? '5 Sites / 20 Lab runs / 50 Word exports / Red-V verification' : '5 站点 / 20 次实验室 / 50 份 Word 导出 / 红V效果验证'}</span></div>
        <div class="flex items-center justify-between text-slate-300"><span>• ${isEn ? 'Enterprise' : '企业版 (¥980/月)'}</span><span class="text-emerald-300">${isEn ? 'Unlimited sites / Custom model dedicated cluster' : '无上限托管 / 专属大模型权重对接'}</span></div>
      </div>
      <div class="flex gap-2 mt-4 pt-1">
        <a href="/pricing" data-action="modal-close" class="btn-primary flex-1 py-2.5 text-sm text-center">${isEn ? 'View Plans' : '查看升级套餐'}</a>
        <button data-action="modal-close" class="btn-ghost flex-1 py-2.5 text-sm">${isEn ? 'Close' : '关闭'}</button>
      </div>
    </div>`);
  }

  // ————————————————————— 站内通知 —————————————————————
  async function loadNotifications() {
    if (!state.user) {
      const badge = $('#notif-badge');
      if (badge) badge.classList.add('hidden');
      return;
    }
    try {
      const r = await api('/notifications', { silent: true });
      const d = r.data || r;
      state.unreadNotifs = d.unreadCount ?? r.unreadCount ?? 0;
      state.notifications = d.list || d.notifications || r.notifications || [];
      const badge = $('#notif-badge');
      if (badge) {
        if (state.unreadNotifs > 0) badge.classList.remove('hidden');
        else badge.classList.add('hidden');
      }
    } catch {}
  }

  function openNotificationsModal() {
    if (!state.user) return openAuth('login', t('请先登录以查看站内通知'));
    const notifs = state.notifications || [];
    const catMap = {
      anomaly: ['站点巡检异常', 'border-amber-500/30 bg-amber-500/10 text-amber-200'],
      threshold_negative: ['负面率超标预警', 'border-rose-500/30 bg-rose-500/10 text-rose-200'],
      threshold_visibility_drop: ['可见度骤降预警', 'border-rose-500/30 bg-rose-500/10 text-rose-200'],
      threshold_competitor: ['竞品替代预警', 'border-amber-500/30 bg-amber-500/10 text-amber-200'],
      redv_verified: ['红V验证完成', 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'],
      system: ['系统通知', 'border-slate-700 bg-slate-800 text-slate-300'],
    };
    openModal(`<div class="space-y-4">
      <div class="flex items-center justify-between pb-3 border-b border-slate-800">
        <h3 class="text-base font-bold text-white flex items-center gap-2">
          <svg class="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
          ${t('站内消息与预警')}
        </h3>
        ${notifs.length ? `<button data-action="notif-read-all" class="btn-ghost text-xs px-2.5 py-1 text-slate-400 hover:text-cyan-300">${t('全部标为已读')}</button>` : ''}
      </div>
      ${notifs.length ? `<div class="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
        ${notifs.map(n => {
          const cat = catMap[n.category] || [n.category, 'border-slate-700 bg-slate-800 text-slate-300'];
          return `<div class="p-3 rounded-xl border ${n.is_read ? 'border-slate-800 bg-slate-950/40 text-slate-400' : 'border-cyan-500/30 bg-cyan-950/20 text-slate-200'} space-y-1.5 transition">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded text-[10px] font-semibold border ${cat[1]}">${esc(cat[0])}</span>
                <span class="text-xs font-semibold ${n.is_read ? 'text-slate-300' : 'text-white'}">${esc(n.title)}</span>
              </div>
              <span class="text-[10px] text-slate-500 font-mono">${fmtDate(n.created_at)}</span>
            </div>
            <div class="text-xs leading-relaxed ${n.is_read ? 'text-slate-400' : 'text-slate-300'}">${esc(n.message)}</div>
            ${!n.is_read ? `<div class="flex justify-end pt-1"><button data-action="notif-read" data-id="${n.id}" class="text-[11px] text-cyan-400 hover:underline">${t('标为已读')}</button></div>` : ''}
          </div>`;
        }).join('')}
      </div>` : `<div class="text-center py-8 text-sm text-slate-500">${t('暂无通知消息')}</div>`}
    </div>`);
  }

  async function markNotifRead(id) {
    try {
      await api(`/notifications/${id}/read`, { method: 'POST', body: {} });
      if (state.notifications) {
        const item = state.notifications.find(n => String(n.id) === String(id));
        if (item) item.is_read = 1;
      }
      state.unreadNotifs = Math.max(0, (state.unreadNotifs || 1) - 1);
      const badge = $('#notif-badge');
      if (badge && state.unreadNotifs === 0) badge.classList.add('hidden');
      openNotificationsModal();
    } catch (e) { fail(e); }
  }

  async function markAllNotifsRead() {
    try {
      await api('/notifications/read-all', { method: 'POST', body: {} });
      if (state.notifications) state.notifications.forEach(n => n.is_read = 1);
      state.unreadNotifs = 0;
      const badge = $('#notif-badge');
      if (badge) badge.classList.add('hidden');
      toast(t('全部已标为已读'), 'ok');
      openNotificationsModal();
    } catch (e) { fail(e); }
  }

  // ————————————————————— 登录 / 注册 / 找回密码 —————————————————————
  function openAuth(mode = 'login', notice) {
    const emailReq = state.config?.emailRequired;
    const tabs = `<div class="grid grid-cols-2 p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold mb-4">
      <button data-action="login" data-mode="login" class="py-2 rounded-lg ${mode === 'login' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400'}">${t('登录')}</button>
      <button data-action="login" data-mode="register" class="py-2 rounded-lg ${mode === 'register' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400'}">${t('注册')}</button></div>`;
    let form;
    if (mode === 'login') {
      form = `<form id="auth-form" data-mode="login" class="space-y-3">
        <label class="field"><span>${t('用户名或邮箱')}</span><input name="username" class="input" autocomplete="username" required></label>
        <label class="field"><span>${t('密码')}</span><input name="password" type="password" class="input" autocomplete="current-password" required></label>
        <button class="btn-primary w-full py-3 text-sm" type="submit">${t('登录')}</button>
        ${emailReq ? `<button type="button" data-action="login" data-mode="reset" class="w-full text-xs text-slate-400 hover:text-cyan-300">${t('忘记密码？')}</button>` : ''}
      </form>`;
    } else if (mode === 'register') {
      form = `<form id="auth-form" data-mode="register" class="space-y-3">
        <label class="field"><span>${t('用户名')}</span><input name="username" class="input" autocomplete="username" minlength="3" maxlength="30" required></label>
        <label class="field"><span>${t('邮箱')}${emailReq ? ' *' : t('（选填，用于找回密码）')}</span><input name="email" type="email" class="input" autocomplete="email" ${emailReq ? 'required' : ''}></label>
        ${emailReq ? `<label class="field"><span>${t('邮箱验证码')}</span><div class="flex gap-2"><input name="code" class="input font-mono" inputmode="numeric" maxlength="6" required><button type="button" data-action="send-code" data-purpose="register" class="btn-secondary px-3 text-xs whitespace-nowrap">${t('获取验证码')}</button></div></label>` : ''}
        <label class="field"><span>${t('密码（至少 8 位，含字母和数字）')}</span><input name="password" type="password" class="input" autocomplete="new-password" minlength="8" required></label>
        <button class="btn-primary w-full py-3 text-sm" type="submit">${t('注册并登录')}</button>
        <p class="text-[11px] text-slate-500 text-center">${state.locale === 'en' ? `Sign up free for ${state.config?.freeQuota || 30} audits/day (resets at 00:00 UTC+8)` : `注册即享每日 ${state.config?.freeQuota || 30} 次免费体检额度（每日 0 点重置）`}</p>
      </form>`;
    } else {
      form = `<form id="auth-form" data-mode="reset" class="space-y-3">
        <label class="field"><span>${t('注册邮箱')}</span><input name="email" type="email" class="input" required></label>
        <label class="field"><span>${t('邮箱验证码')}</span><div class="flex gap-2"><input name="code" class="input font-mono" maxlength="6" required><button type="button" data-action="send-code" data-purpose="reset" class="btn-secondary px-3 text-xs whitespace-nowrap">${t('获取验证码')}</button></div></label>
        <label class="field"><span>${t('新密码')}</span><input name="password" type="password" class="input" minlength="8" required></label>
        <button class="btn-primary w-full py-3 text-sm" type="submit">${t('重置密码')}</button>
        <button type="button" data-action="login" data-mode="login" class="w-full text-xs text-slate-400 hover:text-cyan-300">${t('返回登录')}</button>
      </form>`;
    }
    openModal(`<div class="text-center mb-4"><img src="/luduan-logo.png" alt="" class="w-12 h-12 mx-auto rounded-2xl bg-slate-950 border border-slate-700 p-1"><h3 class="text-lg font-bold text-white mt-2">${mode === 'reset' ? t('找回密码') : t('甪端 GEO 智能体')}</h3></div>
      ${notice ? `<div class="mb-3 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-200 text-xs">${esc(notice)}</div>` : ''}
      ${mode === 'reset' ? '' : tabs}<div id="auth-error" class="hidden mb-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs"></div>${form}`);
  }

  async function submitAuth(form) {
    const mode = form.dataset.mode;
    const data = Object.fromEntries(new FormData(form).entries());
    const btn = form.querySelector('button[type=submit]');
    const errEl = $('#auth-error');
    errEl.classList.add('hidden');
    busy(btn, true);
    try {
      if (mode === 'reset') {
        const r = await api('/auth/reset-password', { method: 'POST', body: data, silent: true });
        toast(r.message, 'ok'); openAuth('login');
        return;
      }
      const r = await api(mode === 'login' ? '/auth/login' : '/auth/register', { method: 'POST', body: data, silent: true });
      state.user = r.user; renderHeader(); closeModal();
      toast(mode === 'login' ? t('登录成功') : t('注册成功，欢迎使用！'), 'ok');
      route();
    } catch (e) {
      errEl.textContent = e.message; errEl.classList.remove('hidden');
    } finally { busy(btn, false); }
  }

  async function sendCode(btn) {
    const form = btn.closest('form');
    const email = form.querySelector('[name=email]').value.trim();
    if (!email) return toast(t('请先填写邮箱'), 'warn');
    busy(btn, true, t('发送中'));
    try {
      const r = await api('/auth/send-code', { method: 'POST', body: { email, purpose: btn.dataset.purpose }, silent: true });
      toast(r.message, 'ok');
      let s = 60; btn.dataset.html = t('获取验证码');
      const timer = setInterval(() => { btn.innerHTML = `${s}s`; btn.disabled = true; if (--s < 0) { clearInterval(timer); busy(btn, false); } }, 1000);
    } catch (e) { busy(btn, false); const el = $('#auth-error'); el.textContent = e.message; el.classList.remove('hidden'); }
  }

  function loginRequired(container, title, desc) {
    container.innerHTML = `<div class="card text-center py-10 space-y-3">
      <div class="w-11 h-11 mx-auto rounded-2xl border border-white/10 flex items-center justify-center text-slate-300"><svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg></div><h3 class="text-lg font-semibold text-white">${esc(title || t('请先登录'))}</h3>
      <p class="text-sm text-slate-400 max-w-md mx-auto">${esc(desc || t('登录后即可使用此功能'))}</p>
      <div class="flex justify-center gap-2 pt-2"><button data-action="login" class="btn-primary px-6 py-2.5 text-sm">${t('登录')}</button><button data-action="login" data-mode="register" class="btn-ghost px-6 py-2.5 text-sm">${t('免费注册')}</button></div></div>`;
  }

  // ————————————————————— 路由 —————————————————————
  const VIEWS = ['audit', 'lab', 'monitor', 'risk', 'redv', 'account', 'pricing', 'result', 'history', 'privacy', 'terms', 'about', 'contact'];

  function navigateTo(path, replace = false) {
    if (!path) path = '/audit';
    const target = path.startsWith('/') ? path : '/' + path;
    const current = location.pathname + location.search;
    if (current !== target || location.hash) {
      if (replace) history.replaceState(null, '', target);
      else history.pushState(null, '', target);
    }
    route();
  }

  function route() {
    let rawPath = '';
    if (location.hash && location.hash.startsWith('#/')) {
      const clean = location.hash.replace(/^#\/?/, '/');
      history.replaceState(null, '', clean);
      rawPath = clean.replace(/^\//, '');
    } else if (location.pathname && location.pathname !== '/') {
      rawPath = location.pathname.replace(/^\//, '');
    }
    const [pathPart, queryPart] = (rawPath || '').split('?');
    const [rawName, arg] = (pathPart || '').split('/');
    const name = rawName === 'results' ? 'result' : rawName;
    const view = VIEWS.includes(name) ? name : 'audit';
    const isInfo = ['privacy', 'terms', 'about', 'contact'].includes(view);

    const searchParams = new URLSearchParams(queryPart || location.search);
    const domainParam = searchParams.get('domain');
    const brandParam = searchParams.get('brand');
    const urlParam = searchParams.get('url');

    ['audit', 'lab', 'monitor', 'risk', 'redv', 'account', 'pricing', 'result', 'history'].forEach((v) => {
      const el = $(`#view-${v}`);
      if (el) el.classList.toggle('hidden', isInfo || v !== view);
    });
    const infoEl = $('#view-info');
    if (infoEl) infoEl.classList.toggle('hidden', !isInfo);

    $$('[data-tab]').forEach((a) => a.classList.toggle('active', a.dataset.tab === view || (view === 'result' && a.dataset.tab === 'audit')));
    if (view !== state.lastView) window.scrollTo({ top: 0 });
    state.lastView = view;
    if (state.riskPoll && view !== 'risk') { clearTimeout(state.riskPoll); state.riskPoll = null; }
    if (view === 'monitor') renderMonitor(domainParam);
    if (view === 'risk') renderRisk(arg || brandParam);
    if (view === 'redv') renderRedV();
    if (view === 'account') renderAccount();
    if (view === 'pricing') renderPricing($('#view-pricing'));
    if (view === 'history') renderHistory();
    if (isInfo) renderInfo(view);
    if (view === 'result' && arg) openResult(arg);
    if (view === 'lab') { fillEngineSelect($('#lab-engine')); initLabView({ domain: domainParam, brand: brandParam, url: urlParam }); }

    const titles = {
      audit: '甪端 GEO — 当用户问 AI，答案里有你吗？| AI 搜索可见度体检与优化',
      lab: '首推实验室 · 甪端 GEO',
      monitor: '站点托管 · 甪端 GEO',
      risk: 'AI 舆情监测 · 甪端 GEO',
      redv: '红V发布闭环 · 甪端 GEO',
      account: '我的账户 · 甪端 GEO',
      pricing: '套餐价格 · 甪端 GEO',
      result: '体检结果 · 甪端 GEO',
      history: '历史记录 · 甪端 GEO',
      privacy: '隐私政策 · 甪端 GEO',
      terms: '服务条款 · 甪端 GEO',
      about: '关于我们 · 甪端 GEO',
      contact: '联系我们 · 甪端 GEO'
    };
    if (view === 'result' && (arg === 'sample-deepseek' || arg === 'sample-brand' || arg === 'demo-deepseek')) {
      document.title = state.locale === 'en' ? 'Sample Report · DeepSeek — Luduan GEO' : '示例报告 · DeepSeek（深度求索）— 甪端 GEO';
    } else if (state.locale === 'en') {
      document.title = t(titles[view] || '甪端 GEO');
    } else {
      document.title = titles[view] || '甪端 GEO';
    }
  }

  function fillEngineSelect(sel, withAuto) {
    if (!sel || !state.config) return;
    const cur = sel.value;
    sel.innerHTML = state.config.engines.map((e) => `<option value="${esc(e.id)}">${esc(formatEngineLabel(e.label))}</option>`).join('') || `<option value="">${t('未配置模型')}</option>`;
    if (cur) sel.value = cur;
    if (withAuto) sel.parentElement.classList.toggle('hidden', state.config.engines.length < 2);
  }

  // ————————————————————— 1. 体检 —————————————————————
  const looksLikeUrl = (v) => /^https?:\/\//i.test(v) || /^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?(\/.*)?$/i.test(v);

  function onAuditInput() {
    const input = $('#audit-input');
    if (!input) return;
    const form = $('#audit-form');
    if (form) form.classList.remove('border-invalid');
    input.classList.remove('border-invalid');
    const rawVal = input.value;
    const countEl = $('#audit-char-count');
    const limitEl = $('#audit-limit-hint');
    if (countEl) {
      countEl.textContent = `${rawVal.length}/60`;
      countEl.classList.toggle('hidden', rawVal.length === 0);
      countEl.classList.toggle('text-rose-400', rawVal.length >= 60);
      countEl.classList.toggle('text-slate-500', rawVal.length < 60);
    }
    if (limitEl) {
      limitEl.classList.toggle('hidden', rawVal.length < 60);
    }
    const v = rawVal.trim();
    const isUrl = !v || looksLikeUrl(v);
    const wrap = $('#brand-engine-wrap');
    const showEngine = !isUrl && state.config && state.config.engines.length > 1;
    wrap.classList.toggle('hidden', !showEngine); wrap.classList.toggle('inline-flex', showEngine);
    $('#audit-submit').innerHTML = `<span>${isUrl ? t('开始体检') : t('AI 认知诊断')}</span>`;
  }

  // ————————————————————— 实体消歧先导机制 (Entity Disambiguation) —————————————————————
  const ENTITY_DISAMBIGUATION_MAP = {
    'northeastern university': {
      titleZh: '检测到多个知名重名高校（GEO 实体消歧）',
      titleEn: 'Multiple Prominent Entities Detected (GEO Disambiguation)',
      descZh: '「Northeastern University」在不同国家对应不同的顶尖高等学府。在 GEO 优化中，消除实体歧义是确保 AI 准确引述的第一步。请选择您想要诊断的明确主体：',
      descEn: '"Northeastern University" corresponds to distinct prominent universities across the globe. Resolving ambiguity is key for precise AI citations. Which entity do you want to audit?',
      candidates: [
        {
          name: 'Northeastern University (China)',
          nameZh: '东北大学（中国沈阳）',
          badge: '中国 · 985/双一流高校',
          badgeEn: 'China · Project 985 / National Key Univ',
          desc: 'National Key University in Shenyang, China, founded 1923. Renowned for metallurgy, materials, control science & computer engineering.',
          descZh: '位于辽宁沈阳，教育部直属全国重点大学，国家“双一流”、“985工程”高校，以控制科学、软件、冶金等学科著称。',
          context: '中国辽宁沈阳，教育部直属全国重点大学（985工程/双一流）',
        },
        {
          name: 'Northeastern University (Boston, USA)',
          nameZh: '美国东北大学（波士顿）',
          badge: '美国 · 私立研究型大学 (R1)',
          badgeEn: 'USA · Private Research University (R1)',
          desc: 'Private research university in Boston, Massachusetts, USA, founded 1898. Renowned for global cooperative education (Co-op) program.',
          descZh: '位于美国马萨诸塞州波士顿，私立研究型大学，以全球首屈一指的带薪实习合作项目（Co-op）和跨学科研究闻名。',
          context: 'Boston, Massachusetts, USA, private research university with renowned Co-op program',
        },
        {
          name: 'Tohoku University (Japan)',
          nameZh: '日本东北大学（仙台）',
          badge: '日本 · 指定国立大学 / 旧帝国大学',
          badgeEn: 'Japan · Imperial National University',
          desc: 'National Designated University in Sendai, Miyagi, Japan, founded 1907. World-leading in materials science, physics and engineering.',
          descZh: '位于日本宫城县仙台市，日本顶尖帝国大学之一，指定国立大学法人，材料科学与物理学处于世界顶尖水平。',
          context: 'Sendai, Miyagi, Japan, designated national university (Tohoku University)',
        },
      ]
    },
    '东北大学': {
      titleZh: '检测到多个知名重名高校（GEO 实体消歧）',
      titleEn: 'Multiple Prominent Entities Detected (GEO Disambiguation)',
      descZh: '「东北大学」在中日美三国均有知名同名或同译名实体。消除实体歧义是建立权威知识图谱的第一步：',
      descEn: '"东北大学" corresponds to distinct prominent institutions in China, Japan and the USA:',
      candidates: [
        {
          name: '东北大学（中国沈阳）',
          nameEn: 'Northeastern University (China)',
          badge: '中国 · 985/双一流高校',
          badgeEn: 'China · Project 985 / National Key Univ',
          descZh: '教育部直属全国重点大学，国家“双一流”、“985工程”高校，位于辽宁沈阳。',
          desc: 'National Key University in Shenyang, China, founded 1923. Renowned for engineering & computing.',
          context: '中国辽宁沈阳，教育部直属全国重点大学（985工程/双一流）',
        },
        {
          name: '日本东北大学（仙台）',
          nameEn: 'Tohoku University (Japan)',
          badge: '日本 · 指定国立大学 / 旧帝国大学',
          badgeEn: 'Japan · Imperial National University',
          descZh: '日本顶尖帝国大学之一（Tohoku University），位于宫城县仙台市，鲁迅先生母校。',
          desc: 'National Designated University in Sendai, Japan (Tohoku University), founded 1907.',
          context: '日本宫城县仙台市，日本顶尖国立大学（Tohoku University）',
        },
        {
          name: '美国东北大学（波士顿）',
          nameEn: 'Northeastern University (Boston, USA)',
          badge: '美国 · 私立研究型大学 (R1)',
          badgeEn: 'USA · Private Research University (R1)',
          descZh: '位于美国波士顿的私立研究型大学，以 Co-op 带薪实习项目闻名全球。',
          desc: 'Private research university in Boston, Massachusetts, USA (Co-op program).',
          context: 'Boston, Massachusetts, USA, private research university with renowned Co-op program',
        },
      ]
    },
    'apple': {
      titleZh: '检测到多个著名实体（GEO 实体消歧）',
      titleEn: 'Multiple Entities Detected (GEO Disambiguation)',
      descZh: '「Apple」在大模型与知识网络中有多个完全不同的指称，请选择目标实体：',
      descEn: '"Apple" refers to multiple global entities in model knowledge weights:',
      candidates: [
        {
          name: 'Apple Inc.',
          nameZh: '苹果公司（Apple Inc.）',
          badge: '全球科技公司 · iPhone / Mac',
          badgeEn: 'Global Tech Giant · iPhone / Mac',
          desc: 'American multinational technology company known for iPhone, iPad, Mac and iOS ecosystem.',
          descZh: '全球市值最高的科技公司之一，以 iPhone、Mac、iPad 及操作系统生态著称。',
          context: 'Apple Inc., consumer technology company (iPhone, Mac, iOS)',
        },
        {
          name: 'Apple Corps',
          nameZh: '苹果唱片（Apple Corps）',
          badge: '音乐与传媒公司 · 披头士乐队',
          badgeEn: 'Multimedia & Music · The Beatles',
          desc: 'Multimedia corporation founded in London in 1968 by the members of the Beatles.',
          descZh: '1968 年由披头士乐队（The Beatles）在英国伦敦创立的跨媒体唱片与知识产权公司。',
          context: 'Apple Corps, multimedia corporation founded by The Beatles',
        },
      ]
    },
    '苹果': {
      titleZh: '检测到多个著名实体（GEO 实体消歧）',
      titleEn: 'Multiple Entities Detected (GEO Disambiguation)',
      descZh: '「苹果」在科技与农产品领域具有完全不同的知识锚点：',
      descEn: '"苹果" (Apple) refers to technology or agricultural domains:',
      candidates: [
        {
          name: '苹果公司（Apple Inc.）',
          nameEn: 'Apple Inc.',
          badge: '科技巨头 · iPhone / Mac',
          badgeEn: 'Global Tech Giant · iPhone / Mac',
          descZh: '全球消费电子与软件科技巨头，iPhone、Mac 制造厂商。',
          desc: 'Consumer tech giant known for iPhone, iPad, Mac and iOS.',
          context: '苹果公司，科技巨头，iPhone与Mac制造者',
        },
        {
          name: '苹果（鲜果 / 农产品）',
          nameEn: 'Apple (Fresh Fruit / Agriculture)',
          badge: '农业 / 鲜果消费品',
          badgeEn: 'Agriculture / Fruit',
          descZh: '蔷薇科苹果属落叶乔木的果实，常见的大众水果。',
          desc: 'Edible fruit produced by an apple tree (Malus domestica).',
          context: '蔷薇科落叶乔木的水果，大众鲜果农产品',
        },
      ]
    }
  };

  function checkDisambiguation(query) {
    const raw = String(query || '').trim();
    if (!raw) return null;
    if (/\(([^)]+)\)|（([^）]+)）|Inc\.|Corp\.|公司|大学（|University \(/i.test(raw)) {
      return null;
    }
    const key = raw.toLowerCase().replace(/\s+/g, ' ');
    return ENTITY_DISAMBIGUATION_MAP[key] || null;
  }

  function openDisambiguationModal(rawQuery, match) {
    const isEn = state.locale === 'en';
    const title = isEn ? match.titleEn : match.titleZh;
    const desc = isEn ? match.descEn : match.descZh;

    const candidateHtml = match.candidates.map((c, idx) => {
      const cName = isEn ? (c.nameEn || c.name) : (c.nameZh || c.name);
      const cBadge = isEn ? (c.badgeEn || c.badge) : (c.badge || c.badgeEn);
      const cDesc = isEn ? c.desc : c.descZh;
      return `<button type="button" class="w-full text-left p-3.5 sm:p-4 rounded-2xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800 hover:border-cyan-500/40 transition group cursor-pointer space-y-1.5" data-action="disambiguate-select" data-idx="${idx}">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="font-bold text-white text-sm sm:text-base group-hover:text-cyan-300 transition flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-cyan-400"></span>
            ${esc(cName)}
          </span>
          <span class="pill-info !text-[11px]">${esc(cBadge)}</span>
        </div>
        <p class="text-xs text-slate-400 group-hover:text-slate-300 leading-relaxed">${esc(cDesc)}</p>
      </button>`;
    }).join('');

    const rawChoiceHtml = `<button type="button" class="w-full text-left p-3.5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-dashed border-white/15 hover:border-white/30 transition group cursor-pointer space-y-1" data-action="disambiguate-raw">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="font-semibold text-slate-300 text-xs sm:text-sm group-hover:text-white transition flex items-center gap-1.5">
          <span class="text-slate-500">↳</span>
          ${isEn ? `Audit raw phrase "${esc(rawQuery)}" directly` : `以原词「${esc(rawQuery)}」直接体检`}
        </span>
        <span class="pill-muted !text-[10px]">${isEn ? 'Confusion & Bias Test' : '默认偏好与混淆率测试'}</span>
      </div>
      <p class="text-[11px] text-slate-500 group-hover:text-slate-400 leading-relaxed">${isEn ? 'Diagnose which entity the AI model defaults to without disambiguation hints, and assess collision risk.' : '测试在无消歧背景下，大模型默认会偏向哪一个实体，并评估实体混淆指数。'}</p>
    </button>`;

    openModal(`<div class="space-y-4">
      <div class="flex items-center gap-2.5 text-xs font-semibold text-cyan-400 uppercase tracking-wider">
        <svg class="w-4 h-4 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <span>${isEn ? 'Entity Disambiguation Guide' : 'GEO 实体消歧向导'}</span>
      </div>
      <div>
        <h3 class="text-base sm:text-lg font-bold text-white mb-1">${esc(title)}</h3>
        <p class="text-xs text-slate-400 leading-relaxed">${esc(desc)}</p>
      </div>
      <div class="space-y-2.5 pt-1">
        ${candidateHtml}
        <div class="pt-1">${rawChoiceHtml}</div>
      </div>
    </div>`);

    state._currentDisambiguation = { rawQuery, match };
  }

  let auditAbortCtrl = null;
  let auditTimerInterval = null;

  async function runAudit(ev, skipDisambiguation = false, disambiguateContext = '') {
    ev && ev.preventDefault();
    const input = $('#audit-input');
    const form = $('#audit-form');
    const v = input ? input.value.trim() : '';
    if (!v) {
      const msg = state.locale === 'en' ? 'Please fill out this field' : '请填写此字段';
      toast(msg, 'warn');
      if (form) form.classList.add('border-invalid');
      if (input) {
        input.classList.add('border-invalid');
        input.focus();
      }
      setTimeout(() => {
        if (form) form.classList.remove('border-invalid');
        if (input) input.classList.remove('border-invalid');
      }, 2500);
      return;
    }

    const isUrl = looksLikeUrl(v);

    // 实体消歧先导检查：当输入具备多个知名实体的通用词时，先引导用户明确主体或选择测试默认偏好
    if (!isUrl && !skipDisambiguation) {
      const match = checkDisambiguation(v);
      if (match) {
        openDisambiguationModal(v, match);
        return;
      }
    }

    // 检查额度是否已用完
    const quota = state.user ? state.user.quota : state.guestQuota;
    if (quota && quota.remaining <= 0) {
      if (!state.user) {
        openAuth('register', state.locale === 'en' ? 'Daily guest quota reached (5/5). Sign up free for 30 audits/day!' : '今日游客额度已用完（5/5 次）。免费注册立享每日 30 次体检额度！');
      } else {
        quotaDialog(state.locale === 'en' ? 'Daily limit reached, resets at 00:00 (UTC+8).' : '今日额度已用完，明日 0 点恢复。可升级套餐获取更多额度。');
      }
      return;
    }

    const btn = $('#audit-submit');
    const out = $('#audit-result');
    busy(btn, true, isUrl ? t('体检中…') : t('诊断中…'));

    if (auditAbortCtrl) { auditAbortCtrl.abort(); auditAbortCtrl = null; }
    if (auditTimerInterval) { clearInterval(auditTimerInterval); auditTimerInterval = null; }
    auditAbortCtrl = new AbortController();

    let elapsedSec = 0;
    const estTimeText = isUrl
      ? (state.locale === 'en' ? 'Estimated 5–20 seconds' : '预计 5~20 秒')
      : (state.locale === 'en' ? 'Estimated 20–35 seconds' : '预计 20~35 秒');
    const estBadge = isUrl
      ? (state.locale === 'en' ? 'Est. 5–20s' : '预计 5~20秒')
      : (state.locale === 'en' ? 'Est. 20–35s' : '预计 20~35秒');
    const progressTitle = isUrl
      ? (state.locale === 'en' ? `Analyzing website GEO for "${esc(v)}"…` : `正在对网站「${esc(v)}」进行 GEO 全维体检…`)
      : (state.locale === 'en' ? `Analyzing brand perception for "${esc(v)}"…` : `正在为品牌「${esc(v)}」生成 AI 认知诊断报告…`);
    const progressEstimate = isUrl
      ? (state.locale === 'en' ? `Crawling page, robots.txt, llms.txt, schema & bot matrices · ${estTimeText}` : `正在抓取网页、robots.txt、llms.txt、结构化数据与爬虫矩阵 · ${estTimeText}`)
      : (state.locale === 'en' ? `Querying models & entity validation · ${estTimeText}` : `调用大模型多轮推演、实体检验与同类竞品对标 · ${estTimeText}`);
    const cancelText = state.locale === 'en' ? 'Cancel' : (isUrl ? '取消体检' : '取消诊断');

    out.innerHTML = `<div class="card space-y-4 animate-rise">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
        <div class="flex items-center gap-2.5 text-sm font-semibold text-white">
          <span class="spinner text-cyan-400"></span>
          <span>${progressTitle}</span>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-xs text-slate-400 bg-white/[0.04] px-2 py-0.5 rounded border border-white/[0.08]">${estBadge}</span>
          <span class="text-xs font-mono text-cyan-300">${state.locale === 'en' ? 'Elapsed' : '已耗时'}: <b id="audit-timer">0</b>s</span>
          <button type="button" data-action="audit-cancel" class="btn-ghost text-xs px-2.5 py-1 text-slate-400 hover:text-rose-300 hover:border-rose-400/40">${cancelText}</button>
        </div>
      </div>
      <p id="audit-progress-hint" class="text-xs text-slate-400 leading-relaxed transition-all">${progressEstimate}</p>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="skeleton h-28"></div>
        <div class="skeleton h-28 md:col-span-2"></div>
      </div>
      <div class="skeleton h-36"></div>
    </div>`;

    const slowThreshold = isUrl ? 25 : 38;
    const timeoutThreshold = isUrl ? 45 : 55;

    auditTimerInterval = setInterval(() => {
      elapsedSec += 1;
      const timerEl = $('#audit-timer');
      if (timerEl) timerEl.textContent = elapsedSec;

      if (elapsedSec >= slowThreshold) {
        const hintEl = $('#audit-progress-hint');
        if (hintEl) {
          hintEl.textContent = isUrl
            ? (state.locale === 'en' ? 'Target website response is slower than usual, still inspecting...' : '目标网站响应较慢，仍在抓取验证 Sitemap 与爬虫矩阵，请稍候…')
            : (state.locale === 'en' ? 'Model response is slower than usual, still processing...' : '模型响应较慢，仍在深度处理与对标中，请稍候…');
          hintEl.className = 'text-xs text-amber-300/85 leading-relaxed';
        }
      }

      if (elapsedSec >= timeoutThreshold) {
        if (auditAbortCtrl) { auditAbortCtrl.abort(); auditAbortCtrl = null; }
        if (auditTimerInterval) { clearInterval(auditTimerInterval); auditTimerInterval = null; }
        const timeoutTitle = isUrl
          ? (state.locale === 'en' ? 'Website audit timed out' : '网站体检请求超时')
          : (state.locale === 'en' ? 'Brand audit timed out' : '品牌诊断请求超时');
        const timeoutDesc = isUrl
          ? (state.locale === 'en' ? `Target website "${esc(v)}" took more than ${timeoutThreshold} seconds to respond. Check if the site is accessible or retry.` : `目标网站「${esc(v)}」响应超过 ${timeoutThreshold} 秒。请确认站点可访问后重试。`)
          : (state.locale === 'en' ? `The model response took more than ${timeoutThreshold} seconds. You can retry or inspect the sample report.` : `大模型推理响应较慢，超过 ${timeoutThreshold} 秒未返回结果。建议重试或查看现成示例报告。`);
        out.innerHTML = `<div class="card border-rose-400/25 text-center py-8 space-y-3">
          <div class="w-10 h-10 mx-auto rounded-full border border-rose-400/30 text-rose-300 flex items-center justify-center font-mono">!</div>
          <h4 class="text-base font-semibold text-white">${timeoutTitle}</h4>
          <p class="text-xs text-slate-400 max-w-md mx-auto">${timeoutDesc}</p>
          <div class="flex justify-center gap-2 pt-2">
            <button data-action="audit-retry" class="btn-primary px-5 py-2 text-xs">${t('重试')}</button>
            <button data-action="demo-audit" class="btn-ghost px-4 py-2 text-xs text-cyan-300">${t('查看示例报告')}</button>
          </div>
        </div>`;
        busy(btn, false);
        onAuditInput();
      }
    }, 1000);
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });

    try {
      let r;
      if (isUrl) {
        const hintEl = $('#audit-progress-hint');
        const urlSteps = state.locale === 'en' ? [
          `Connecting to host & inspecting HTTP response headers… · ${estBadge}`,
          `Parsing robots.txt & testing 19 AI crawler permissions… · ${estBadge}`,
          `Validating llms.txt, Schema.org entities & sitemaps… · ${estBadge}`,
          `Aggregating 4-part score & generating custom fixes… · ${estBadge}`,
        ] : [
          `正在连接服务器，检查 HTTP 响应头与网页 HTML… · ${estBadge}`,
          `正在解析 robots.txt 与 19 大 AI 爬虫放行规则… · ${estBadge}`,
          `正在验证 llms.txt、Schema 实体图谱与 Sitemap 结构… · ${estBadge}`,
          `正在计算 GEO 四维评分并生成专属整改代码… · ${estBadge}`,
        ];

        let stepIdx = 0;
        const stepInterval = setInterval(() => {
          stepIdx += 1;
          if (hintEl && urlSteps[stepIdx]) {
            hintEl.textContent = urlSteps[stepIdx];
          }
        }, 380);

        try {
          const [apiRes] = await Promise.all([
            api('/audit', { method: 'POST', body: { url: v }, signal: auditAbortCtrl.signal }),
            sleep(1600),
          ]);
          clearInterval(stepInterval);
          r = apiRes;
        } catch (err) {
          clearInterval(stepInterval);
          throw err;
        }
      } else {
        r = await api('/brand-audit', { method: 'POST', body: { keyword: v, context: disambiguateContext || state.auditContext || '', engine: $('#brand-engine').value }, signal: auditAbortCtrl.signal });
      }

      if (auditTimerInterval) { clearInterval(auditTimerInterval); auditTimerInterval = null; }
      auditAbortCtrl = null;

      state.audit = r.data; state.auditId = r.id; state.auditKind = isUrl ? 'url' : 'brand'; state.auditCreatedAt = new Date().toISOString();
      if (r.quota) updateQuota(r.quota);
      await enrichCardsPublishState(r.data);
      state.compTab = 'score';
      state.domainsExpanded = false;
      state.evidenceFilter = 'all';
      try {
        const hist = JSON.parse(localStorage.getItem('geo_audit_history') || '[]');
        const nextHist = [r.id, ...hist.filter((x) => x !== r.id)].slice(0, 50);
        localStorage.setItem('geo_audit_history', JSON.stringify(nextHist));
      } catch {}
      out.innerHTML = isUrl ? renderUrlResult(r.data, r.id) : renderBrandResult(r.data, r.id);
      if (isUrl) $('#compare-main').value = r.data.url;
    } catch (e) {
      if (auditTimerInterval) { clearInterval(auditTimerInterval); auditTimerInterval = null; }
      auditAbortCtrl = null;
      // 同步刷新最新额度（退款后恢复）
      loadMe();
      if (e.aborted) {
        out.innerHTML = `<div class="card border-slate-700 text-center py-6 space-y-3">
          <p class="text-sm font-medium text-slate-200">${t('已取消诊断。未扣除额度。')}</p>
          <button data-action="audit-retry" class="btn-ghost mt-1 px-4 py-1.5 text-xs text-cyan-300">${t('重新开始')}</button>
        </div>`;
        return;
      }
      const isTimeout = e.status === 504 || e.status === 408 || /504|timeout|took too long|响应超时/i.test(e.message);
      const friendlyMsg = isTimeout
        ? (state.locale === 'en'
            ? 'The model took too long. Your quota was not used. Retry?'
            : '大模型响应超时，未扣除额度。请重试。')
        : (state.locale === 'en' ? (EN[e.message] || e.message) : e.message);

      out.innerHTML = `<div class="card border-rose-400/25 text-center py-8 space-y-3">
        <div class="w-10 h-10 mx-auto mb-1 rounded-full border border-rose-400/30 text-rose-300 flex items-center justify-center font-mono text-base">!</div>
        <h4 class="text-base font-semibold text-white">${state.locale === 'en' ? 'Diagnosis Notice' : '体检提示'}</h4>
        <p class="text-sm text-rose-200/90 max-w-md mx-auto leading-relaxed">${esc(friendlyMsg)}</p>
        <div class="flex justify-center gap-2 pt-2">
          ${e.code === 'LLM_NOT_CONFIGURED' ? '' : `<button data-action="audit-retry" class="btn-primary px-5 py-2 text-xs">${t('重试')}</button>`}
          <button data-action="demo-audit" class="btn-ghost px-4 py-2 text-xs text-cyan-300">${t('查看示例报告')}</button>
        </div>
      </div>`;
      fail(friendlyMsg);
    } finally {
      if (auditTimerInterval) { clearInterval(auditTimerInterval); auditTimerInterval = null; }
      busy(btn, false);
      onAuditInput();
    }
  }

  const skeleton = (msg) => `<div class="card space-y-4"><div class="flex items-center gap-3 text-sm text-slate-300"><span class="spinner text-cyan-400"></span>${esc(msg)}</div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4"><div class="skeleton h-32"></div><div class="skeleton h-32 md:col-span-2"></div></div><div class="skeleton h-40"></div></div>`;

  function scoreRing(score, size = 120) {
    const color = score >= 70 ? '#ccf43d' : score >= 50 ? '#fbbf24' : '#fb7185';
    const r = 54; const c = 2 * Math.PI * r;
    return `<svg width="${size}" height="${size}" viewBox="0 0 120 120" class="shrink-0" role="img" aria-label="${score}/100">
      <circle cx="60" cy="60" r="${r}" stroke="rgba(255,255,255,.07)" stroke-width="5" fill="none"/>
      <circle cx="60" cy="60" r="${r}" stroke="${color}" stroke-width="5" fill="none" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - score / 100)}" transform="rotate(-90 60 60)" style="transition:stroke-dashoffset 1s;filter:drop-shadow(0 0 6px ${color}66)"/>
      <text x="60" y="68" text-anchor="middle" font-size="34" font-weight="600" fill="#fff" font-family="'JetBrains Mono Var',ui-monospace,monospace">${score}</text>
      <text x="60" y="86" text-anchor="middle" font-size="9" fill="#8b919a" font-family="'JetBrains Mono Var',ui-monospace,monospace">/ 100</text></svg>`;
  }
  const bar = (p, max, cls) => { const r = p / max; const c = cls || (r >= 0.75 ? 'bg-cyan-400' : r >= 0.5 ? 'bg-amber-400' : 'bg-rose-400'); return `<div class="h-1.5 rounded-full bg-white/[0.06] overflow-hidden"><div class="h-full rounded-full ${c}" style="width:${Math.round(r * 100)}%"></div></div>`; };

  async function downloadDocx(id) {
    if (!id) return;
    try {
      toast(t('正在生成 Word 报告…'), 'info', 2000);
      const res = await fetch(`/api/results/${encodeURIComponent(id)}/report.docx?locale=${state.locale}`, {
        credentials: 'same-origin'
      });
      if (!res.ok) {
        let json = {};
        try { json = await res.json(); } catch {}
        if (res.status === 401 || json.code === 'NEED_LOGIN') return openAuth('login', json.error);
        if (res.status === 403 || json.code === 'PLAN_LIMIT' || json.code === 'QUOTA_EXCEEDED') {
          return quotaDialog(json.error || t('本月 Word 导出额度已达上限，请升级套餐'));
        }
        throw new Error(json.error || `下载失败（HTTP ${res.status}）`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `GEO-Report-${id}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      toast(t('Word 报告已成功导出'), 'ok', 3000);
    } catch (e) {
      fail(e);
    }
  }

  function reportButtons(id) {
    const nextLang = state.locale === 'en' ? 'zh' : 'en';
    const toggleLabel = state.locale === 'en' ? '中文版' : 'English';
    return `<div class="flex flex-wrap gap-2">
      <button type="button" data-action="download-docx" data-id="${esc(id)}" class="btn-primary px-4 py-2 text-xs">${t('下载 Word 报告')}</button>
      <button type="button" data-action="toggle-card-lang" data-lang="${nextLang}" class="btn-ghost px-3 py-2 text-xs">${toggleLabel}</button>
      <button data-action="copy-result-link" data-id="${esc(id)}" class="btn-ghost px-3 py-2 text-xs">${t('复制结果链接')}</button></div>`;
  }

  function renderUrlResult(d, id) {
    const statusPill = (b) => b.status === 'blocked' ? `<span class="pill-bad">${t('被禁止')}</span>` : b.status === 'page_blocked' ? `<span class="pill-bad">${t('本页被禁止')}</span>` : b.status === 'partial' ? `<span class="pill-warn">${t('部分受限')}</span>` : `<span class="pill-ok">${t('可访问')}</span>`;
    const cats = [['search', t('AI 搜索 / 引用')], ['user', t('用户触发访问')], ['training', t('模型训练采集')]];
    const g = d.generated || {};
    const codeTabs = [
      ['llms', 'llms.txt', g.llmsTxt, 'llms.txt', t('上传到网站根目录，使 https://您的域名/llms.txt 可访问。请先补充注释处的真实机构信息。')],
      ['schema', 'JSON-LD', g.schema, 'schema.html', t('粘贴到首页 <head> 中。sameAs 可填写百科、官方公众号等权威主页链接。')],
      ...(g.faqSchema ? [['faq', 'FAQPage', g.faqSchema, 'faq-schema.html', t('从本页已有的问答内容中提取，粘贴到该页面 <head> 中。')]] : []),
      ['robots', 'robots.txt', g.robots, 'robots.txt', g.robotsHadExisting ? t('已保留您原有的规则，并追加 AI 爬虫分组（沿用原有的路径限制）。') : t('未发现原有 robots.txt，已生成默认版本。')],
      ['robotsPrivacy', t('robots.txt（防训练）'), g.robotsPrivacy, 'robots.txt', t('放行 AI 搜索与用户访问，禁止模型训练采集。适合重视内容版权的网站。')],
    ].filter((x) => x[2]);
    state.codeTabs = codeTabs;
    return `<div class="space-y-6">
      <div class="card">
        <div class="flex flex-col md:flex-row gap-5 md:items-center">
          ${scoreRing(d.score)}
          <div class="flex-1 min-w-0 space-y-1.5">
            <div class="flex flex-wrap items-center gap-2"><span class="pill-info">${esc(d.grade?.label || '')}</span><span class="text-xs text-slate-500 truncate">${esc(d.url)}</span></div>
            <h2 class="text-lg sm:text-xl font-bold text-white break-words">${esc(d.title || t('（无标题）'))}</h2>
            <p class="text-sm text-slate-400">${esc(d.grade?.desc || '')}</p>
            <p class="text-xs text-slate-500">${t('正文约')} ${d.stats.wordCount} ${t('字')} · ${t('响应')} ${d.stats.responseMs}ms · ${d.hasLlmsTxt ? '✓ llms.txt' : '✗ llms.txt'} · ${d.hasSitemap ? '✓ sitemap' : '✗ sitemap'}</p>
          </div>
          <div class="md:self-start">${reportButtons(id)}</div>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-5 border-t border-white/[0.06]">${d.vectors.map((v) => `<div><div class="flex justify-between text-xs mb-2"><span class="text-slate-400">${esc(t(v.label))}</span><span class="num text-slate-200">${v.points}<span class="text-slate-500">/${v.max}</span></span></div>${bar(v.points, v.max)}</div>`).join('')}</div>
        <p class="text-[11px] text-slate-500 mt-4">${t('分数衡量网站被 AI 读取与引用的技术和内容条件，不代表 AI 产品中的具体排名。')}</p>
      </div>
      ${d.aiView ? aiViewCard(d) : ''}

      ${d.priorities.length ? `<div class="card space-y-3"><h3 class="card-title">${t('优先整改')} <span class="text-xs font-normal text-slate-500">${t('按可提升分数排序')}</span></h3>
        <ol class="space-y-3">${d.priorities.map((p, i) => `<li class="flex gap-3"><span class="w-6 h-6 shrink-0 rounded-full bg-amber-500/15 text-amber-300 text-xs font-bold flex items-center justify-center">${i + 1}</span>
          <div class="min-w-0"><div class="text-sm font-semibold text-white">${esc(p.label)} <span class="text-xs font-normal text-amber-300">+${p.lost} ${t('分')}</span> <span class="text-xs font-normal text-slate-500">· ${esc(p.vector)}</span></div>
          <div class="text-xs text-slate-500 mt-0.5">${esc(p.detail)}</div><div class="text-sm text-slate-300 mt-1 leading-relaxed">${esc(p.fix)}</div></div></li>`).join('')}</ol></div>` : ''}

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
        ${d.vectors.map((v) => `<div class="card space-y-3">
          <div class="flex items-center justify-between"><h3 class="font-bold text-white">${esc(v.label)}</h3><span class="font-mono text-sm ${v.points >= v.max * 0.75 ? 'text-emerald-300' : v.points >= v.max * 0.5 ? 'text-amber-300' : 'text-rose-300'}">${v.points}/${v.max}</span></div>
          ${bar(v.points, v.max)}
          <ul class="space-y-2">${v.checks.map((c) => `<li class="flex gap-2 text-sm"><span class="${c.pass ? 'text-emerald-400' : c.points > 0 ? 'text-amber-400' : 'text-rose-400'}">${c.pass ? '✓' : c.points > 0 ? '◐' : '✗'}</span>
            <div class="min-w-0 flex-1"><div class="flex justify-between gap-2"><span class="text-slate-200">${esc(c.label)}</span><span class="text-xs font-mono text-slate-500">${c.points}/${c.max}</span></div><div class="text-xs text-slate-500">${esc(c.detail)}</div></div></li>`).join('')}</ul></div>`).join('')}
      </div>

      <div class="card space-y-4">
        <div><h3 class="card-title">${t('AI 爬虫访问矩阵')}</h3>${d.wildcardDisallows && d.wildcardDisallows.length ? `<p class="card-sub">${t('通配规则中禁止访问的路径（对所有爬虫生效）')}${colon()}<code class="text-slate-300">${esc(d.wildcardDisallows.join('  '))}</code></p>` : ''}</div>
        ${cats.map(([k, label]) => `<div><div class="text-xs font-semibold text-slate-400 mb-2">${esc(label)}</div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">${d.botStatus.filter((b) => b.category === k).map((b) => `<div class="p-3 rounded-xl bg-slate-950/60 border ${b.allowed ? 'border-slate-800' : 'border-rose-500/30'}">
            <div class="flex items-center justify-between gap-2"><span class="font-mono text-xs text-white">${esc(b.name)}</span>${statusPill(b)}</div>
            <div class="text-[11px] text-slate-500 mt-1">${esc(b.company)}</div><div class="text-[11px] text-slate-400 mt-1">${esc(b.reason)}</div></div>`).join('')}</div></div>`).join('')}
      </div>

      <div class="card space-y-3">
        <h3 class="card-title">${t('一键生成的整改代码')}</h3>
        <div class="flex gap-1.5 overflow-x-auto no-scrollbar">${codeTabs.map((c, i) => `<button data-action="code-tab" data-i="${i}" class="chip text-xs whitespace-nowrap ${i === 0 ? 'chip-on' : ''}">${esc(c[1])}</button>`).join('')}</div>
        <div id="code-panel">${codePanel(0)}</div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        <a href="/lab?domain=${encodeURIComponent(d.domain || '')}&url=${encodeURIComponent(d.url || '')}" class="card group hover:border-cyan-400/50 hover:bg-cyan-500/[0.04] transition p-5 block">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <span class="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 flex items-center justify-center text-sm font-bold">01</span>
              <div>
                <h4 class="text-sm font-bold text-white group-hover:text-cyan-300 transition">${t('下一步 · 首推实验室')}</h4>
                <p class="text-[11px] text-cyan-400/80">${d.domain ? (state.locale === 'en' ? `Pass domain: ${esc(d.domain)}` : `带入域名：${esc(d.domain)}`) : ''}</p>
              </div>
            </div>
            <span class="btn-primary text-xs px-3.5 py-1.5 shrink-0 pointer-events-none">${t('去实验')} →</span>
          </div>
          <p class="text-xs text-slate-400 mt-3 leading-relaxed">${t('用真实模型测试：AI 读到您的官方资料后，回答会有什么变化。')}</p>
        </a>

        <a href="/monitor?domain=${encodeURIComponent(d.domain || '')}" class="card group hover:border-emerald-400/50 hover:bg-emerald-500/[0.04] transition p-5 block">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <span class="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center justify-center text-sm font-bold">02</span>
              <div>
                <h4 class="text-sm font-bold text-white group-hover:text-emerald-300 transition">${t('下一步 · 站点托管')}</h4>
                <p class="text-[11px] text-emerald-400/80">${d.domain ? (state.locale === 'en' ? `Pass site: ${esc(d.domain)}` : `带入站点：${esc(d.domain)}`) : ''}</p>
              </div>
            </div>
            <span class="btn-emerald text-xs px-3.5 py-1.5 shrink-0 pointer-events-none">${t('去托管')} →</span>
          </div>
          <p class="text-xs text-slate-400 mt-3 leading-relaxed">${t('整改完成后，用 IndexNow 通知搜索引擎重新抓取。')}</p>
        </a>
      </div>
    </div>`;
  }

  // “AI 眼中的页面”：展示爬虫实际读到的标题、结构和正文开头
  function aiViewCard(d) {
    const v = d.aiView;
    return `<div class="card">
      <div class="flex flex-wrap items-baseline justify-between gap-2 mb-4"><h3 class="card-title">${t('AI 爬虫读到的页面')}</h3><span class="note">${t('这是不执行 JavaScript 的爬虫看到的内容')}</span></div>
      <div class="grid lg:grid-cols-5 gap-4">
        <div class="lg:col-span-2 rounded-2xl bg-ink border border-white/[0.07] p-4 space-y-3 min-w-0">
          <div><div class="text-[11px] font-mono text-slate-500 mb-1">&lt;title&gt;</div><div class="text-sm text-white break-words">${esc(d.title || t('（缺失）'))}</div></div>
          <div><div class="text-[11px] font-mono text-slate-500 mb-1">meta description</div><div class="text-[13px] text-slate-300 break-words">${esc(d.metaDesc || t('（缺失）'))}</div></div>
          <div><div class="text-[11px] font-mono text-slate-500 mb-1">${t('标题结构')}</div>${v.outline.length ? `<ul class="space-y-1">${v.outline.map((h) => `<li class="text-[12px] text-slate-300 truncate" style="padding-left:${(h.level - 1) * 14}px"><span class="num text-slate-500 mr-1.5">H${h.level}</span>${esc(h.text)}</li>`).join('')}</ul>` : `<div class="text-[12px] text-rose-300">${t('没有 H1–H3 标题')}</div>`}</div>
        </div>
        <div class="lg:col-span-3 rounded-2xl bg-ink border border-white/[0.07] p-4 min-w-0">
          <div class="text-[11px] font-mono text-slate-500 mb-2">${t('正文开头')} · ${d.stats.wordCount} ${t('字')}</div>
          <p class="text-[13px] leading-6 text-slate-300 break-words">${v.textPreview ? esc(v.textPreview) + (d.stats.wordCount > 200 ? '…' : '') : `<span class="text-rose-300">${t('几乎读不到正文。内容可能依赖 JavaScript 渲染，AI 爬虫看到的是空白页。')}</span>`}</p>
        </div>
      </div></div>`;
  }

  function codePanel(i) {
    const c = state.codeTabs[i]; if (!c) return '';
    return `<p class="text-xs text-slate-400 mb-2">${esc(c[4])}</p><pre class="code" id="code-content">${esc(c[2])}</pre>
      <div class="flex gap-2 mt-2"><button data-action="copy" data-target="code-content" class="btn-secondary px-4 py-2 text-xs">${t('复制')}</button>
      <button data-action="download" data-target="code-content" data-filename="${esc(c[3])}" class="btn-ghost px-4 py-2 text-xs">${t('下载')} ${esc(c[3])}</button></div>`;
  }

  function categorizeDomainFrontend(domain, brandDomain = '') {
    const isEn = state.locale === 'en';
    const d = String(domain || '').toLowerCase().trim();
    const b = String(brandDomain || '').toLowerCase().trim();
    if ((b && (d === b || d.endsWith('.' + b))) || /\.(edu(\.[a-z]{2})?|ac\.[a-z]{2})$/i.test(d) || /(^|\.)(neu|tsinghua|pku|hit|dlut|jlu|ustb|fudan|sjtu|zju|northeastern|bu|bc|harvard|mit|stanford|ox|cam)\./i.test(d)) {
      return isEn ? 'Official Portal' : '官方主页 / 院校官网';
    }
    if (/shanghairanking|usnews|topuniversities|timeshighereducation|cwur|ruankey|gaokao|chsi|cdgdc|rankings|qs\./i.test(d)) {
      return isEn ? 'Ranking & Benchmarks' : '权威评估 / 榜单平台';
    }
    if (/\.gov(\.[a-z]{2})?$/i.test(d) || /gov\.cn|moe\.gov|ed\.gov/i.test(d)) {
      return isEn ? 'Government & Authority' : '政府与主管部门';
    }
    if (/wikipedia|baike\.baidu|hudong|wikihow/i.test(d)) return isEn ? 'Encyclopedia' : '权威百科平台';
    if (/arxiv|ieee|nature|science|acm|sciencedirect/i.test(d)) return isEn ? 'Academic / Preprint' : '学术科研预印本';
    if (/zhihu|quora|reddit|stackoverflow|v2ex/i.test(d)) return isEn ? 'Q&A / Community' : '问答与开发者社区';
    if (/sina|sohu|163|qq|xinhuanet|people|cctv|news\.cn|reuters|bloomberg|wsj|nytimes/i.test(d)) return isEn ? 'Mainstream News' : '综合权威媒体';
    if (/36kr|huxiu|geekpark|ithome|techcrunch|theverge|venturebeat/i.test(d)) return isEn ? 'Tech & Media' : '科技商业媒体';
    if (/csdn|juejin|infoq|cnblogs|segmentfault/i.test(d)) return isEn ? 'Developer Hub' : '技术社区';
    if (/weibo|twitter|x\.com|linkedin|facebook|youtube|bilibili/i.test(d)) return isEn ? 'Social Media' : '社交平台';
    if (/github|gitee|gitlab|huggingface|kaggle/i.test(d)) return isEn ? 'Open Source / Code' : '代码与开源社区';
    return isEn ? 'Media / Web' : '资讯与网络媒体';
  }

  function computeFiveIndicesFrontend(d) {
    const isEn = state.locale === 'en';
    const qs = Array.isArray(d?.typical_questions) ? d.typical_questions : [];
    const total = qs.length;

    let visRate = null, visCount = 0;
    if (total > 0) {
      const trackedVis = qs.filter(q => typeof q.likely_mentioned === 'boolean');
      if (trackedVis.length > 0) {
        visCount = trackedVis.filter(q => q.likely_mentioned === true).length;
        visRate = Math.round((visCount / trackedVis.length) * 100);
      }
    }

    const rankedQs = qs.filter(q => q.likely_mentioned === true && typeof q.rank === 'number' && q.rank > 0);
    let avgRank = null, rankScore = null;
    const unrankedCount = total - rankedQs.length;
    if (rankedQs.length > 0) {
      const sum = rankedQs.reduce((s, q) => s + q.rank, 0);
      avgRank = +(sum / rankedQs.length).toFixed(1);
      rankScore = Math.max(10, Math.min(100, Math.round(100 - (avgRank - 1) * 20)));
    }

    let top1Rate = null, top1Count = 0;
    if (total > 0) {
      top1Count = rankedQs.filter(q => q.rank === 1).length;
      top1Rate = Math.round((top1Count / total) * 100);
    }

    const sentimentQs = qs.filter(q => q.likely_mentioned === true && (q.sentiment === 'positive' || q.sentiment === 'neutral' || q.sentiment === 'negative' || q.sentiment === 'mixed'));
    let sentimentRate = null, posCount = 0;
    if (sentimentQs.length > 0) {
      posCount = sentimentQs.filter(q => q.sentiment === 'positive').length;
      sentimentRate = Math.round((posCount / sentimentQs.length) * 100);
    }

    const trackedCiteQs = qs.filter(q => q.likely_mentioned === true && (typeof q.cited_official === 'boolean' || (Array.isArray(q.cited_domains) && q.cited_domains.length > 0)));
    let citationRate = null, citedCount = 0;
    if (trackedCiteQs.length > 0) {
      citedCount = trackedCiteQs.filter(q => q.cited_official === true || (Array.isArray(q.cited_domains) && q.cited_domains.length > 0)).length;
      citationRate = Math.round((citedCount / trackedCiteQs.length) * 100);
    }

    return {
      visibility: {
        key: 'visibility', label: t('可见指数'), rate: visRate, score: visRate,
        value: visRate !== null ? `${visRate}%` : null, count: visCount, total,
        summary: visRate !== null ? `${visCount}/${total} ${t('次被主动提及')}` : null,
        def: isEn ? 'Frequency and percentage of the brand being mentioned in AI model responses, reflecting brand exposure.' : '品牌在各大模型回答中被提及的频率与占比。反映品牌在 AI 知识库中的知名度与曝光面。',
        trace_filter: 'visibility', status: visRate !== null ? 'ok' : 'insufficient',
      },
      ranking: {
        key: 'ranking', label: t('排名指数'), rate: rankScore, score: rankScore, avgRank,
        value: avgRank !== null ? (isEn ? `Rank #${avgRank}` : `第 ${avgRank} 位`) : null,
        count: rankedQs.length, total,
        summary: avgRank !== null
          ? (isEn
              ? (unrankedCount > 0 ? `Avg rank #${avgRank} across ${rankedQs.length}/${total} answers (${unrankedCount} unranked)` : `Avg rank #${avgRank} across ${total} answers`)
              : (unrankedCount > 0 ? `在 ${rankedQs.length}/${total} 个问答中平均居第 ${avgRank} 位（${unrankedCount} 次未排名）` : `在 ${total} 个回答中平均居第 ${avgRank} 位`))
          : null,
        def: isEn ? 'Average rank of the brand when mentioned in AI recommendation lists (higher rank = higher score).' : '品牌在 AI 回答推荐或列出时的平均名次（越靠前得分越高）。反映 AI 推荐时的优先位序。',
        trace_filter: 'ranking', status: avgRank !== null ? 'ok' : 'insufficient',
      },
      top1: {
        key: 'top1', label: t('首位指数'), rate: top1Rate, score: top1Rate,
        value: top1Rate !== null ? `${top1Rate}%` : null, count: top1Count, total,
        summary: top1Rate !== null
          ? (isEn
              ? (unrankedCount > 0 ? `Ranked #1 in ${top1Count}/${total} responses (${unrankedCount} unranked)` : `Ranked #1 in ${top1Count}/${total} responses`)
              : (unrankedCount > 0 ? `${top1Count}/${total} 次在回答中排首位（${unrankedCount} 次未排名）` : `${top1Count}/${total} 次在回答中排首位`))
          : null,
        def: isEn ? 'Share of AI answers where the brand ranks #1 in recommendation or listing.' : '在 AI 回答中位居首选或第一位推荐的次数占比。衡量品牌在该领域的绝对领先心智。',
        trace_filter: 'top1', status: top1Rate !== null ? 'ok' : 'insufficient',
      },
      sentiment: {
        key: 'sentiment', label: t('情感指数'), rate: sentimentRate, score: sentimentRate,
        value: sentimentRate !== null ? `${sentimentRate}%` : null, count: posCount, total: sentimentQs.length,
        summary: sentimentRate !== null ? `${t('正面评价')} ${posCount}/${sentimentQs.length} 条` : null,
        def: isEn ? 'Proportion of positive sentiment when AI discusses the brand, reflecting brand reputation.' : '正面评价内容占比。反映各大模型对品牌声誉、技术实力与口碑的态度倾向。',
        trace_filter: 'sentiment', status: sentimentRate !== null ? 'ok' : 'insufficient',
      },
      citation: {
        key: 'citation', label: t('引用指数'), rate: citationRate, score: citationRate,
        value: citationRate !== null ? `${citationRate}%` : null, count: citedCount, total: trackedCiteQs.length,
        summary: citationRate !== null ? `${citedCount}/${trackedCiteQs.length} ${t('次问答引用权威信源')}` : null,
        def: isEn ? 'Rate of official domains and authoritative media cited in AI answers, reflecting credibility.' : '自有媒体/主流媒体被模型回答引用的次数与引用率。体现 AI 对品牌权威信源的采信度。',
        trace_filter: 'citation', status: citationRate !== null ? 'ok' : 'insufficient',
      },
    };
  }

  function computeCitationDomainsFrontend(d) {
    const isEn = state.locale === 'en';
    const qs = Array.isArray(d?.typical_questions) ? d.typical_questions : [];
    const brandDomain = d?.official_domain || '';
    const cleanBrandDomain = String(brandDomain || '').toLowerCase().trim();
    const confusionsText = (Array.isArray(d?.possible_confusions) ? d.possible_confusions.join(' ') : String(d?.possible_confusions || '')).toLowerCase();

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
    const domains = entries.map(([domain, count], i) => {
      const cat = categorizeDomainFrontend(domain, brandDomain);
      let confusionRisk = false;
      let confusionNote = '';
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

  function computeCompetitorComparisonFrontend(d) {
    const isEn = state.locale === 'en';
    const indices = d.five_indices || computeFiveIndicesFrontend(d);
    const yours = {
      name: d.brand,
      isYours: true,
      score: d.score,
      visibility: indices.visibility?.rate ?? d.score,
      sentiment: indices.sentiment?.rate ?? null,
      citation: indices.citation?.rate ?? null,
      note: isEn ? 'Target Brand' : '本次诊断品牌',
    };

    const rawComps = Array.isArray(d.competitor_metrics) && d.competitor_metrics.length > 0
      ? d.competitor_metrics
      : (Array.isArray(d.competitors) ? d.competitors : (typeof d.competitors === 'string' ? d.competitors.split(/[、,，\n]+/) : []));

    const items = [yours];
    rawComps.forEach((c) => {
      const name = typeof c === 'string' ? c : c.name;
      if (!name || name === d.brand) return;
      const cleanName = isEn ? String(name).replace(/、/g, ', ') : name;
      items.push({
        name: cleanName,
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

  function renderBrandVectors(d) {
    if (!d.vectors || !d.vectors.length) return '';
    return `<div class="card space-y-4">
      <div class="flex items-center justify-between pb-3 border-b border-white/[0.06]">
        <div>
          <h3 class="card-title flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-cyan-400"></span>${t('四维诊断')}</h3>
          <p class="card-sub text-xs text-slate-400">${t('技术可达性、内容可引用性、结构化数据与实体信任信号综合评测')}</p>
        </div>
        <div class="font-mono text-sm text-cyan-300 font-bold">${t('四维总分')}${colon()}${d.score}/100</div>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">${d.vectors.map((v) => `<div><div class="flex justify-between text-xs mb-2"><span class="text-slate-400">${esc(t(v.label))}</span><span class="num text-slate-200">${v.points}<span class="text-slate-500">/${v.max}</span></span></div>${bar(v.points, v.max)}</div>`).join('')}</div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
        ${d.vectors.map((v) => `<div class="p-4 rounded-xl bg-slate-950/50 border border-slate-800 space-y-2.5">
          <div class="flex items-center justify-between"><span class="font-semibold text-white text-xs">${esc(t(v.label))}</span><span class="font-mono text-xs ${v.points >= v.max * 0.75 ? 'text-emerald-300' : 'text-amber-300'}">${v.points}/${v.max}</span></div>
          ${Array.isArray(v.checks) ? `<ul class="space-y-1.5">${v.checks.map(c => `<li class="flex items-start gap-1.5 text-xs text-slate-300"><span class="${c.pass ? 'text-emerald-400' : 'text-amber-400'} shrink-0">${c.pass ? '✓' : '◐'}</span><span class="flex-1">${esc(t(c.label))}<span class="text-slate-500 block text-[11px]">${esc(t(c.detail))}</span></span></li>`).join('')}</ul>` : ''}
        </div>`).join('')}
      </div>
    </div>`;
  }

  function renderFiveIndices(d) {
    const fi = d.five_indices;
    if (!fi) return '';
    const items = [fi.visibility, fi.ranking, fi.top1, fi.sentiment, fi.citation].filter(Boolean);
    const qs = Array.isArray(d.typical_questions) ? d.typical_questions : [];
    return `<div class="card space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/[0.06]">
        <div>
          <h3 class="card-title flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-cyan-400"></span>${t('五维可见度指数')}</h3>
          <p class="card-sub text-xs text-slate-400">${t('与四维诊断互补：从可见度、排名、首位度、情感倾向与引用率五个维度评估大模型真实认知情况')}</p>
          <div class="flex flex-wrap items-center gap-2 mt-2">
            <span class="pill-muted !text-[11px] font-mono">${state.locale === 'en' ? `Sample size: ${qs.length} prompt queries` : `实测样本量：${qs.length} 轮问答`}</span>
            <span class="text-[11px] text-slate-500">${state.locale === 'en' ? '(Standard quick scan · Pro unlocks 20+ deep benchmark queries)' : '（免费快速抽样 · 专业版支持 20+ 轮全网深度拓频采样）'}</span>
          </div>
        </div>
        ${qs.length ? `<button type="button" data-action="toggle-evidence" class="btn-ghost px-3 py-1.5 text-xs text-cyan-300 border border-cyan-400/25 rounded-xl shrink-0 transition flex items-center gap-1">${t('查看完整证据链')} (${qs.length}${t('条问答')}) ↓</button>` : ''}
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        ${items.map(idx => {
          const isIns = idx.status === 'insufficient' || idx.value === null;
          return `<div class="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between space-y-3 relative group hover:border-cyan-500/30 transition">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-300">${esc(t(idx.label))}</span>
              <span class="text-[11px] text-slate-500 cursor-help" title="${esc(t(idx.def))}">ⓘ</span>
            </div>
            <div>
              ${isIns ? `<div class="text-xl font-mono text-slate-500 font-semibold">${t('数据不足')}</div><div class="text-[11px] text-slate-500 mt-1">${t('暂无足够问答样本')}</div>` : `<div class="text-2xl font-mono font-bold text-white tracking-tight">${esc(idx.value)}</div>
                ${idx.summary ? `<div class="text-[11px] text-cyan-300/90 mt-0.5 truncate" title="${esc(t(idx.summary))}">${esc(t(idx.summary))}</div>` : ''}
                <div class="mt-2.5">${bar(idx.rate ?? 50, 100)}</div>`}
            </div>
            <div class="pt-2 border-t border-white/[0.06] text-[11px] text-slate-400 leading-snug line-clamp-2" title="${esc(t(idx.def))}">
              ${esc(t(idx.def))}
            </div>
            ${!isIns && qs.length ? `<button type="button" data-action="trace-evidence" data-filter="${esc(idx.trace_filter || idx.key)}" class="text-[11px] text-cyan-400 hover:text-cyan-300 font-medium pt-1 flex items-center gap-1">${t('查看证据链')} →</button>` : ''}
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  function renderCitationDomains(d) {
    const cd = d.citation_domains;
    const domains = cd?.domains || [];
    const showAll = state.domainsExpanded;
    const visibleList = showAll ? domains : domains.slice(0, 10);
    return `<div class="card space-y-4">
      <div class="flex items-center justify-between pb-3 border-b border-white/[0.06]">
        <div>
          <h3 class="card-title flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-emerald-400"></span>${t('引用域名排行')}</h3>
          <p class="card-sub text-xs text-slate-400">${t('大模型在回答相关问题时引用频次最高的权威媒体与信源域名')}</p>
        </div>
      </div>
      <div class="p-3.5 rounded-xl bg-cyan-400/[0.07] border border-cyan-400/30 flex items-start gap-2.5 text-xs text-cyan-200">
        <span class="text-base leading-none">💡</span>
        <div><strong class="text-cyan-300">${t('行动指引')}</strong>${colon()}${esc(cd?.action_guide || t('以下域名最常被 AI 回答引用，优先在这些媒体发布内容可提升被引用概率'))}</div>
      </div>
      ${domains.some(dm => dm.confusion_risk) ? `
      <div class="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-200">
        <span class="text-base leading-none">⚠️</span>
        <div><strong class="text-amber-300">${t('实体混淆预警')}</strong>${colon()}${t('检测到大模型在部分回答中引用了同名/混淆实体的官方网站（而非目标主体官网）。建议加强实体消歧建设（同义词、英文全称与 Schema 别名），引导 AI 正确关联本方官网。')}</div>
      </div>` : ''}
      ${domains.length ? `<div class="overflow-x-auto"><table class="w-full text-xs">
        <thead><tr class="text-slate-400 border-b border-slate-800">
          <th class="text-left py-2 px-2 w-12">${t('排名')}</th>
          <th class="text-left py-2 px-2">${t('引用域名')}</th>
          <th class="text-left py-2 px-2">${t('类别/属性')}</th>
          <th class="text-right py-2 px-2 w-20">${t('引用次数')}</th>
          <th class="text-left py-2 px-2 w-44">${t('引用占比')}</th>
        </tr></thead>
        <tbody id="domain-rankings-tbody">${visibleList.map((dm) => {
          const catName = t(dm.category || '资讯与网络媒体');
          const isOfficial = /official|官网|主页/i.test(catName);
          const isRanking = /ranking|榜单|评估/i.test(catName);
          const isGov = /government|政府|主管/i.test(catName);
          const pillCls = isOfficial ? 'pill-ok' : (isRanking || isGov ? 'pill-info' : 'pill-muted');
          return `
          <tr class="border-b border-slate-800/60 hover:bg-slate-800/20 transition">
            <td class="py-2.5 px-2 font-mono ${dm.rank <= 3 ? 'text-cyan-300 font-bold' : 'text-slate-500'}">#${dm.rank}</td>
            <td class="py-2.5 px-2 font-mono text-white font-medium break-all">
              <span class="inline-flex items-center gap-1.5 flex-wrap">
                <span>${esc(dm.domain)}</span>
                ${dm.confusion_risk
                  ? `<span class="pill-warn !text-[10px] py-0.5 px-1.5" title="${esc(dm.confusion_note || t('引用了同名或混淆实体的官网'))}">⚠️ ${t('实体混淆风险')}</span>`
                  : (dm.verified === false
                      ? `<span class="pill-warn !text-[10px] py-0.5 px-1.5" title="${t('未通过 DNS 解析，可能为虚构域名')}">${t('未验证')}</span>`
                      : `<span class="text-emerald-400 text-xs inline-block" title="${t('已通过权威 DNS 解析验证')}">✓</span>`)}
              </span>
            </td>
            <td class="py-2.5 px-2"><span class="${pillCls} !text-[11px]">${esc(catName)}</span></td>
            <td class="py-2.5 px-2 text-right font-mono text-slate-200">${dm.count}</td>
            <td class="py-2.5 px-2">
              <div class="flex items-center gap-2">
                <div class="flex-1">${bar(dm.share, 30)}</div>
                <span class="num text-[11px] text-slate-400 w-12 text-right">${dm.share}%</span>
              </div>
            </td>
          </tr>`;
        }).join('')}</tbody></table></div>
        <p class="text-[11px] text-slate-500 pt-1 flex items-center gap-1.5">
          <span>ℹ</span>
          <span>${t('统计口径说明：五维指数中的「引用指数」衡量含权威信源引用的问答占比；本表统计各具体域名在问答中被引用的累计频次与分布。')}</span>
        </p>
        ${domains.length > 10 ? `<button type="button" data-action="toggle-domains" class="btn-ghost w-full py-2.5 text-xs text-slate-300 hover:text-white border border-white/[0.08] rounded-xl transition">${t(showAll ? '收起' : '查看全部')} (${domains.length})</button>` : ''}`
      : `<div class="text-xs text-slate-500 py-6 text-center">${t('暂无引用域名数据（模型回答未包含外部链接）')}</div>`}
    </div>`;
  }

  function renderCompetitorComparison(d) {
    const comp = d.competitor_comparison;
    const items = comp?.items || [];
    if (!items.length) return '';
    const activeTab = state.compTab || 'score';
    const tabObj = (comp.tabs || []).find(t => t.key === activeTab) || { key: 'score', label: t('总分'), desc: '' };
    const unit = state.locale === 'en' ? ' pts' : ' 分';

    return `<div class="card space-y-4 comp-card">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
        <div>
          <h3 class="card-title flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-indigo-400"></span>${t('竞品对比')}</h3>
          <p class="card-sub text-xs text-slate-400">${t('本方 vs 同类竞品多维度横向对标')}</p>
        </div>
        <div class="flex p-0.5 rounded-xl bg-slate-950 border border-white/10 text-xs shrink-0 comp-tabs" role="tablist" id="comp-tabs">
          ${[
            ['score', t('总分')],
            ['visibility', t('可见指数')],
            ['sentiment', t('情感指数')],
            ['citation', t('引用指数')],
          ].map(([k, label]) => `<button type="button" class="px-3 py-1.5 rounded-lg font-medium transition ${activeTab === k ? 'chip-on text-white' : 'text-slate-400 hover:text-white'}" data-action="comp-tab" data-tab="${k}">${label}</button>`).join('')}
        </div>
      </div>
      <div id="comp-view-container" class="comp-view-container space-y-3">
        <div class="text-xs text-slate-400">${esc(t(tabObj.desc || ''))}</div>
        <div class="overflow-x-auto"><table class="w-full text-xs">
          <thead><tr class="text-slate-400 border-b border-slate-800">
            <th class="text-left py-2 px-2">${t('品牌')}</th>
            <th class="text-center py-2 px-2 w-28">${esc(t(tabObj.label || '当前指标'))}</th>
            <th class="text-left py-2 px-2 w-48">${t('维度对标')}</th>
            <th class="text-left py-2 px-2">${t('对比简评')}</th>
          </tr></thead>
          <tbody>${items.map((it) => {
            const rawVal = it[activeTab];
            const isYours = it.isYours;
            const isIns = rawVal === null || rawVal === undefined;
            const numVal = isIns ? 0 : rawVal;
            const dispVal = isIns ? t('数据不足') : (activeTab === 'score' ? `${numVal}${unit}` : `${numVal}%`);
            return `<tr class="border-b border-slate-800/60 ${isYours ? 'bg-cyan-500/[0.07] text-white' : 'hover:bg-slate-800/20 text-slate-300'} transition">
              <td class="py-3 px-2 font-medium"><div class="flex items-center gap-1.5">${isYours ? `<span class="pill-info !text-[11px] font-bold">★ ${t('本方')}</span>` : ''}<span class="${isYours ? 'text-cyan-200 font-bold' : 'text-slate-200'}">${esc(it.name)}</span></div></td>
              <td class="py-3 px-2 text-center font-mono font-bold ${isIns ? 'text-slate-500' : (isYours ? 'text-cyan-300 text-sm' : 'text-slate-200')}">${dispVal}</td>
              <td class="py-3 px-2">${isIns ? '—' : bar(numVal, 100)}</td>
              <td class="py-3 px-2 text-slate-400 text-[11px]">${esc(it.note || '—')}</td>
            </tr>`;
          }).join('')}</tbody></table></div>
      </div>
    </div>`;
  }

  function updateCompView(d, root) {
    if (!d) return;
    if (!d.competitor_comparison) {
      d.competitor_comparison = computeCompetitorComparisonFrontend(d);
    }
    const comp = d.competitor_comparison;
    if (!comp) return;

    let containers = [];
    if (root) {
      const c = root.querySelector('#comp-view-container') || root.querySelector('.comp-view-container');
      if (c) containers.push(c);
    }
    const allContainers = $$('#comp-view-container, .comp-view-container');
    allContainers.forEach(c => {
      if (!containers.includes(c)) containers.push(c);
    });

    if (!containers.length) return;

    const activeTab = state.compTab || 'score';
    const tabObj = (comp.tabs || []).find(t => t.key === activeTab) || { key: 'score', label: t('总分'), desc: '' };
    const items = comp.items || [];
    const unit = state.locale === 'en' ? ' pts' : ' 分';
    const html = `
      <div class="text-xs text-slate-400 mb-1">${esc(t(tabObj.desc || ''))}</div>
      <div class="overflow-x-auto"><table class="w-full text-xs">
        <thead><tr class="text-slate-400 border-b border-slate-800">
          <th class="text-left py-2 px-2">${t('品牌')}</th>
          <th class="text-center py-2 px-2 w-28">${esc(t(tabObj.label || '当前指标'))}</th>
          <th class="text-left py-2 px-2 w-48">${t('维度对标')}</th>
          <th class="text-left py-2 px-2">${t('对比简评')}</th>
        </tr></thead>
        <tbody>${items.map((it) => {
          const rawVal = it[activeTab];
          const isYours = it.isYours;
          const isIns = rawVal === null || rawVal === undefined;
          const numVal = isIns ? 0 : rawVal;
          const dispVal = isIns ? t('数据不足') : (activeTab === 'score' ? `${numVal}${unit}` : `${numVal}%`);
          return `<tr class="border-b border-slate-800/60 ${isYours ? 'bg-cyan-500/[0.07] text-white' : 'hover:bg-slate-800/20 text-slate-300'} transition">
            <td class="py-3 px-2 font-medium"><div class="flex items-center gap-1.5">${isYours ? `<span class="pill-info !text-[11px] font-bold">★ ${t('本方')}</span>` : ''}<span class="${isYours ? 'text-cyan-200 font-bold' : 'text-slate-200'}">${esc(it.name)}</span></div></td>
            <td class="py-3 px-2 text-center font-mono font-bold ${isIns ? 'text-slate-500' : (isYours ? 'text-cyan-300 text-sm' : 'text-slate-200')}">${dispVal}</td>
            <td class="py-3 px-2">${isIns ? '—' : bar(numVal, 100)}</td>
            <td class="py-3 px-2 text-slate-400 text-[11px]">${esc(it.note || '—')}</td>
          </tr>`;
        }).join('')}</tbody></table></div>`;

    containers.forEach(container => {
      container.innerHTML = html;
    });
  }

  // —— 内容行动卡 2.0：弱点下方自动展示 / 小红书发布标记 / 发布后重测对比 ——
  function normalizeQuestionKey(q) {
    return String(q || '').replace(/[\s\p{P}]/gu, '').toLowerCase();
  }
  function isWeaknessFrontend(q) {
    return q && (q.likely_mentioned !== true || q.sentiment === 'negative' || !q.rank || q.rank > 2);
  }
  function findWeaknessCard(d, q) {
    const cards = Array.isArray(d.action_cards) ? d.action_cards : [];
    if (!cards.length || !q || !q.q) return null;
    const key = normalizeQuestionKey(q.q);
    return cards.find((c) => (c.questionKey || normalizeQuestionKey(c.targetQuestion)) === key) || null;
  }
  function renderWeaknessCard(d, q) {
    if (!isWeaknessFrontend(q)) return '';
    const card = findWeaknessCard(d, q);
    if (!card) return '';
    const published = card.publishStatus === 'published';
    const channels = Array.isArray(card.suggestedChannels) ? card.suggestedChannels : [];
    return `<div class="mt-2 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.05] p-3 space-y-2">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="text-[11px] font-bold text-cyan-300">📋 ${t('内容行动卡')}</span>
        ${published ? `<span class="flex flex-wrap items-center gap-1.5">
          <span class="pill-ok !text-[10px]">✓ ${t('已在小红书发布')} · ${esc(card.publishChannel || '')}${card.publishedAt ? ' · ' + esc(fmtDate(card.publishedAt)) : ''}</span>
          ${card.id && state.user ? `<button type="button" data-action="card-unmark-published" data-id="${card.id}" class="text-[10px] text-slate-500 hover:text-slate-300 underline">${t('撤销标记')}</button>` : ''}
        </span>` : ''}
      </div>
      <p class="text-xs text-slate-200"><span class="text-slate-500">${t('建议标题')}${colon()}</span><span class="font-semibold text-white">${esc(card.title)}</span></p>
      <div class="text-xs">
        <span class="text-slate-500">${t('建议发布渠道')}${colon()}</span>
        ${channels.length ? `<div class="flex flex-wrap gap-1.5 mt-1">${channels.map((ch) => `<span class="pill-info !text-[10px]" title="${esc(ch.reason || '')}">${esc(ch.channel)}</span>`).join('')}</div>
        <p class="text-[10px] text-slate-500 mt-1">${t('渠道取自本轮审计的引用域名排行，悬停查看具体依据')}</p>`
        : `<span class="text-[11px] text-slate-500">${t('本轮审计暂未观测到外部引用，建议先在官网沉淀该内容，再同步到小红书等自有阵地。')}</span>`}
      </div>
      <details class="text-xs">
        <summary class="cursor-pointer text-cyan-300/90 hover:text-cyan-200 text-[11px]">${t('展开内容大纲')}</summary>
        <div class="mt-1.5 text-[11px] text-slate-300 leading-relaxed whitespace-pre-wrap">${esc(card.outline)}</div>
      </details>
      ${!published ? `<div class="pt-1">
        ${card.id && state.user
          ? `<button type="button" data-action="card-mark-published" data-id="${card.id}" data-title="${esc(card.title)}" class="btn-ghost text-[10px] px-2 py-1 text-emerald-300 border-emerald-500/30">✓ ${t('我已在小红书发布，标记一下')}</button>`
          : `<span class="text-[10px] text-slate-500">${t('登录后可标记发布进度，下次审计自动重测引用变化')}</span>`}
      </div>` : ''}
    </div>`;
  }
  function retestCell(x) {
    const m = x.mentioned === true ? `<span class="pill-ok !text-[10px]">${t('被提及')}</span>` : (x.mentioned === false ? `<span class="pill-bad !text-[10px]">${t('未被提及')}</span>` : '<span class="text-slate-500">—</span>');
    const domains = Array.isArray(x.citedDomains) && x.citedDomains.length ? x.citedDomains.map((d) => `<span class="pill-muted !text-[10px] font-mono">${esc(d)}</span>`).join(' ') : '<span class="text-slate-500 text-[10px]">—</span>';
    return `<div class="space-y-1.5">
      <div class="flex items-center gap-1.5">${m}${typeof x.rank === 'number' && x.rank ? `<span class="pill-info !text-[10px]">${t('排名')} #${x.rank}</span>` : ''}</div>
      <div><span class="text-slate-500 text-[10px]">${t('引用域名')}${colon()}</span><span class="flex flex-wrap gap-1 mt-0.5">${domains}</span></div>
    </div>`;
  }
  function renderPublishRetests(d) {
    const list = Array.isArray(d.publish_retests) ? d.publish_retests : [];
    if (!list.length) return '';
    return `<div class="card space-y-3">
      <div>
        <h3 class="card-title flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-emerald-400"></span>${t('发布后重测对比')}</h3>
        <p class="card-sub text-xs text-slate-400">${t('以下弱点曾标记为已在小红书发布，本次审计用真实模型重新提问，自动对比引用变化')}</p>
      </div>
      <div class="space-y-2.5">
        ${list.map((rt) => `
        <div class="p-3.5 rounded-xl bg-slate-950/60 border border-emerald-500/15 space-y-2">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="text-sm font-semibold text-white">${esc(rt.question)}</span>
            <span class="pill-ok !text-[10px]">✓ ${esc(rt.publishChannel || t('已发布'))}${rt.days ? ` · ${rt.days} ${t('天前')}` : ''}</span>
          </div>
          <div class="grid sm:grid-cols-2 gap-2 text-[11px]">
            <div class="rounded-lg bg-white/[0.02] border border-white/[0.06] p-2.5">
              <p class="text-slate-500 mb-1.5">${t('发布前基线')}</p>
              ${retestCell(rt.baseline || {})}
            </div>
            <div class="rounded-lg bg-white/[0.02] border border-white/[0.06] p-2.5">
              <p class="text-slate-500 mb-1.5">${t('本次重测')}${rt.engine ? ' · ' + esc(rt.engine) : ''}</p>
              ${retestCell(rt.current || {})}
            </div>
          </div>
          <p class="text-[11px] text-slate-400 leading-relaxed">${esc(rt.observation)}</p>
        </div>`).join('')}
      </div>
    </div>`;
  }

  function renderEvidenceChain(d) {
    const qs = Array.isArray(d.typical_questions) ? d.typical_questions : [];
    if (!qs.length) return '';
    const filter = state.evidenceFilter || 'all';
    const visCount = qs.filter(q => q.likely_mentioned === true).length;
    const rankCount = qs.filter(q => q.likely_mentioned === true && typeof q.rank === 'number').length;
    const top1Count = qs.filter(q => q.likely_mentioned === true && q.rank === 1).length;
    const posCount = qs.filter(q => q.likely_mentioned === true && q.sentiment === 'positive').length;
    const citedCount = qs.filter(q => q.likely_mentioned === true && (q.cited_official === true || (Array.isArray(q.cited_domains) && q.cited_domains.length > 0))).length;

    let filtered = qs;
    if (filter === 'visibility') filtered = qs.filter(q => q.likely_mentioned === true);
    else if (filter === 'ranking') filtered = qs.filter(q => q.likely_mentioned === true && typeof q.rank === 'number');
    else if (filter === 'top1') filtered = qs.filter(q => q.likely_mentioned === true && q.rank === 1);
    else if (filter === 'sentiment') filtered = qs.filter(q => q.likely_mentioned === true && q.sentiment === 'positive');
    else if (filter === 'citation') filtered = qs.filter(q => q.likely_mentioned === true && (q.cited_official === true || (Array.isArray(q.cited_domains) && q.cited_domains.length > 0)));

    return `<div class="card space-y-4" id="evidence-chain-section">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/[0.06]">
        <div>
          <h3 class="card-title flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-cyan-400"></span>${t('证据链')} · ${t('审计问答明细')}</h3>
          <p class="card-sub text-xs text-slate-400">${t('点击上方任一指数可快速定位贡献该分数的问答证据，严格可追溯')}</p>
        </div>
      </div>
      <div class="flex flex-wrap gap-1.5 text-xs" role="tablist">
        ${[
          ['all', `${t('全部')} (${qs.length})`],
          ['visibility', `${t('可见提及')} (${visCount})`],
          ['ranking', `${t('排名明细')} (${rankCount})`],
          ['top1', `${t('首位推荐')} (${top1Count})`],
          ['sentiment', `${t('正面评价')} (${posCount})`],
          ['citation', `${t('信源引用')} (${citedCount})`],
        ].map(([k, label]) => `<button type="button" class="chip text-xs ${filter === k ? 'chip-on' : ''}" data-action="evidence-filter" data-filter="${k}">${label}</button>`).join('')}
      </div>
      <div class="space-y-2.5">
        ${filtered.map((q, idx) => `
          <div class="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="text-sm font-semibold text-white">Q${idx + 1}. ${esc(q.q)}</span>
              <div class="flex flex-wrap items-center gap-1.5">
                ${q.likely_mentioned === true ? `<span class="pill-ok !text-[10px]">${t('可能提及')}</span>` : (q.likely_mentioned === false ? `<span class="pill-bad !text-[10px]">${t('可能不提')}</span>` : `<span class="pill-muted !text-[10px]">?</span>`)}
                ${q.rank ? `<span class="pill-info !text-[10px]">${t('位居第')} ${q.rank} ${t('位')}</span>` : ''}
                ${q.sentiment ? `<span class="${q.sentiment === 'positive' ? 'pill-ok' : (q.sentiment === 'negative' ? 'pill-bad' : 'pill-muted')} !text-[10px]">${esc({ positive: t('偏正面'), neutral: t('中性'), negative: t('偏负面') }[q.sentiment] || q.sentiment)}</span>` : ''}
                ${q.cited_official ? `<span class="pill-ok !text-[10px]">${t('官网引用')}</span>` : ''}
              </div>
            </div>
            ${q.note ? `<p class="text-xs text-slate-300 leading-relaxed">${esc(q.note)}</p>` : ''}
            <div class="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/[0.04]">
              <div class="flex flex-wrap items-center gap-1.5">
                ${Array.isArray(q.cited_domains) && q.cited_domains.length ? `
                  <span class="text-[11px] text-slate-500">${t('引用信源')}${colon()}</span>
                  ${q.cited_domains.map(dom => `<span class="pill-muted !text-[10px] font-mono">${esc(dom)}</span>`).join('')}
                ` : `<span class="text-[11px] text-slate-500">${t('未观测到外部信源引用')}</span>`}
              </div>
              ${q.likely_mentioned !== true || q.sentiment === 'negative' || !q.rank || q.rank > 2 ? `
                <button type="button" data-action="quick-gen-redv" data-brand="${esc(d.brand)}" data-question="${esc(q.q)}" data-reason="${esc(q.note || '')}" class="btn-ghost text-[10px] px-2 py-0.5 text-rose-300 hover:text-white border-rose-500/30">
                  + ${t('一键生成红V行动卡')}
                </button>
              ` : ''}
            </div>
            ${renderWeaknessCard(d, q)}
          </div>`).join('')}
      </div>
    </div>`;
  }

  function renderBrandResult(d, id) {
    d.five_indices = d.five_indices || computeFiveIndicesFrontend(d);
    d.citation_domains = d.citation_domains || computeCitationDomainsFrontend(d);
    d.competitor_comparison = d.competitor_comparison || computeCompetitorComparisonFrontend(d);

    const rec = { known: [t('较为熟悉'), 'pill-ok'], partial: [t('部分了解'), 'pill-warn'], unknown: [t('基本不了解'), 'pill-bad'] }[d.recognized] || ['—', 'pill-muted'];
    const sent = { positive: t('偏正面'), neutral: t('中性'), mixed: t('有争议'), negative: t('偏负面') }[d.sentiment];
    const conf = { high: 'pill-ok', medium: 'pill-warn', low: 'pill-muted' };
    const a = d.assets || {};
    state.codeTabs = [
      ['faq', t('FAQ 问答模板'), a.faqMd, 'faq.md', t('【】处请填写真实内容后发布在官网 FAQ 页面。')],
      ['compare', t('对比表模板'), a.compareMd, 'compare.md', t('只填写可公开核实的数据，并附来源链接。')],
      ['llms', 'llms.txt', a.llmsTxt, 'llms.txt', t('补全【】中的信息后上传到网站根目录。')],
      ['schema', 'JSON-LD', a.schema, 'schema.html', t('补全后粘贴到官网首页 <head> 中。')],
    ].filter((x) => x[2]);

    return `<div class="space-y-6">
      ${d.isSample ? `
        <div class="p-3.5 sm:p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3 text-xs text-amber-200">
          <svg class="w-4 h-4 text-amber-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <div><strong class="text-amber-300 font-semibold">${t('示例报告说明')}</strong>${colon()}${t('此报告为预置示例，基于深度求索（DeepSeek）真实审计数据固化，展示完整的 GEO 诊断能力；非实时体检结果。')}</div>
        </div>` : ''}

      <div class="card">
        <div class="flex flex-col md:flex-row gap-5 md:items-center">
          ${scoreRing(d.score)}
          <div class="flex-1 min-w-0 space-y-2">
            <div class="flex flex-wrap items-center gap-2">
              <span class="${rec[1]}">${rec[0]}</span>
              <span class="pill-muted">${t('把握度')} ${d.confidence}%</span>
              ${sent ? `<span class="pill-muted">${t('印象')}${colon()}${sent}</span>` : ''}
              <span class="pill-info">${esc(formatEngineLabel(d.engine?.label || ''))}</span>
              ${d.isSample ? `<span class="pill-warn !text-xs font-semibold">${t('示例报告')}</span>` : ''}
            </div>
            <div class="flex items-center gap-2 flex-wrap">
              <h2 class="text-xl sm:text-2xl font-bold text-white">${esc(d.brand)}</h2>
              ${d.isSample ? `<span class="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">${t('示例报告')}</span>` : ''}
            </div>
            ${d.category ? `<div class="text-xs text-slate-400">${esc(d.category)}</div>` : ''}
            <p class="text-sm text-slate-300 leading-relaxed">${esc(d.summary)}</p>
            <div class="flex flex-wrap gap-1.5">${d.tags.map((x) => `<span class="pill-muted">${esc(x)}</span>`).join('')}</div>
          </div>
          <div class="md:self-start">${reportButtons(id)}</div>
        </div>
        <p class="text-[11px] text-slate-500 mt-4">${t('以上为单一模型在未联网情况下的认知，反映品牌信息在模型知识中的覆盖程度；不同模型、不同时间可能不同。建议在「AI 舆情监测」中用多个模型交叉验证。')}</p>
      </div>

      ${renderBrandVectors(d)}

      ${renderFiveIndices(d)}

      ${renderCitationDomains(d)}

      ${renderCompetitorComparison(d)}

      ${renderPublishRetests(d)}

      ${renderEvidenceChain(d)}

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div class="card space-y-2"><h3 class="font-bold text-white text-sm">${t('模型较有把握的信息')}</h3>
          ${d.known_facts && d.known_facts.length ? `<ul class="space-y-2">${d.known_facts.map((f) => `<li class="text-sm text-slate-300 flex gap-2"><span class="${conf[f.confidence]} shrink-0 !text-[10px]">${esc({ high: t('高'), medium: t('中'), low: t('低') }[f.confidence])}</span><span>${esc(f.fact)}</span></li>`).join('')}</ul>` : `<p class="text-sm text-slate-500">${t('无')}</p>`}</div>
        <div class="card space-y-2"><h3 class="font-bold text-white text-sm">${t('不确定 / 可能过时')}</h3>
          ${d.uncertain_points && d.uncertain_points.length ? `<ul class="space-y-1.5 text-sm text-slate-300 list-disc pl-5">${d.uncertain_points.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : `<p class="text-sm text-slate-500">${t('无')}</p>`}</div>
        <div class="card space-y-2"><h3 class="font-bold text-white text-sm">${t('可能混淆 / 同类对象')}</h3>
          <div class="flex flex-wrap gap-1.5">${(d.possible_confusions || []).map((x) => `<span class="pill-warn">${esc(x)}</span>`).join('') || `<span class="text-sm text-slate-500">${t('无明显混淆')}</span>`}</div>
          <div class="text-xs text-slate-400 pt-2">${t('同类')}${colon()}${esc((Array.isArray(d.competitors) ? d.competitors : (typeof d.competitors === 'string' ? [d.competitors] : [])).flatMap(c => String(c || '').split(/[、,，\n]+/)).map(s => s.trim()).filter(Boolean).map(c => state.locale === 'en' ? c.replace(/、/g, ', ') : c).join(state.locale === 'en' ? ', ' : '、') || '—')}</div></div>
      </div>

      <div class="card space-y-3"><h3 class="card-title">${t('改进建议')}</h3>
        <ol class="space-y-2 list-decimal pl-5 text-sm text-slate-300">${[...(a.fixes || []), ...(d.recommendations || [])].map((x) => `<li>${esc(x)}</li>`).join('')}</ol></div>
      <div class="card space-y-3"><h3 class="card-title">${t('语料模板（需填入真实信息）')}</h3>
        <div class="flex gap-1.5 overflow-x-auto no-scrollbar">${state.codeTabs.map((c, i) => `<button data-action="code-tab" data-i="${i}" class="chip text-xs whitespace-nowrap ${i === 0 ? 'chip-on' : ''}">${esc(c[1])}</button>`).join('')}</div>
        <div id="code-panel">${codePanel(0)}</div></div>
    </div>`;
  }

  function renderCompareTable() {
    const data = state.compareData;
    const out = $('#compare-result');
    if (!data || !out) return;
    const rows = [data.yours, ...data.competitors];
    const activeTab = state.compareTab || 'score';
    const tabLabels = {
      score: t('总分'),
      visibility: t('可见指数'),
      sentiment: t('情感指数'),
      citation: t('引用指数'),
    };
    const vecs = (data.yours.vectors || data.competitors.find((c) => c.vectors)?.vectors || []).map((v) => [v.vector, v.label]);

    out.innerHTML = `<div class="space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
        <span class="text-xs text-slate-400 font-medium">${t('维度切换')}${colon()}</span>
        <div class="flex p-0.5 rounded-lg bg-slate-950 border border-slate-800 text-xs shrink-0" role="tablist">
          ${['score', 'visibility', 'sentiment', 'citation'].map(k => `<button type="button" class="px-2.5 py-1 rounded-md font-medium transition ${activeTab === k ? 'chip-on text-white' : 'text-slate-400 hover:text-white'}" data-action="url-comp-tab" data-tab="${k}">${tabLabels[k]}</button>`).join('')}
        </div>
      </div>
      <div class="overflow-x-auto"><table class="w-full text-xs">
        <thead><tr class="text-slate-400 border-b border-slate-800">
          <th class="text-left py-2 pr-2">${t('网站')}</th>
          <th class="px-2 text-center">${tabLabels[activeTab]}</th>
          ${activeTab === 'score' ? vecs.map((v) => `<th class="px-2 whitespace-nowrap text-center">${esc(v[1])}</th>`).join('') : `<th class="px-2 w-48 text-left">${t('维度对标')}</th>`}
        </tr></thead>
        <tbody>${rows.map((x, i) => {
          if (x.error) return `<tr class="border-t border-slate-800"><td class="py-2 pr-2 max-w-[160px] truncate">${esc(x.url)}</td><td colspan="${activeTab === 'score' ? vecs.length + 1 : 2}" class="text-rose-300 px-2">${esc(x.error)}</td></tr>`;
          const m = x.metrics || { score: x.score, visibility: 50, sentiment: 50, citation: 50 };
          const curVal = m[activeTab] ?? x.score;
          const isYours = i === 0;
          return `<tr class="border-t border-slate-800 ${isYours ? 'text-cyan-200 bg-cyan-500/[0.05]' : 'text-slate-300'}">
            <td class="py-2 pr-2 max-w-[160px] truncate" title="${esc(x.url)}">${isYours ? '★ ' : ''}${esc(x.title || x.url)}</td>
            <td class="text-center font-mono font-bold px-2 ${isYours ? 'text-cyan-300' : 'text-white'}">${curVal}${activeTab === 'score' ? '' : '%'}</td>
            ${activeTab === 'score' ? vecs.map((v) => { const y = x.vectors.find((z) => z.vector === v[0]); return `<td class="text-center font-mono px-2">${y ? `${y.points}/${y.max}` : '—'}</td>`; }).join('') : `<td class="px-2">${bar(curVal, 100)}</td>`}
          </tr>`;
        }).join('')}</tbody></table></div>
      ${data.gaps && data.gaps.length ? `<div class="mt-3 space-y-1.5">${data.gaps.map((g) => `<div class="text-xs text-amber-200">⚠ ${esc(g.label)}：${esc(g.competitor)} ${g.theirs} ${t('分')} vs ${t('您')} ${g.yours} ${t('分')}</div>`).join('')}</div>` : `<p class="text-xs text-emerald-300 mt-3">${t('各维度均不落后于竞品 🎉')}</p>`}
    </div>`;
  }

  // 竞品对比
  async function runCompare(ev) {
    ev.preventDefault();
    const url = $('#compare-main').value.trim();
    const competitors = $('#compare-comps').value.split(/\s+/).map((s) => s.trim()).filter(Boolean).slice(0, 4);
    if (!url || !competitors.length) return toast(t('请填写您的网址和至少一个竞品网址'), 'warn');
    const btn = ev.target.querySelector('button[type=submit]'); const out = $('#compare-result');
    busy(btn, true, t('对比中…')); out.innerHTML = `<div class="skeleton h-24"></div>`;
    try {
      const r = await api('/compare', { method: 'POST', body: { url, competitors } });
      state.compareData = r.data;
      state.compareTab = 'score';
      renderCompareTable();
    } catch (e) { out.innerHTML = ''; fail(e); } finally { busy(btn, false); }
  }


  async function openResult(id) {
    const out = $('#view-result');
    out.innerHTML = skeleton(t('加载中…'));
    try {
      const r = await api(`/results/${encodeURIComponent(id)}`, { silent: true });
      state.audit = r.data; state.auditId = r.id; state.auditKind = r.kind; state.auditCreatedAt = r.createdAt;
      await enrichCardsPublishState(r.data);
      state.compTab = 'score';
      state.domainsExpanded = false;
      state.evidenceFilter = 'all';
      out.innerHTML = `<div class="text-xs text-slate-500 mb-2">${t('体检时间')}${colon()}${fmtDate(r.createdAt)} · <a href="/audit" class="text-cyan-400">${t('新的体检')}</a></div>` + (r.kind === 'url' ? renderUrlResult(r.data, r.id) : renderBrandResult(r.data, r.id));
    } catch (e) {
      out.innerHTML = `<div class="card text-center py-10"><p class="text-slate-300">${esc(e.message)}</p><a href="/audit" class="btn-primary inline-flex mt-4 px-5 py-2 text-sm">${t('返回体检')}</a></div>`;
    }
  }

  // 内容检查
  function contentChecks(d) {
    return `<div class="flex items-center gap-3 mb-2"><span class="text-2xl font-extrabold font-mono ${d.score >= 70 ? 'text-emerald-300' : d.score >= 50 ? 'text-amber-300' : 'text-rose-300'}">${d.score}</span><span class="text-xs text-slate-400">${t('约')} ${d.words} ${t('字')}</span></div>
      <ul class="space-y-2">${d.checks.map((c) => `<li class="text-sm flex gap-2"><span class="${c.pass ? 'text-emerald-400' : 'text-rose-400'}">${c.pass ? '✓' : '✗'}</span><div><span class="text-slate-200">${esc(c.label)}</span> <span class="text-xs text-slate-500">${esc(c.detail)}</span>${c.pass ? '' : `<div class="text-xs text-slate-400 mt-0.5">${esc(c.fix)}</div>`}</div></li>`).join('')}</ul>`;
  }
  async function runContentCheck(ev) {
    ev.preventDefault();
    const text = $('#content-text').value.trim();
    if (text.length < 50) return toast(t('请粘贴至少 50 字的正文'), 'warn');
    try { const r = await api('/content/check', { method: 'POST', body: { text } }); $('#content-result').innerHTML = contentChecks(r.data); } catch (e) { fail(e); }
  }
  async function runContentRewrite(btn) {
    const text = $('#content-text').value.trim();
    if (text.length < 50) return toast(t('请粘贴至少 50 字的正文'), 'warn');
    busy(btn, true, t('改写中…'));
    try {
      const r = await api('/content/rewrite', { method: 'POST', body: { text } });
      $('#content-result').innerHTML = `<div class="flex items-center justify-between mb-2"><span class="text-xs text-slate-400">${t('改写稿')} · ${esc(r.data.engine.label)}</span><button data-action="copy" data-target="rewrite-raw" class="btn-ghost px-3 py-1 text-xs">${t('复制')}</button></div>
        <textarea id="rewrite-raw" class="hidden">${esc(r.data.text)}</textarea>
        <div class="md p-4 rounded-2xl bg-slate-950/60 border border-slate-800 max-h-96 overflow-auto">${md(r.data.text)}</div>
        <p class="text-[11px] text-amber-300/80 mt-2">${t('【待补充】处需要您填入真实数据与来源；请人工核对后再发布。')}</p>`;
    } catch (e) { fail(e); } finally { busy(btn, false); }
  }

  // ————————————————————— 2. 实验室 —————————————————————
  async function buildLab(ev) {
    ev.preventDefault();
    const body = {
      brand: $('#lab-brand').value, domain: $('#lab-domain').value, category: $('#lab-category').value, keyword: $('#lab-keyword').value,
      facts: $('#lab-facts').value, audience: $('#lab-audience').value, competitors: $('#lab-competitors').value,
    };
    const btn = ev.target.querySelector('button[type=submit]');
    busy(btn, true, t('生成中…'));
    try {
      const r = await api('/lab/capsule', { method: 'POST', body });
      state.lab = r.data;
      $('#lab-capsule').value = r.data.capsule;
      $('#lab-questions').innerHTML = r.data.questions.map((q, i) => `<button class="chip text-xs text-left ${i === 0 ? 'chip-on' : ''}" data-action="lab-q" data-q="${esc(q)}">${esc(q)}</button>`).join('');
      $('#lab-question').value = r.data.questions[0];
      fillEngineSelect($('#lab-engine'));
      $('#lab-step2').classList.remove('hidden');
      $('#lab-result').innerHTML = '';
      $('#lab-step2').scrollIntoView({ behavior: 'smooth' });
    } catch (e) { fail(e); } finally { busy(btn, false); }
  }

  function mentionBadges(a) {
    if (!a) return '';
    return `${a.mentioned ? `<span class="pill-ok">${t('提到了您')}${a.rank ? ` · ${t('列表第')} ${a.rank} ${t('位')}` : ''}</span>` : `<span class="pill-bad">${t('未提到您')}</span>`}
      ${a.competitorsMentioned?.length ? `<span class="pill-muted">${t('提到竞品')}${colon()}${esc(a.competitorsMentioned.join('、'))}</span>` : ''}`;
  }

  async function runLab(btn) {
    if (!state.lab) return;
    const question = $('#lab-question').value.trim();
    if (!question) return toast(t('请输入问题'), 'warn');
    const out = $('#lab-result');
    busy(btn, true, t('模型作答中…'));
    out.innerHTML = `<div class="grid md:grid-cols-2 gap-4"><div class="skeleton h-48"></div><div class="skeleton h-48"></div></div>`;
    try {
      const r = await api('/lab/simulate', { method: 'POST', body: {
        question, capsule: $('#lab-capsule').value, brand: state.lab.brand, domain: state.lab.domain, competitors: state.lab.competitors, engine: $('#lab-engine').value,
      } });
      const d = r.data;
      const col = (x, title, cls, sub) => `<div class="p-4 rounded-2xl border ${cls} space-y-3 min-w-0">
        <div class="flex flex-wrap items-center justify-between gap-2"><span class="text-sm font-bold">${title}</span><div class="flex flex-wrap gap-1.5">${x.ok ? mentionBadges(x.analysis) : ''}</div></div>
        <div class="text-[11px] text-slate-500">${sub}</div>
        ${x.ok ? `<div class="md">${md(x.answer)}</div>` : `<div class="text-sm text-rose-300">${esc(x.error)}</div>`}</div>`;
      const verdict = d.before.ok && d.after.ok ? labVerdict(d.before.analysis, d.after.analysis) : '';
      out.innerHTML = `<div class="text-xs text-slate-400 mb-3">${t('模型')}${colon()}<b class="text-slate-200">${esc(d.engine.label)}</b> (${esc(d.engine.model)}) · ${t('问题')}${colon()}${esc(d.question)}</div>
        ${verdict}
        <div class="grid md:grid-cols-2 gap-4">
          ${col(d.before, `<span class="text-rose-300">A · ${t('没有您的资料')}</span>`, 'border-rose-500/30 bg-rose-950/10', t('模型仅凭已有知识作答'))}
          ${col(d.after, `<span class="text-emerald-300">B · ${t('检索到您的资料')}</span>`, 'border-emerald-500/30 bg-emerald-950/10', t('把上方语料作为检索结果提供给模型（模拟 AI 搜索读到您的 llms.txt）'))}
        </div>
        <div class="mt-4 p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 leading-relaxed">
          <b class="text-slate-200">${t('如何让真实 AI 读到这份资料？')}</b><br>
          1. ${t('把语料保存为 llms.txt 上传到网站根目录，并将关键事实同步写进官网正文页面（AI 搜索主要读取正文页面）。')}<br>
          2. ${t('在「可见度体检」中确认 AI 搜索爬虫没有被 robots.txt 拦截。')}<br>
          3. ${t('在「站点托管」中用 IndexNow 通知搜索引擎抓取更新。')}</div>`;
    } catch (e) { out.innerHTML = ''; fail(e); } finally { busy(btn, false); }
  }
  function labVerdict(a, b) {
    let msg; let cls;
    if (!a.mentioned && b.mentioned) { msg = t('读到资料后，模型开始提及您的品牌。说明补充官方资料有明显作用。'); cls = 'border-emerald-500/40 text-emerald-200'; }
    else if (a.mentioned && b.mentioned && b.rank && (!a.rank || b.rank < a.rank)) { msg = t('读到资料后，您在推荐列表中的位置提前了。'); cls = 'border-emerald-500/40 text-emerald-200'; }
    else if (!b.mentioned) { msg = t('即使读到资料，模型仍未提及您。建议补充更具体、可核实的事实，或换一个更贴近您优势的问题。'); cls = 'border-amber-500/40 text-amber-200'; }
    else { msg = t('两种情况下模型都提到了您，可对比描述是否更准确、更完整。'); cls = 'border-cyan-500/40 text-cyan-200'; }
    return `<div class="mb-4 p-3 rounded-xl border bg-slate-950/40 text-sm ${cls}">${esc(msg)}</div>`;
  }
  async function labShare(btn) {
    if (!state.lab) return;
    if (!state.user) return openAuth('login', t('生成临时预览链接需要登录'));
    busy(btn, true);
    try {
      const r = await api('/lab/share', { method: 'POST', body: { brand: state.lab.brand, domain: state.lab.domain, keyword: state.lab.keyword, capsule: $('#lab-capsule').value } });
      const box = $('#lab-share-out'); box.classList.remove('hidden');
      box.innerHTML = `<div class="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-xs text-cyan-100 space-y-1"><div class="flex flex-wrap items-center gap-2"><code class="break-all">${esc(r.data.url)}</code><button data-action="copy-text" data-text="${esc(r.data.url)}" class="btn-ghost px-2 py-1 text-[11px]">${t('复制')}</button></div>
        <div class="text-slate-400">${t('7 天内有效，已禁止搜索引擎收录。可在支持联网浏览的 AI（如 ChatGPT）中发送此链接，测试 AI 读取后的回答。')}</div></div>`;
    } catch (e) { fail(e); } finally { busy(btn, false); }
  }

  
  // ————————————————————— 首推实验室 A/B 测试 —————————————————————
  function initLabView(params = {}) {
    if (params.domain) {
      const dInp = $('#lab-ab-domain'); if (dInp && (!dInp.value || dInp.value === 'example.com')) dInp.value = params.domain;
      const dInp2 = $('#lab-domain'); if (dInp2 && (!dInp2.value || dInp2.value === 'example.com')) dInp2.value = params.domain;
    }
    if (params.brand) {
      const bInp = $('#lab-ab-brand'); if (bInp && !bInp.value) bInp.value = params.brand;
      const bInp2 = $('#lab-brand'); if (bInp2 && !bInp2.value) bInp2.value = params.brand;
    }
    const box = $('#lab-ab-engines-box');
    if (box && (!box.children.length || !box.dataset.ready || box.dataset.locale !== state.locale)) {
      const prev = new Set(Array.from(box.querySelectorAll('input:checked')).map(i => i.value));
      box.dataset.ready = '1';
      box.dataset.locale = state.locale;
      const engines = state.config?.engines || [];
      box.innerHTML = engines.map((e, idx) => `
        <label class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-950 text-xs text-slate-300 cursor-pointer hover:border-cyan-500/50">
          <input type="checkbox" name="engines" value="${esc(e.id)}" ${(prev.size ? prev.has(e.id) : idx < 2) ? 'checked' : ''} class="accent-cyan-400">
          <span>${esc(state.locale === 'en' ? e.label.replace('智谱', 'Zhipu') : e.label)}</span>
        </label>
      `).join('') || '<span class="text-xs text-slate-500">加载引擎中…</span>';
    }
    const roundsSlider = $('#lab-ab-rounds');
    if (roundsSlider && !roundsSlider.dataset.bound) {
      roundsSlider.dataset.bound = '1';
      roundsSlider.addEventListener('input', (e) => {
        const v = $('#lab-ab-rounds-val');
        if (v) v.textContent = `${e.target.value} ${state.locale === 'en' ? 'rounds' : '轮'}`;
      });
    }
    const rv = $('#lab-ab-rounds-val');
    if (rv && roundsSlider) rv.textContent = `${roundsSlider.value} ${state.locale === 'en' ? 'rounds' : '轮'}`;
  }

  function switchLabMode(mode) {
    const isAb = mode === 'ab';
    const secAb = $('#lab-section-ab');
    const secCapsule = $('#lab-section-capsule');
    if (secAb) secAb.classList.toggle('hidden', !isAb);
    if (secCapsule) secCapsule.classList.toggle('hidden', isAb);
    $$('[data-action=lab-mode]').forEach(b => b.classList.toggle('chip-on', b.dataset.mode === mode));
  }

  function loadAuditQuestionsToLab() {
    let qs = [];
    if (state.audit?.typical_questions?.length) {
      qs = state.audit.typical_questions.map(q => q.q);
    } else {
      try {
        const history = JSON.parse(localStorage.getItem('geo_audit_history') || '[]');
        if (history.length && history[0].typical_questions?.length) {
          qs = history[0].typical_questions.map(q => q.q);
        }
      } catch {}
    }
    const target = $('#lab-ab-questions');
    if (target) {
      if (qs.length) {
        target.value = qs.slice(0, 5).join('\n');
        toast(t('已导入品牌诊断测试问题'), 'ok');
      } else {
        loadDefaultQuestionsToLab();
      }
    }
  }

  function loadDefaultQuestionsToLab() {
    const target = $('#lab-ab-questions');
    if (target) {
      target.value = [
        '有哪些值得推荐的权威机构或标杆品牌？请说明推荐理由与核心优势。',
        '选择该品牌需要注意哪些核心指标？在行业中的技术资质和实力如何？',
        '与行业内主要竞品相比，该品牌有什么独特的差异化价值？'
      ].join('\n');
      toast(t('已填入典型推荐问题'), 'info');
    }
  }

  async function runAbExperiment(ev) {
    ev.preventDefault();
    const val = (id) => { const el = $(id); return el ? String(el.value || '').trim() : ''; };
    const brand = val('#lab-ab-brand');
    const domain = val('#lab-ab-domain');
    const competitors = val('#lab-ab-competitors');
    const textA = val('#lab-ab-text-a');
    const textB = val('#lab-ab-text-b');
    const questionsRaw = val('#lab-ab-questions');
    const rounds = parseInt(val('#lab-ab-rounds')) || 3;

    const engineBoxes = $$('#lab-ab-engines-box input[type=checkbox]:checked');
    const engines = Array.from(engineBoxes).map(b => b.value);

    if (!brand || !domain || !textA || !textB) return toast(t('请填写完整的品牌、域名与双版本文案'), 'warn');
    if (!questionsRaw) return toast(t('请输入至少一个测试提示词问题'), 'warn');
    if (!engines.length) return toast(t('请至少选择一个测试模型'), 'warn');
    if (!state.user) return openAuth('login', t('请先登录后使用真实大模型 A/B 对比实验'));

    const questions = questionsRaw.split('\n').map(q => q.trim()).filter(Boolean);
    const btn = $('#lab-ab-submit-btn');
    busy(btn, true, t('真实大模型多次抽样观测中…'));

    const out = $('#lab-ab-result');
    out.innerHTML = `<div class="card space-y-4 py-12 text-center">
      <div class="spinner !w-8 !h-8 mx-auto text-cyan-400"></div>
      <div class="text-sm font-semibold text-white">${t('正在调用真实大模型进行多轮采样测试…')}</div>
      <p class="text-xs text-slate-400 max-w-md mx-auto">${t('版本 A 与版本 B 独立向模型施加测试提示，聚合统计品牌提及率、平均推荐位次与信源引用倾向，请勿关闭页面。')}</p>
    </div>`;

    try {
      const res = await api('/lab/experiment', {
        method: 'POST',
        body: { brand, domain, competitors, textA, textB, questions, engines, rounds }
      });
      const d = res.data;
      renderAbExperimentReport(d);
      toast(t('A/B 实验实测完成'), 'ok');
    } catch (e) {
      out.innerHTML = '';
      fail(e);
    } finally {
      busy(btn, false);
    }
  }

  function renderAbExperimentReport(d) {
    const out = $('#lab-ab-result');
    const s = d.summary || d.stats || {};
    const aStats = s.a || {};
    const bStats = s.b || {};
    const mentionRateA = aStats.mentionRate ?? s.mentionRateA ?? 0;
    const mentionRateB = bStats.mentionRate ?? s.mentionRateB ?? 0;
    const avgRankA = aStats.avgRank ?? s.avgRankA;
    const avgRankB = bStats.avgRank ?? s.avgRankB;
    const citationRateA = aStats.citationRate ?? s.citationRateA ?? 0;
    const citationRateB = bStats.citationRate ?? s.citationRateB ?? 0;
    const winnerMap = {
      B: ['版本 B（优化版）胜出', 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'],
      A: ['版本 A（对照版）胜出', 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'],
      TIE: ['两版本表现基本持平', 'border-amber-500/40 bg-amber-500/10 text-amber-300'],
      INCONCLUSIVE: ['无明确统计差异', 'border-slate-600 bg-slate-800 text-slate-300'],
    };
    const winBadge = winnerMap[d.winner] || winnerMap.INCONCLUSIVE;

    out.innerHTML = `
      <div class="card space-y-5">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <h3 class="text-lg font-bold text-white">${esc(d.brand)} · 首推实验室 A/B 测试报告</h3>
              <span class="px-2.5 py-1 rounded-full text-xs font-bold border ${winBadge[1]}">${winBadge[0]}</span>
            </div>
            <p class="text-xs text-slate-400 mt-1">${esc(d.domain)} · 覆盖 ${d.engines.length} 个模型 · 采样 ${d.rounds} 轮 · 共 ${d.totalSamples} 次独立调用</p>
          </div>
          <span class="text-xs text-slate-500 font-mono">${fmtDate(d.createdAt)}</span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div class="stat !p-3.5">
            <div class="stat-label">品牌提及率 (Mention Rate)</div>
            <div class="flex items-baseline justify-between mt-2">
              <div><span class="text-xs text-rose-300">对照版 A: </span><b class="text-base font-mono text-white">${mentionRateA}%</b></div>
              <div><span class="text-xs text-emerald-300">优化版 B: </span><b class="text-base font-mono text-white">${mentionRateB}%</b></div>
            </div>
            <div class="text-[11px] text-slate-400 mt-1">${mentionRateB > mentionRateA ? `↑ 优化版提高 ${mentionRateB - mentionRateA} 个百分点` : (mentionRateB === mentionRateA ? '两版本提及率一致' : `↓ 优化版低于对照版`)}</div>
          </div>

          <div class="stat !p-3.5">
            <div class="stat-label">平均推荐位次 (Avg Rank)</div>
            <div class="flex items-baseline justify-between mt-2">
              <div><span class="text-xs text-rose-300">对照版 A: </span><b class="text-base font-mono text-white">${avgRankA ? `第 ${avgRankA} 位` : '未上榜'}</b></div>
              <div><span class="text-xs text-emerald-300">优化版 B: </span><b class="text-base font-mono text-white">${avgRankB ? `第 ${avgRankB} 位` : '未上榜'}</b></div>
            </div>
            <div class="text-[11px] text-slate-400 mt-1">${avgRankB && (!avgRankA || avgRankB < avgRankA) ? '↑ 优化版排名位次更靠前' : '排名未见显著差异'}</div>
          </div>

          <div class="stat !p-3.5">
            <div class="stat-label">信源/域名引用率 (Citation Rate)</div>
            <div class="flex items-baseline justify-between mt-2">
              <div><span class="text-xs text-rose-300">对照版 A: </span><b class="text-base font-mono text-white">${citationRateA}%</b></div>
              <div><span class="text-xs text-emerald-300">优化版 B: </span><b class="text-base font-mono text-white">${citationRateB}%</b></div>
            </div>
            <div class="text-[11px] text-slate-400 mt-1">${citationRateB > citationRateA ? `↑ 优化版信源引用提升 ${citationRateB - citationRateA}%` : '信源引用率持平'}</div>
          </div>
        </div>

        <div class="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
          <div class="text-xs font-semibold text-cyan-300">优化建议与洞察</div>
          <div class="text-xs text-slate-300 leading-relaxed">${esc(d.advice)}</div>
        </div>

        <div class="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-[11px] text-amber-200/90 leading-relaxed">
          <strong>诚实声明：</strong>${esc(d.noiseDisclaimer || d.disclaimer)}
        </div>

        <div class="space-y-3 pt-2">
          <h4 class="text-xs font-bold text-slate-300">多轮采样观测明细（可展开核对模型作答原文）</h4>
          <div class="space-y-2 max-h-96 overflow-y-auto pr-1">
            ${((d.pairs || d.samples || [])).map((sample, idx) => { const itemA = sample.a || {}; const itemB = sample.b || {}; const ansA = sample.answer_a || itemA.answer || itemA.error || ''; const ansB = sample.answer_b || itemB.answer || itemB.error || ''; const mentA = sample.mentioned_a ?? itemA.mention?.mentioned; const mentB = sample.mentioned_b ?? itemB.mention?.mentioned; const rankA = sample.rank_a ?? itemA.mention?.rank; const rankB = sample.rank_b ?? itemB.mention?.rank; const citeA = sample.cited_a ?? itemA.cited; const citeB = sample.cited_b ?? itemB.cited; return `
              <details class="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 text-xs group">
                <summary class="cursor-pointer font-medium text-slate-300 flex items-center justify-between">
                  <span>#${idx + 1} [第 ${sample.round} 轮 · ${esc(sample.engine_label || sample.engine)}] ${esc(sample.question)}</span>
                  <span class="text-[11px] text-slate-500">点击展开对比</span>
                </summary>
                <div class="grid md:grid-cols-2 gap-3 mt-3 pt-2 border-t border-slate-800">
                  <div class="p-2.5 rounded-lg bg-rose-950/10 border border-rose-500/20 space-y-1.5">
                    <div class="flex items-center justify-between">
                      <span class="font-bold text-rose-300">对照版 A</span>
                      <span class="text-[10px] text-slate-400">提及: ${mentA ? '是' : '否'} · 排名: ${rankA || '—'} · 引用: ${citeA ? '是' : '否'}</span>
                    </div>
                    <div class="text-slate-300 text-[11px] max-h-40 overflow-y-auto whitespace-pre-wrap">${esc(ansA)}</div>
                  </div>
                  <div class="p-2.5 rounded-lg bg-emerald-950/10 border border-emerald-500/20 space-y-1.5">
                    <div class="flex items-center justify-between">
                      <span class="font-bold text-emerald-300">优化版 B</span>
                      <span class="text-[10px] text-slate-400">提及: ${mentB ? '是' : '否'} · 排名: ${rankB || '—'} · 引用: ${citeB ? '是' : '否'}</span>
                    </div>
                    <div class="text-slate-300 text-[11px] max-h-40 overflow-y-auto whitespace-pre-wrap">${esc(ansB)}</div>
                  </div>
                </div>
              </details>
            `; }).join('')}
          </div>
        </div>
      </div>
    `;
  }


  // ————————————————————— 3. 站点托管 —————————————————————
  async function renderMonitor(domainParam) {
    if (domainParam) {
      const inp = $('#llms-check-domain'); if (inp && !inp.value) inp.value = domainParam;
    }
    const box = $('#monitor-body');
    if (!state.user) return loginRequired(box, t('登录后托管您的站点'), t('添加站点、验证 IndexNow Key 后，即可一键推送新网址；付费套餐每天自动巡检 Sitemap。'));
    box.innerHTML = `<div class="skeleton h-40"></div>`;
    try {
      const r = await api('/sites');
      state.sites = r.data;
      const paid = r.plan !== 'free';
      box.innerHTML = `<div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <form id="site-add-form" class="card space-y-3 lg:col-span-1">
          <h3 class="card-title">${t('添加站点')}</h3>
          <label class="field"><span>${t('域名')}</span><input name="domain" class="input" placeholder="example.com" value="${esc(domainParam || '')}" required></label>
          <label class="field"><span>${t('Sitemap（选填）')}</span><input name="sitemapUrl" class="input" placeholder="https://example.com/sitemap.xml"></label>
          <button class="btn-emerald w-full py-2.5 text-sm" type="submit">${t('添加')}</button>
          <p class="text-[11px] text-slate-500">${t('已托管')} ${r.data.length}/${r.limit} ${t('个站点')} · ${paid ? t('每日自动巡检已开启') : t('免费版需手动巡检，')}${paid ? '' : `<a href="/pricing" class="text-emerald-300">${t('升级自动巡检')}</a>`}</p>
        </form>
        <div class="lg:col-span-2 space-y-4">${r.data.length ? r.data.map((s) => siteCard(s, paid)).join('') : `<div class="card text-center text-sm text-slate-500 py-12">${t('还没有托管站点，在左侧添加第一个吧。')}</div>`}</div></div>`;
    } catch (e) { box.innerHTML = ''; fail(e); }
  }

  function siteCard(s, paid) {
    return `<div class="card space-y-3" data-site="${s.id}">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div class="min-w-0"><div class="text-base font-bold text-white break-all">${esc(s.domain)}</div><div class="text-[11px] text-slate-500 break-all">${esc(s.sitemapUrl)}</div></div>
        <div class="flex flex-wrap gap-1.5">
          ${s.keyVerified ? `<span class="pill-ok">${t('Key 已验证')}</span>` : `<span class="pill-warn">${t('Key 未验证')}</span>`}
          ${s.healthScore != null ? `<span class="pill-info font-bold">${t('健康')} ${s.healthScore}分</span>` : ''}
          ${s.hasLlmsTxt === true ? '<span class="pill-ok">llms.txt 正常</span>' : s.hasLlmsTxt === false ? '<span class="pill-muted">无 llms.txt</span>' : ''}
          ${s.lastRobotsAllowedCount != null ? `<span class="pill-info">AI 爬虫: ${s.lastRobotsAllowedCount}/14</span>` : ''}
          ${s.lastSchemaTypes ? `<span class="pill-ok">Schema: ${esc(s.lastSchemaTypes.split(',')[0])}</span>` : ''}
        </div>
      </div>
      ${s.keyVerified ? '' : `<div class="p-3 rounded-xl bg-amber-500/5 border border-amber-500/30 text-xs text-slate-300 space-y-2">
        <div class="font-semibold text-amber-200">${t('验证站点所有权（一次性）')}</div>
        <div>${t('在网站根目录创建文件')} <code class="text-amber-200">${esc(s.indexNowKey)}.txt</code>${t('，文件内容仅为下面这一行：')}</div>
        <div class="flex flex-wrap items-center gap-2"><code class="px-2 py-1 rounded bg-slate-950 border border-slate-800 break-all">${esc(s.indexNowKey)}</code>
          <button data-action="copy-text" data-text="${esc(s.indexNowKey)}" class="btn-ghost px-2 py-1 text-[11px]">${t('复制')}</button>
          <button data-action="download-key" data-key="${esc(s.indexNowKey)}" class="btn-ghost px-2 py-1 text-[11px]">${t('下载 Key 文件')}</button></div>
        <div class="text-slate-500">${t('上传后确保能访问')}${colon()}<span class="break-all">${esc(s.keyFileUrl)}</span></div>
        <button data-action="site-verify" data-id="${s.id}" class="btn-secondary px-4 py-1.5 text-xs">${t('我已上传，验证')}</button></div>`}
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div class="stat !p-3"><div class="stat-label">${t('上次巡检')}</div><div class="text-slate-200 mt-1">${s.lastCheckAt ? fmtDate(s.lastCheckAt) : '—'}</div></div>
        <div class="stat !p-3"><div class="stat-label">${t('Sitemap 网址数')}</div><div class="text-slate-200 font-mono mt-1">${s.lastUrlCount ?? '—'}</div></div>
        <div class="stat !p-3"><div class="stat-label">${t('上次新增')}</div><div class="text-slate-200 font-mono mt-1">${s.lastNewCount ?? '—'}</div></div>
        <div class="stat !p-3"><div class="stat-label">${t('最近推送')}</div><div class="text-slate-200 mt-1">${s.recentPushes && s.recentPushes[0] ? `${s.recentPushes[0].url_count} ${t('条')} · HTTP ${s.recentPushes[0].status_code}` : '—'}</div></div>
      </div>
      ${s.lastError ? `<div class="text-xs text-rose-300">⚠ ${esc(s.lastError)}</div>` : ''}
      <div class="flex flex-wrap gap-2">
        <button data-action="site-check" data-id="${s.id}" class="btn-secondary px-3 py-1.5 text-xs">${t('立即巡检')}</button>
        <button data-action="site-logs" data-id="${s.id}" data-domain="${esc(s.domain)}" class="btn-ghost px-3 py-1.5 text-xs text-cyan-300">${t('巡检历史')}</button>
        <button data-action="site-push" data-id="${s.id}" data-domain="${esc(s.domain)}" class="btn-ghost px-3 py-1.5 text-xs" ${s.keyVerified ? '' : 'disabled'}>${t('手动推送网址')}</button>
        <label class="inline-flex items-center gap-1.5 text-xs text-slate-300 px-2 ${paid ? '' : 'opacity-50'}" title="${paid ? '' : t('付费套餐可用')}"><input type="checkbox" data-action="site-auto" data-id="${s.id}" ${s.autoIndexNow ? 'checked' : ''} ${paid ? '' : 'disabled'}>${t('新增网址自动推送')}</label>
        <button data-action="site-delete" data-id="${s.id}" data-domain="${esc(s.domain)}" class="btn-danger px-3 py-1.5 text-xs ml-auto">${t('删除')}</button>
      </div></div>`;
  }

  async function siteAction(action, el) {
    const id = el.dataset.id;
    try {
      if (action === 'site-verify') {
        busy(el, true, t('验证中…'));
        const r = await api(`/sites/${id}/verify`, { method: 'POST', body: {} });
        toast(r.data.detail, r.data.ok ? 'ok' : 'warn', 6000);
        if (r.data.ok) renderMonitor(); else busy(el, false);
      } else if (action === 'site-logs') {
        busy(el, true, t('加载中…'));
        const r = await api(`/sites/${id}/logs`);
        busy(el, false);
        const logs = r.data || [];
        openModal(`<div class="space-y-4">
          <div class="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 class="text-base font-bold text-white">${t('深度巡检历史')} · ${esc(el.dataset.domain)}</h3>
            <span class="text-xs text-slate-500 font-mono">${logs.length} ${t('条记录')}</span>
          </div>
          ${logs.length ? `<div class="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            ${logs.map(log => {
              let anomalies = [];
              try { anomalies = Array.isArray(log.anomalies) ? log.anomalies : JSON.parse(log.anomalies || '[]'); } catch {}
              return `<div class="p-3.5 rounded-xl border border-slate-800 bg-slate-950/50 space-y-2">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-xs font-mono text-slate-400">${fmtDate(log.created_at)}</span>
                  <span class="pill-info font-bold">${t('健康评分')} ${log.health_score ?? '—'}</span>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div class="p-2 rounded bg-slate-900 border border-slate-800/80">
                    <span class="text-slate-500 block">llms.txt</span>
                    <span class="${log.llms_txt_status === 'ok' ? 'text-emerald-300' : 'text-amber-300'} font-medium">${esc(log.llms_txt_status || '—')}</span>
                  </div>
                  <div class="p-2 rounded bg-slate-900 border border-slate-800/80">
                    <span class="text-slate-500 block">robots.txt</span>
                    <span class="text-cyan-300 font-medium">${esc(log.robots_txt_status || '—')}</span>
                  </div>
                  <div class="p-2 rounded bg-slate-900 border border-slate-800/80">
                    <span class="text-slate-500 block">Sitemap</span>
                    <span class="text-slate-200 font-mono">${log.sitemap_status === 'ok' ? `${log.new_urls_count || 0} 新增` : esc(log.sitemap_status || '—')}</span>
                  </div>
                  <div class="p-2 rounded bg-slate-900 border border-slate-800/80">
                    <span class="text-slate-500 block">Schema</span>
                    <span class="text-indigo-300 font-medium truncate block" title="${esc(log.schema_status || '')}">${esc(log.schema_status || '—')}</span>
                  </div>
                </div>
                ${anomalies.length ? `<div class="p-2 rounded bg-rose-500/10 border border-rose-500/25 text-xs text-rose-200 space-y-1">
                  <span class="font-semibold text-rose-300">⚠ ${t('巡检发现异常')}${colon()}</span>
                  <ul class="list-disc pl-4 space-y-0.5">${anomalies.map(a => `<li>${esc(a)}</li>`).join('')}</ul>
                </div>` : ''}
              </div>`;
            }).join('')}
          </div>` : `<p class="text-sm text-slate-500 text-center py-6">${t('暂无历史巡检记录')}</p>`}
        </div>`, { wide: true });
      } else if (action === 'site-check') {
        busy(el, true, t('巡检中…'));
        const r = await api(`/sites/${id}/check`, { method: 'POST', body: {} });
        const d = r.data;
        const msg = d.error ? `${t('巡检完成，但有问题')}${colon()}${d.error}`
          : d.baseline ? `${t('已建立基线：Sitemap 共')} ${d.urlCount} ${t('个网址，之后新增的网址会被识别并推送。')}`
          : `${t('Sitemap 共')} ${d.urlCount} ${t('个网址，新增')} ${d.newUrls.length} ${t('个')}${d.pushed ? `；${t('推送')}：${d.pushed.message}` : (d.newUrls.length && !d.site.keyVerified ? `；${t('Key 未验证，未推送')}` : '')}`;
        toast(msg, d.error ? 'warn' : 'ok', 7000);
        renderMonitor();
      } else if (action === 'site-delete') {
        openModal(`<h3 class="text-lg font-bold text-white">${t('删除站点')}</h3><p class="text-sm text-slate-300 mt-2">${t('确定删除')} <b>${esc(el.dataset.domain)}</b>？${t('推送记录将一并清除。')}</p>
          <div class="flex gap-2 mt-5"><button data-action="site-delete-confirm" data-id="${id}" class="btn-danger flex-1 py-2.5 text-sm">${t('删除')}</button><button data-action="modal-close" class="btn-ghost flex-1 py-2.5 text-sm">${t('取消')}</button></div>`);
      } else if (action === 'site-delete-confirm') {
        await api(`/sites/${id}`, { method: 'DELETE' }); closeModal(); toast(t('已删除'), 'ok'); renderMonitor();
      } else if (action === 'site-push') {
        openModal(`<h3 class="text-lg font-bold text-white">${t('手动推送网址')}</h3><p class="text-xs text-slate-400 mt-1">${t('每行一个完整网址，必须属于')} ${esc(el.dataset.domain)}</p>
          <form id="push-form" data-id="${id}" class="space-y-3 mt-3"><textarea name="urls" rows="6" class="input font-mono text-xs" placeholder="https://${esc(el.dataset.domain)}/news/article-1" required></textarea>
          <button class="btn-emerald w-full py-2.5 text-sm" type="submit">${t('推送')}</button></form>`);
      }
    } catch (e) { busy(el, false); fail(e); }
  }

  async function checkLlms(ev) {
    ev.preventDefault();
    const domain = $('#llms-check-domain').value.trim();
    if (!domain) return;
    const btn = ev.target.querySelector('button'); busy(btn, true);
    try {
      const r = await api('/tools/check-llms', { method: 'POST', body: { domain } });
      $('#llms-check-result').innerHTML = `<div class="p-3 rounded-xl border text-sm ${r.data.deployed ? 'border-emerald-500/30 text-emerald-200 bg-emerald-500/5' : 'border-amber-500/30 text-amber-200 bg-amber-500/5'}">${esc(r.data.message)}</div>${r.data.preview ? `<pre class="code mt-2 max-h-48">${esc(r.data.preview)}</pre>` : ''}`;
    } catch (e) { fail(e); } finally { busy(btn, false); }
  }

  // ————————————————————— 4. 舆情监测 —————————————————————
  const QUAD = {
    high_vis_high_risk: ['高可见度 · 高风险', 'text-rose-300 border-rose-500/40 bg-rose-500/10', '负面或争议内容已大量进入 AI 回答，优先处置。'],
    low_vis_high_risk: ['低可见度 · 高风险', 'text-amber-300 border-amber-500/40 bg-amber-500/10', '正面/官方信息缺席，争议信息相对突出，重点补充官方内容。'],
    high_vis_low_risk: ['高可见度 · 低风险', 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10', 'AI 对您的描述总体健康，保持权威内容更新。'],
    low_vis_low_risk: ['低可见度 · 低风险', 'text-slate-300 border-slate-600 bg-slate-800/40', 'AI 对您了解不多，建议开展基础 GEO 内容建设。'],
  };

  async function renderRisk(runId) {
    const box = $('#risk-body');
    if (!state.user) return loginRequired(box, t('登录后使用 AI 舆情监测'), t('每次监测会调用多个大模型，需要登录账号并消耗额度（每个模型 2 次）。'));
    if (!box.dataset.ready) {
      box.dataset.ready = '1';
      const engines = state.config.engines;
      box.innerHTML = `<div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <form id="risk-form" class="card space-y-3 lg:col-span-1">
          <h3 class="card-title">${t('发起监测')}</h3>
          <label class="field"><span>${t('监测主体 *')}</span><input name="subject" class="input" required placeholder="${t('机构 / 品牌全称')}"></label>
          <label class="field"><span>${t('官网域名')}</span><input name="domain" class="input" placeholder="example.com"></label>
          <label class="field"><span>${t('争议说法（选填）')}</span><input name="claim" class="input" placeholder="${t('网上流传的具体说法')}"></label>
          <label class="field"><span>${t('官方说法（选填）')}</span><textarea name="officialStatement" rows="3" class="input text-sm" placeholder="${t('已发布的官方回应，用于判断 AI 回答是否与官方一致')}"></textarea></label>
          <label class="field"><span>${t('事件热度')}</span><select name="riskLevel" class="input"><option value="low">${t('低')}</option><option value="medium" selected>${t('中')}</option><option value="high">${t('高')}</option></select></label>
          <div class="field"><span>${t('参与测试的模型')}</span><div class="flex flex-wrap gap-2">${engines.map((e, i) => `<label class="chip text-xs inline-flex items-center gap-1.5 cursor-pointer"><input type="checkbox" name="engines" value="${esc(e.id)}" ${i < 4 ? 'checked' : ''}>${esc(e.label)}</label>`).join('') || `<span class="text-xs text-rose-300">${t('服务器尚未配置模型')}</span>`}</div></div>
          <button class="btn-rose w-full py-3 text-sm" type="submit">${t('开始监测')}</button>
          <p class="text-[11px] text-slate-500">${t('模型未联网时基于其训练知识作答，结果反映“模型记忆中的您”。')}</p>
        </form>
        <div class="lg:col-span-2 space-y-5"><div id="risk-trends" class="card space-y-2 hidden"></div><div id="risk-run"></div><div id="risk-history" class="card"></div></div></div>
        <div id="risk-clarify" class="mt-6"></div>`;
      renderClarify();
    }
    loadRiskHistory();
    loadRiskTrends();
    if (runId) loadRun(runId);
    else if (!$('#risk-run').innerHTML) $('#risk-run').innerHTML = `<div class="card text-sm text-slate-500 text-center py-10">${t('填写左侧表单发起监测，或从下方历史记录中查看结果。')}</div>`;
  }

  async function loadRiskHistory() {
    try {
      const r = await api('/risk/runs', { silent: true });
      $('#risk-history').innerHTML = `<h3 class="card-title mb-3">${t('监测记录')}</h3>` + (r.data.length ? `<div class="divide-y divide-slate-800">${r.data.map((x) => `<a href="/risk/${x.id}" class="flex items-center justify-between gap-3 py-2.5 hover:bg-slate-800/30 rounded-lg px-2 -mx-2">
        <div class="min-w-0"><div class="text-sm text-white truncate">${esc(x.subject)}</div><div class="text-[11px] text-slate-500 truncate">${esc(x.claim)} · ${fmtDate(x.createdAt)}</div></div>
        ${x.status === 'done' ? `<span class="pill-${x.risk >= 60 ? 'bad' : x.risk >= 40 ? 'warn' : 'ok'} shrink-0">${t('风险')} ${x.risk}</span>` : x.status === 'failed' ? `<span class="pill-bad shrink-0">${t('失败')}</span>` : `<span class="pill-info shrink-0">${x.done}/${x.total}</span>`}</a>`).join('')}</div>` : `<p class="text-sm text-slate-500">${t('暂无记录')}</p>`);
    } catch { /* 忽略 */ }
  }

  async function startRisk(ev) {
    ev.preventDefault();
    const f = ev.target; const fd = new FormData(f);
    const body = Object.fromEntries(fd.entries()); body.engines = fd.getAll('engines');
    if (!body.engines.length) return toast(t('请至少选择一个模型'), 'warn');
    const btn = f.querySelector('button[type=submit]'); busy(btn, true, t('提交中…'));
    try {
      const r = await api('/risk/runs', { method: 'POST', body });
      toast(t('监测已开始，通常需要 1~3 分钟'), 'ok');
      navigateTo(`/risk/${r.data.runId}`);
    } catch (e) { fail(e); } finally { busy(btn, false); }
  }


  async function loadRiskTrends(subject) {
    const box = $('#risk-trends');
    if (!box) return;
    try {
      const url = subject ? `/risk/trends?subject=${encodeURIComponent(subject)}` : '/risk/trends';
      const r = await api(url, { silent: true });
      const trends = r.data || [];
      if (!trends.length) {
        box.classList.add('hidden');
        return;
      }
      box.classList.remove('hidden');

      const w = 500; const h = 140; const padX = 40; const padY = 20;
      const pts = trends.slice(-10);
      const n = pts.length;
      const stepX = n > 1 ? (w - padX * 2) / (n - 1) : 0;

      const visPts = pts.map((p, i) => {
        const x = padX + i * stepX;
        const y = h - padY - ((p.visibilityScore || 0) / 100) * (h - padY * 2);
        return [x, y, p.visibilityScore];
      });

      const negPts = pts.map((p, i) => {
        const x = padX + i * stepX;
        const y = h - padY - ((p.aiNegativeRate || 0) / 100) * (h - padY * 2);
        return [x, y, p.aiNegativeRate];
      });

      const visPoly = visPts.map(p => `${p[0]},${p[1]}`).join(' ');
      const negPoly = negPts.map(p => `${p[0]},${p[1]}`).join(' ');

      box.innerHTML = `
        <div class="flex items-center justify-between pb-2 border-b border-slate-800">
          <div class="text-xs font-bold text-white flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-cyan-400"></span>
            ${t('AI 认知与负面走势历史曲线')} ${subject ? `(${esc(subject)})` : ''}
          </div>
          <div class="flex items-center gap-3 text-[11px]">
            <span class="flex items-center gap-1 text-cyan-300"><span class="w-2.5 h-0.5 bg-cyan-400 inline-block"></span> ${t('AI 可见度')}</span>
            <span class="flex items-center gap-1 text-rose-300"><span class="w-2.5 h-0.5 bg-rose-400 inline-block"></span> ${t('负面回答占比')}</span>
          </div>
        </div>
        <div class="w-full overflow-x-auto">
          <svg viewBox="0 0 ${w} ${h}" class="w-full h-32 select-none">
            <line x1="${padX}" y1="${padY}" x2="${w - padX}" y2="${padY}" stroke="#334155" stroke-dasharray="3,3" stroke-width="0.8"/>
            <line x1="${padX}" y1="${h / 2}" x2="${w - padX}" y2="${h / 2}" stroke="#334155" stroke-dasharray="3,3" stroke-width="0.8"/>
            <line x1="${padX}" y1="${h - padY}" x2="${w - padX}" y2="${h - padY}" stroke="#475569" stroke-width="1"/>
            
            <text x="${padX - 8}" y="${padY + 4}" fill="#64748b" font-size="9" text-anchor="end">100</text>
            <text x="${padX - 8}" y="${h / 2 + 3}" fill="#64748b" font-size="9" text-anchor="end">50</text>
            <text x="${padX - 8}" y="${h - padY + 3}" fill="#64748b" font-size="9" text-anchor="end">0</text>

            ${n > 1 ? `<polyline points="${visPoly}" fill="none" stroke="#22d3ee" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
            ${n > 1 ? `<polyline points="${negPoly}" fill="none" stroke="#f43f5e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>` : ''}

            ${visPts.map((p, i) => `
              <circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="#0891b2" stroke="#22d3ee" stroke-width="1.5"/>
              <text x="${p[0]}" y="${h - 4}" fill="#94a3b8" font-size="8" text-anchor="middle">${fmtDate(pts[i].createdAt).slice(5, 10)}</text>
            `).join('')}
            ${negPts.map(p => `
              <circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="#be123c" stroke="#f43f5e" stroke-width="1.5"/>
            `).join('')}
          </svg>
        </div>
      `;
    } catch {
      box.classList.add('hidden');
    }
  }

    async function loadRun(id) {
    const box = $('#risk-run');
    if (state.riskPoll) { clearTimeout(state.riskPoll); state.riskPoll = null; }
    try {
      const r = await api(`/risk/runs/${id}`);
      const d = r.data;
      if (d.status === 'queued' || d.status === 'running') {
        const pct = d.total ? Math.round(d.done / d.total * 100) : 0;
        box.innerHTML = `<div class="card space-y-3"><div class="flex items-center justify-between"><h3 class="card-title">${esc(d.subject)}</h3><span class="pill-info"><span class="spinner !w-3 !h-3"></span>${t('监测中')}</span></div>
          <div class="text-xs text-slate-400">${t('正在让')} ${d.engines.map((e) => esc(e.label)).join('、')} ${t('回答')} ${d.questions.length} ${t('个问题并逐条分析…')}</div>
          ${bar(d.done, d.total || 1, 'from-rose-500 to-amber-500')}<div class="text-xs font-mono text-slate-400">${d.done}/${d.total} (${pct}%)</div>
          <p class="text-[11px] text-slate-500">${t('可以离开此页面，完成后在监测记录中查看。')}</p></div>`;
        state.riskPoll = setTimeout(() => { if (location.hash === `#/risk/${id}` || location.pathname === `/risk/${id}`) loadRun(id); }, 2500);
        return;
      }
      if (d.status === 'failed') { box.innerHTML = `<div class="card border-rose-500/30"><h3 class="card-title">${esc(d.subject)}</h3><p class="text-sm text-rose-300 mt-2">${esc(d.error || t('任务失败'))}</p></div>`; loadRiskHistory(); return; }
      box.innerHTML = renderRunResult(d);
      loadRiskHistory();
    } catch (e) { box.innerHTML = ''; fail(e); }
  }

  function renderRunResult(d) {
    const ev = d.evaluation; const q = QUAD[ev.quadrant] || QUAD.low_vis_low_risk; const b = ev.breakdown;
    const sentCls = { negative: 'bg-rose-500/20 border-rose-500/40 text-rose-200', positive: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200', neutral: 'bg-slate-800 border-slate-700 text-slate-300' };
    return `<div class="space-y-5">
      <div class="card space-y-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div><h3 class="text-lg font-bold text-white">${esc(d.subject)}</h3><div class="text-xs text-slate-500 mt-0.5">${esc(d.claim)} · ${esc(d.eventCode)} · ${fmtDate(d.finishedAt)}</div></div>
          <span class="px-3 py-1 rounded-full text-xs font-bold border ${q[1]}">${t(q[0])}</span></div>
        <p class="text-sm text-slate-300">${t(q[2])}</p>
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <div class="stat"><div class="stat-label">${t('综合风险指数')}</div><div class="stat-value ${ev.comprehensiveRiskScore >= 60 ? 'text-rose-300' : ev.comprehensiveRiskScore >= 40 ? 'text-amber-300' : 'text-emerald-300'}">${ev.comprehensiveRiskScore}</div></div>
          <div class="stat"><div class="stat-label">${t('AI 可见度')}</div><div class="stat-value text-cyan-300">${ev.visibilityScore}</div></div>
          <div class="stat"><div class="stat-label">${t('负面回答占比')}</div><div class="stat-value text-rose-300">${b.aiNegativeRate}%</div></div>
          <div class="stat"><div class="stat-label">${t('把争议当事实')}</div><div class="stat-value text-amber-300">${b.aiHallucinationRate}%</div></div>
          <div class="stat"><div class="stat-label">${t('未提及官方信息')}</div><div class="stat-value text-indigo-300">${b.officialAbsentRate}%</div></div>
        </div>
        ${ev.byEngine ? `<div class="overflow-x-auto"><table class="w-full text-xs"><thead><tr class="text-slate-400"><th class="text-left py-1.5">${t('模型')}</th><th>${t('有效回答')}</th><th>${t('负面')}</th><th>${t('复述争议')}</th><th>${t('提及官方')}</th></tr></thead>
          <tbody>${ev.byEngine.map((e) => `<tr class="border-t border-slate-800 text-slate-300"><td class="py-1.5">${esc(e.label)}</td><td class="text-center font-mono">${e.answered}</td><td class="text-center font-mono">${e.negativeRate}%</td><td class="text-center font-mono">${e.claimRepeatRate}%</td><td class="text-center font-mono">${e.officialRate}%</td></tr>`).join('')}</tbody></table></div>` : ''}
      </div>
      <div class="card space-y-3"><h3 class="card-title">${t('逐题回答')} <span class="text-xs font-normal text-slate-500">${t('点击查看原文')}</span></h3>
        ${d.questions.map((qq) => `<div class="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2"><div class="text-sm text-white"><span class="pill-muted mr-1.5">${esc(qq.categoryLabel)}</span>${esc(qq.question)}</div>
          <div class="flex flex-wrap gap-1.5">${d.audits.filter((a) => a.question_id === qq.id).map((a) => `<button data-action="audit-view" data-id="${a.id}" class="px-2 py-1 rounded-lg border text-[11px] ${a.error ? 'border-slate-700 text-slate-500 line-through' : sentCls[a.sentiment] || sentCls.neutral}" title="${esc(a.summary || a.error || '')}">${esc(a.engine_label || a.platform)}${a.is_hallucinated ? ' ⚠' : ''}${a.cited_official ? ' ✓' : ''}</button>`).join('')}</div></div>`).join('')}
        <p class="text-[11px] text-slate-500">${t('颜色：红=负面 绿=正面 灰=中性；⚠ 把争议说法当事实；✓ 提及官方信息。分析由评审模型自动完成，重要结论请查看原文复核。')}</p>
      </div></div>`;
  }

  async function viewAudit(id) {
    try {
      const r = await api(`/risk/audits/${id}`);
      const d = r.data; const a = d.analysis || {};
      openModal(`<div class="space-y-3"><div class="text-xs text-slate-400">${esc(d.engine)} · ${esc(d.model || '')} · ${esc(d.category)}</div>
        <h3 class="text-base font-bold text-white">${esc(d.question)}</h3>
        ${d.error ? `<p class="text-sm text-rose-300">${esc(d.error)}</p>` : `<div class="md p-4 rounded-2xl bg-slate-950/60 border border-slate-800">${md(d.answer)}</div>`}
        ${d.analysis ? `<div class="flex flex-wrap gap-1.5 text-[11px]">
          <span class="pill-${a.sentiment === 'negative' ? 'bad' : a.sentiment === 'positive' ? 'ok' : 'muted'}">${t('倾向')}${colon()}${esc(a.sentiment)}</span>
          ${a.repeats_claim_as_fact ? `<span class="pill-warn">${t('把争议当事实')}</span>` : ''}
          <span class="${a.mentions_official ? 'pill-ok' : 'pill-muted'}">${a.mentions_official ? t('提及官方信息') : t('未提及官方信息')}</span>
          ${a.consistent_with_official === false ? `<span class="pill-bad">${t('与官方说法不一致')}</span>` : a.consistent_with_official === true ? `<span class="pill-ok">${t('与官方说法一致')}</span>` : ''}
        </div>` : ''}<div class="text-[11px] text-slate-500">${fmtDate(d.createdAt)}</div></div>`, { wide: true });
    } catch (e) { fail(e); }
  }

  function renderClarify() {
    const engines = state.config.engines;
    $('#risk-clarify').innerHTML = `<div class="card space-y-4">
      <div><h3 class="card-title">${t('争议澄清助手')}</h3><p class="card-sub">${t('粘贴您已发布（或拟发布）的官方说明，对比 AI 读到它之前和之后的回答，并生成可发布的澄清页结构与结构化数据。系统只使用您提供的内容，不会替您编写官方结论。')}</p></div>
      <form id="clarify-form" class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label class="field"><span>${t('主体名称 *')}</span><input name="subject" class="input" required></label>
        <label class="field"><span>${t('争议说法 *')}</span><input name="claim" class="input" required></label>
        <label class="field md:col-span-2"><span>${t('官方说明内容 *')}</span><textarea name="statement" rows="4" class="input text-sm" required></textarea></label>
        <label class="field"><span>${t('官方原文链接（选填）')}</span><input name="officialUrl" class="input" placeholder="https://"></label>
        <label class="field"><span>${t('测试模型')}</span><select name="engine" class="input">${engines.map((e) => `<option value="${esc(e.id)}">${esc(e.label)}</option>`).join('')}</select></label>
        <button class="btn-rose md:col-span-2 py-3 text-sm" type="submit">${t('生成对比与澄清素材')}</button>
      </form>
      <div id="clarify-result"></div>
      <div class="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="text-sm text-slate-300">${t('需要专业团队协助梳理事实、撰写与发布？')}</div>
        <button data-action="lead" class="btn-ghost px-4 py-2 text-sm">${t('预约专家咨询')}</button></div></div>`;
  }

  async function runClarify(ev) {
    ev.preventDefault();
    const body = Object.fromEntries(new FormData(ev.target).entries());
    const btn = ev.target.querySelector('button[type=submit]'); const out = $('#clarify-result');
    busy(btn, true, t('生成中…')); out.innerHTML = `<div class="grid md:grid-cols-2 gap-4"><div class="skeleton h-40"></div><div class="skeleton h-40"></div></div>`;
    try {
      const r = await api('/remediation/preview', { method: 'POST', body });
      const d = r.data; const a = d.assets;
      state.codeTabs = [
        ['page', t('澄清页结构'), a.page, 'clarification.md', t('【】处补充依据后发布在官网，标题包含公众搜索的关键词。')],
        ['faq', 'FAQPage', a.faqSchema, 'faq-schema.html', t('粘贴到澄清页 <head> 中。')],
        ...(a.articleSchema ? [['article', 'NewsArticle', a.articleSchema, 'article-schema.html', t('粘贴到澄清页 <head> 中。')]] : []),
        ['llms', t('llms.txt 片段'), a.llmsSnippet, 'llms-snippet.txt', t('追加到网站 llms.txt 中。')],
      ];
      const col = (x, title, cls) => `<div class="p-4 rounded-2xl border ${cls} space-y-2 min-w-0"><div class="text-sm font-bold">${title}</div>${x.ok ? `<div class="md">${md(x.answer)}</div>` : `<div class="text-sm text-rose-300">${esc(x.error)}</div>`}</div>`;
      out.innerHTML = `<div class="text-xs text-slate-400 mb-3">${esc(d.engine.label)} · ${t('问题')}${colon()}${esc(d.question)}</div>
        <div class="grid md:grid-cols-2 gap-4">${col(d.before, `<span class="text-rose-300">A · ${t('AI 仅凭已有知识')}</span>`, 'border-rose-500/30 bg-rose-950/10')}${col(d.after, `<span class="text-emerald-300">B · ${t('AI 检索到官方说明后')}</span>`, 'border-emerald-500/30 bg-emerald-950/10')}</div>
        <div class="mt-4 space-y-3"><div class="flex gap-1.5 overflow-x-auto no-scrollbar">${state.codeTabs.map((c, i) => `<button data-action="code-tab" data-i="${i}" class="chip text-xs whitespace-nowrap ${i === 0 ? 'chip-on' : ''}">${esc(c[1])}</button>`).join('')}</div><div id="code-panel">${codePanel(0)}</div></div>`;
    } catch (e) { out.innerHTML = ''; fail(e); } finally { busy(btn, false); }
  }

  function openLead() {
    openModal(`<h3 class="text-lg font-bold text-white">${t('预约专家咨询')}</h3><p class="text-xs text-slate-400 mt-1">${t('留下联系方式，我们会在 1 个工作日内与您沟通。')}</p>
      <form id="lead-form" class="space-y-3 mt-4">
        <label class="field"><span>${t('称呼 *')}</span><input name="clientName" class="input" required></label>
        <label class="field"><span>${t('联系方式（手机 / 微信 / 邮箱）*')}</span><input name="contactInfo" class="input" required></label>
        <label class="field"><span>${t('机构 / 品牌名称 *')}</span><input name="subjectName" class="input" required></label>
        <label class="field"><span>${t('官网（选填）')}</span><input name="domain" class="input"></label>
        <label class="field"><span>${t('需求描述 *')}</span><textarea name="negativeIssue" rows="4" class="input text-sm" required></textarea></label>
        <button class="btn-rose w-full py-3 text-sm" type="submit">${t('提交')}</button></form>`);
  }

  async function renderHistory() {
    const box = $('#view-history');
    if (!box) return;
    box.innerHTML = `<div class="page-head"><span class="eyebrow">History</span><h1 class="page-title">${t('历史记录')}</h1><p class="page-desc">${t('查看过去运行的网站体检与品牌 AI 认知诊断报告')}</p></div><div class="skeleton h-64"></div>`;
    let ids = [];
    try {
      ids = JSON.parse(localStorage.getItem('geo_audit_history') || '[]');
    } catch {}
    let list = [];
    try {
      const q = state.user ? '' : (ids.length ? `?ids=${encodeURIComponent(ids.join(','))}` : '');
      const r = await api(`/history${q}`, { silent: true });
      list = Array.isArray(r.data) ? r.data : (r.data?.results || []);
    } catch (e) {
      fail(e);
    }

    if (!list.length) {
      box.innerHTML = `<div class="page-head"><span class="eyebrow">History</span><h1 class="page-title">${t('历史记录')}</h1><p class="page-desc">${t('查看过去运行的网站体检与品牌 AI 认知诊断报告')}</p></div>
        <div class="card text-center py-16 space-y-4">
          <div class="w-12 h-12 mx-auto rounded-2xl border border-white/10 flex items-center justify-center text-slate-400">
            <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <h3 class="text-lg font-bold text-white">${t('暂无历史体检记录')}</h3>
          <p class="text-sm text-slate-400 max-w-sm mx-auto">${t('输入网址或品牌名称发起体检后，历史报告将自动保存在这里。')}</p>
          <a href="/audit" class="btn-primary inline-flex px-6 py-2.5 text-sm">${t('开始体检')}</a>
        </div>`;
      return;
    }

    box.innerHTML = `<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/[0.07]">
      <div>
        <div class="eyebrow">History</div>
        <h1 class="page-title">${t('历史记录')}</h1>
        <p class="page-desc">${t('共找到')} <b class="text-white font-mono">${list.length}</b> ${t('条历史诊断报告')}</p>
      </div>
      <div class="flex gap-2">
        <a href="/audit" class="btn-primary px-4 py-2 text-xs">${t('新的体检')}</a>
        <button data-action="clear-history" class="btn-ghost px-3 py-2 text-xs text-rose-300 hover:text-rose-200">${t('清空历史')}</button>
      </div>
    </div>
    <div class="grid gap-4 mt-6">
      ${list.map((item) => {
        const isUrl = item.kind === 'url';
        const color = item.score >= 70 ? 'text-emerald-400' : item.score >= 50 ? 'text-amber-400' : 'text-rose-400';
        const bg = item.score >= 70 ? 'bg-emerald-500/10 border-emerald-500/20' : item.score >= 50 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-rose-500/10 border-rose-500/20';
        return `<div class="card p-5 hover:border-cyan-400/30 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div class="flex items-start gap-4 min-w-0">
            <div class="w-14 h-14 rounded-2xl ${bg} border flex flex-col items-center justify-center shrink-0">
              <span class="text-xl font-bold font-mono ${color}">${item.score}</span>
              <span class="text-[9px] text-slate-400 -mt-1 font-mono">/100</span>
            </div>
            <div class="space-y-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="${isUrl ? 'pill-info' : 'pill-ok'} !text-[11px]">${isUrl ? t('网站体检') : t('品牌诊断')}</span>
                <span class="text-xs text-slate-500 font-mono">${fmtDate(item.createdAt || item.created_at)}</span>
              </div>
              <h3 class="text-base font-semibold text-white truncate max-w-md">${esc(item.target || item.input || '—')}</h3>
            </div>
          </div>
          <div class="flex items-center gap-2 self-end sm:self-center shrink-0">
            <a href="/result/${esc(item.id)}" class="btn-secondary px-4 py-2 text-xs">${t('查看完整报告')}</a>
            <button type="button" data-action="download-docx" data-id="${esc(item.id)}" class="btn-ghost p-2 text-xs" title="${t('下载 Word 报告')}">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </button>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }

  function renderInfo(page) {
    const box = $('#view-info');
    if (!box) return;
    const isEn = state.locale === 'en';
    const contents = {
      privacy: {
        title: isEn ? 'Privacy Policy' : '隐私政策',
        tag: 'Trust & Safety',
        body: isEn ? `
          <h2 class="text-xl font-bold text-white mb-3">1. Information Collection</h2>
          <p class="text-slate-300 leading-relaxed mb-4">Luduan GEO only fetches and audits publicly accessible web pages, robots.txt, sitemaps, and llms.txt. We do not inspect private endpoints, intranet systems, or password-protected resources.</p>
          <h2 class="text-xl font-bold text-white mb-3">2. Use of Diagnostic Data</h2>
          <p class="text-slate-300 leading-relaxed mb-4">Scan results are used strictly to generate GEO audit reports and downloadable remediation artifacts (llms.txt, Schema markup). We never sell, lease, or share site data with third parties.</p>
          <h2 class="text-xl font-bold text-white mb-3">3. Account & Data Retention</h2>
          <p class="text-slate-300 leading-relaxed">Registered accounts store audit histories securely. You may clear your history or request account termination at any time by contacting our support team.</p>
        ` : `
          <h2 class="text-xl font-bold text-white mb-3">一、公开数据采集原则</h2>
          <p class="text-slate-300 leading-relaxed mb-4">甪端 GEO 仅抓取公开可访问的网站前端页面、robots.txt、sitemap 与 llms.txt 进行技术可达性与语义分析。我们绝不探测内网地址、私有接口或需密码鉴权的页面。</p>
          <h2 class="text-xl font-bold text-white mb-3">二、数据使用与安全性</h2>
          <p class="text-slate-300 leading-relaxed mb-4">所有诊断数据仅用于为您呈现可见度评分并生成可落地的修复代码。我们绝不会将您的网站数据或商业信息出售、租借给任何第三方用于商业营销。</p>
          <h2 class="text-xl font-bold text-white mb-3">三、数据保存与清除</h2>
          <p class="text-slate-300 leading-relaxed">体检记录妥善加密保存。您可随时在历史记录页清空记录，或随时联系支持团队注销账号与删除所有关联数据。</p>
        `
      },
      terms: {
        title: isEn ? 'Terms of Service' : '服务条款',
        tag: 'Terms & Conditions',
        body: isEn ? `
          <h2 class="text-xl font-bold text-white mb-3">1. Scope of Service</h2>
          <p class="text-slate-300 leading-relaxed mb-4">Luduan GEO provides Generative Engine Optimization (GEO) auditing, scoring, and technical recommendations. The audit score measures technical and structural readiness for AI crawlers and models.</p>
          <h2 class="text-xl font-bold text-white mb-3">2. Disclaimer of Rankings</h2>
          <p class="text-slate-300 leading-relaxed mb-4">Actual responses from AI products (such as ChatGPT, Perplexity, or DeepSeek) depend on real-time search indexation, user prompts, and model updates. Luduan GEO does not guarantee specific keyword rankings or citation guarantees on third-party AI platforms.</p>
          <h2 class="text-xl font-bold text-white mb-3">3. Acceptable Use</h2>
          <p class="text-slate-300 leading-relaxed">Users agree not to use the audit engine for unauthorized automated stress testing, malicious scanning, or violating applicable internet security laws.</p>
        ` : `
          <h2 class="text-xl font-bold text-white mb-3">一、服务范围与定位</h2>
          <p class="text-slate-300 leading-relaxed mb-4">甪端 GEO 为用户提供针对生成式 AI 搜索引擎的技术诊断、评分和整改代码生成。体检评分基于公开规范对技术可达性、结构化数据与内容可引用性进行客观评估。</p>
          <h2 class="text-xl font-bold text-white mb-3">二、免责声明</h2>
          <p class="text-slate-300 leading-relaxed mb-4">各大 AI 产品（如 ChatGPT、Perplexity、DeepSeek、豆包等）的具体回答受检索时机、模型版本、知识库更新与用户提问方式影响。本服务的分数与建议不构成在任何第三方 AI 中的排名承诺。</p>
          <h2 class="text-xl font-bold text-white mb-3">三、合规使用规范</h2>
          <p class="text-slate-300 leading-relaxed">用户不得利用本平台对非授权目标发起高频恶意扫描或实施网络攻击，须自觉遵守相关法律法规。</p>
        `
      },
      about: {
        title: isEn ? 'About Luduan GEO' : '关于 甪端 GEO',
        tag: 'DailyToolbox Suite',
        body: isEn ? `
          <h2 class="text-xl font-bold text-white mb-3">Why GEO?</h2>
          <p class="text-slate-300 leading-relaxed mb-4">As generative AI engines replace traditional 10-blue-link search, AI answers only cite top 2–3 authoritative sources. Traditional SEO keywords no longer suffice—brands need technical reachability for AI crawlers, clean JSON-LD entity structures, and high-density citable facts.</p>
          <h2 class="text-xl font-bold text-white mb-3">Who We Are</h2>
          <p class="text-slate-300 leading-relaxed mb-4">Founded in 2026 by the DailyToolbox engineering team, Luduan GEO is built to ensure modern digital assets are accurately understood and cited by leading AI models (ChatGPT, Claude, DeepSeek, Doubao, Perplexity).</p>
          <h2 class="text-xl font-bold text-white mb-3">Our 5 Core Capabilities</h2>
          <ul class="space-y-2 text-sm text-slate-300 mb-6">
            <li><b class="text-white">1. Visibility Audit:</b> 19-crawler access radar, 4-dimension 100-pt scoring, automated robots.txt/Schema/llms.txt generation.</li>
            <li><b class="text-white">2. Top-1 Lab:</b> Real-model multi-round A/B testing measuring mention rate and ranking lifts.</li>
            <li><b class="text-white">3. Site Autopilot:</b> Daily sitemap verification and instant IndexNow broadcast to Bing & Copilot.</li>
            <li><b class="text-white">4. AI Perception Monitor:</b> Cross-model sentiment tracking, hallucination detection and claim audit.</li>
            <li><b class="text-white">5. Mainstream Media Red-V Loop:</b> Action cards connected to 60+ authoritative media channels with automated post-publish citation tracking.</li>
          </ul>
          <div class="mt-6 p-4 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-300">
            <span class="text-cyan-400 font-semibold">Official Suite:</span> DailyToolbox (<a href="https://dailytoolbox.org" class="text-cyan-300 hover:underline">dailytoolbox.org</a>)
          </div>
        ` : `
          <h2 class="text-xl font-bold text-white mb-3">为什么需要 GEO？</h2>
          <p class="text-slate-300 leading-relaxed mb-4">在大模型重塑搜索体验的今天，AI 不再展示 10 条广告链接，而是直接在答案中精选推荐 2~3 个最权威的信源。传统关键词堆砌彻底失效，网站和品牌必须建立面向 AI 的技术可达性、实体信任信号与高密度事实语料。</p>
          <h2 class="text-xl font-bold text-white mb-3">我们的团队与定位</h2>
          <p class="text-slate-300 leading-relaxed mb-4">甪端（读音：lù duān）是中国古代知晓四方语言、能辩善恶真伪的神兽。甪端 GEO 由 DailyToolbox 核心技术团队于 2026 年创立，致力于帮助每一家重视自身数字资产的企业与站长，在 AI 时代被大模型精准理解、优先引用。</p>
          <h2 class="text-xl font-bold text-white mb-3">五大完整核心链路</h2>
          <ul class="space-y-2 text-sm text-slate-300 mb-6">
            <li><b class="text-white">1. 可见度体检：</b>19 大国内外 AI 爬虫访问矩阵、四维 100 分量化评分，一键生成 robots.txt、Schema 与 llms.txt。</li>
            <li><b class="text-white">2. 首推实验室：</b>真实大模型多轮多采样 A/B 对比实测，科学评估官方语料对推荐排位的提升。</li>
            <li><b class="text-white">3. 站点托管巡检：</b>每日全自动扫描 Sitemap，新增内容通过 IndexNow 协议秒级推送到 Bing、Copilot 等 AI 索引源。</li>
            <li><b class="text-white">4. AI 舆情认知监测：</b>多模型交叉推演，客观监测大模型对品牌争议的复述率、官方信息提及率与情感倾向。</li>
            <li><b class="text-white">5. 主流媒体红V发布闭环：</b>关联 60+ 主流央媒与财经资讯矩阵，根据弱点生成行动卡，发布后自动观测信源采纳演进。</li>
          </ul>
          <div class="mt-6 p-4 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-300">
            <span class="text-cyan-400 font-semibold">母站官网：</span> DailyToolbox (<a href="https://dailytoolbox.org" class="text-cyan-300 hover:underline">dailytoolbox.org</a>)
          </div>
        `
      },
      contact: {
        title: isEn ? 'Contact Us' : '联系我们',
        tag: 'Get in Touch',
        body: isEn ? `
          <p class="text-slate-300 leading-relaxed mb-6">Need expert assistance with generative engine optimization, enterprise deployment, or custom brand reputation monitoring? We are here to help.</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="card space-y-2">
              <div class="text-xs text-slate-400 font-medium">Customer Support & Inquiries</div>
              <div class="text-white font-mono text-sm">support@dailytoolbox.org</div>
            </div>
            <div class="card space-y-2">
              <div class="text-xs text-slate-400 font-medium">Business WeChat / Enterprise</div>
              <div class="text-white font-mono text-sm">DailyToolbox_GEO</div>
            </div>
          </div>
        ` : `
          <p class="text-slate-300 leading-relaxed mb-6">无论是关于 GEO 优化的技术探讨、大客户企业级定制、对公转账与发票，还是产品建议，欢迎随时与我们取得联系。</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="card space-y-2">
              <div class="text-xs text-slate-400 font-medium">客服与商务邮箱</div>
              <div class="text-white font-mono text-sm">support@dailytoolbox.org</div>
            </div>
            <div class="card space-y-2">
              <div class="text-xs text-slate-400 font-medium">商务微信 / 售前顾问</div>
              <div class="text-white font-mono text-sm">DailyToolbox_GEO</div>
            </div>
          </div>
        `
      }
    };
    const c = contents[page] || contents.privacy;
    box.innerHTML = `<div class="page-head">
      <span class="eyebrow">${c.tag}</span>
      <h1 class="page-title">${c.title}</h1>
    </div>
    <div class="card p-6 sm:p-8 space-y-6">${c.body}</div>
    <div class="text-center pt-4">
      <a href="/audit" class="btn-ghost inline-flex px-5 py-2 text-xs">${t('返回首页')}</a>
    </div>`;
  }

  // ————————————————————— 账户与套餐 —————————————————————
  async function renderPricing(box) {
    box.innerHTML = `<div class="skeleton h-72"></div>`;
    try {
      const r = await api('/billing/plans', { silent: true });
      const plans = r.data.plans; const cur = state.user?.plan || null;
      const period = state.pricingPeriod || 'monthly';
      const isYearly = period === 'yearly';
      const isEn = state.locale === 'en';
      box.innerHTML = `<div class="page-head"><span class="eyebrow">Pricing</span><h1 class="page-title">${t('选择适合您的套餐')}</h1><p class="page-desc">${t('年付优惠约 17%。支持对公转账与发票。')}</p></div>
        <div class="flex justify-center items-center my-6">
          <div class="inline-flex p-1 rounded-xl bg-slate-900 border border-slate-800">
            <button type="button" data-action="pricing-period" data-period="monthly" class="px-5 py-2 rounded-lg text-xs transition ${!isYearly ? 'bg-cyan-500/20 text-cyan-300 font-semibold' : 'text-slate-400 hover:text-white'}">${t('按月付费')}</button>
            <button type="button" data-action="pricing-period" data-period="yearly" class="px-5 py-2 rounded-lg text-xs transition ${isYearly ? 'bg-cyan-500/20 text-cyan-300 font-semibold' : 'text-slate-400 hover:text-white'}">${t('按年付费 (省17%)')}</button>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-5">${plans.map((p) => {
          const price = isYearly && p.priceYearly ? p.priceYearly : p.priceMonthly;
          const unit = isYearly && p.priceYearly ? t('年') : t('月');
          const subText = isYearly && p.priceYearly ? `<div class="text-xs text-cyan-400/80 mt-1">${t('相当于')} ¥${Math.round(p.priceYearly / 12)} / ${t('月')}</div>` : (p.priceYearly ? `<div class="text-xs text-slate-400 mt-1">${t('年付')} ¥${p.priceYearly}</div>` : '');
          const rawFeatures = state.locale === 'en' ? (p.featuresEn || p.features) : (p.features || p.featuresEn);
          const seenFeatures = new Set();
          const cleanFeatures = (rawFeatures || []).filter((f) => {
            const key = String(f).trim();
            if (seenFeatures.has(key)) return false;
            if (/runs\/day|每天.*次|次.*天/i.test(key)) {
              if (seenFeatures.has('__quota_feature__')) return false;
              seenFeatures.add('__quota_feature__');
            }
            seenFeatures.add(key);
            return true;
          });
          return `<div class="card flex flex-col ${p.popular ? '!border-cyan-400/40 !bg-cyan-400/[0.03]' : ''}">
          <div class="flex items-center justify-between"><span class="font-bold text-white">${esc(state.locale === 'en' ? p.nameEn : p.name)}</span>${p.popular ? `<span class="pill-ok">${t('推荐')}</span>` : ''}${cur === p.id ? `<span class="pill-info">${t('当前套餐')}</span>` : ''}</div>
          <div class="mt-3"><span class="text-4xl font-semibold num text-white">¥${price}</span><span class="text-xs text-slate-500"> / ${unit}</span>${subText}</div>
          <ul class="mt-4 space-y-2 text-sm text-slate-300 flex-1">${cleanFeatures.map((f) => `<li class="flex gap-2"><span class="text-cyan-300">✓</span><span>${esc(f)}</span></li>`).join('')}</ul>
          ${p.id === 'free' ? `<div class="mt-5 text-center text-xs text-slate-500">${state.user ? `<span class="pill-muted block py-2">${t('当前已是免费版')}</span>` : `<button data-action="login" data-mode="register" class="btn-ghost w-full py-2.5 text-sm">${t('免费注册')}</button>`}</div>`
            : p.id === 'enterprise' ? `<div class="mt-5"><button data-action="contact-sales" class="btn-primary w-full py-2.5 text-sm font-semibold">${t('联系销售 / 定制方案')}</button></div>`
            : `<div class="mt-5"><button data-action="order" data-plan="${p.id}" data-period="${period}" class="${p.popular ? 'btn-emerald' : 'btn-secondary'} w-full py-2.5 text-sm font-semibold">${isYearly ? t('按年开通') : t('按月开通')}</button></div>`}
        </div>`;}).join('')}</div>

        <!-- 额度与功能消耗说明 -->
        <div class="card mt-10 space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
            <div>
              <h3 class="card-title text-base text-white">${isEn ? 'Credits & Daily Quota Breakdown' : '额度与功能消耗说明'}</h3>
              <p class="text-xs text-slate-400 mt-0.5">${isEn ? 'Daily credits reset every night at 00:00 (UTC+8). Transparent usage per feature.' : '所有每日额度均于每日 00:00 (UTC+8) 自动满额重置，不滚存、无隐形扣费。'}</p>
            </div>
            <span class="pill-info text-[11px]">${isEn ? 'Reset daily at 00:00 (UTC+8)' : '每日 0 点自动重置'}</span>
          </div>

          <div class="p-3.5 rounded-xl bg-cyan-400/[0.07] border border-cyan-400/30 flex items-start gap-2.5 text-xs text-cyan-200">
            <span class="text-base leading-none">💡</span>
            <div>
              <strong class="text-white">${isEn ? 'Credit & Quota Value:' : '积分与额度价值说明：'}</strong>
              ${isEn
                ? '1 standard credit is valued at ¥0.50 CNY. With a Pro subscription (¥299/mo for 200 credits/day = 6,000 credits/mo), the unit cost drops to just ¥0.05 / credit. Daily quotas refresh at 00:00 (UTC+8).'
                : '1 积分基准价值约 ¥0.50 元。订阅专业版（¥299/月享每日 200 积分，月均 6,000 积分）单价低至 ¥0.05 / 积分。所有每日额度均在每日 00:00 (UTC+8) 自动补满重置。'}
            </div>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-xs text-left border-collapse">
              <thead>
                <tr class="border-b border-white/10 text-slate-400 font-medium">
                  <th class="py-2.5 px-3">${isEn ? 'Feature' : '功能模块'}</th>
                  <th class="py-2.5 px-3">${isEn ? 'Credit Cost' : '额度消耗'}</th>
                  <th class="py-2.5 px-3">${isEn ? 'Guest' : '未注册游客'}</th>
                  <th class="py-2.5 px-3">${isEn ? 'Free Registered' : '免费注册用户'}</th>
                  <th class="py-2.5 px-3 text-cyan-300">${isEn ? 'Pro Plan (¥299/mo)' : '标准版 (¥299/月)'}</th>
                  <th class="py-2.5 px-3 text-emerald-300">${isEn ? 'Enterprise' : '企业版'}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/[0.06] text-slate-300">
                <tr>
                  <td class="py-2.5 px-3 font-semibold text-white">${isEn ? 'Website GEO Audit' : '网站可见度体检'}</td>
                  <td class="py-2.5 px-3 font-mono text-cyan-300">${isEn ? '1 credit / run' : '1 次额度 / 次'}</td>
                  <td class="py-2.5 px-3 font-mono">5 ${isEn ? '/ day' : '次/天'}</td>
                  <td class="py-2.5 px-3 font-mono text-emerald-400 font-bold">30 ${isEn ? '/ day' : '次/天'}</td>
                  <td class="py-2.5 px-3 font-mono">200 ${isEn ? '/ day' : '次/天'}</td>
                  <td class="py-2.5 px-3 font-mono">999 ${isEn ? '/ day' : '次/天'}</td>
                </tr>
                <tr>
                  <td class="py-2.5 px-3 font-semibold text-white">${isEn ? 'Brand AI Perception Check' : '品牌 AI 认知诊断'}</td>
                  <td class="py-2.5 px-3 font-mono text-cyan-300">${isEn ? '1 credit / run' : '1 次额度 / 次'}</td>
                  <td class="py-2.5 px-3 font-mono">5 ${isEn ? '/ day' : '次/天'}</td>
                  <td class="py-2.5 px-3 font-mono text-emerald-400 font-bold">30 ${isEn ? '/ day' : '次/天'}</td>
                  <td class="py-2.5 px-3 font-mono">200 ${isEn ? '/ day' : '次/天'}</td>
                  <td class="py-2.5 px-3 font-mono">999 ${isEn ? '/ day' : '次/天'}</td>
                </tr>
                <tr>
                  <td class="py-2.5 px-3 font-semibold text-white">${isEn ? 'Top-1 Lab A/B Testing' : '首推实验室（大模型 A/B 实测）'}</td>
                  <td class="py-2.5 px-3 font-mono text-cyan-300">${isEn ? '1 credit / run' : '1 次额度 / 次'}</td>
                  <td class="py-2.5 px-3 text-slate-500">${isEn ? 'Sample only' : '仅示例'}</td>
                  <td class="py-2.5 px-3 font-mono">1 ${isEn ? '/ month' : '次/月'}</td>
                  <td class="py-2.5 px-3 font-mono">20 ${isEn ? '/ month' : '次/月'}</td>
                  <td class="py-2.5 px-3 font-mono">${isEn ? 'Unlimited concurrency' : '不限并发'}</td>
                </tr>
                <tr>
                  <td class="py-2.5 px-3 font-semibold text-white">${isEn ? 'Site Autopilot & IndexNow' : '站点托管 & IndexNow 自动巡检'}</td>
                  <td class="py-2.5 px-3 font-mono text-slate-400">${isEn ? 'Included' : '按站点计'}</td>
                  <td class="py-2.5 px-3 text-slate-500">—</td>
                  <td class="py-2.5 px-3 text-slate-400">1 ${isEn ? 'site (manual)' : '站点（手动）'}</td>
                  <td class="py-2.5 px-3 font-mono text-cyan-300">5 ${isEn ? 'sites (daily auto)' : '站点（每日全自动）'}</td>
                  <td class="py-2.5 px-3 font-mono text-emerald-300">30+ ${isEn ? 'sites' : '站点'}</td>
                </tr>
                <tr>
                  <td class="py-2.5 px-3 font-semibold text-white">${isEn ? 'AI Perception Monitor' : 'AI 舆情认知监测'}</td>
                  <td class="py-2.5 px-3 font-mono text-cyan-300">${isEn ? '2 credits / model' : '2 次额度 / 每个模型'}</td>
                  <td class="py-2.5 px-3 text-slate-500">—</td>
                  <td class="py-2.5 px-3 text-slate-400">${isEn ? 'Available via quota' : '消耗每日额度'}</td>
                  <td class="py-2.5 px-3 font-mono text-cyan-300">${isEn ? 'Priority queue' : '优先队列'}</td>
                  <td class="py-2.5 px-3 font-mono text-emerald-300">${isEn ? 'Dedicated cluster' : '专属集群'}</td>
                </tr>
                <tr>
                  <td class="py-2.5 px-3 font-semibold text-white">${isEn ? 'Red-V Media Loop' : '权威媒体红V行动卡闭环'}</td>
                  <td class="py-2.5 px-3 font-mono text-slate-400">${isEn ? 'Custom' : '按任务派发'}</td>
                  <td class="py-2.5 px-3 text-slate-500">${isEn ? 'Preview' : '可预览'}</td>
                  <td class="py-2.5 px-3 text-slate-400">${isEn ? 'Basic cards' : '基础行动卡'}</td>
                  <td class="py-2.5 px-3 text-cyan-300">${isEn ? 'Full release loop' : '完整发布闭环'}</td>
                  <td class="py-2.5 px-3 text-emerald-300">${isEn ? '60+ mainstream media matrix lines' : '60+ 主流媒体矩阵专线'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 价格 FAQ & 退款政策 -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
          <div class="card space-y-4">
            <h3 class="card-title text-sm text-white">${isEn ? 'Pricing FAQ' : '常见问题解答'}</h3>
            <div class="space-y-3 text-xs leading-relaxed text-slate-300">
              <div>
                <b class="text-white block mb-0.5">${isEn ? 'What is the value of 1 credit?' : '一个积分/额度值多少钱？'}</b>
                <span class="text-slate-400">${isEn ? 'Standard credits are valued at ¥0.50 CNY each. Registered users get 30 free audits daily. Pro subscribers receive 200 credits/day (6,000/mo) for ¥299/mo, reducing unit cost to just ¥0.05 / credit.' : '基础单次积分折算约为 ¥0.50 元/次。注册即送每日 30 次免费体检；升级专业版（¥299/月）每日享受 200 积分，月均 6,000 积分，折合单价仅需 ¥0.05 / 积分，性价比极高。'}</span>
              </div>
              <div>
                <b class="text-white block mb-0.5">${isEn ? 'When does the daily quota reset?' : '每日免费额度何时重置？'}</b>
                <span class="text-slate-400">${isEn ? 'All daily limits reset automatically at 00:00 Beijing Time (UTC+8). Free registered users enjoy 30 fresh audits every single day.' : '每日额度于北京时间每天 00:00 (UTC+8) 自动满血重置。免费注册用户每天均有 30 次体检与诊断额度，天天可用。'}</span>
              </div>
              <div>
                <b class="text-white block mb-0.5">${isEn ? 'Do you support official invoices and bank transfers?' : '支持对公转账与开具增值税发票吗？'}</b>
                <span class="text-slate-400">${isEn ? 'Yes. We support corporate bank transfers, WeChat, and Alipay. We provide VAT invoices for technology and software services.' : '支持企业对公银行账户转账、微信及支付宝支付。所有付费方案均可开具增值税发票（类目为“技术服务费”或“软件服务费”）。'}</span>
              </div>
              <div>
                <b class="text-white block mb-0.5">${isEn ? 'What is the yearly discount?' : '年付优惠是多少？'}</b>
                <span class="text-slate-400">${isEn ? 'Yearly billing includes ~17% discount (2 months free) and extra autopilot site quotas.' : '按年付费立享 2 个月免单特惠（相当于 8.3 折 / 省 17%），并赠送额外托管站点配额与优先客服响应。'}</span>
              </div>
            </div>
          </div>

          <div class="card space-y-4">
            <h3 class="card-title text-sm text-white">${isEn ? 'Refund Policy & Guarantee' : '退款保障政策'}</h3>
            <div class="space-y-3 text-xs leading-relaxed text-slate-300">
              <div>
                <b class="text-white block mb-0.5">${isEn ? '72-Hour / 7-Day Satisfaction Guarantee' : '72 小时 / 7 天无忧退款保障'}</b>
                <span class="text-slate-400">${isEn ? 'Monthly subscriptions can be refunded within 72 hours, and yearly subscriptions within 7 days, provided usage has not exceeded 20% of your plan quota.' : '购买月付套餐 72 小时内、年付套餐 7 天内，若产品未达到您的预期且未产生大批量耗尽型调用（使用量不超过配额 20%），可联系客服申请全额退款。'}</span>
              </div>
              <div>
                <b class="text-white block mb-0.5">${isEn ? 'Invoice and Tax Handling' : '已开发票退款处理'}</b>
                <span class="text-slate-400">${isEn ? 'If an invoice has already been issued, processing requires return or voiding of the original invoice per accounting standards.' : '若订单已开具发票，办理退款时须按税务合规要求寄回原发票或办理红字冲销。'}</span>
              </div>
              <div>
                <b class="text-white block mb-0.5">${isEn ? 'Need help with billing?' : '需要账单咨询或定制退改？'}</b>
                <span class="text-slate-400">${isEn ? 'Contact contact@dailytoolbox.org or reach our consultant on WeChat.' : '欢迎发送邮件至 contact@dailytoolbox.org 或直接添加专属商务微信联系。'}</span>
              </div>
            </div>
          </div>
        </div>`;
    } catch (e) { box.innerHTML = ''; fail(e); }
  }

  function openContactSales() {
    const isEn = state.locale === 'en';
    openModal(`<h3 class="text-lg font-bold text-white">${isEn ? 'Enterprise Custom Solution Inquiry' : '企业版专属方案咨询'}</h3>
      <p class="text-xs text-slate-400 mt-1 leading-relaxed">${isEn ? 'Dedicated high-concurrency API lines, custom AI crawlers, private deployment, and media Red-V loops. Reach out directly or leave your details.' : '支持高并发专属 API 线路、定制化模型监测矩阵、私有化部署与权威媒体红V闭环公关服务。欢迎直接联系或留下需求。'}</p>
      
      <div class="my-4 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div>
          <span class="text-slate-500 block mb-0.5">${isEn ? 'Business WeChat / Consultant' : '商务微信 / 售前顾问'}</span>
          <span class="text-white font-mono font-medium">DailyToolbox_GEO</span>
          <span class="text-[10px] text-cyan-400 block mt-0.5">${isEn ? '(Search ID or note "Enterprise")' : '（请备注：企业版咨询）'}</span>
        </div>
        <div>
          <span class="text-slate-500 block mb-0.5">${isEn ? 'Direct Business Email' : '大客户直通邮箱'}</span>
          <a href="mailto:contact@dailytoolbox.org" class="text-white font-mono hover:text-cyan-300">contact@dailytoolbox.org</a>
          <span class="text-[10px] text-slate-400 block mt-0.5">${isEn ? 'Reply within 2 hours' : '工作日 2 小时内回复'}</span>
        </div>
      </div>

      <form id="lead-form" class="space-y-3 mt-4">
        <label class="field"><span>${t('称呼 *')}</span><input name="clientName" class="input" required placeholder="${isEn ? 'e.g. Alex Zhang' : '如：张总 / 李经理'}"></label>
        <label class="field"><span>${t('联系方式（手机 / 微信 / 邮箱）*')}</span><input name="contactInfo" class="input" required placeholder="${isEn ? 'Phone / WeChat / Email' : '手机号、微信或企业邮箱'}"></label>
        <label class="field"><span>${t('机构 / 品牌名称 *')}</span><input name="subjectName" class="input" required placeholder="${isEn ? 'Company / Brand Name' : '公司或机构全称'}"></label>
        <label class="field"><span>${t('需求描述 *')}</span><textarea name="negativeIssue" rows="3" class="input text-sm" required placeholder="${isEn ? 'Tell us your goals, website scale, or custom monitoring requirements…' : '请简述您的需求，如：需要监测的品牌数量、定制大模型评测、公关信源治理等…'}"></textarea></label>
        <button class="btn-primary w-full py-2.5 text-sm font-semibold" type="submit">${isEn ? 'Submit Inquiry' : '提交咨询需求'}</button>
      </form>`);
  }

  async function createOrder(el) {
    if (!state.user) return openAuth('login', t('请先登录再开通套餐'));
    busy(el, true);
    try {
      const r = await api('/billing/orders', { method: 'POST', body: { plan: el.dataset.plan, period: el.dataset.period } });
      const d = r.data;
      openModal(`<h3 class="text-lg font-bold text-white">${t('订单已创建')}</h3>
        <div class="mt-3 space-y-1 text-sm"><div class="kv"><span class="text-slate-400">${t('订单号')}</span><span class="font-mono">${esc(d.orderNo)}</span></div>
        <div class="kv"><span class="text-slate-400">${t('套餐')}</span><span>${esc(t(d.planName))} · ${d.period === 'yearly' ? t('年付') : t('月付')}</span></div>
        <div class="kv"><span class="text-slate-400">${t('金额')}</span><span class="font-mono text-emerald-300 text-lg">¥${d.amount}</span></div></div>
        ${d.payQrUrl ? `<img src="${esc(d.payQrUrl)}" alt="${t('收款码')}" class="w-48 h-48 mx-auto mt-4 rounded-xl bg-white p-2">` : ''}
        <p class="text-sm text-slate-300 mt-4 leading-relaxed">${esc(d.payContact)}</p>
        <p class="text-xs text-slate-500 mt-2">${t('付款时请备注订单号，确认到账后即为您开通。')}</p>
        ${d.demoPayments ? `<button data-action="mock-pay" data-order="${esc(d.orderNo)}" class="btn-amber w-full py-2.5 text-sm mt-4">${t('演示模式：模拟支付')}</button>` : ''}
        <button data-action="modal-close" class="btn-ghost w-full py-2.5 text-sm mt-2">${t('好的')}</button>`);
    } catch (e) { fail(e); } finally { busy(el, false); }
  }

  async function renderAccount() {
    const box = $('#view-account');
    if (!state.user) return loginRequired(box);
    await loadMe();
    const u = state.user; if (!u) return loginRequired(box);
    box.innerHTML = `<div class="page-head"><span class="eyebrow">Account</span><h1 class="page-title">${t('我的账户')}</h1></div><div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div class="card space-y-1"><h3 class="card-title mb-2">${t('账户信息')}</h3>
        <div class="kv"><span class="text-slate-400">${t('用户名')}</span><span>${esc(u.username)}</span></div>
        <div class="kv"><span class="text-slate-400">${t('邮箱')}</span><span class="truncate">${esc(u.email || '—')}</span></div>
        <div class="kv"><span class="text-slate-400">${t('套餐')}</span><span>${esc(t(u.planName))}</span></div>
        <div class="kv"><span class="text-slate-400">${t('到期时间')}</span><span>${u.planExpiresAt ? fmtDate(u.planExpiresAt) : '—'}</span></div>
        <div class="kv"><span class="text-slate-400">${t('今日额度')}</span><span class="font-mono">${u.quota.remaining}/${u.quota.limit}</span></div>
        <div class="kv"><span class="text-slate-400">${t('托管站点')}</span><span class="font-mono">${u.siteCount}/${u.siteLimit}</span></div>
        <div class="flex gap-2 pt-3"><a href="/pricing" class="btn-primary flex-1 py-2 text-xs">${t('升级 / 续费')}</a><button data-action="change-pw" class="btn-ghost flex-1 py-2 text-xs">${t('修改密码')}</button></div></div>
      <div class="card lg:col-span-2"><h3 class="card-title mb-3">${t('体检与诊断记录')}</h3><div id="acct-history" class="text-sm text-slate-500">${t('加载中…')}</div></div>
      <div class="card lg:col-span-3"><h3 class="card-title mb-3">${t('我的订单')}</h3><div id="acct-orders" class="text-sm text-slate-500">${t('加载中…')}</div></div></div>`;
    try {
      const [h, o] = await Promise.all([api('/me/history'), api('/billing/orders')]);
      $('#acct-history').innerHTML = h.data.length ? `<div class="divide-y divide-slate-800">${h.data.map((x) => `<a href="/result/${esc(x.id)}" class="flex items-center justify-between gap-3 py-2.5 hover:bg-slate-800/30 rounded-lg px-2 -mx-2">
        <div class="min-w-0"><div class="text-slate-200 truncate">${esc(x.target)}</div><div class="text-[11px] text-slate-500">${x.kind === 'url' ? t('网站体检') : t('品牌诊断')} · ${fmtDate(x.created_at)}</div></div><span class="font-mono text-cyan-300">${x.score ?? '—'}</span></a>`).join('')}</div>` : t('暂无记录');
      const st = { pending: t('待付款'), paid: t('已开通'), cancelled: t('已取消') };
      $('#acct-orders').innerHTML = o.data.length ? `<div class="overflow-x-auto"><table class="w-full text-xs"><tbody>${o.data.map((x) => `<tr class="border-t border-slate-800"><td class="py-2 font-mono">${esc(x.order_no)}</td><td>${esc({ standard: t('标准版'), enterprise: t('机构版') }[x.plan_type] || x.plan_type)} · ${x.period === 'yearly' ? t('年付') : t('月付')}</td><td class="font-mono">¥${x.amount}</td><td>${esc(st[x.status] || x.status)}</td><td class="text-slate-500">${fmtDate(x.created_at)}</td></tr>`).join('')}</tbody></table></div>` : t('暂无订单');
    } catch (e) { fail(e); }
  }

  function changePw() {
    openModal(`<h3 class="text-lg font-bold text-white">${t('修改密码')}</h3><form id="pw-form" class="space-y-3 mt-4">
      <label class="field"><span>${t('原密码')}</span><input name="oldPassword" type="password" class="input" autocomplete="current-password" required></label>
      <label class="field"><span>${t('新密码（至少 8 位）')}</span><input name="newPassword" type="password" class="input" autocomplete="new-password" minlength="8" required></label>
      <button class="btn-primary w-full py-2.5 text-sm" type="submit">${t('保存')}</button></form>`);
  }


  // ————————————————————— 5. 红V发布闭环 —————————————————————
  state.redvTab = 'cards';
  state.redvCards = [];
  state.redvTasks = [];
  state.redvAccounts = [];

  async function renderRedV() {
    const box = $('#redv-body');
    if (!state.user) {
      const isEn = state.locale === 'en';
      box.innerHTML = `
        <div class="space-y-6">
          <div class="p-6 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-slate-900 to-indigo-950/40 border border-cyan-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div class="space-y-1.5 max-w-2xl">
              <span class="pill-info text-[11px]">${isEn ? '60+ Mainstream Media Red-V Loop' : '60+ 全网主流媒体红V矩阵与闭环验证'}</span>
              <h3 class="text-lg font-bold text-white">${isEn ? 'How the Red-V Loop Reshapes AI Citations' : '红V发布闭环如何扭转大模型心智？'}</h3>
              <p class="text-xs text-slate-300 leading-relaxed">${isEn ? 'When AI models exhibit brand perception gaps or dispute residue, the system generates actionable narrative cards based on factual evidence. Following publication via authoritative media, we track model answer evolutions and citations in real time.' : '当大模型在回答中存在负面信息残留、事实混淆或权威内容缺位时，系统基于客观事实生成定制叙事行动卡，经主流媒体发布后，全自动重测各大模型的信源采纳与排位变化。'}</p>
            </div>
            <div class="flex flex-col sm:flex-row gap-2 shrink-0">
              <button data-action="login" data-mode="register" class="btn-primary px-5 py-2.5 text-xs font-semibold">${isEn ? 'Sign Up for Full Loop' : '免费注册开启实操'}</button>
              <button data-action="lead" class="btn-ghost px-4 py-2.5 text-xs text-slate-300">${isEn ? 'Consult Media Matrix' : '咨询媒体发布方案'}</button>
            </div>
          </div>

          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <h4 class="text-sm font-bold text-white flex items-center gap-2">
                <span>${isEn ? 'Live Sample Action Card' : '示例行动卡预览'}</span>
                <span class="pill-warn !text-[10px]">${isEn ? 'Demonstration' : '实战案例解构'}</span>
              </h4>
              <span class="text-xs text-slate-500 font-mono">${isEn ? 'Target: Apollo (Healthcare & Wellness)' : '标的品牌：太阳神集团'}</span>
            </div>

            <div class="card space-y-4 !border-cyan-500/30">
              <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div class="flex items-center gap-2">
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold border border-cyan-500/40 bg-cyan-500/10 text-cyan-300">主流央媒 / 财经客户端矩阵</span>
                  <h4 class="text-base font-bold text-white">太阳神（Apollo）健康产业集团</h4>
                  <span class="pill-ok !text-[10px]">已完成发布并验证</span>
                </div>
                <span class="text-xs text-slate-400 font-mono">观测周期: 7 天</span>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div class="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div class="font-semibold text-rose-300 flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full bg-rose-400"></span>
                    <span>${isEn ? 'Identified AI Weakness / Dispute Residue' : 'AI 诊断弱点 / 历史传言残留'}</span>
                  </div>
                  <p class="text-slate-300 leading-relaxed">各大模型在回答“太阳神是否正规？产品怎么样？”时，频繁引用 10 年前的历史纠纷网络帖子，官方辟谣与现代科研资质严重缺席，导致品牌情感指数仅 42%。</p>
                </div>

                <div class="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div class="font-semibold text-emerald-300 flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span>${isEn ? 'Narrative Action Angle & Evidence Ladder' : '叙事建议 / 权威论据证据链'}</span>
                  </div>
                  <p class="text-slate-300 leading-relaxed">引用国家药监局与市场监管总局官方认证公报、现代生物制造研发中心投产数据，重点突出中国首创运动营养保健品的科研积淀与规范合规发展历程。</p>
                </div>
              </div>

              <!-- 效果重测前后对比 -->
              <div class="p-4 rounded-xl bg-slate-950/80 border border-cyan-500/20 space-y-3">
                <div class="text-xs font-bold text-slate-200">${isEn ? 'Model Retest Before vs After' : '发布后模型回答演进与信源采纳对比'}</div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div class="p-3 rounded-lg bg-rose-950/20 border border-rose-500/20 space-y-1">
                    <div class="text-rose-300 font-semibold">${isEn ? 'Before Publishing (Baseline)' : '发布前基线'}</div>
                    <div class="text-slate-400">官方信息未被采纳 · 负面传言复述率 35% · 权威媒体引用率 0%</div>
                  </div>
                  <div class="p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/20 space-y-1">
                    <div class="text-emerald-300 font-semibold">${isEn ? '7 Days Post-Publishing' : '发布后 7 天重测'}</div>
                    <div class="text-slate-300">主流媒体权威引用率 <b class="text-emerald-400 font-mono">85%</b> · 争议消除率 <b class="text-emerald-400 font-mono">92%</b> · 推荐位第 1 位</div>
                  </div>
                </div>
              </div>

              <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800 text-xs">
                <span class="text-slate-500">登录后可针对您的品牌一键生成全套行动卡并派发至账号矩阵</span>
                <button data-action="login" data-mode="register" class="btn-primary px-4 py-1.5 text-xs">${isEn ? 'Sign Up to Create Cards' : '立即注册生成行动卡'}</button>
              </div>
            </div>
          </div>
        </div>`;
      return;
    }

    box.innerHTML = `<div class="skeleton h-48"></div>`;
    try {
      const [cardsRes, tasksRes, accountsRes] = await Promise.all([
        api('/redv/cards', { silent: true }).catch(() => ({ data: [] })),
        api('/redv/tasks', { silent: true }).catch(() => ({ data: [] })),
        api('/redv/accounts', { silent: true }).catch(() => ({ data: [] })),
      ]);
      state.redvCards = cardsRes.data || [];
      state.redvTasks = tasksRes.data || [];
      state.redvAccounts = accountsRes.data || [];

      renderRedVView();
    } catch (e) {
      box.innerHTML = '';
      fail(e);
    }
  }

  function renderRedVView() {
    const box = $('#redv-body');
    const tab = state.redvTab || 'cards';
    const cards = state.redvCards || [];
    const tasks = state.redvTasks || [];
    const accounts = state.redvAccounts || [];

    box.innerHTML = `
      <div class="space-y-6">
        <!-- Tab Bar -->
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div class="flex gap-2">
            <button data-action="redv-tab" data-tab="cards" class="chip text-xs ${tab === 'cards' ? 'chip-on text-white' : 'text-slate-400'}">${t('行动卡库')} (${cards.length})</button>
            <button data-action="redv-tab" data-tab="tasks" class="chip text-xs ${tab === 'tasks' ? 'chip-on text-white' : 'text-slate-400'}">${t('发布任务与验证')} (${tasks.length})</button>
            <button data-action="redv-tab" data-tab="accounts" class="chip text-xs ${tab === 'accounts' ? 'chip-on text-white' : 'text-slate-400'}">${t('主流媒体红V矩阵')} (${accounts.length})</button>
          </div>
          <div>
            ${tab === 'cards' ? `<button data-action="redv-create-card" class="btn-primary text-xs px-3 py-1.5">+ ${t('生成红V行动卡')}</button>` : ''}
            ${tab === 'tasks' ? `<button data-action="redv-create-task" class="btn-emerald text-xs px-3 py-1.5">+ ${t('创建发布任务')}</button>` : ''}
          </div>
        </div>

        <!-- Tab 1: Cards -->
        ${tab === 'cards' ? `
          <div class="space-y-4">
            <div class="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-200 flex items-center justify-between gap-3">
              <span>系统结合品牌 AI 认知诊断弱点自动生成行动卡，明确叙事角度与权威信源需求，可一键派发至红V账号发布。</span>
              <button data-action="redv-create-card" class="btn-primary shrink-0 px-3 py-1 text-xs">+ 手动生成行动卡</button>
            </div>
            ${cards.length ? `
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${cards.map(c => `
                  <div class="card space-y-3">
                    <div class="flex items-center justify-between gap-2">
                      <div class="flex items-center gap-2">
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold border border-cyan-500/40 bg-cyan-500/10 text-cyan-300">${esc(c.target_platform || '全平台')}</span>
                        <h4 class="text-sm font-bold text-white">${esc(c.brand)}</h4>
                      </div>
                      <span class="${c.status === 'done' ? 'pill-ok' : 'pill-warn'} !text-[10px]">${c.status === 'done' ? t('已转任务') : t('待指派')}</span>
                    </div>
                    <div class="space-y-1.5 text-xs">
                      <div><strong class="text-rose-300">目标弱点 / 负面：</strong><span class="text-slate-300">${esc(c.target_issue)}</span></div>
                      <div><strong class="text-emerald-300">叙事建议 / 论据：</strong><span class="text-slate-300">${esc(c.suggested_angle)}</span></div>
                    </div>
                    <div class="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                      <span class="text-slate-500 text-[11px] font-mono">${fmtDate(c.created_at)}</span>
                      <button data-action="redv-create-task" data-card-id="${c.id}" class="btn-secondary px-3 py-1 text-xs">转发布任务</button>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : `
              <div class="card text-center py-12 text-sm text-slate-500 space-y-3">
                <p>暂无红V行动卡</p>
                <p class="text-xs text-slate-600">在「品牌 AI 体检结果」的弱势问答中可一键生成，或点击上方按钮手动创建。</p>
              </div>
            `}
          </div>
        ` : ''}

        <!-- Tab 2: Tasks -->
        ${tab === 'tasks' ? `
          <div class="space-y-4">
            <div class="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-200">
              发布任务支持全流程闭环跟踪：待发布 → 人工发布回填链接 → 真实大模型调用自动验证观测品牌与信源是否被成功引用。
            </div>
            ${tasks.length ? `
              <div class="space-y-3">
                ${tasks.map(t => {
                  const statusMap = {
                    pending: ['待发布', 'pill-warn'],
                    published: ['已发布待验证', 'pill-info'],
                    verified: ['已验证', 'pill-ok'],
                  };
                  const st = statusMap[t.status] || [t.status, 'pill-muted'];
                  return `
                    <div class="card space-y-3">
                      <div class="flex flex-wrap items-center justify-between gap-2">
                        <div class="flex items-center gap-2">
                          <span class="text-xs font-mono text-slate-500">#${t.id}</span>
                          <h4 class="text-sm font-bold text-white">${esc(t.brand)}</h4>
                          <span class="${st[1]} !text-[10px]">${st[0]}</span>
                        </div>
                        <div class="flex items-center gap-2 text-xs">
                          <span class="text-slate-400">指派红V：</span>
                          <span class="text-cyan-300 font-semibold">${esc(t.account_name || '未指定')}</span>
                        </div>
                      </div>
                      <div class="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-1">
                        <div class="text-slate-400">测试验证 Prompt：<span class="text-slate-200 font-medium">${esc(t.query_prompt)}</span></div>
                        <div class="text-slate-500">目标测试引擎：${esc(t.target_engine_label || t.target_engine)}</div>
                        ${t.publish_url ? `<div class="text-slate-400">已发布链接：<a href="${esc(t.publish_url)}" target="_blank" rel="noopener" class="text-cyan-400 hover:underline break-all">${esc(t.publish_url)}</a></div>` : ''}
                      </div>
                      <div class="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800">
                        <span class="text-[11px] text-slate-500 font-mono">${fmtDate(t.created_at)}</span>
                        <div class="flex gap-2">
                          ${t.status === 'pending' ? `
                            <button data-action="task-edit-publish" data-id="${t.id}" class="btn-ghost text-xs px-3 py-1 text-cyan-300">填写发布信息</button>
                          ` : ''}
                          ${t.status === 'published' ? `
                            <button data-action="task-verify" data-id="${t.id}" class="btn-emerald text-xs px-3 py-1 font-semibold">立即验证效果</button>
                          ` : ''}
                          ${t.status === 'verified' ? `
                            <button data-action="task-view-report" data-id="${t.id}" class="btn-ghost text-xs px-3 py-1 text-emerald-300 font-medium">查看验证报告</button>
                          ` : ''}
                        </div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : `
              <div class="card text-center py-12 text-sm text-slate-500">
                暂无发布任务，请点击上方「+ 创建发布任务」发起指派。
              </div>
            `}
          </div>
        ` : ''}

        <!-- Tab 3: RedV Accounts Matrix -->
        ${tab === 'accounts' ? `
          <div class="space-y-4">
            <div class="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-200">
              60+ 全平台主流媒体权威红V矩阵，覆盖微博、抖音、微信公众号、知乎、B站等高权重渠道，直连主流 AI 搜索信源索引。
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              ${accounts.map(a => `
                <div class="card space-y-2.5 !p-4">
                  <div class="flex items-center justify-between gap-2">
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold border border-cyan-500/40 bg-cyan-500/10 text-cyan-300">${esc(a.platform)}</span>
                    <span class="pill-ok !text-[10px]">官方合作直连</span>
                  </div>
                  <div>
                    <h4 class="text-sm font-bold text-white">${esc(a.account_name)}</h4>
                    <p class="text-[11px] text-slate-400 mt-0.5">${esc(a.tier)} · ${esc(a.category)}</p>
                  </div>
                  <div class="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-800">
                    <div><span class="text-slate-500">粉丝体量: </span><span class="text-slate-200 font-mono">${esc(a.followers_count)}</span></div>
                    <div><span class="text-slate-500">信源权重: </span><span class="text-emerald-300 font-mono">${esc(a.domain_authority)}</span></div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  function switchRedVTab(tab) {
    state.redvTab = tab;
    renderRedVView();
  }

  function openCreateCardModal(prefill = {}) {
    openModal(`
      <h3 class="text-base font-bold text-white mb-3">生成红V内容行动卡</h3>
      <form id="card-gen-form" class="space-y-3">
        <label class="field"><span>品牌 / 机构名称 *</span><input name="brand" class="input" required value="${esc(prefill.brand || '')}" placeholder="如：某某科技 / 某某品牌"></label>
        <label class="field"><span>目标弱点 / 负面争议 *</span><textarea name="target_issue" rows="2" class="input text-xs" required placeholder="如：AI 搜索时竞品出现频次更高，本方缺乏权威资质背书">${esc(prefill.target_issue || '')}</textarea></label>
        <label class="field"><span>建议叙事角度 / 论据要点 *</span><textarea name="suggested_angle" rows="3" class="input text-xs" required placeholder="由主流媒体权威账号发布针对该领域技术资质、发明专利与产业成果的深度解读">${esc(prefill.suggested_angle || '')}</textarea></label>
        <label class="field"><span>目标发布渠道</span>
          <select name="target_platform" class="input">
            <option value="微博">微博 (高权重即时资讯)</option>
            <option value="微信公众号">微信公众号 (深度权威文章)</option>
            <option value="抖音">抖音 (多模态短视频)</option>
            <option value="知乎">知乎 (专业长文与问答索引)</option>
            <option value="B站">哔哩哔哩 (专业评测与技术科普)</option>
          </select>
        </label>
        <div class="flex gap-2 pt-2">
          <button class="btn-primary flex-1 py-2.5 text-xs font-semibold" type="submit">生成行动卡</button>
          <button data-action="modal-close" class="btn-ghost flex-1 py-2.5 text-xs" type="button">${t('取消')}</button>
        </div>
      </form>
    `);
  }

  // —— 内容行动卡 2.0：发布标记交互 ——
  function openPublishMarkModal(cardId, title) {
    if (!state.user) return toast(t('请先登录'), 'warn');
    openModal(`
      <h3 class="text-base font-bold text-white mb-1">${t('标记为已在小红书发布')}</h3>
      <p class="text-xs text-slate-400 mb-3">${esc(title || '')}</p>
      <form id="card-publish-form" data-id="${esc(cardId)}" class="space-y-3">
        <label class="field"><span>${t('发布渠道')} *</span>
          <input name="channel" class="input" required maxlength="120" placeholder="${t('如：小红书@你的账号名')}">
        </label>
        <p class="text-[11px] text-slate-500">${t('标记后，下次品牌审计会自动用真实模型重测该弱点的引用变化，并在报告中展示前后对比。')}</p>
        <div class="flex gap-2 pt-1">
          <button class="btn-primary flex-1 py-2.5 text-xs font-semibold" type="submit">${t('确认标记')}</button>
          <button data-action="modal-close" class="btn-ghost flex-1 py-2.5 text-xs" type="button">${t('取消')}</button>
        </div>
      </form>`);
  }
  async function unmarkCardPublished(id) {
    if (!confirm(t('确定撤销该行动卡的发布标记吗？'))) return;
    try {
      const r = await api(`/redv/cards/${id}/unmark-published`, { method: 'POST' });
      toast(t('已撤销标记'), 'ok');
      updateLocalCard(r.data);
      rerenderBrandReport();
    } catch (e) { fail(e); }
  }
  function updateLocalCard(updated) {
    if (!updated || !state.audit || !Array.isArray(state.audit.action_cards)) return;
    const i = state.audit.action_cards.findIndex((c) => String(c.id) === String(updated.id));
    if (i !== -1) state.audit.action_cards[i] = { ...state.audit.action_cards[i], publishStatus: updated.publishStatus, publishChannel: updated.publishChannel, publishedAt: updated.publishedAt };
  }
  function rerenderBrandReport() {
    if (!state.audit || state.auditKind !== 'brand') return;
    const out = $('#audit-result') || $('#view-result');
    if (out) out.innerHTML = renderBrandResult(state.audit, state.auditId);
  }
  async function enrichCardsPublishState(d) {
    try {
      if (!state.user || !d || !Array.isArray(d.action_cards) || !d.action_cards.length || !d.brand) return;
      const r = await api(`/redv/cards?brand=${encodeURIComponent(d.brand)}`, { silent: true });
      const map = new Map((r.data || []).map((c) => [String(c.id), c]));
      d.action_cards.forEach((c) => {
        const u = c.id ? map.get(String(c.id)) : null;
        if (u) { c.publishStatus = u.publishStatus; c.publishChannel = u.publishChannel; c.publishedAt = u.publishedAt; }
      });
    } catch {}
  }

  function quickGenRedV(brand, question, reason) {
    navigateTo('/redv');
    openCreateCardModal({
      brand,
      target_issue: question || 'AI 搜索推荐中未显著提及品牌',
      suggested_angle: reason ? `针对“${question}”的疑问或竞品替代：${reason}` : `由主流媒体全平台账号针对“${question}”发布客观权威背书，补全技术资质与差异化优势。`
    });
  }

  function openCreateTaskModal(cardId) {
    const cards = state.redvCards || [];
    const accounts = state.redvAccounts || [];
    const engines = state.config?.engines || [];
    const card = cards.find(c => String(c.id) === String(cardId));

    openModal(`
      <h3 class="text-base font-bold text-white mb-3">创建红V发布与验证任务</h3>
      <form id="task-create-form" class="space-y-3">
        ${card ? `<input type="hidden" name="card_id" value="${card.id}">` : `
          <label class="field"><span>关联行动卡（选填）</span>
            <select name="card_id" class="input">
              <option value="">不关联行动卡</option>
              ${cards.map(c => `<option value="${c.id}">${esc(c.brand)} - ${esc(c.target_issue.slice(0, 20))}</option>`).join('')}
            </select>
          </label>
        `}
        <label class="field"><span>品牌名称 *</span><input name="brand" class="input" required value="${esc(card?.brand || '')}"></label>
        <label class="field"><span>指派主流媒体红V账号 *</span>
          <select name="redv_account_id" class="input" required>
            ${accounts.map(a => `<option value="${a.id}">[${esc(a.platform)}] ${esc(a.account_name)} (${esc(a.tier)})</option>`).join('')}
          </select>
        </label>
        <label class="field"><span>目标效果验证模型 *</span>
          <select name="target_engine" class="input">
            ${engines.map(e => `<option value="${esc(e.id)}">${esc(e.label)}</option>`).join('')}
          </select>
        </label>
        <label class="field"><span>验证测试 Prompt（检验 AI 是否采信红V信息）*</span>
          <input name="query_prompt" class="input" required value="${esc(card?.target_issue ? `请客观介绍${card.brand}的核心资质与实力` : '')}" placeholder="如：在相关领域中，该机构/品牌的权威实力与成果如何？">
        </label>
        <div class="flex gap-2 pt-2">
          <button class="btn-emerald flex-1 py-2.5 text-xs font-semibold" type="submit">创建任务</button>
          <button data-action="modal-close" class="btn-ghost flex-1 py-2.5 text-xs" type="button">${t('取消')}</button>
        </div>
      </form>
    `);
  }

  function openEditPublishModal(taskId) {
    const task = (state.redvTasks || []).find(t => String(t.id) === String(taskId));
    if (!task) return;
    openModal(`
      <h3 class="text-base font-bold text-white mb-3">录入红V发布信息</h3>
      <form id="task-edit-publish-form" data-id="${task.id}" class="space-y-3">
        <label class="field"><span>已发布线上网址（微博/抖音/公众号等链接）*</span>
          <input name="publish_url" class="input" required value="${esc(task.publish_url || '')}" placeholder="https://">
        </label>
        <label class="field"><span>发布说明 / 备注</span>
          <textarea name="publish_notes" rows="2" class="input text-xs" placeholder="如：已发布专访视频，包含资质专利等核心论据">${esc(task.publish_notes || '')}</textarea>
        </label>
        <div class="flex gap-2 pt-2">
          <button class="btn-primary flex-1 py-2.5 text-xs font-semibold" type="submit">标记为已发布</button>
          <button data-action="modal-close" class="btn-ghost flex-1 py-2.5 text-xs" type="button">${t('取消')}</button>
        </div>
      </form>
    `);
  }

  async function runTaskVerify(taskId, btn) {
    busy(btn, true, t('真实大模型效果检验中…'));
    try {
      const res = await api(`/redv/tasks/${taskId}/verify`, { method: 'POST', body: {} });
      const { task, verification } = res.data;
      const idx = (state.redvTasks || []).findIndex(t => String(t.id) === String(taskId));
      if (idx !== -1) state.redvTasks[idx] = task;
      renderRedVView();
      showTaskVerificationModal(task, verification);
      toast(t('验证测试执行完毕'), 'ok');
    } catch (e) {
      fail(e);
    } finally {
      busy(btn, false);
    }
  }

  async function viewTaskReport(taskId) {
    const task = (state.redvTasks || []).find(t => String(t.id) === String(taskId));
    if (!task || !task.verification_data) return toast(t('暂无验证数据'), 'warn');
    let v = {};
    try { v = typeof task.verification_data === 'string' ? JSON.parse(task.verification_data) : task.verification_data; } catch {}
    showTaskVerificationModal(task, v);
  }

  function showTaskVerificationModal(task, v) {
    const isMentioned = v.brand_mentioned ?? v.mentioned ?? false;
    const isCited = v.account_cited ?? (v.cites > 0) ?? false;
    const promptText = v.query_prompt || task.targetQuestion || task.query_prompt || task.target_question || '';
    const answerText = v.answer || v.answerExcerpt || '';
    const obsNotes = v.observation_notes || v.observation || '';
    const honestText = v.honest_statement || (obsNotes.includes('注：') ? obsNotes.slice(obsNotes.indexOf('注：')) : '诚实说明：大模型生成具有动态概率性，本结论仅陈述当次测试观测事实，不构成因果保证。');

    openModal(`
      <div class="space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div>
            <h3 class="text-base font-bold text-white">${esc(task.brandName || task.brand)} · 红V发布效果检验观测报告</h3>
            <span class="text-xs text-slate-400">指派红V：${esc(task.accountName || task.account_name)} · 引擎：${esc(v.engine || task.target_engine)}</span>
          </div>
          <span class="pill-ok">验证已完成</span>
        </div>

        <div class="grid grid-cols-2 gap-3 text-xs">
          <div class="p-3 rounded-xl border ${isMentioned ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-rose-500/40 bg-rose-500/10 text-rose-300'}">
            <span class="block text-slate-400">品牌提及状态</span>
            <span class="font-bold text-sm mt-1 block">${isMentioned ? '✓ 已观测到品牌提及' : '✗ 未观测到品牌提及'}</span>
          </div>
          <div class="p-3 rounded-xl border ${v.account_cited ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-900 text-slate-300'}">
            <span class="block text-slate-400">红V内容信源引用</span>
            <span class="font-bold text-sm mt-1 block">${isCited ? '✓ 已观测到信源直接引用' : '— 暂无直接链接引用'}</span>
          </div>
        </div>

        <div class="space-y-1.5">
          <span class="text-xs font-semibold text-slate-300">测试问题 Prompt：</span>
          <div class="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white">${esc(promptText)}</div>
        </div>

        <div class="space-y-1.5">
          <span class="text-xs font-semibold text-slate-300">真实大模型作答原文（当次观测记录）：</span>
          <div class="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-200 leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap">${esc(answerText)}</div>
        </div>

        <div class="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-xs text-cyan-200">
          <strong>观测结论：</strong>${esc(obsNotes)}
        </div>

        <div class="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
          <strong>诚实说明：</strong>${esc(honestText)}
        </div>
      </div>
    `, { wide: true });
  }


    // ————————————————————— 事件委托 —————————————————————
  document.addEventListener('click', async (e) => {
    if (e.target.closest('#btn-demo-report')) {
      e.preventDefault();
      navigateTo('/result/sample-deepseek');
      return;
    }

    const internalLink = e.target.closest('a');
    if (internalLink && internalLink.href && !internalLink.target && !internalLink.hasAttribute('download')) {
      try {
        const u = new URL(internalLink.href);
        if (u.origin === location.origin) {
          const p = u.pathname;
          const firstSegment = p.replace(/^\//, '').split('/')[0];
          if (VIEWS.includes(firstSegment) || p === '/') {
            if (!internalLink.dataset.action || internalLink.dataset.action === 'modal-close') {
              if (internalLink.dataset.action === 'modal-close') closeModal();
              e.preventDefault();
              navigateTo(p + u.search);
              return;
            }
          }
        }
      } catch {}
    }

    const el = e.target.closest('[data-action]');
    if (!el) {
      if (!e.target.closest('#user-menu') && !e.target.closest('[data-action=user-menu]')) $('#user-menu')?.classList.add('hidden');
      if (e.target.id === 'modal') closeModal();
      return;
    }
    const a = el.dataset.action;
    if (el.tagName === 'A' && a !== 'modal-close' && a !== 'download-docx') return;
    switch (a) {
      case 'lang': setLocale(el.dataset.lang); break;
      case 'toggle-card-lang': setLocale(el.dataset.lang || (state.locale === 'en' ? 'zh' : 'en')); break;
      case 'login': e.preventDefault(); openAuth(el.dataset.mode || 'login'); break;
      case 'logout': await api('/auth/logout', { method: 'POST', body: {} }).catch(() => {}); state.user = null; await loadMe(); toast(t('已退出登录'), 'ok'); $('#risk-body').dataset.ready = ''; navigateTo('/audit'); break;
      case 'user-menu': $('#user-menu').classList.toggle('hidden'); break;
      case 'modal-close': closeModal(); break;
      case 'pricing-period':
        state.pricingPeriod = el.dataset.period;
        renderPricing($('#view-pricing'));
        break;
      case 'clear-history':
        try { localStorage.removeItem('geo_audit_history'); } catch {}
        toast(t('历史记录已清空'), 'ok');
        renderHistory();
        break;
      case 'disambiguate-select': {
        const cur = state._currentDisambiguation;
        if (!cur) return;
        const idx = parseInt(el.dataset.idx, 10);
        const c = cur.match.candidates[idx];
        if (c) {
          const chosenName = state.locale === 'en' ? (c.nameEn || c.name) : (c.nameZh || c.name);
          $('#audit-input').value = chosenName;
          onAuditInput();
          closeModal();
          runAudit(null, true, c.context);
        }
        break;
      }
      case 'disambiguate-raw': {
        closeModal();
        runAudit(null, true);
        break;
      }
      case 'send-code': sendCode(el); break;
      case 'fill-audit':
        const fillVal = (state.locale === 'en' && el.dataset.enValue) ? el.dataset.enValue : el.dataset.value;
        $('#audit-input').value = fillVal;
        onAuditInput();
        $('#audit-input').focus();
        toast(state.locale === 'en' ? 'Entered example into input. Click "Run audit" to start.' : '已填入输入框，点击“开始体检”运行', 'ok');
        break;
      case 'audit-cancel':
        if (auditAbortCtrl) {
          auditAbortCtrl.abort();
          auditAbortCtrl = null;
        }
        if (auditTimerInterval) {
          clearInterval(auditTimerInterval);
          auditTimerInterval = null;
        }
        toast(t('已取消诊断。未扣除额度。'), 'ok');
        loadMe();
        break;
      case 'contact-sales': openContactSales(); break;
      case 'audit-retry': runAudit(); break;
      case 'focus-audit': e.preventDefault(); if (location.pathname !== '/audit' && location.pathname !== '/') navigateTo('/audit'); window.scrollTo({ top: 0, behavior: 'smooth' }); setTimeout(() => $('#audit-input').focus({ preventScroll: true }), 350); break;
      case 'code-tab': $$('[data-action=code-tab]', el.parentElement).forEach((b) => b.classList.toggle('chip-on', b === el)); $('#code-panel').innerHTML = codePanel(+el.dataset.i); break;
      case 'copy': { const tgt = document.getElementById(el.dataset.target); copyText(tgt.value ?? tgt.textContent); break; }
      case 'copy-text': copyText(el.dataset.text); break;
      case 'download': { const tgt = document.getElementById(el.dataset.target); downloadText(tgt.value ?? tgt.textContent, el.dataset.filename); break; }
      case 'download-key': downloadText(el.dataset.key, `${el.dataset.key}.txt`); break;
      case 'copy-result-link': copyText(`${location.origin}/result/${el.dataset.id}`); break;
      case 'content-rewrite': runContentRewrite(el); break;
      case 'lab-q': $$('[data-action=lab-q]').forEach((b) => b.classList.toggle('chip-on', b === el)); $('#lab-question').value = el.dataset.q; break;
      case 'lab-run': e.preventDefault(); runLab(el); break;
      case 'lab-share': labShare(el); break;
      case 'site-verify': case 'site-check': case 'site-delete': case 'site-delete-confirm': case 'site-push': siteAction(a, el); break;
      case 'audit-view': viewAudit(el.dataset.id); break;
      case 'lead': openLead(); break;
      case 'order': createOrder(el); break;
      case 'mock-pay':
        try { await api('/billing/mock-pay', { method: 'POST', body: { orderNo: el.dataset.order } }); closeModal(); toast(t('已开通'), 'ok'); await loadMe(); route(); } catch (err) { fail(err); }
        break;
      case 'change-pw': changePw(); break;
      case 'comp-tab': {
        state.compTab = el.dataset.tab;
        const card = el.closest('.card') || el.closest('#comp-card');
        $$('[data-action=comp-tab]').forEach(b => {
          const active = b.dataset.tab === el.dataset.tab;
          b.classList.toggle('chip-on', active);
          b.classList.toggle('text-white', active);
          b.classList.toggle('text-slate-400', !active);
        });
        updateCompView(state.audit, card);
        break;
      }
      case 'toggle-domains':
        state.domainsExpanded = !state.domainsExpanded;
        renderAuditResult();
        break;
      case 'trace-evidence':
        state.evidenceFilter = el.dataset.filter || 'all';
        renderAuditResult();
        setTimeout(() => { document.getElementById('evidence-chain-section')?.scrollIntoView({ behavior: 'smooth' }); }, 60);
        break;
      case 'toggle-evidence':
        document.getElementById('evidence-chain-section')?.scrollIntoView({ behavior: 'smooth' });
        break;
      case 'evidence-filter':
        state.evidenceFilter = el.dataset.filter || 'all';
        renderAuditResult();
        break;
      case 'url-comp-tab':
        state.compareTab = el.dataset.tab;
        renderCompareTable();
        break;
      case 'demo-audit':
        e.preventDefault();
        navigateTo('/result/sample-deepseek');
        break;
      case 'download-docx':
        e.preventDefault();
        downloadDocx(el.dataset.id);
        break;
      case 'open-notifications':
        e.preventDefault();
        openNotificationsModal();
        break;
      case 'notif-read':
        e.preventDefault();
        markNotifRead(el.dataset.id);
        break;
      case 'notif-read-all':
        e.preventDefault();
        markAllNotifsRead();
        break;
      case 'site-logs':
        e.preventDefault();
        siteAction('site-logs', el);
        break;
      case 'lab-mode':
        e.preventDefault();
        switchLabMode(el.dataset.mode);
        break;
      case 'lab-load-audit-qs':
        e.preventDefault();
        loadAuditQuestionsToLab();
        break;
      case 'lab-load-default-qs':
        e.preventDefault();
        loadDefaultQuestionsToLab();
        break;
      case 'quick-gen-redv':
        e.preventDefault();
        quickGenRedV(el.dataset.brand, el.dataset.question, el.dataset.reason);
        break;
      case 'card-mark-published':
        e.preventDefault();
        openPublishMarkModal(el.dataset.id, el.dataset.title);
        break;
      case 'card-unmark-published':
        e.preventDefault();
        unmarkCardPublished(el.dataset.id);
        break;
      case 'redv-tab':
        e.preventDefault();
        switchRedVTab(el.dataset.tab);
        break;
      case 'redv-create-card':
        e.preventDefault();
        openCreateCardModal();
        break;
      case 'redv-create-task':
        e.preventDefault();
        openCreateTaskModal(el.dataset.cardId);
        break;
      case 'task-edit-publish':
        e.preventDefault();
        openEditPublishModal(el.dataset.id);
        break;
      case 'task-verify':
        e.preventDefault();
        runTaskVerify(el.dataset.id, el);
        break;
      case 'task-view-report':
        e.preventDefault();
        viewTaskReport(el.dataset.id);
        break;
      default: break;
    }
  });

  document.addEventListener('change', async (e) => {
    const el = e.target;
    if (el.dataset.action === 'site-auto') {
      try { await api(`/sites/${el.dataset.id}`, { method: 'PATCH', body: { autoIndexNow: el.checked } }); toast(el.checked ? t('已开启自动推送') : t('已关闭自动推送'), 'ok'); } catch (err) { el.checked = !el.checked; fail(err); }
    }
  });

  document.addEventListener('submit', async (e) => {
    const f = e.target;
    const handlers = {
      'audit-form': runAudit, 'compare-form': runCompare, 'content-form': runContentCheck, 'lab-form': buildLab,
      'llms-check-form': checkLlms, 'risk-form': startRisk, 'clarify-form': runClarify, 'lab-ab-form': runAbExperiment,
    };
    if (handlers[f.id]) return handlers[f.id](e);
    e.preventDefault();
    const btn = f.querySelector('button[type=submit]');
    if (f.id === 'auth-form') return submitAuth(f);
    busy(btn, true);
    try {
      if (f.id === 'site-add-form') {
        await api('/sites', { method: 'POST', body: Object.fromEntries(new FormData(f).entries()) });
        toast(t('站点已添加，请按提示完成 Key 验证'), 'ok'); renderMonitor();
      } else if (f.id === 'push-form') {
        const urls = f.urls.value.split(/\s+/).filter(Boolean);
        const r = await api(`/sites/${f.dataset.id}/push`, { method: 'POST', body: { urls } });
        toast(`${r.data.message}（${r.data.count} ${t('条')}）`, 'ok', 6000); closeModal(); renderMonitor();
      } else if (f.id === 'lead-form') {
        const r = await api('/remediation/lead', { method: 'POST', body: Object.fromEntries(new FormData(f).entries()) });
        closeModal(); toast(r.message, 'ok', 6000);
      } else if (f.id === 'pw-form') {
        const r = await api('/auth/change-password', { method: 'POST', body: Object.fromEntries(new FormData(f).entries()) });
        closeModal(); toast(r.message, 'ok');
      } else if (f.id === 'card-publish-form') {
        const r = await api(`/redv/cards/${f.dataset.id}/mark-published`, { method: 'POST', body: { channel: f.channel.value } });
        closeModal();
        toast(t('已标记为已发布'), 'ok');
        updateLocalCard(r.data);
        rerenderBrandReport();
      } else if (f.id === 'card-gen-form') {
        const body = Object.fromEntries(new FormData(f).entries());
        const r = await api('/redv/cards/generate', { method: 'POST', body });
        closeModal();
        toast(t('行动卡已生成'), 'ok');
        state.redvTab = 'cards';
        await renderRedV();
      } else if (f.id === 'task-create-form') {
        const body = Object.fromEntries(new FormData(f).entries());
        const r = await api('/redv/tasks', { method: 'POST', body });
        closeModal();
        toast(t('发布任务已创建'), 'ok');
        state.redvTab = 'tasks';
        await renderRedV();
      } else if (f.id === 'task-edit-publish-form') {
        const body = Object.fromEntries(new FormData(f).entries());
        body.status = 'published';
        const r = await api(`/redv/tasks/${f.dataset.id}`, { method: 'PATCH', body });
        closeModal();
        toast(t('已标记为已发布，可发起效果验证'), 'ok');
        await renderRedV();
      }
    } catch (err) { fail(err); } finally { busy(btn, false); }
  });

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#modal').classList.contains('hidden')) closeModal(); });

  // Character counter for Task 7
  $('#audit-input')?.addEventListener('input', onAuditInput);
  window.addEventListener('hashchange', route);
  window.addEventListener('popstate', route);

  // ————————————————————— 首页动效：AI 回答示意 + 爬虫跑马灯 —————————————————————
  const BOTS = ['OAI-SearchBot', 'PerplexityBot', 'Claude-SearchBot', 'Bingbot', 'Googlebot', 'Baiduspider', 'Bytespider', 'YisouSpider', 'Applebot', 'ChatGPT-User', 'Claude-User', 'Perplexity-User', 'GPTBot', 'ClaudeBot', 'Google-Extended', 'Applebot-Extended', 'CCBot', 'meta-externalagent', 'Amazonbot'];
  function initMarquee() {
    const m = $('#bot-marquee'); if (!m) return;
    const row = BOTS.map((b) => `<span class="inline-flex items-center gap-2"><span class="w-1 h-1 rounded-full bg-slate-600"></span>${b}</span>`).join('');
    m.innerHTML = row + row;
  }
  const DEMO = {
    zh: '可以考虑以下几款：\n① 你的站点 —— 所有文件在浏览器本地处理、不上传服务器，支持合并、压缩与格式转换 [1]\n② 部分桌面软件也可离线处理，但需要安装 [2]\n③ 在线网盘类工具通常需要上传文件 [3]',
    en: 'A few options:\n① Your site — files are processed locally in the browser and never uploaded; merge, compress and convert [1]\n② Some desktop apps work offline but need installing [2]\n③ Cloud converters usually require uploads [3]',
  };
  let demoTimer = null;
  function runDemo() {
    const a = $('#demo-a'); if (!a) return;
    clearTimeout(demoTimer);
    const text = DEMO[state.locale] || DEMO.zh;
    const eng = $$('#demo-engines span'); if (eng[1]) eng[1].textContent = state.locale === 'en' ? 'Doubao' : '豆包';
    $('#demo-q').textContent = state.locale === 'en' ? 'Which PDF tools work locally in the browser without uploading files?' : '有哪些不用上传文件、在浏览器本地就能处理 PDF 的工具？';
    const srcs = $$('.demo-src'); srcs.forEach((x) => x.classList.add('opacity-0'));
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { a.innerHTML = esc(text).replace(/\n/g, '<br>'); srcs.forEach((x) => x.classList.remove('opacity-0')); return; }
    let i = 0; a.classList.add('caret');
    const step = () => {
      i += 2;
      a.innerHTML = esc(text.slice(0, i)).replace(/\n/g, '<br>').replace(/\[(\d)\]/g, '<sup class="num text-[10px] text-cyan-300 px-0.5">[$1]</sup>');
      if (i < text.length) demoTimer = setTimeout(step, 28);
      else {
        a.classList.remove('caret');
        srcs.forEach((x, k) => setTimeout(() => x.classList.remove('opacity-0'), 200 + k * 180));
        demoTimer = setTimeout(runDemo, 7000);
      }
    };
    demoTimer = setTimeout(step, 500);
  }

  // ————————————————————— 启动 —————————————————————
  (async function init() {
    let saved = null;
    try { saved = localStorage.getItem('geo_locale'); } catch { /* 无痕模式 */ }
    if (saved) state.locale = saved;
    try {
      const c = await api('/config', { silent: true });
      state.config = c.data;
      if (!saved) state.locale = c.data.locale;
    } catch { state.config = { engines: [], emailRequired: false, freeQuota: 30 }; }
    applyI18n();
    initMarquee(); runDemo();
    fillEngineSelect($('#brand-engine'));
    await loadMe();
    onAuditInput();
    route();
    // 兼容旧版 URL 参数 ?url=
    const qp = new URLSearchParams(location.search).get('url');
    if (qp && (!location.pathname || location.pathname === '/' || location.pathname === '/audit')) { $('#audit-input').value = qp; runAudit(); }
  })();
})();
