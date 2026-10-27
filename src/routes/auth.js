import express from 'express';
import crypto from 'crypto';
import { get, run, query } from '../db.js';
import { config, smtpConfigured, llmConfigured } from '../config.js';
import { ah, bad, rateLimit, getClientIp, str } from '../http.js';
import { hashPassword, verifyPassword, generateToken, setAuthCookie, clearAuthCookie, requireAuth, optionalAuth, quotaStatus, loadUser } from '../auth.js';
import { sendCodeEmail } from '../mailer.js';
import { listEngines } from '../llm.js';
import { PLANS, planSiteLimit } from '../plans.js';

const r = express.Router();
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i;
const CODE_TTL = 10 * 60 * 1000;

// 前端启动配置（公开）
r.get('/config', optionalAuth, (req, res) => {
  const accept = String(req.headers['accept-language'] || '').toLowerCase();
  const cf = String(req.headers['cf-ipcountry'] || '').toUpperCase();
  const locale = cf ? (['CN', 'HK', 'MO', 'TW'].includes(cf) ? 'zh' : 'en') : (accept.startsWith('en') ? 'en' : 'zh');
  res.json({
    success: true,
    data: {
      locale,
      engines: listEngines(),
      llmReady: llmConfigured(),
      emailRequired: smtpConfigured(),
      demoPayments: config.demoPayments,
      guestQuota: config.guestDailyQuota,
      freeQuota: config.freeDailyQuota,
      gaId: config.gaId,
    },
  });
});

function userPayload(req) {
  const u = req.user;
  const q = quotaStatus(req);
  const siteCount = get('SELECT count(*) AS c FROM monitored_sites WHERE user_id = ?', [u.id]).c;
  return {
    id: u.id, username: u.username, role: u.role, email: u.phone || null,
    plan: u.plan, planName: PLANS[u.plan]?.name || u.plan, planExpiresAt: u.plan_expires_at,
    quota: { used: q.used, limit: q.limit, remaining: q.remaining },
    siteCount, siteLimit: planSiteLimit(u.plan), createdAt: u.created_at,
  };
}

r.get('/auth/me', optionalAuth, (req, res) => {
  if (!req.user) {
    const q = quotaStatus(req);
    return res.json({ success: true, user: null, guest: { quota: { used: q.used, limit: q.limit, remaining: q.remaining } } });
  }
  res.json({ success: true, user: userPayload(req) });
});

// 发送邮箱验证码（注册 / 找回密码）
r.post('/auth/send-code',
  rateLimit({ windowMs: 60 * 60 * 1000, max: 8, message: '验证码请求过于频繁，请 1 小时后再试' }),
  ah(async (req, res) => {
    if (!smtpConfigured()) throw bad('邮件服务未配置，暂时无法发送验证码');
    const email = str(req.body?.email, 254).toLowerCase();
    const purpose = req.body?.purpose === 'reset' ? 'reset' : 'register';
    if (!EMAIL_RE.test(email)) throw bad('请输入有效的邮箱地址');
    const exists = get('SELECT id FROM users WHERE lower(phone) = ?', [email]);
    if (purpose === 'register' && exists) throw bad('该邮箱已注册，请直接登录或找回密码');
    if (purpose === 'reset' && !exists) {
      // 不暴露邮箱是否注册，统一返回成功
      return res.json({ success: true, message: '如果该邮箱已绑定账号，验证码将发送至邮箱' });
    }
    const last = get('SELECT created_at FROM sms_verifications WHERE phone = ? ORDER BY id DESC LIMIT 1', [email]);
    if (last && Date.now() - new Date(last.created_at.replace(' ', 'T') + 'Z').getTime() < 60 * 1000) throw bad('发送过于频繁，请 60 秒后再试');
    const code = String(crypto.randomInt(100000, 1000000));
    await sendCodeEmail(email, code, purpose).catch((e) => { console.error('[mail]', e.message); throw bad('邮件发送失败，请检查邮箱地址或稍后重试'); });
    run('INSERT INTO sms_verifications (phone, code, ip, expires_at, purpose) VALUES (?, ?, ?, ?, ?)', [email, code, getClientIp(req), Date.now() + CODE_TTL, purpose]);
    res.json({ success: true, message: '验证码已发送，请查收邮箱（如未收到请检查垃圾邮件）' });
  }));

function consumeCode(email, code, purpose) {
  const row = get('SELECT id, code, expires_at, used, attempts FROM sms_verifications WHERE phone = ? AND purpose = ? ORDER BY id DESC LIMIT 1', [email, purpose]);
  if (!row || row.used) throw bad('请先获取验证码');
  if (Date.now() > row.expires_at) throw bad('验证码已过期，请重新获取');
  if (row.attempts >= 5) throw bad('验证码错误次数过多，请重新获取');
  if (row.code !== code) { run('UPDATE sms_verifications SET attempts = attempts + 1 WHERE id = ?', [row.id]); throw bad('验证码不正确'); }
  run('UPDATE sms_verifications SET used = 1 WHERE id = ?', [row.id]);
}

r.post('/auth/register',
  rateLimit({ windowMs: 60 * 60 * 1000, max: 20 }),
  ah(async (req, res) => {
    const username = str(req.body?.username, 40);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const email = str(req.body?.email, 254).toLowerCase();
    const code = str(req.body?.code, 10);
    if (username.length < 3 || username.length > 30) throw bad('用户名需为 3~30 个字符');
    if (/[\s<>"'&]/.test(username)) throw bad('用户名不能包含空格或特殊符号');
    if (password.length < 8) throw bad('密码至少 8 位');
    if (/^\d+$/.test(password) || /^[a-z]+$/i.test(password)) throw bad('密码过于简单，请混合使用字母和数字');
    if (get('SELECT id FROM users WHERE username = ? COLLATE NOCASE', [username])) throw bad('该用户名已被使用');

    let boundEmail = null;
    if (smtpConfigured()) {
      if (!EMAIL_RE.test(email)) throw bad('请填写有效邮箱并完成验证');
      if (get('SELECT id FROM users WHERE lower(phone) = ?', [email])) throw bad('该邮箱已注册');
      consumeCode(email, code, 'register');
      boundEmail = email;
    } else if (email) {
      if (!EMAIL_RE.test(email)) throw bad('邮箱格式不正确');
      boundEmail = email;
    }

    const ip = getClientIp(req);
    const recent = get("SELECT count(*) AS c FROM users WHERE register_ip = ? AND created_at >= datetime('now','-1 day')", [ip]).c;
    if (recent >= config.registerPerIpPerDay) throw bad('当前网络今日注册账号过多，请明天再试或联系客服');

    const r1 = run('INSERT INTO users (username, password_hash, role, quota_daily, register_ip, phone, plan) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [username, hashPassword(password), 'user', config.freeDailyQuota, ip, boundEmail, 'free']);
    const token = generateToken({ id: r1.lastID });
    setAuthCookie(req, res, token);
    req.user = loadUser(r1.lastID);
    res.json({ success: true, user: userPayload(req) });
  }));

r.post('/auth/login',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 15, message: '登录尝试过于频繁，请 15 分钟后再试' }),
  ah(async (req, res) => {
    const id = str(req.body?.username, 254);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!id || !password) throw bad('请输入用户名和密码');
    const u = get('SELECT id, password_hash, disabled FROM users WHERE id != 0 AND (username = ? COLLATE NOCASE OR lower(phone) = lower(?))', [id, id]);
    const v = u ? verifyPassword(password, u.password_hash) : { ok: false };
    if (!u || !v.ok) return res.status(401).json({ success: false, error: '用户名或密码不正确' });
    if (u.disabled) return res.status(403).json({ success: false, error: '该账号已被停用，请联系客服' });
    if (v.needsRehash) run('UPDATE users SET password_hash = ? WHERE id = ?', [hashPassword(password), u.id]);
    run('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [u.id]);
    setAuthCookie(req, res, generateToken({ id: u.id }));
    req.user = loadUser(u.id);
    res.json({ success: true, user: userPayload(req) });
  }));

r.post('/auth/logout', (req, res) => { clearAuthCookie(res); res.json({ success: true }); });

r.post('/auth/reset-password',
  rateLimit({ windowMs: 60 * 60 * 1000, max: 10 }),
  ah(async (req, res) => {
    const email = str(req.body?.email, 254).toLowerCase();
    const code = str(req.body?.code, 10);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (password.length < 8) throw bad('新密码至少 8 位');
    const u = get('SELECT id FROM users WHERE lower(phone) = ?', [email]);
    if (!u) throw bad('验证码不正确');
    consumeCode(email, code, 'reset');
    run('UPDATE users SET password_hash = ? WHERE id = ?', [hashPassword(password), u.id]);
    res.json({ success: true, message: '密码已重置，请使用新密码登录' });
  }));

r.post('/auth/change-password', requireAuth, rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }), ah(async (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  if (typeof newPassword !== 'string' || newPassword.length < 8) throw bad('新密码至少 8 位');
  const u = get('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
  if (!verifyPassword(String(oldPassword || ''), u.password_hash).ok) throw bad('原密码不正确');
  run('UPDATE users SET password_hash = ? WHERE id = ?', [hashPassword(newPassword), req.user.id]);
  res.json({ success: true, message: '密码已修改' });
}));

// 我的历史记录
r.get('/me/history', requireAuth, (req, res) => {
  const results = query('SELECT id, kind, target, score, created_at FROM audit_results WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', [req.user.id]);
  res.json({ success: true, data: results });
});

export default r;
