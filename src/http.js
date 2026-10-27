// HTTP 通用工具：客户端 IP、安全响应头、限流、错误处理、HTML 转义
const TRUST_CF = ['1', 'true', 'yes'].includes(String(process.env.TRUST_CF_HEADER || '').toLowerCase());

export function getClientIp(req) {
  if (req.headers['cf-connecting-ip']) return String(req.headers['cf-connecting-ip']).trim();
  if (req.headers['x-real-ip']) return String(req.headers['x-real-ip']).trim();
  const xff = req.headers['x-forwarded-for'];
  if (xff) {
    const ips = String(xff).split(',').map(s => s.trim()).filter(Boolean);
    if (ips.length) return ips[0].replace(/^::ffff:/, '');
  }
  return (req.ip || req.socket?.remoteAddress || '').replace(/^::ffff:/, '');
}

export function securityHeaders(gaEnabled) {
  const scriptSrc = ["'self'"];
  const connectSrc = ["'self'"];
  if (gaEnabled) {
    scriptSrc.push('https://www.googletagmanager.com');
    connectSrc.push('https://*.google-analytics.com', 'https://*.analytics.google.com', 'https://www.googletagmanager.com');
  }
  const csp = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    `connect-src ${connectSrc.join(' ')}`,
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'self'",
    "form-action 'self'",
  ].join('; ');
  return (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (!req.path.startsWith('/api/')) res.setHeader('Content-Security-Policy', csp);
    next();
  };
}

// 简单内存滑动窗口限流（单进程部署足够；多实例部署请换 Redis）
const buckets = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
}, 60000).unref();

export function rateLimit({ windowMs, max, key = 'ip', message }) {
  return (req, res, next) => {
    const id = key === 'user' && req.user ? `u${req.user.id}` : getClientIp(req);
    const k = `${req.baseUrl}${req.route?.path || req.path}|${id}|${windowMs}`;
    const now = Date.now();
    let b = buckets.get(k);
    if (!b || b.reset < now) { b = { count: 0, reset: now + windowMs }; buckets.set(k, b); }
    b.count++;
    if (b.count > max) {
      res.setHeader('Retry-After', Math.ceil((b.reset - now) / 1000));
      return res.status(429).json({ success: false, code: 'RATE_LIMITED', error: message || '操作过于频繁，请稍后再试' });
    }
    next();
  };
}

// 跨站请求防护：写操作必须是 JSON（浏览器跨站表单无法在不触发预检的情况下发送 application/json）
export function requireJsonForWrites(req, res, next) {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.path.startsWith('/api/')) {
    const len = parseInt(req.headers['content-length'] || '0', 10);
    if (len > 0 && !req.is('application/json')) {
      return res.status(415).json({ success: false, error: '请求格式错误（需要 application/json）' });
    }
  }
  next();
}

export class HttpError extends Error {
  constructor(status, message, code) { super(message); this.status = status; this.code = code; }
}
export const bad = (msg, code) => new HttpError(400, msg, code);

export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function errorHandler(err, req, res, _next) {
  if (typeof req.refundQuota === 'function') {
    try { req.refundQuota(); } catch {}
  }
  if (err?.type === 'entity.too.large') return res.status(413).json({ success: false, error: '提交内容过大' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ success: false, error: '请求 JSON 格式错误' });
  if (err instanceof HttpError) return res.status(err.status).json({ success: false, error: err.message, code: err.code });
  console.error(`[error] ${req.method} ${req.originalUrl}:`, err);
  res.status(500).json({ success: false, error: req.locale === 'en' ? 'Server error, please try again later.' : '服务器开小差了，请稍后重试' });
}

export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const str = (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// 规范化域名输入：去协议、路径、端口、小写
export function normalizeDomain(input) {
  let d = str(input, 300).toLowerCase();
  if (!d) return '';
  d = d.replace(/^[a-z]+:\/\//, '').split(/[/?#]/)[0];
  if (process.env.ALLOW_PRIVATE_TARGETS === '1' && /^[a-z0-9.-]+(:\d+)?$/.test(d)) return d; // 仅本地开发
  d = d.replace(/:\d+$/, '').replace(/\.$/, '');
  if (!/^[a-z0-9.-]+\.[a-z0-9-]{2,}$/i.test(d) && !/^[一-龥a-z0-9.-]+\.[一-龥a-z0-9-]{2,}$/i.test(d)) return '';
  return d;
}
