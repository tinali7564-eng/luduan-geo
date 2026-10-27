import nodemailer from 'nodemailer';
import { config, smtpConfigured } from './config.js';
import { escapeHtml } from './http.js';

let transporter = null;
function t() {
  if (!smtpConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host, port: config.smtp.port, secure: config.smtp.port === 465,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    });
  }
  return transporter;
}

export async function sendCodeEmail(to, code, purpose) {
  const tr = t();
  if (!tr) throw new Error('邮件服务未配置');
  const action = purpose === 'reset' ? '重置密码' : '注册账号';
  await tr.sendMail({
    from: `"${config.smtp.fromName}" <${config.smtp.user}>`,
    to,
    subject: `【DailyToolbox GEO】${action}验证码：${code}`,
    text: `您正在${action}，验证码为 ${code}，10 分钟内有效。如非本人操作，请忽略本邮件。`,
    html: `<div style="max-width:480px;margin:0 auto;padding:24px;font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;color:#0f172a;border:1px solid #e2e8f0;border-radius:12px">
      <div style="font-size:16px;font-weight:700;margin-bottom:16px">甪端 GEO 智能体 · DailyToolbox</div>
      <p style="font-size:14px;line-height:1.6;color:#334155">您正在${escapeHtml(action)}，本次验证码为：</p>
      <div style="font-size:30px;font-weight:800;letter-spacing:6px;color:#0284c7;margin:16px 0">${escapeHtml(code)}</div>
      <p style="font-size:12px;color:#64748b">验证码 10 分钟内有效，请勿泄露给他人。如非本人操作，请忽略本邮件。</p>
    </div>`,
  });
}
