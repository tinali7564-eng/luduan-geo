import crypto from 'crypto';
import { get, run } from './db.js';
import { config } from './config.js';
import { getClientIp } from './http.js';

// ———————————— 密码哈希 ————————————
// 新格式：pbkdf2$<迭代次数>$<salt>$<hash>；兼容旧格式 salt:hash（1000 次迭代），登录成功后自动升级。
const ITER = 210000;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, ITER, 64, 'sha512').toString('hex');
  return `pbkdf2$${ITER}$${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored || typeof password !== 'string') return { ok: false };
  let iter, salt, expected;
  if (stored.startsWith('pbkdf2$')) {
    const parts = stored.split('$');
    if (parts.length !== 4) return { ok: false };
    iter = parseInt(parts[1], 10); salt = parts[2]; expected = parts[3];
  } else if (stored.includes(':')) {
    [salt, expected] = stored.split(':');
    iter = 1000;
  } else {
    return { ok: false };
  }
  const hash = crypto.pbkdf2Sync(password, salt, iter, 64, 'sha512');
  const exp = Buffer.from(expected, 'hex');
  const ok = exp.length === hash.length && crypto.timingSafeEqual(hash, exp);
  return { ok, needsRehash: ok && iter < ITER };
}

// ———————————— 会话令牌（HMAC 签名，JWT 兼容格式）————————————
export function generateToken(payload, days = 7) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + days * 86400 })).toString('base64url');
  const sig = crypto.createHmac('sha256', config.jwtSecret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const expected = crypto.createHmac('sha256', config.jwtSecret).update(`${parts[0]}.${parts[1]}`).digest('base64url');
  const a = Buffer.from(parts[2]); const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

export const COOKIE_NAME = 'geo_auth_token';

export function setAuthCookie(req, res, token) {
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; Path=/; Max-Age=${7 * 86400}; SameSite=Lax; HttpOnly${secure ? '; Secure' : ''}`);
}
export function clearAuthCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly`);
}

function readToken(req) {
  const h = req.headers.authorization;
  if (h && h.startsWith('Bearer ')) return h.slice(7).trim();
  const c = req.headers.cookie;
  if (!c) return null;
  for (const part of c.split(';')) {
    const i = part.indexOf('=');
    if (i > -1 && part.slice(0, i).trim() === COOKIE_NAME) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

// 读取用户并处理套餐过期（过期自动回落免费版）
export function loadUser(id) {
  const u = get('SELECT id, username, role, plan, plan_expires_at, quota_daily, phone, disabled, created_at FROM users WHERE id = ?', [id]);
  if (!u || u.id === 0 || u.disabled) return null;
  if (u.plan && u.plan !== 'free' && u.plan_expires_at && new Date(u.plan_expires_at.replace(' ', 'T') + 'Z') < new Date()) {
    run("UPDATE users SET plan = 'free', quota_daily = ? WHERE id = ?", [config.freeDailyQuota, u.id]);
    u.plan = 'free'; u.quota_daily = config.freeDailyQuota;
  }
  u.plan = u.plan || 'free';
  return u;
}

function resolveUser(req) {
  const payload = verifyToken(readToken(req));
  return payload && payload.id ? loadUser(payload.id) : null;
}

export function optionalAuth(req, res, next) {
  req.user = resolveUser(req);
  next();
}

export function requireAuth(req, res, next) {
  const user = resolveUser(req);
  if (!user) return res.status(401).json({ success: false, error: '请先登录后再使用该功能', code: 'NEED_LOGIN' });
  req.user = user;
  next();
}

export function requireAdmin(req, res, next) {
  const user = resolveUser(req);
  if (!user) return res.status(401).json({ success: false, error: '请先登录', code: 'NEED_LOGIN' });
  if (user.role !== 'admin') return res.status(403).json({ success: false, error: '需要管理员权限' });
  req.user = user;
  next();
}

// ———————————— 额度 ————————————
const today = () => new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10); // 以北京时间零点重置

export function quotaStatus(req) {
  const d = today();
  if (req.user) {
    const row = get('SELECT count FROM user_daily_usage WHERE user_id = ? AND usage_date = ?', [req.user.id, d]);
    const used = row ? row.count : 0;
    const limit = req.user.quota_daily || config.freeDailyQuota;
    return { used, limit, remaining: Math.max(0, limit - used), guest: false };
  }
  const ip = getClientIp(req);
  const row = get('SELECT count FROM guest_daily_usage WHERE ip = ? AND usage_date = ?', [ip, d]);
  const used = row ? row.count : 0;
  const limit = config.guestDailyQuota;
  return { used, limit, remaining: Math.max(0, limit - used), guest: true };
}

// cost：本次操作消耗的额度（多引擎任务按引擎数计）
export function consumeQuota(req, cost = 1) {
  const s = quotaStatus(req);
  if (s.remaining < cost) return { allowed: false, ...s };
  const d = today();
  if (req.user) {
    run(`INSERT INTO user_daily_usage (user_id, usage_date, count) VALUES (?, ?, ?)
         ON CONFLICT(user_id, usage_date) DO UPDATE SET count = count + excluded.count`, [req.user.id, d, cost]);
  } else {
    run(`INSERT INTO guest_daily_usage (ip, usage_date, count) VALUES (?, ?, ?)
         ON CONFLICT(ip, usage_date) DO UPDATE SET count = count + excluded.count`, [getClientIp(req), d, cost]);
  }
  return { allowed: true, used: s.used + cost, limit: s.limit, remaining: s.remaining - cost, guest: s.guest };
}

export function refundQuota(req, cost) {
  const d = today();
  try {
    if (req.user) run('UPDATE user_daily_usage SET count = MAX(0, count - ?) WHERE user_id = ? AND usage_date = ?', [cost, req.user.id, d]);
    else run('UPDATE guest_daily_usage SET count = MAX(0, count - ?) WHERE ip = ? AND usage_date = ?', [cost, getClientIp(req), d]);
  } catch (e) { console.error('[quota refund]', e.message); }
}

// 额度中间件工厂
export function withQuota(cost = 1) {
  return (req, res, next) => {
    const c = typeof cost === 'function' ? cost(req) : cost;
    const q = consumeQuota(req, c);
    if (!q.allowed) {
      return res.status(429).json({
        success: false,
        code: 'QUOTA_EXCEEDED',
        error: q.guest
          ? (req.locale === 'en' ? 'Daily quota reached. 5 audits/day for guests, 30 free audits/day for registered users.' : '今日额度已用完，明日 0 点恢复。游客每天 5 次，免费注册用户每天 30 次。')
          : (req.locale === 'en' ? 'Daily quota reached. Resets at 00:00 (UTC+8), or upgrade your plan.' : '今日额度已用完，明日 0 点恢复。游客每天 5 次，免费注册用户每天 30 次，或升级套餐获取更多额度。'),
      });
    }
    req.quota = q;

    let refunded = false;
    const doRefund = () => {
      if (refunded) return;
      refunded = true;
      refundQuota(req, c);
      if (req.quota) req.quota.remaining += c;
    };

    req.refundQuota = doRefund;

    // 1. 请求完成时如果状态码 >= 400，自动退款
    res.on('finish', () => {
      if (res.statusCode >= 400) doRefund();
    });

    // 2. 客户端中断请求、连接断开或超时未正常完成时，自动退款
    res.on('close', () => {
      if (!res.writableEnded) doRefund();
    });

    next();
  };
}

export function logScan(req, type, target, score, summary) {
  if (!req.user) return;
  try {
    run('INSERT INTO scan_logs (user_id, type, target, score, summary) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, type, String(target).slice(0, 300), Number.isFinite(score) ? Math.round(score) : null, String(summary || '').slice(0, 500)]);
  } catch (e) { console.error('[scan_log]', e.message); }
}

