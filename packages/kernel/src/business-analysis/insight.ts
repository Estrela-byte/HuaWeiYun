import type { Insight } from "../types/business-analysis.js";
import type { IndicatorSet } from "../types/domain.js";
import { Decimal } from "../types/decimal.js";

const HIGH_MARGIN = new Decimal(30n, 2); // 30%
const LOW_MARGIN = new Decimal(5n, 2); // 5%
const HIGH_EXPENSE = new Decimal(5n, 1); // 50%

function valueOf(indicators: IndicatorSet, name: string): Decimal | undefined {
  return indicators.indicators.find((i) => i.name === name)?.value;
}

/** 经营优势与问题归纳：基于确定性指标阈值判定，evidence 可回溯 */
export function buildInsights(indicators: IndicatorSet): Insight[] {
  const insights: Insight[] = [];

  const grossMargin = valueOf(indicators, "grossMargin");
  if (grossMargin) {
    if (grossMargin.gte(HIGH_MARGIN)) {
      insights.push({
        type: "strength",
        title: "毛利空间充足",
        detail: `毛利率 ${grossMargin.toString()}，处于健康区间`,
        evidence: "grossMargin = grossProfit / revenue",
      });
    } else if (grossMargin.lt(LOW_MARGIN)) {
      insights.push({
        type: "problem",
        title: "毛利过低",
        detail: `毛利率仅 ${grossMargin.toString()}，低于 5% 警戒线`,
        evidence: "grossMargin 低于阈值",
      });
    }
  }

  const expenseRatio = valueOf(indicators, "expenseRatio");
  if (expenseRatio && expenseRatio.gt(HIGH_EXPENSE)) {
    insights.push({
      type: "problem",
      title: "费用负担偏重",
      detail: `费用率 ${expenseRatio.toString()} 超过 50%`,
      evidence: "expenseRatio = expense / revenue",
    });
  }

  const netMargin = valueOf(indicators, "netMargin");
  if (netMargin && netMargin.isNegative()) {
    insights.push({
      type: "problem",
      title: "经营亏损",
      detail: `净利率 ${netMargin.toString()} 为负`,
      evidence: "netMargin 为负",
    });
  }

  const operatingCashflow = valueOf(indicators, "operatingCashflow");
  if (operatingCashflow && operatingCashflow.isNegative()) {
    insights.push({
      type: "problem",
      title: "经营现金流为负",
      detail: `经营现金流 ${operatingCashflow.toString()}`,
      evidence: "operatingCashflow < 0",
    });
  }

  return insights;
}