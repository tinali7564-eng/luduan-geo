import express from 'express';
import { get, query, run } from '../db.js';
import { ah, bad, HttpError, str } from '../http.js';
import { requireAdmin } from '../auth.js';
import { PLANS, planQuota } from '../plans.js';
import { activateOrder } from './api.js';
import { listRedVAccounts, createRedVAccount, updateRedVAccount, deleteRedVAccount } from '../redv.js';
import { listInbox, getInboxItem, updateDraft, rejectDraft, approveAndQueueDraft, generateDraftWithAi } from '../geo_inbox.js';

const r = express.Router();
r.use(requireAdmin);

r.get('/overview', (req, res) => {
  const c = (sql, p = []) => get(sql, p).c;
  res.json({
    success: true,
    data: {
      users: c('SELECT count(*) c FROM users WHERE id != 0'),
      usersToday: c("SELECT count(*) c FROM users WHERE created_at >= datetime('now','-1 day')"),
      paidUsers: c("SELECT count(*) c FROM users WHERE plan IN ('standard','enterprise')"),
      pendingOrders: c("SELECT count(*) c FROM orders WHERE status = 'pending'"),
      newLeads: c("SELECT count(*) c FROM custom_remediation_requests WHERE status = 'pending'"),
      audits7d: c("SELECT count(*) c FROM scan_logs WHERE created_at >= datetime('now','-7 days')"),
      sites: c('SELECT count(*) c FROM monitored_sites'),
      riskRuns7d: c("SELECT count(*) c FROM risk_runs WHERE created_at >= datetime('now','-7 days')"),
      redvAccounts: c('SELECT count(*) c FROM redv_accounts'),
      redvTasks: c('SELECT count(*) c FROM redv_publish_tasks'),
      pendingDrafts: c("SELECT count(*) c FROM geo_approval_inbox WHERE status = 'pending'"),
      publishedDrafts: c("SELECT count(*) c FROM geo_approval_inbox WHERE status = 'published'"),
    },
  });
});

r.get('/users', (req, res) => {
  const q = str(req.query.q, 60);
  const rows = query(`SELECT id, username, role, plan, plan_expires_at, quota_daily, phone AS email, disabled, created_at, last_login_at,
      (SELECT count(*) FROM scan_logs s WHERE s.user_id = users.id) AS scans
    FROM users WHERE id != 0 ${q ? 'AND (username LIKE ? OR phone LIKE ?)' : ''} ORDER BY id DESC LIMIT 200`, q ? [`%${q}%`, `%${q}%`] : []);
  res.json({ success: true, data: rows });
});

r.patch('/users/:id', ah(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const u = get('SELECT * FROM users WHERE id = ? AND id != 0', [id]);
  if (!u) throw new HttpError(404, '用户不存在');
  const b = req.body || {};
  if (b.plan !== undefined) {
    if (!PLANS[b.plan]) throw bad('无效套餐');
    run('UPDATE users SET plan = ?, quota_daily = ? WHERE id = ?', [b.plan, planQuota(b.plan), id]);
  }
  if (b.planExpiresAt !== undefined) run('UPDATE users SET plan_expires_at = ? WHERE id = ?', [b.planExpiresAt ? String(b.planExpiresAt).replace('T', ' ').slice(0, 19) : null, id]);
  if (b.quotaDaily !== undefined) {
    const qd = parseInt(b.quotaDaily, 10);
    if (!Number.isFinite(qd) || qd < 0 || qd > 100000) throw bad('额度不合法');
    run('UPDATE users SET quota_daily = ? WHERE id = ?', [qd, id]);
  }
  if (b.disabled !== undefined) {
    if (id === req.user.id) throw bad('不能停用自己的账号');
    run('UPDATE users SET disabled = ? WHERE id = ?', [b.disabled ? 1 : 0, id]);
  }
  res.json({ success: true, data: get('SELECT id, username, role, plan, plan_expires_at, quota_daily, disabled FROM users WHERE id = ?', [id]) });
}));

r.get('/orders', (req, res) => {
  res.json({ success: true, data: query(`SELECT o.*, u.username, u.phone AS email FROM orders o LEFT JOIN users u ON o.user_id = u.id ORDER BY o.id DESC LIMIT 200`) });
});
r.post('/orders/:id/mark-paid', ah(async (req, res) => {
  const o = get("SELECT * FROM orders WHERE id = ?", [parseInt(req.params.id, 10)]);
  if (!o) throw new HttpError(404, '订单不存在');
  if (o.status !== 'pending') throw bad('该订单不是待支付状态');
  const exp = activateOrder(o);
  if (req.body?.note) run('UPDATE orders SET admin_note = ? WHERE id = ?', [str(req.body.note, 300), o.id]);
  res.json({ success: true, data: { expiresAt: exp } });
}));
r.post('/orders/:id/cancel', ah(async (req, res) => {
  const x = run("UPDATE orders SET status = 'cancelled', admin_note = ? WHERE id = ? AND status = 'pending'", [str(req.body?.note, 300), parseInt(req.params.id, 10)]);
  if (!x.changes) throw bad('订单不存在或不是待支付状态');
  res.json({ success: true });
}));

r.get('/leads', (req, res) => {
  res.json({ success: true, data: query('SELECT * FROM custom_remediation_requests ORDER BY id DESC LIMIT 200') });
});
r.patch('/leads/:id', ah(async (req, res) => {
  const status = ['pending', 'contacting', 'processing', 'completed', 'closed'].includes(req.body?.status) ? req.body.status : null;
  const x = run('UPDATE custom_remediation_requests SET status = COALESCE(?, status), admin_notes = COALESCE(?, admin_notes), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [status, req.body?.notes !== undefined ? str(req.body.notes, 1000) : null, parseInt(req.params.id, 10)]);
  if (!x.changes) throw new HttpError(404, '线索不存在');
  res.json({ success: true });
}));

// Wave 2 红V账号管理
r.get('/redv', ah(async (req, res) => {
  res.json({ success: true, data: listRedVAccounts({ activeOnly: false }) });
}));
r.post('/redv', ah(async (req, res) => {
  const item = createRedVAccount({
    platform: str(req.body?.platform, 40),
    accountName: str(req.body?.accountName, 60),
    domainField: str(req.body?.domainField, 40),
    followers: str(req.body?.followers, 30),
    notes: str(req.body?.notes, 300),
  });
  res.json({ success: true, data: item });
}));
r.patch('/redv/:id', ah(async (req, res) => {
  const item = updateRedVAccount(parseInt(req.params.id, 10), req.body || {});
  res.json({ success: true, data: item });
}));
r.delete('/redv/:id', ah(async (req, res) => {
  deleteRedVAccount(parseInt(req.params.id, 10));
  res.json({ success: true });
}));

// —— GEO Approval Inbox (Human-in-the-Loop) ——
r.get('/inbox', ah(async (req, res) => {
  const status = req.query.status || 'all';
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
  const offset = parseInt(req.query.offset, 10) || 0;
  res.json({ success: true, data: listInbox({ status, limit, offset }) });
}));

r.get('/inbox/:id', ah(async (req, res) => {
  const item = getInboxItem(parseInt(req.params.id, 10));
  res.json({ success: true, data: item });
}));

r.post('/inbox/generate', ah(async (req, res) => {
  const draft = await generateDraftWithAi({
    topic: req.body?.topic,
    targetQuery: req.body?.targetQuery,
    competitor: req.body?.competitor,
    targetToolUrl: req.body?.targetToolUrl,
    engineId: req.body?.engineId,
    locale: req.body?.locale || 'en'
  });
  res.json({ success: true, data: draft });
}));

r.patch('/inbox/:id', ah(async (req, res) => {
  const item = updateDraft(parseInt(req.params.id, 10), req.body || {});
  res.json({ success: true, data: item });
}));

r.post('/inbox/:id/approve', ah(async (req, res) => {
  const result = approveAndQueueDraft(parseInt(req.params.id, 10));
  res.json({ success: true, data: result });
}));

r.post('/inbox/:id/reject', ah(async (req, res) => {
  const result = rejectDraft(parseInt(req.params.id, 10), req.body?.reason);
  res.json({ success: true, data: result });
}));

export default r;
