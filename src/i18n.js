// 接口提示语翻译：业务代码统一写中文，英文界面下由中间件在输出时翻译 error / message / detail 字段
const EXACT = {
  'AI 引擎尚未配置（请在服务器 .env 中设置 LLM_API_KEY / GEO_ENGINES）': 'AI models are not configured on the server yet.',
  'AI 引擎尚未配置（请在服务器 .env 中设置 LLM_API_KEY）': 'AI models are not configured on the server yet.',
  'Sitemap 必须属于该域名': 'The sitemap must belong to this domain.',
  'Sitemap 网址格式不正确': 'Invalid sitemap URL.',
  '不支持该端口': 'That port is not supported.',
  '不能停用自己的账号': 'You cannot disable your own account.',
  '仅支持 http/https 网址': 'Only http/https URLs are supported.',
  '任务不存在': 'Run not found.',
  '原密码不正确': 'Current password is incorrect.',
  '发送过于频繁，请 60 秒后再试': 'Too many requests. Try again in 60 seconds.',
  '在线支付暂未开通，请按页面提示联系客服完成付款': 'Online payment is not available yet. Please follow the payment instructions.',
  '域名无法解析，请检查网址是否正确': 'Domain could not be resolved. Please check the URL.',
  '如果该邮箱已绑定账号，验证码将发送至邮箱': 'If this email is linked to an account, a code has been sent.',
  '官方原文链接需以 http(s):// 开头': 'The official URL must start with http(s)://.',
  '密码已修改': 'Password changed.',
  '密码已重置，请使用新密码登录': 'Password reset. Please log in with your new password.',
  '密码至少 8 位': 'Password must be at least 8 characters.',
  '密码过于简单，请混合使用字母和数字': 'Password too simple — mix letters and numbers.',
  '巡检过于频繁，请 10 分钟后再试': 'Too many checks. Try again in 10 minutes.',
  '已收到您的需求，我们会在 1 个工作日内通过您留下的联系方式与您沟通。': 'Thanks — we will contact you within one business day.',
  '当前网络今日注册账号过多，请明天再试或联系客服': 'Too many sign-ups from this network today. Please try again tomorrow.',
  '接口不存在': 'Not found.',
  '提交内容过大': 'Request too large.',
  '提交过于频繁，请稍后再试': 'Too many submissions. Please try again later.',
  '操作过于频繁，请稍后再试': 'Too many requests. Please slow down.',
  '文件内容过短': 'File content is too short.',
  '新密码至少 8 位': 'New password must be at least 8 characters.',
  '新密码至少 8 位': 'New password must be at least 8 characters.',
  '无效套餐': 'Invalid plan.',
  '服务器开小差了，请稍后重试': 'Something went wrong on our side. Please try again.',
  '模型未按要求返回 JSON，请重试': 'The model returned an unexpected format. Please retry.',
  '用户不存在': 'User not found.',
  '用户名不能包含空格或特殊符号': 'Username cannot contain spaces or special characters.',
  '用户名或密码不正确': 'Incorrect username or password.',
  '用户名需为 3~30 个字符': 'Username must be 3–30 characters.',
  '登录尝试过于频繁，请 15 分钟后再试': 'Too many login attempts. Try again in 15 minutes.',
  '目标地址指向内网或保留地址，已拒绝访问': 'That address points to a private or reserved network and was refused.',
  '目标服务器拒绝连接': 'The server refused the connection.',
  '目标网站 HTTPS 证书异常': 'The site’s HTTPS certificate is invalid.',
  '站点不存在': 'Site not found.',
  '线索不存在': 'Lead not found.',
  '结果不存在或已过期': 'Result not found or expired.',
  '结果不存在或已过期，请重新体检': 'Result not found or expired. Please run the audit again.',
  '网址中不能包含账号密码': 'URLs cannot contain credentials.',
  '网址格式不正确': 'Invalid URL.',
  '订单不存在': 'Order not found.',
  '订单不存在或不是待支付状态': 'Order not found or not pending.',
  '订单不存在或已处理': 'Order not found or already processed.',
  '记录不存在': 'Record not found.',
  '该域名已在托管列表中': 'This domain is already in your list.',
  '该用户名已被使用': 'That username is taken.',
  '该订单不是待支付状态': 'This order is not pending.',
  '该账号已被停用，请联系客服': 'This account has been disabled. Please contact support.',
  '该邮箱已注册': 'That email is already registered.',
  '该邮箱已注册，请直接登录或找回密码': 'That email is already registered. Log in or reset your password.',
  '请先完成 IndexNow Key 验证（在网站根目录放置 Key 文件）': 'Verify your IndexNow key first (upload the key file to your site root).',
  '请先生成语料': 'Generate the capsule first.',
  '请先登录': 'Please log in.',
  '请先登录后再使用该功能': 'Please log in to use this feature.',
  '请先获取验证码': 'Please request a verification code first.',
  '请填写主体名称和争议说法': 'Enter the subject and the claim.',
  '请填写品牌名称和官网域名': 'Enter the brand name and website domain.',
  '请填写有效邮箱并完成验证': 'Enter a valid email and verify it.',
  '请完整填写称呼、联系方式、主体名称和需求描述': 'Please fill in your name, contact, organization and request.',
  '请求 JSON 格式错误': 'Malformed JSON request.',
  '请求格式错误（需要 application/json）': 'Invalid request format (application/json required).',
  '请粘贴官方已发布（或拟发布）的澄清内容，至少 20 字。系统不会替您编写官方结论': 'Paste your published (or planned) official statement, at least 20 characters. We never write official conclusions for you.',
  '请粘贴至少 50 字的正文': 'Paste at least 50 characters of text.',
  '请至少填写 2 条真实、可核实的关键事实（每行一条），实验室只使用您提供的事实': 'Enter at least 2 true, verifiable facts (one per line). The lab only uses facts you provide.',
  '请至少输入 1 个竞品网址': 'Enter at least one competitor URL.',
  '请输入品牌或机构名称': 'Enter a brand or organization name.',
  '请输入您的网址': 'Enter your URL.',
  '请输入有效的邮箱地址': 'Enter a valid email address.',
  '请输入正确的域名': 'Enter a valid domain.',
  '请输入正确的域名，例如 example.com': 'Enter a valid domain, e.g. example.com.',
  '请输入正确的网址，例如 https://example.com': 'Enter a valid URL, e.g. https://example.com.',
  '请输入用户名和密码': 'Enter your username and password.',
  '请输入监测主体名称': 'Enter the subject to monitor.',
  '请输入要测试的问题': 'Enter a question to test.',
  '请选择要开通的套餐': 'Choose a plan.',
  '返回的是网页 HTML 而不是纯文本，常见原因是站点把所有路径都重定向到了首页': 'It returned an HTML page instead of plain text — usually because the site redirects every path to the homepage.',
  '连接目标网站超时': 'Timed out connecting to the site.',
  '邮件发送失败，请检查邮箱地址或稍后重试': 'Could not send the email. Check the address or try again later.',
  '邮件服务未配置': 'Email service is not configured.',
  '邮件服务未配置，暂时无法发送验证码': 'Email service is not configured, so codes cannot be sent.',
  '邮箱格式不正确': 'Invalid email address.',
  '重定向次数过多': 'Too many redirects.',
  '需要管理员权限': 'Admin access required.',
  '额度不合法': 'Invalid quota.',
  '验证码不正确': 'Incorrect code.',
  '验证码已发送，请查收邮箱（如未收到请检查垃圾邮件）': 'Code sent. Check your inbox (and spam folder).',
  '验证码已过期，请重新获取': 'Code expired. Please request a new one.',
  '验证码请求过于频繁，请 1 小时后再试': 'Too many code requests. Try again in an hour.',
  '验证码错误次数过多，请重新获取': 'Too many wrong attempts. Please request a new code.',
  '验证通过：Key 文件可访问且内容正确': 'Verified: key file is reachable and correct.',
  '推送成功，搜索引擎已接收': 'Pushed — accepted by the search engine.',
  '已接收，搜索引擎将验证 Key 后处理': 'Accepted — the search engine will verify the key and process it.',
  '请求格式有误': 'Malformed request.',
  'Key 验证失败：请确认 Key 文件可访问': 'Key verification failed: make sure the key file is reachable.',
  '网址与站点不匹配或 Key 不匹配': 'URLs don’t match the site, or the key doesn’t match.',
  '推送过于频繁，请稍后再试': 'Pushing too often. Please try again later.',
  '服务重启导致任务中断，请重新发起': 'The run was interrupted by a server restart. Please start it again.',
  '所有模型调用均失败：未知错误': 'All model calls failed.',
};

const PATTERNS = [
  [/^今日额度已用完，明日 0 点恢复。游客每天 5 次，免费注册用户每天 30 次。$/, () => 'Daily quota reached — resets at 00:00 tomorrow. 5 runs/day for guests, 30 runs/day for free registered users.'],
  [/^今日额度已用完，明日 0 点恢复。游客每天 5 次，免费注册用户每天 30 次，或升级套餐获取更多额度。$/, () => 'Daily quota reached — resets at 00:00 tomorrow. 5 runs/day for guests, 30 runs/day for free registered users, or upgrade for more.'],
  [/^游客每日可免费体验 (\d+) 次，今日已用完。注册账号即可每日获得 (\d+) 次额度。$/, (m) => `Guests get ${m[1]} free runs per day and today’s are used up. Sign up for ${m[2]} per day.`],
  [/^今日额度已用完（(\d+) 次\/天，本次需要 (\d+) 次），明日 0 点（北京时间）自动恢复，或升级套餐提升额度。$/, (m) => `Daily limit reached (${m[1]}/day; this needs ${m[2]}). It resets at midnight Beijing time, or upgrade your plan.`],
  [/^当前套餐最多托管 (\d+) 个站点，请升级套餐$/, (m) => `Your plan allows up to ${m[1]} sites. Please upgrade.`],
  [/^没有可推送的网址（网址必须属于 (.+)）$/, (m) => `No URLs to push (URLs must belong to ${m[1]}).`],
  [/^Sitemap 无法访问（HTTP (\d+)）：(.+)$/, (m) => `Sitemap unreachable (HTTP ${m[1]}): ${m[2]}`],
  [/^文件可访问，但内容不是该 Key（请确认文件内容只有这一行：(.+)）$/, (m) => `The file is reachable but its content isn’t the key (it must contain only: ${m[1]}).`],
  [/^无法访问 (\S+)（HTTP (\d+)），请确认文件已上传到网站根目录$/, (m) => `Could not access ${m[1]} (HTTP ${m[2]}). Make sure the file is in your site root.`],
  [/^无法访问 (\S+)：(.+)$/, (m) => `Could not access ${m[1]}: ${tr(m[2])}`],
  [/^无法连接目标网站（(.+)）$/, (m) => `Could not connect to the site (${m[1]}).`],
  [/^未找到 (\S+)（HTTP (\d+)）$/, (m) => `Not found: ${m[1]} (HTTP ${m[2]})`],
  [/^已检测到 (\S+)，格式符合 llms\.txt 规范（以 # 标题开头）$/, (m) => `Found ${m[1]} — format looks valid (starts with a # title).`],
  [/^已检测到 (\S+)，建议以“# 站点名称”开头$/, (m) => `Found ${m[1]} — consider starting it with “# Site name”.`],
  [/^所有模型调用均失败：(.+)$/, (m) => `All model calls failed: ${tr(m[1])}`],
  [/^首页体检失败：(.+)$/, (m) => `Homepage check failed: ${tr(m[1])}`],
  [/^(.+) 响应超时$/, (m) => `${m[1]} timed out.`],
  [/^(.+) 连接失败：(.+)$/, (m) => `${m[1]} connection failed: ${m[2]}`],
  [/^(.+) 返回错误 HTTP (\d+)(.*)$/, (m) => `${m[1]} returned HTTP ${m[2]}${m[3]}`],
  [/^(.+) 返回了空回答$/, (m) => `${m[1]} returned an empty answer.`],
  [/^(.+) 返回了无法解析的内容$/, (m) => `${m[1]} returned an unreadable response.`],
  [/^IndexNow 返回 HTTP (\d+)$/, (m) => `IndexNow returned HTTP ${m[1]}`],
  [/^网络错误：(.+)$/, (m) => `Network error: ${m[1]}`],
  [/^请求失败（HTTP (\d+)）$/, (m) => `Request failed (HTTP ${m[1]})`],
];

export function tr(msg) {
  if (typeof msg !== 'string' || !/[一-龥]/.test(msg)) return msg;
  if (EXACT[msg]) return EXACT[msg];
  for (const [re, fn] of PATTERNS) {
    const m = msg.match(re);
    if (m) return fn(m);
  }
  return msg;
}

// 解析请求语言：前端通过 X-Locale 头传递，其次看 Accept-Language
export function localeMiddleware(req, res, next) {
  const h = String(req.headers['x-locale'] || '').toLowerCase();
  req.locale = h === 'en' || h === 'zh' ? h : (String(req.headers['accept-language'] || '').toLowerCase().startsWith('en') ? 'en' : 'zh');
  if (req.locale === 'en') {
    const json = res.json.bind(res);
    res.json = (body) => {
      if (body && typeof body === 'object') {
        for (const k of ['error', 'message']) if (typeof body[k] === 'string') body[k] = tr(body[k]);
        const d = body.data;
        if (d && typeof d === 'object' && !Array.isArray(d)) {
          for (const k of ['message', 'detail', 'error']) if (typeof d[k] === 'string') d[k] = tr(d[k]);
          if (d.pushed && typeof d.pushed.message === 'string') d.pushed.message = tr(d.pushed.message);
        }
      }
      return json(body);
    };
  }
  next();
}
