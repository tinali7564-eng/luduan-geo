import { config } from './config.js';
import { getMonthlyUsage, get, query } from './db.js';
import { HttpError } from './http.js';

export const PLANS = {
  free: {
    id: 'free',
    name: '免费版',
    nameEn: 'Free',
    priceMonthly: 0,
    priceYearly: 0,
    siteLimit: 1,
    dailyQuota: 30, // 游客每天 5 次，免费注册用户每天 30 次
    labMonthlyLimit: 1, // 每月 1 次首推实验室 A/B 测试
    wordExportMonthlyLimit: 3, // 每月 3 次 Word 报告导出
    riskRunsWeeklyLimit: 1, // 每周 1 次 AI 舆情认知监测
    redvActionCardLimit: 3, // 每月可生成 3 张弱点内容行动卡体验
    redvVerifyAllowed: false, // 不支持红V任务验证
    autoSiteCheck: false, // 仅支持单次手动巡检
    thresholdAlerts: false, // 不支持阈值自动告警
    features: [
      '游客每天 5 次，免费注册用户每天 30 次（每日 0 点重置）',
      '1 个站点托管（体验单次巡检与推送）',
      '每月 3 次体检报告 Word 规范导出',
      '每周 1 次 AI 舆情认知监测',
      '每月 1 次首推实验室真实模型 A/B 对比',
      '弱点内容行动卡生成体验（每月 3 次）',
      'llms.txt / Schema / robots 规则生成',
    ],
    featuresEn: [
      '5 runs/day for guests, 30 runs/day for registered users (resets at 00:00 UTC+8)',
      '1 site hosted (manual check & push preview)',
      '3 formatted Word report exports / month',
      '1 AI perception monitor run / week',
      '1 Top-1 Lab A/B test / month',
      'Action card generator preview (3 / month)',
      'llms.txt / Schema / robots generator',
    ],
  },
  standard: {
    id: 'standard',
    name: '标准版',
    nameEn: 'Pro',
    priceMonthly: 299,
    priceYearly: 2990,
    siteLimit: 5,
    popular: true,
    dailyQuota: 200,
    labMonthlyLimit: 20, // 每月 20 次首推实验室 A/B 测试
    wordExportMonthlyLimit: 50, // 每月 50 次 Word 报告导出
    riskRunsWeeklyLimit: 7, // 每日可跑舆情监测
    redvActionCardLimit: 50, // 每月 50 张行动卡
    redvVerifyAllowed: true, // 支持红V任务关联与发布后观测验证
    autoSiteCheck: true, // 每日自动巡检与异常站内告警
    thresholdAlerts: true, // 负面突增、可见度骤降、竞品替代站内告警与趋势图
    features: [
      '每日 200 次诊断额度',
      '5 个站点托管，每日自动巡检 + 异常站内告警',
      'Sitemap 变更自动 IndexNow 推送搜索引擎',
      'AI 舆情监测（每日频率 + 阈值告警 + 认知趋势曲线）',
      '首推实验室多轮真实模型 A/B 测试（每月 20 次）',
      '每月 50 次规范公文排版 Word 报告导出',
      '红V发布闭环（弱点行动卡生成 + 主流媒体红V任务管理 + 发布后效果验证）',
    ],
    featuresEn: [
      '200 credits / day',
      '5 hosted sites with daily auto-check & in-site anomaly alerts',
      'Automatic IndexNow push upon Sitemap updates',
      'AI perception monitoring (daily frequency + threshold alerts + trend charts)',
      'Top-1 Lab multi-round A/B testing (20 runs / month)',
      '50 formatted Word report exports / month',
      'Red-V action loop (weakness cards + Mainstream Media Red-V tasks + verification)',
    ],
  },
  enterprise: {
    id: 'enterprise',
    name: '机构版',
    nameEn: 'Enterprise',
    priceMonthly: 980,
    priceYearly: 9800,
    siteLimit: 999,
    dailyQuota: 999,
    labMonthlyLimit: 999,
    wordExportMonthlyLimit: 999,
    riskRunsWeeklyLimit: 999,
    redvActionCardLimit: 999,
    redvVerifyAllowed: true,
    autoSiteCheck: true,
    thresholdAlerts: true,
    features: [
      '每日 999 次额度',
      '不限托管站点数量，每日高频自动巡检与全量异常告警',
      'AI 舆情多主体每日全景追踪 + 深度竞品对比与定制告警',
      '首推实验室多模型 A/B 对比不限次',
      '体检报告 Word 导出不限次',
      '红V发布闭环全功能不限次，专人对接主流媒体红V矩阵人工发布',
      '专人协助部署、月度复检、支持对公转账与发票',
    ],
    featuresEn: [
      '999 credits / day',
      'Unlimited sites with high-frequency auto-checks & anomaly alerts',
      'Daily panorama AI perception tracking + deep competitor comparisons',
      'Unlimited Top-1 Lab multi-round A/B tests',
      'Unlimited Word report exports',
      'Unlimited Red-V action cards & task verification with dedicated media onboarding',
      'Dedicated onboarding & monthly audit, invoice & bank transfer',
    ],
  },
};

export const planQuota = (plan) => (plan === 'enterprise' ? 999 : plan === 'standard' ? 200 : config.freeDailyQuota);
export const planSiteLimit = (plan) => PLANS[plan]?.siteLimit ?? 1;
export const planLabLimit = (plan) => PLANS[plan]?.labMonthlyLimit ?? 1;
export const planExportLimit = (plan) => PLANS[plan]?.wordExportMonthlyLimit ?? 3;
export const planActionCardLimit = (plan) => PLANS[plan]?.redvActionCardLimit ?? 3;
export const planCanAutoCheck = (plan) => !!PLANS[plan]?.autoSiteCheck;
export const planCanAlert = (plan) => !!PLANS[plan]?.thresholdAlerts;
export const planCanVerifyRedV = (plan) => !!PLANS[plan]?.redvVerifyAllowed;

// 按次加量包说明
export const ADDON_PACKS = [
  { id: 'lab_10', name: '首推实验加量包', price: 50, count: 10, unit: '次实验', desc: '超出套餐后可按次购买，随时补充多轮 A/B 测试额度' },
  { id: 'export_10', name: 'Word 报告加量包', price: 30, count: 10, unit: '次导出', desc: '超出套餐后按次购买，永久有效' },
];

/**
 * 校验用户对某项权益的访问额度，未满足时返回友好的中文/英文升级提示（携带 PLAN_LIMIT 错误码）
 */
export function checkPlanFeature(user, feature, opts = {}) {
  const plan = user?.plan || 'free';
  const p = PLANS[plan] || PLANS.free;
  const isEn = opts.locale === 'en';

  if (feature === 'site_limit') {
    const curSites = opts.currentCount ?? get('SELECT count(*) AS c FROM monitored_sites WHERE user_id = ?', [user.id])?.c ?? 0;
    if (curSites >= p.siteLimit) {
      const msg = isEn
        ? `Your current plan allows up to ${p.siteLimit} hosted site(s). Upgrade to Pro for 5 sites with daily autopilot, or Enterprise for unlimited sites.`
        : `当前套餐最多托管 ${p.siteLimit} 个站点。升级标准版可托管 5 个站点并开启每日自动巡检，机构版不限站点。`;
      throw new HttpError(403, msg, 'PLAN_LIMIT');
    }
  }

  if (feature === 'auto_site_check') {
    if (!p.autoSiteCheck) {
      const msg = isEn
        ? 'Daily automatic inspection & in-site anomaly alerts are exclusive to Pro and Enterprise plans. Upgrade to enable 24/7 monitoring.'
        : '每日自动巡检与异常站内告警为标准版与机构版专享功能。升级后即可开启 24 小时自动巡检与故障预警。';
      throw new HttpError(403, msg, 'PLAN_LIMIT');
    }
  }

  if (feature === 'lab_experiment') {
    const used = getMonthlyUsage(user.id, 'lab_run');
    if (used >= p.labMonthlyLimit) {
      const msg = isEn
        ? `Monthly Top-1 Lab test limit reached (${p.labMonthlyLimit}/month for ${p.nameEn}). Upgrade your plan or purchase an add-on pack ($50 for 10 tests).`
        : `本月首推实验室 A/B 测试额度已达上限（${p.name}每月 ${p.labMonthlyLimit} 次，已用 ${used} 次）。升级标准版可享每月 20 次，机构版不限次；超出亦可购买按次加量包（¥50/10次）。`;
      throw new HttpError(403, msg, 'PLAN_LIMIT');
    }
  }

  if (feature === 'word_export') {
    const used = getMonthlyUsage(user.id, 'word_export');
    if (used >= p.wordExportMonthlyLimit) {
      const msg = isEn
        ? `Monthly Word report export limit reached (${p.wordExportMonthlyLimit}/month for ${p.nameEn}). Upgrade to Pro (50/month) or Enterprise (unlimited), or buy an export pack.`
        : `本月 Word 评估报告导出额度已达上限（${p.name}每月 ${p.wordExportMonthlyLimit} 次，已用 ${used} 次）。升级标准版（每月 50 次）或机构版（不限次），或购买导出加量包（¥30/10次）。`;
      throw new HttpError(403, msg, 'PLAN_LIMIT');
    }
  }

  if (feature === 'risk_run') {
    if (plan === 'free') {
      const recent = get("SELECT count(*) AS c FROM risk_runs WHERE user_id = ? AND created_at >= datetime('now', '-7 days')", [user.id])?.c ?? 0;
      if (recent >= 1) {
        const msg = isEn
          ? 'Free plan allows 1 AI perception monitor run per week. Upgrade to Pro or Enterprise for daily runs, trend charts, and threshold alerts.'
          : '免费版支持每周 1 次 AI 舆情监测（过去 7 天内已有记录）。升级标准版或机构版可享受每日持续监测、认知趋势图与负面/可见度阈值告警。';
        throw new HttpError(403, msg, 'PLAN_LIMIT');
      }
    }
  }

  if (feature === 'action_card') {
    const used = getMonthlyUsage(user.id, 'action_card');
    if (used >= p.redvActionCardLimit) {
      const msg = isEn
        ? `Monthly Action Card generation limit reached (${p.redvActionCardLimit}/month for ${p.nameEn}). Upgrade to Pro or Enterprise for more cards.`
        : `本月弱点内容行动卡生成额度已达上限（${p.name}每月 ${p.redvActionCardLimit} 次）。升级标准版（每月 50 次）或机构版（不限次）持续获取精准优化大纲。`;
      throw new HttpError(403, msg, 'PLAN_LIMIT');
    }
  }

  if (feature === 'redv_verify') {
    if (!p.redvVerifyAllowed) {
      const msg = isEn
        ? 'Red-V publish task verification is available on Pro and Enterprise plans. Connect 60+ mainstream media accounts and track visibility changes.'
        : '红V发布任务跟踪与模型实测验证为标准版及机构版权益。升级后可关联 60+ 主流媒体红V矩阵账号并自动观测模型回答变化。';
      throw new HttpError(403, msg, 'PLAN_LIMIT');
    }
  }
}
