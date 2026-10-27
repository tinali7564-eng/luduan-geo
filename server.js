import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { config, ROOT_DIR, DATA_DIR, llmConfigured, smtpConfigured } from './src/config.js';
import { initDb, get, run } from './src/db.js';
import { hashPassword, verifyPassword } from './src/auth.js';
import { securityHeaders, requireJsonForWrites, errorHandler } from './src/http.js';
import authRoutes from './src/routes/auth.js';
import apiRoutes, { sourcePage } from './src/routes/api.js';
import adminRoutes from './src/routes/admin.js';
import { startScheduler } from './src/sites.js';
import { localeMiddleware } from './src/i18n.js';

initDb();
seedAdmin();

const app = express();
app.disable('x-powered-by');
// 反向代理跳数（Nginx 一层 = 1；Cloudflare + Nginx 可设 2，或开启 TRUST_CF_HEADER）
app.set('trust proxy', /^\d+$/.test(process.env.TRUST_PROXY || '') ? parseInt(process.env.TRUST_PROXY, 10) : (process.env.TRUST_PROXY || 1));
app.use(securityHeaders(!!config.gaId));
app.use(express.json({ limit: '200kb' }));
app.use(localeMiddleware);
app.use(requireJsonForWrites);

app.get('/healthz', (req, res) => res.json({ ok: true, llm: llmConfigured(), smtp: smtpConfigured() }));

app.use('/api', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', apiRoutes);
app.get(['/s/:token', '/api/source/:token'], sourcePage);
app.use('/api', (req, res) => res.status(404).json({ success: false, error: '接口不存在' }));

// 本站自身的 IndexNow key 文件（如配置）
if (config.indexNowKey) {
  app.get(`/${config.indexNowKey}.txt`, (req, res) => res.type('text/plain').send(config.indexNowKey));
}

const publicDir = path.join(ROOT_DIR, 'public');
app.use('/assets', express.static(path.join(publicDir, 'assets'), { maxAge: '30d', immutable: true }));
app.use(express.static(publicDir, { index: false, maxAge: '1h' }));

// 页面：注入资源版本号，保证发布后浏览器立即拿到新版本
const assetVersion = (() => {
  const h = crypto.createHash('md5');
  for (const f of ['app.js', 'app.css', 'admin.js']) {
    const p = path.join(publicDir, 'assets', f);
    if (fs.existsSync(p)) h.update(fs.readFileSync(p));
  }
  return h.digest('hex').slice(0, 10);
})();
const ROUTE_META = {
  '/audit': {
    title: '可见度体检 · 甪端 GEO — 当用户问 AI，答案里有你吗？',
    desc: '检测 ChatGPT、DeepSeek、豆包、Perplexity 等 AI 能否读取、理解并引用你的网站与品牌，并给出可直接上线的修复代码。',
  },
  '/pricing': {
    title: '套餐价格 · 甪端 GEO — 网站体检、首推实验室与 AI 舆情监测定价',
    desc: '甪端 GEO 套餐价格：免费注册每日享 30 次体检额度；专业版与企业版提供大模型 A/B 对比、站点托管自动 IndexNow 推送与权威媒体红V行动卡闭环。',
  },
  '/lab': {
    title: '首推实验室 · 甪端 GEO — 真实大模型 A/B 对比实测',
    desc: '首推实验室：对比不同内容版本在真实大模型中的检索与推荐表现，多轮采样聚合提及率、首推排名与引用倾向。',
  },
  '/monitor': {
    title: '站点托管 · 甪端 GEO — IndexNow 搜索引擎即时推送',
    desc: '站点托管：每日自动巡检 Sitemap，新发布或更新的网页通过 IndexNow 秒级推送 Bing、Yandex 等 AI 搜索信源。',
  },
  '/risk': {
    title: 'AI 舆情监测 · 甪端 GEO — 大模型认知与争议推演',
    desc: 'AI 舆情与认知监测：多模型交叉推演，客观监测大模型对品牌争议的复述率、官方信息提及率与情感倾向。',
  },
  '/redv': {
    title: '红V发布闭环 · 甪端 GEO — 媒体行动卡与效果验证',
    desc: '红V发布闭环：关联主流媒体红V账号矩阵，由系统根据品牌审计弱点生成行动卡，人工发布后自动观测模型回答变化与信源引用。',
  },
  '/history': {
    title: '历史记录 · 甪端 GEO — 网站与品牌 AI 体检归档',
    desc: '查看历史网站可见度体检与品牌 AI 认知诊断报告，对比优化前后得分变化与引用提升。',
  },
  '/account': {
    title: '我的账户 · 甪端 GEO — 个人中心与配额管理',
    desc: '管理甪端 GEO 账户、API 线路、套餐订阅与站点托管资产。',
  },
  '/about': {
    title: '关于我们 · 甪端 GEO — 生成式引擎优化与 AI 搜索中控',
    desc: '关于甪端 GEO（DailyToolbox 旗下）：专注于让网站与品牌在生成式 AI 时代被精准理解、权威引用的专业平台。',
  },
  '/contact': {
    title: '联系我们 · 甪端 GEO — 商务咨询与专属支持',
    desc: '联系甪端 GEO 团队：获取企业级 GEO 定制方案、媒体矩阵派发与技术咨询。',
  },
  '/privacy': {
    title: '隐私政策 · 甪端 GEO',
    desc: '甪端 GEO 隐私政策：仅采集公开网页，保障用户数据隐私与安全。',
  },
  '/terms': {
    title: '服务条款 · 甪端 GEO',
    desc: '甪端 GEO 服务条款与免责声明。',
  },
};

const renderPage = (file, reqPath = '/') => {
  let html = fs.readFileSync(path.join(publicDir, file), 'utf8')
    .replaceAll('__V__', assetVersion)
    .replaceAll('__GA_ID__', config.gaId || '');
  if (!config.gaId) html = html.replace(/<!--GA-->[\s\S]*?<!--\/GA-->/g, '');

  const normPath = reqPath.split('?')[0].replace(/\/+$/, '') || '/';
  let meta = ROUTE_META[normPath];
  if (!meta && (normPath.startsWith('/result/') || normPath.startsWith('/results/'))) {
    meta = {
      title: '体检诊断报告 · 甪端 GEO — 生成式引擎优化 (GEO) 深度评估',
      desc: '查看专属 GEO 评估诊断报告：AI 爬虫访问矩阵、四维评分、典型问题推演与权威信源引用。',
    };
  }
  if (meta) {
    html = html.replace(/<title>.*?<\/title>/i, `<title>${meta.title}</title>`)
      .replace(/<meta name="description" content=".*?">/i, `<meta name="description" content="${meta.desc}">`)
      .replace(/<link rel="canonical" href=".*?">/i, `<link rel="canonical" href="https://geo.dailytoolbox.org${normPath}">`)
      .replace(/<meta property="og:url" content=".*?">/i, `<meta property="og:url" content="https://geo.dailytoolbox.org${normPath}">`)
      .replace(/<meta property="og:title" content=".*?">/i, `<meta property="og:title" content="${meta.title}">`)
      .replace(/<meta property="og:description" content=".*?">/i, `<meta property="og:description" content="${meta.desc}">`);
  }
  return html;
};

const pages = { index: renderPage('index.html'), admin: renderPage('admin.html') };
const sendPage = (name) => (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  const reqPath = req.path;
  const normPath = reqPath.split('?')[0].replace(/\/+$/, '') || '/';
  if (name === 'index' && (ROUTE_META[normPath] || normPath.startsWith('/result/') || normPath.startsWith('/results/'))) {
    res.type('html').send(renderPage('index.html', reqPath));
  } else {
    res.type('html').send(config.isProd && name in pages ? pages[name] : renderPage(`${name}.html`, reqPath));
  }
};
app.get('/admin', sendPage('admin'));
app.get('*', (req, res, next) => (req.accepts('html') ? sendPage('index')(req, res) : next()));

app.use(errorHandler);

app.listen(config.port, '0.0.0.0', () => {
  console.log(`[geo] DailyToolbox GEO 已启动：http://0.0.0.0:${config.port}  数据目录：${DATA_DIR}`);
  if (!llmConfigured()) console.warn('[geo] ⚠ 未配置 LLM_API_KEY：品牌诊断 / 实验室 / 舆情监测等 AI 功能将不可用');
  if (!smtpConfigured()) console.warn('[geo] ⚠ 未配置 SMTP：注册无需邮箱验证，找回密码不可用');
  if (config.allowPrivateTargets) console.warn('[geo] ⚠ ALLOW_PRIVATE_TARGETS 已开启，仅限本地开发使用');
  if (config.demoPayments) console.warn('[geo] ⚠ DEMO_PAYMENTS 已开启：用户可一键模拟支付升级套餐');
  startScheduler();
});

function seedAdmin() {
  const name = config.adminUsername;
  const admin = get('SELECT id, password_hash FROM users WHERE username = ?', [name]);
  if (!admin) {
    const pass = config.adminPassword || crypto.randomBytes(9).toString('base64url');
    run("INSERT INTO users (username, password_hash, role, quota_daily, register_ip, plan) VALUES (?, ?, 'admin', 9999, '127.0.0.1', 'enterprise')", [name, hashPassword(pass)]);
    if (!config.adminPassword) {
      const f = path.join(DATA_DIR, '.admin_initial_password');
      fs.writeFileSync(f, `${name}\n${pass}\n`, { mode: 0o600 });
      console.log(`[geo] 已创建管理员账号 ${name}，初始密码已写入 ${f}（登录后请修改并删除该文件）`);
    }
    return;
  }
  run("UPDATE users SET role = 'admin' WHERE id = ?", [admin.id]);
  // 旧版默认密码仍在使用时：若提供了 ADMIN_PASSWORD 则自动替换，否则持续告警
  const legacyDefault = verifyPassword('DailyToolbox2026!', admin.password_hash).ok;
  if (config.adminPassword && (legacyDefault || process.env.ADMIN_PASSWORD_FORCE_RESET === '1')) {
    run('UPDATE users SET password_hash = ? WHERE id = ?', [hashPassword(config.adminPassword), admin.id]);
    console.log('[geo] 管理员密码已更新为 ADMIN_PASSWORD 中的值');
  } else if (legacyDefault) {
    console.warn('[geo] ⚠⚠ 管理员仍在使用旧版公开的默认密码！请在 .env 设置 ADMIN_PASSWORD 后重启，或登录后立即修改密码');
  }
}
