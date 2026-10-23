import type { DiagnosticAnomaly, IndicatorSet } from "../types/domain.js";
import { Decimal } from "../types/decimal.js";

/**
 * 异常识别器：三通道检测（阈值超限 / 趋势突变 / 同环比偏离）。
 * 趋势与同环比通道依赖历史或基准数据，缺失时不编造、显式标注。
 */
export class AnomalyDetector {
  detect(indicators: IndicatorSet, options: { hasHistory?: boolean; hasBenchmark?: boolean } = {}): DiagnosticAnomaly[] {
    const anomalies: DiagnosticAnomaly[] = [];
    const v = (name: string) => indicators.indicators.find((i) => i.name === name)?.value;

    // 通道一：指标阈值超限
    const grossMargin = v("grossMargin");
    if (grossMargin && grossMargin.lt(new Decimal(5n, 2))) {
      anomalies.push({
        indicator: "grossMargin",
        deviation: `毛利率 ${grossMargin.toString()}，低于 5% 阈值`,
        basis: "指标阈值超限",
      });
    }
    const netMargin = v("netMargin");
    if (netMargin && netMargin.isNegative()) {
      anomalies.push({
        indicator: "netMargin",
        deviation: `净利率 ${netMargin.toString()} 为负`,
        basis: "指标阈值超限",
      });
    }
    const expenseRatio = v("expenseRatio");
    if (expenseRatio && expenseRatio.gt(new Decimal(5n, 1))) {
      anomalies.push({
        indicator: "expenseRatio",
        deviation: `费用率 ${expenseRatio.toString()} 超过 50%`,
        basis: "指标阈值超限",
      });
    }

    // 通道二：趋势突变（依赖历史，无则标注）
    if (!options.hasHistory) {
      anomalies.push({
        indicator: "trend",
        deviation: "缺少历史期间数据",
        basis: "趋势突变通道跳过（数据不足）",
      });
    }

    // 通道三：同环比偏离（依赖基准，无则标注）
    if (!options.hasBenchmark) {
      anomalies.push({
        indicator: "benchmark",
        deviation: "缺少行业/可比基准数据",
        basis: "同环比偏离通道跳过（数据不足）",
      });
    }

    return anomalies;
  }
}