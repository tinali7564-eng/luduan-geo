/**
 * Risk Assessment & Evaluation Engine
 * Calculates Comprehensive Risk Score, GEO Visibility Score, and Quadrant Placement
 */

export function calculateRiskAndVisibility({
  sentimentEvents = [],
  aiAudits = [],
  subjectDomain = ''
}) {
  // 1. 事件热度（由用户评估的舆情热度：低/中/高）
  const HEAT = { low: 20, medium: 50, high: 80, critical: 95 };
  let traditionalRisk = 20;
  if (sentimentEvents.length > 0) {
    traditionalRisk = Math.max(...sentimentEvents.map(e => HEAT[e.risk_level] ?? 50));
  }

  // 2. AI 问答层指标统计
  const totalAudits = aiAudits.length;
  if (totalAudits === 0) {
    return {
      comprehensiveRiskScore: traditionalRisk,
      visibilityScore: 10,
      quadrant: 'low_vis_low_risk',
      aiPollutionRate: 0,
      officialAbsentRate: 100,
      breakdown: { traditionalRisk, aiNegativeRisk: 0, aiHallucinationRisk: 0, officialAbsentRisk: 100, crossPlatformRisk: 0 }
    };
  }

  // 提及总数
  const mentionedCount = aiAudits.filter(a => a.brand_mentioned === 1).length;
  const brandMentionRate = (mentionedCount / totalAudits) * 100;

  // 负面回答数
  const negAiCount = aiAudits.filter(a => a.sentiment === 'negative').length;
  const aiNegativeRate = (negAiCount / totalAudits) * 100;

  // 失实/谣言回答数
  const hallucinatedCount = aiAudits.filter(a => a.is_hallucinated === 1).length;
  const aiHallucinationRate = (hallucinatedCount / totalAudits) * 100;

  // 官方信源缺席数
  const citedOfficialCount = aiAudits.filter(a => a.cited_official === 1).length;
  const officialAbsentRate = Math.max(0, 100 - (citedOfficialCount / totalAudits) * 100);

  // 跨平台扩散 (检查是否有多个平台出现同一负面评价)
  const platformsWithNeg = new Set(aiAudits.filter(a => a.sentiment === 'negative').map(a => a.platform));
  const allPlatforms = new Set(aiAudits.map(a => a.platform));
  const crossPlatformRisk = allPlatforms.size ? Math.round(platformsWithNeg.size / allPlatforms.size * 100) : 0;

  // AI 叙事污染率: 包含负面或失实叙事的 AI 回答比例
  const pollutedAudits = aiAudits.filter(a => a.sentiment === 'negative' || a.is_hallucinated === 1).length;
  const aiPollutionRate = Math.round((pollutedAudits / totalAudits) * 100);

  // 推荐入选率
  const recommendedCount = aiAudits.filter(a => a.is_recommended === 1).length;
  const recommendationRate = (recommendedCount / totalAudits) * 100;

  // 正面叙事率
  const positiveCount = aiAudits.filter(a => a.sentiment === 'positive').length;
  const positiveRate = (positiveCount / totalAudits) * 100;

  // 3. 综合认知风险指数（0~100）：以真实 AI 回答为主，事件热度为辅
  // = AI 负面回答率*35% + 把争议当事实*25% + 官方信息缺席*15% + 跨模型扩散*10% + 事件热度*15%
  const comprehensiveRiskScore = Math.min(100, Math.round(
    (aiNegativeRate * 0.35) +
    (aiHallucinationRate * 0.25) +
    (officialAbsentRate * 0.15) +
    (crossPlatformRisk * 0.10) +
    (traditionalRisk * 0.15)
  ));

  // 4. 计算 GEO 可见度分 (0 ~ 100)
  // GEO可见度 = 品牌提及率*30% + 推荐入选率*25% + 官网引用率*20% + 正确事实率*15% + 正面叙事率*10%
  const correctFactRate = Math.max(0, 100 - aiHallucinationRate);
  const officialCitationRate = 100 - officialAbsentRate;

  const visibilityScore = Math.min(100, Math.round(
    (brandMentionRate * 0.30) +
    (recommendationRate * 0.25) +
    (officialCitationRate * 0.20) +
    (correctFactRate * 0.15) +
    (positiveRate * 0.10)
  ));

  // 5. 四象限判定 (高/低可见度以 50 分为界，高/低风险以 50 分为界)
  let quadrant = 'low_vis_low_risk';
  if (visibilityScore >= 50 && comprehensiveRiskScore < 50) {
    quadrant = 'high_vis_low_risk';  // 品牌认知健康：保持权威内容供给
  } else if (visibilityScore >= 50 && comprehensiveRiskScore >= 50) {
    quadrant = 'high_vis_high_risk'; // 负面叙事已广泛进入 AI：优先处置
  } else if (visibilityScore < 50 && comprehensiveRiskScore < 50) {
    quadrant = 'low_vis_low_risk';   // AI 认知不足：开展 GEO 内容建设
  } else {
    quadrant = 'low_vis_high_risk';  // 正面信息缺席，负面信息突出：重点修复
  }

  return {
    comprehensiveRiskScore,
    visibilityScore,
    quadrant,
    aiPollutionRate,
    officialAbsentRate,
    breakdown: {
      traditionalRisk,
      aiNegativeRate: Math.round(aiNegativeRate),
      aiHallucinationRate: Math.round(aiHallucinationRate),
      officialAbsentRate: Math.round(officialAbsentRate),
      crossPlatformRisk: Math.round(crossPlatformRisk)
    }
  };
}


