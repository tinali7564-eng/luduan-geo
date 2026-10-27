// Telegram 告警（可选）
import { config } from './config.js';

const QUADRANT = {
  high_vis_low_risk: '高可见度 · 低风险',
  high_vis_high_risk: '高可见度 · 高风险',
  low_vis_low_risk: '低可见度 · 低风险',
  low_vis_high_risk: '低可见度 · 高风险',
};

export async function sendTelegramAlert({ subjectName, eventTitle, riskScore, quadrant, aiPollutionRate, officialAbsentRate, details = [] }) {
  if (!config.telegram.token || !config.telegram.chatId) return { success: false, reason: 'unconfigured' };
  const text = [
    '【AI 舆情认知风险预警】',
    `主体：${subjectName}`,
    `事件：${eventTitle}`,
    `综合风险指数：${riskScore}/100（${QUADRANT[quadrant] || quadrant}）`,
    `AI 叙事污染率：${aiPollutionRate}%　官方信息缺席率：${officialAbsentRate}%`,
    ...details.map(d => `· ${d}`),
  ].join('\n');
  const r = await fetch(`https://api.telegram.org/bot${config.telegram.token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: config.telegram.chatId, text }),
    signal: AbortSignal.timeout(10000),
  });
  return { success: r.ok };
}
