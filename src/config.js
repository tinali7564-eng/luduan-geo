// 统一配置：所有密钥与可变参数只从环境变量 / .env 读取，代码中不再出现任何明文密钥。
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(__dirname, '..');

// 轻量 .env 解析（不引入 dotenv 依赖）。已存在的环境变量优先。
function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadDotEnv(path.join(ROOT_DIR, '.env'));

const env = (k, d = '') => (process.env[k] ?? d).toString().trim();
const bool = (k, d = false) => {
  const v = env(k, d ? '1' : '0').toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
};
const int = (k, d) => {
  const n = parseInt(env(k, String(d)), 10);
  return Number.isFinite(n) ? n : d;
};

export const DATA_DIR = path.resolve(env('DATA_DIR', path.join(ROOT_DIR, 'data')));
fs.mkdirSync(DATA_DIR, { recursive: true });

// JWT 密钥：未配置时自动生成随机密钥并持久化到数据目录，杜绝“默认密钥可伪造登录态”的问题。
function resolveJwtSecret() {
  const fromEnv = env('JWT_SECRET');
  if (fromEnv && fromEnv.length >= 16) return fromEnv;
  const file = path.join(DATA_DIR, '.jwt_secret');
  if (fs.existsSync(file)) {
    const s = fs.readFileSync(file, 'utf8').trim();
    if (s.length >= 32) return s;
  }
  const s = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(file, s, { mode: 0o600 });
  console.log('[config] JWT_SECRET 未配置，已自动生成并保存到数据目录 .jwt_secret');
  return s;
}

// 多引擎配置：GEO_ENGINES 为 JSON 数组，每项 {id,label,model,baseUrl?,apiKey?,web?}
// 未配置时使用单一默认引擎（LLM_MODEL）。
function resolveEngines(defaults) {
  const raw = env('GEO_ENGINES');
  let list = [];
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed;
    } catch (e) {
      console.error('[config] GEO_ENGINES 不是合法 JSON，已忽略：', e.message);
    }
  }
  if (list.length === 0 && defaults.apiKey) {
    list = [{ id: 'default', label: defaults.model, model: defaults.model }];
  }
  return list
    .filter(e => e && e.id && e.model)
    .map(e => ({
      id: String(e.id).replace(/[^a-z0-9_-]/gi, '').slice(0, 32),
      label: String(e.label || e.model).slice(0, 60),
      model: String(e.model),
      baseUrl: (e.baseUrl || defaults.baseUrl).replace(/\/+$/, ''),
      apiKey: e.apiKey || defaults.apiKey,
      web: !!e.web, // 该模型是否具备联网检索能力（仅用于界面如实标注）
    }));
}

const llmDefaults = {
  baseUrl: env('LLM_BASE_URL', 'https://api.dailytoolbox.org/v1').replace(/\/+$/, ''),
  apiKey: env('LLM_API_KEY'),
  model: env('LLM_MODEL', 'glm-5.2'),
};

export const config = {
  port: int('PORT', 8092),
  isProd: env('NODE_ENV') === 'production',
  publicUrl: env('PUBLIC_URL', 'https://geo.dailytoolbox.org').replace(/\/+$/, ''),
  jwtSecret: resolveJwtSecret(),
  // 仅供本地开发/测试：允许体检内网地址（生产环境务必保持关闭，否则存在 SSRF 风险）
  allowPrivateTargets: bool('ALLOW_PRIVATE_TARGETS', false),

  adminUsername: env('ADMIN_USERNAME', 'admin'),
  adminPassword: env('ADMIN_PASSWORD'),

  llm: {
    ...llmDefaults,
    timeoutMs: int('LLM_TIMEOUT_MS', 90000),
    judgeModel: env('LLM_JUDGE_MODEL', llmDefaults.model),
    concurrency: Math.max(1, int('LLM_CONCURRENCY', 4)),
  },
  engines: resolveEngines(llmDefaults),

  smtp: {
    host: env('SMTP_HOST', 'smtp.qq.com'),
    port: int('SMTP_PORT', 465),
    user: env('SMTP_USER'),
    pass: env('SMTP_PASS'),
    fromName: env('SMTP_FROM_NAME', 'DailyToolbox GEO'),
  },

  r2: {
    accountId: env('CF_ACCOUNT_ID'),
    bucket: env('R2_BUCKET_NAME'),
    accessKeyId: env('R2_ACCESS_KEY_ID'),
    secretAccessKey: env('R2_SECRET_ACCESS_KEY'),
  },

  telegram: { token: env('TELEGRAM_BOT_TOKEN'), chatId: env('TELEGRAM_CHAT_ID') },

  // 本站自身（dailytoolbox.org 系列）的 IndexNow key；用户托管站点各自生成独立 key
  indexNowKey: env('INDEXNOW_KEY'),
  googleSaPath: env('GOOGLE_SA_PATH', path.join(ROOT_DIR, 'google-sa.json')),

  guestDailyQuota: int('GUEST_DAILY_QUOTA', 5),
  freeDailyQuota: int('FREE_DAILY_QUOTA', 30),
  registerPerIpPerDay: int('REGISTER_PER_IP_PER_DAY', 3),

  demoPayments: bool('DEMO_PAYMENTS', false),
  payContact: env('PAY_CONTACT', '请添加客服微信完成对公转账或扫码付款，付款后 1 个工作日内开通'),
  payContactEn: env('PAY_CONTACT_EN', 'Please contact us to pay by bank transfer; include your order number. Your plan is activated within one business day.'),
  payQrUrl: env('PAY_QR_URL'), // 可选：收款码图片地址（放在 public/ 下即可，如 /pay-qr.png）

  reportIssuer: env('REPORT_ISSUER', '甪端 GEO 智能体（DailyToolbox）'),
  reportIssuerEn: env('REPORT_ISSUER_EN', 'Luduan GEO Agent (DailyToolbox)'),

  schedulerEnabled: bool('SCHEDULER_ENABLED', true),
  gaId: env('GA_ID', 'G-7TLTQ13LW5'),
};

export const smtpConfigured = () => !!(config.smtp.user && config.smtp.pass);
export const llmConfigured = () => config.engines.length > 0 && !!config.engines[0].apiKey;
export const r2Configured = () => !!(config.r2.accountId && config.r2.bucket && config.r2.accessKeyId && config.r2.secretAccessKey);
