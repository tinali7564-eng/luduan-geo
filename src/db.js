import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { DATA_DIR } from './config.js';

// 与旧版保持同一数据库文件，直接兼容线上已有数据
const db = new DatabaseSync(path.join(DATA_DIR, 'geo_saas.db'));
db.exec('PRAGMA busy_timeout = 5000;');
// WAL 提升并发性能；少数网络/虚拟文件系统不支持时自动回退
try { db.exec('PRAGMA journal_mode = WAL;'); } catch { /* 使用默认日志模式 */ }

export const exec = (sql) => db.exec(sql);
export const query = (sql, params = []) => db.prepare(sql).all(...params);
export const get = (sql, params = []) => db.prepare(sql).get(...params);
export const run = (sql, params = []) => {
  const r = db.prepare(sql).run(...params);
  return { lastID: Number(r.lastInsertRowid), changes: r.changes };
};
export const tx = (fn) => {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
};

const addColumn = (table, col, def) => {
  const cols = query(`PRAGMA table_info(${table})`).map(c => c.name);
  if (!cols.includes(col)) exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
};

export function initDb() {
  exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      quota_daily INTEGER DEFAULT 30,
      register_ip TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS scan_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      target TEXT NOT NULL,
      score INTEGER,
      summary TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS user_daily_usage (
      user_id INTEGER NOT NULL,
      usage_date TEXT NOT NULL,
      count INTEGER DEFAULT 0,
      PRIMARY KEY(user_id, usage_date)
    );
    CREATE TABLE IF NOT EXISTS guest_daily_usage (
      ip TEXT NOT NULL,
      usage_date TEXT NOT NULL,
      count INTEGER DEFAULT 0,
      PRIMARY KEY(ip, usage_date)
    );
    CREATE TABLE IF NOT EXISTS sms_verifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS geo_sentiment_subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      aliases TEXT,
      domain TEXT,
      industry TEXT DEFAULT 'general',
      risk_threshold INTEGER DEFAULT 60,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS geo_sentiment_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL,
      event_code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      main_claim TEXT,
      risk_level TEXT DEFAULT 'medium',
      sentiment TEXT DEFAULT 'negative',
      source_types TEXT,
      article_count INTEGER DEFAULT 1,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS geo_event_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      question TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS geo_ai_audits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER NOT NULL,
      platform TEXT NOT NULL,
      brand_mentioned INTEGER DEFAULT 0,
      mention_rank INTEGER,
      is_recommended INTEGER DEFAULT 0,
      sentiment TEXT DEFAULT 'neutral',
      is_hallucinated INTEGER DEFAULT 0,
      is_outdated INTEGER DEFAULT 0,
      cited_official INTEGER DEFAULT 0,
      cited_domains TEXT,
      r2_raw_key TEXT,
      summary TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS geo_risk_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL,
      event_id INTEGER,
      comprehensive_risk_score INTEGER NOT NULL,
      visibility_score INTEGER NOT NULL,
      quadrant TEXT NOT NULL,
      ai_pollution_rate REAL DEFAULT 0,
      official_absent_rate REAL DEFAULT 0,
      alert_triggered INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS risk_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      event_id INTEGER NOT NULL,
      status TEXT DEFAULT 'queued',
      engines TEXT,
      total INTEGER DEFAULT 0,
      done INTEGER DEFAULT 0,
      error TEXT,
      evaluation_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      finished_at DATETIME
    );
    CREATE TABLE IF NOT EXISTS audit_results (
      id TEXT PRIMARY KEY,
      user_id INTEGER DEFAULT 0,
      kind TEXT NOT NULL,
      target TEXT NOT NULL,
      score INTEGER,
      data_json TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS monitored_sites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      domain TEXT NOT NULL,
      sitemap_url TEXT,
      last_snapshot_urls TEXT,
      auto_indexnow INTEGER DEFAULT 1,
      check_interval_hours INTEGER DEFAULT 24,
      last_check_at DATETIME,
      last_health_score INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS indexnow_push_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      site_id INTEGER,
      url_count INTEGER NOT NULL,
      urls_json TEXT NOT NULL,
      status_code INTEGER,
      response_body TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS top1_simulations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      brand_name TEXT NOT NULL,
      domain TEXT NOT NULL,
      target_keyword TEXT NOT NULL,
      capsule_markdown TEXT NOT NULL,
      prompts_json TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS custom_remediation_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      client_name TEXT NOT NULL,
      contact_info TEXT NOT NULL,
      subject_name TEXT NOT NULL,
      domain TEXT,
      negative_issue TEXT NOT NULL,
      target_engines TEXT,
      expected_effect TEXT,
      budget_tier TEXT DEFAULT 'standard',
      status TEXT DEFAULT 'pending',
      admin_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS ephemeral_grounding_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      brand_name TEXT NOT NULL,
      domain TEXT NOT NULL,
      target_keyword TEXT NOT NULL,
      question TEXT,
      entity_type TEXT,
      content_markdown TEXT NOT NULL,
      schema_json TEXT,
      access_count INTEGER DEFAULT 0,
      last_accessed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      order_no TEXT UNIQUE NOT NULL,
      plan_type TEXT NOT NULL,
      period TEXT DEFAULT 'monthly',
      amount REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      payment_method TEXT DEFAULT 'alipay',
      pay_time DATETIME,
      expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    -- ===== Wave 2 新增数据表 =====
    CREATE TABLE IF NOT EXISTS user_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL, -- site_alert, risk_alert, system
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      link TEXT,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS site_check_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      url_count INTEGER DEFAULT 0,
      new_urls_count INTEGER DEFAULT 0,
      has_llms_txt INTEGER DEFAULT 0,
      llms_status TEXT,
      robots_status TEXT,
      robots_blocked_bots TEXT,
      sitemap_status TEXT,
      schema_status TEXT,
      health_score INTEGER,
      error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS lab_experiments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      brand_name TEXT NOT NULL,
      domain TEXT NOT NULL,
      version_a TEXT NOT NULL,
      version_b TEXT NOT NULL,
      questions_json TEXT NOT NULL,
      engines_json TEXT NOT NULL,
      rounds INTEGER DEFAULT 3,
      stats_json TEXT,
      summary_text TEXT,
      winner TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS user_monthly_usage (
      user_id INTEGER NOT NULL,
      usage_month TEXT NOT NULL, -- 格式 YYYY-MM
      feature TEXT NOT NULL, -- lab_run, word_export, action_card, publish_verify
      count INTEGER DEFAULT 0,
      PRIMARY KEY(user_id, usage_month, feature)
    );
    CREATE TABLE IF NOT EXISTS redv_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL, -- douyin, kuaishou, wechat_channels, weibo, xiaohongshu, toutiao
      account_name TEXT NOT NULL,
      domain_field TEXT NOT NULL,
      followers TEXT,
      notes TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS redv_action_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      brand_name TEXT NOT NULL,
      domain TEXT,
      target_question TEXT NOT NULL,
      weakness_reason TEXT,
      title TEXT NOT NULL,
      outline TEXT NOT NULL,
      suggested_channels TEXT NOT NULL, -- JSON array
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS redv_publish_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      card_id INTEGER,
      redv_account_id INTEGER,
      brand_name TEXT NOT NULL,
      domain TEXT,
      target_question TEXT,
      publish_url TEXT,
      publish_time DATETIME,
      status TEXT DEFAULT 'pending', -- pending, published, verified
      verification_result_json TEXT,
      verified_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS geo_approval_inbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER DEFAULT 1,
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      category TEXT DEFAULT 'developer',
      tags TEXT DEFAULT '[]',
      target_query TEXT NOT NULL,
      target_engine TEXT DEFAULT 'ChatGPT / Claude / Perplexity',
      competitor TEXT DEFAULT '',
      gap_reason TEXT NOT NULL,
      excerpt TEXT NOT NULL,
      body TEXT NOT NULL,
      faq_schema TEXT DEFAULT '',
      llms_snippet TEXT DEFAULT '',
      cta_url TEXT DEFAULT '',
      cta_text TEXT DEFAULT '',
      read_mins INTEGER DEFAULT 8,
      status TEXT DEFAULT 'pending',
      published_url TEXT DEFAULT '',
      published_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // —— 增量迁移（兼容旧库）——
  addColumn('users', 'plan', "TEXT DEFAULT 'free'");
  addColumn('users', 'plan_expires_at', 'DATETIME');
  addColumn('users', 'register_ip', 'TEXT');
  addColumn('users', 'phone', 'TEXT'); // 旧字段名沿用，实际存储邮箱
  addColumn('users', 'last_login_at', 'DATETIME');
  addColumn('users', 'disabled', 'INTEGER DEFAULT 0');

  addColumn('sms_verifications', 'purpose', "TEXT DEFAULT 'register'");
  addColumn('sms_verifications', 'attempts', 'INTEGER DEFAULT 0');

  addColumn('monitored_sites', 'indexnow_key', 'TEXT');
  addColumn('monitored_sites', 'key_verified', 'INTEGER DEFAULT 0');
  addColumn('monitored_sites', 'last_error', 'TEXT');
  addColumn('monitored_sites', 'last_url_count', 'INTEGER');
  addColumn('monitored_sites', 'last_new_count', 'INTEGER');
  addColumn('monitored_sites', 'has_llms_txt', 'INTEGER');

  addColumn('geo_ai_audits', 'run_id', 'INTEGER');
  addColumn('geo_ai_audits', 'engine_label', 'TEXT');
  addColumn('geo_ai_audits', 'model', 'TEXT');
  addColumn('geo_ai_audits', 'answer_text', 'TEXT');
  addColumn('geo_ai_audits', 'analysis_json', 'TEXT');
  addColumn('geo_ai_audits', 'error', 'TEXT');

  addColumn('ephemeral_grounding_sources', 'user_id', 'INTEGER');
  addColumn('ephemeral_grounding_sources', 'expires_at', 'INTEGER');

  addColumn('orders', 'admin_note', 'TEXT');
  addColumn('custom_remediation_requests', 'updated_at', 'DATETIME');

  // 内容行动卡：小红书发布标记与重测基线（2026-10-08）
  addColumn('redv_action_cards', 'publish_status', "TEXT DEFAULT 'unpublished'");
  addColumn('redv_action_cards', 'publish_channel', 'TEXT');
  addColumn('redv_action_cards', 'published_at', 'DATETIME');
  addColumn('redv_action_cards', 'baseline_json', 'TEXT');
  addColumn('redv_action_cards', 'audit_result_id', 'TEXT');

  exec(`
    CREATE INDEX IF NOT EXISTS idx_scan_logs_user ON scan_logs(user_id, id);
    CREATE INDEX IF NOT EXISTS idx_sites_user ON monitored_sites(user_id);
    CREATE INDEX IF NOT EXISTS idx_audits_run ON geo_ai_audits(run_id);
    CREATE INDEX IF NOT EXISTS idx_runs_user ON risk_runs(user_id, id);
    CREATE INDEX IF NOT EXISTS idx_results_user ON audit_results(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_sms_phone ON sms_verifications(phone, id);
    CREATE INDEX IF NOT EXISTS idx_user_notif ON user_notifications(user_id, is_read, id);
    CREATE INDEX IF NOT EXISTS idx_site_logs ON site_check_logs(site_id, id);
    CREATE INDEX IF NOT EXISTS idx_lab_exp_user ON lab_experiments(user_id, id);
    CREATE INDEX IF NOT EXISTS idx_redv_tasks_user ON redv_publish_tasks(user_id, id);
  `);

  // 主流媒体红V矩阵账号初始化种子数据
  try {
    const redvCount = get('SELECT count(*) AS c FROM redv_accounts');
    if (!redvCount || redvCount.c === 0) {
      const SEED_ACCOUNTS = [
        ['douyin', '主流媒体', '综合新闻', '320万', '主流媒体官方主账号，权威首发矩阵核心'],
        ['douyin', 'BBC News 中文', '民生民情', '185万', '国际视角下的民生热点与城市故事'],
        ['douyin', '路透早班车', '早间资讯', '96万', '清晨早新闻资讯标杆，受众粘性高'],
        ['wechat_channels', '美联社中文', '融媒综合', '120万', '国际通讯社中文视频号，政企事业覆盖广'],
        ['wechat_channels', '孤独星球中文', '文旅生活', '68万', '文旅地标、城市生活与消费种草指南'],
        ['weibo', '主流媒体官方微博', '政务新闻', '150万', '权威微博蓝V/红V联动矩阵，话题冲榜能力强'],
        ['weibo', 'Top Gear 中文版', '出行汽车', '110万', '车主与本地高净值人群高频触达渠道'],
        ['kuaishou', 'RT中文', '国际短视频', '140万', '国际时事短视频，下沉传播与泛资讯权重高'],
        ['xiaohongshu', 'VOGUE中文版', '品质消费', '45万', '年轻化消费、探店攻略与品牌生活方式种草'],
        ['toutiao', '东北振兴观察', '财经产业', '88万', '产业经济、营商环境与企业故事深度解读'],
        ['toutiao', '主流媒体融媒', '深度报道', '105万', '今日头条权威信源认证，搜索加权优势明显'],
        ['douyin', '辽海热线', '舆论监督', '135万', '权威民生求证与事实核查，公信力高']
      ];
      for (const [platform, account_name, domain_field, followers, notes] of SEED_ACCOUNTS) {
        run('INSERT INTO redv_accounts (platform, account_name, domain_field, followers, notes, is_active) VALUES (?, ?, ?, ?, ?, 1)',
          [platform, account_name, domain_field, followers, notes]);
      }
      console.log('[db] 已初始化主流媒体红V矩阵账号种子数据（12个全平台标杆账号）');
    }
  } catch (e) {
    console.error('[db] 初始化红V账号种子数据出错：', e.message);
  }

  // 旧版遗留：id=0 的 guest 行保留（外键兼容），但确保其无法登录
  run("UPDATE users SET password_hash = 'disabled' WHERE id = 0");
  // 游客结果保留 7 天、登录用户保留 180 天
  run("DELETE FROM audit_results WHERE (user_id = 0 AND created_at < datetime('now','-7 days')) OR created_at < datetime('now','-180 days')");
  // 服务重启时，把中断的舆情任务标记为失败，避免前端一直转圈
  run("UPDATE risk_runs SET status = 'failed', error = '服务重启导致任务中断，请重新发起' WHERE status IN ('queued','running')");
}

export function currentMonth() {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  return d.toISOString().slice(0, 7);
}

export function getMonthlyUsage(userId, feature, month = currentMonth()) {
  const row = get('SELECT count FROM user_monthly_usage WHERE user_id = ? AND usage_month = ? AND feature = ?', [userId, month, feature]);
  return row ? row.count : 0;
}

export function incMonthlyUsage(userId, feature, amount = 1, month = currentMonth()) {
  run(`INSERT INTO user_monthly_usage (user_id, usage_month, feature, count) VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, usage_month, feature) DO UPDATE SET count = count + excluded.count`,
    [userId, month, feature, amount]);
}

export function addNotification(userId, { type = 'system', title, message, link = '' }) {
  if (!userId) return null;
  return run('INSERT INTO user_notifications (user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?)',
    [userId, type, String(title).slice(0, 120), String(message).slice(0, 500), String(link).slice(0, 200)]);
}

export function getUnreadNotificationsCount(userId) {
  if (!userId) return 0;
  const r = get('SELECT count(*) AS c FROM user_notifications WHERE user_id = ? AND is_read = 0', [userId]);
  return r ? r.c : 0;
}

export function listNotifications(userId, limit = 20) {
  if (!userId) return [];
  return query('SELECT id, type, title, message, link, is_read, created_at FROM user_notifications WHERE user_id = ? ORDER BY id DESC LIMIT ?', [userId, limit]);
}

export function markNotificationRead(id, userId) {
  return run('UPDATE user_notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [id, userId]);
}

export function markAllNotificationsRead(userId) {
  return run('UPDATE user_notifications SET is_read = 1 WHERE user_id = ?', [userId]);
}

export default { exec, query, get, run, tx, initDb, getMonthlyUsage, incMonthlyUsage, addNotification, getUnreadNotificationsCount, listNotifications, markNotificationRead, markAllNotificationsRead };
