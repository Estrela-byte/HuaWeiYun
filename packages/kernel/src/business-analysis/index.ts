import type { BusinessAnalysisReport } from "../types/business-analysis.js";
import type { IndicatorSet, UnifiedData } from "../types/domain.js";
import { Decimal } from "../types/decimal.js";
import { buildTrend } from "./trend.js";
import { buildCostStructure } from "./cost-structure.js";
import { buildComparison } from "./comparison.js";
import { buildInsights } from "./insight.js";

export { buildTrend, monthlyAggregate } from "./trend.js";
export { buildCostStructure } from "./cost-structure.js";
export { buildComparison } from "./comparison.js";
export { buildInsights } from "./insight.js";

export interface BusinessAnalysisOptions {
  /** 成本结构聚合维度，未指定时取记录的第一个维度 */
  dimension?: string;
}

const ZERO = Decimal.zero(2);

function valueOf(indicators: IndicatorSet, name: string): Decimal {
  return indicators.indicators.find((i) => i.name === name)?.value ?? ZERO;
}

/** 经营分析主入口：KPI → 趋势 → 成本结构 → 同环比 → 优势/问题归纳 */
export function analyzeBusiness(
  unified: UnifiedData,
  indicators: IndicatorSet,
  options: BusinessAnalysisOptions = {},
): BusinessAnalysisReport {
  const revenue = valueOf(indicators, "revenue");
  const grossProfit = valueOf(indicators, "grossProfit");
  const grossMargin = valueOf(indicators, "grossMargin");
  const cost = revenue.sub(grossProfit);

  return {
    kpi: {
      revenue: revenue.toString(),
      cost: cost.toString(),
      grossProfit: grossProfit.toString(),
      grossMargin: grossMargin.toString(),
    },
    trend: buildTrend(unified),
    costStructure: buildCostStructure(unified, options.dimension),
    comparison: buildComparison(unified),
    insights: buildInsights(indicators),
  };
}