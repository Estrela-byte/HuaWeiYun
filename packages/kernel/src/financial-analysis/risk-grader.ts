import type { IndicatorResult, IndicatorSet } from "../types/domain.js";
import { Decimal } from "../types/decimal.js";

export type RiskLevel = "red" | "yellow" | "green";

export interface RiskSignal {
  type: string;
  level: RiskLevel;
  indicator?: string;
  message: string;
}

export interface RiskReport {
  signals: RiskSignal[];
}

/** 默认阈值（可被覆盖） */
export const DEFAULT_RISK_THRESHOLDS = {
  marginRed: new Decimal(5n, 2), // 5%
  marginYellow: new Decimal(15n, 2), // 15%
  expenseRed: new Decimal(5n, 1), // 50%
  expenseYellow: new Decimal(3n, 1), // 30%
  turnoverRed: new Decimal(2n, 0),
  turnoverYellow: new Decimal(5n, 0),
  netMarginRed: new Decimal(0n, 0),
};

export interface RiskThresholds {
  marginRed: Decimal;
  marginYellow: Decimal;
  expenseRed: Decimal;
  expenseYellow: Decimal;
  turnoverRed: Decimal;
  turnoverYellow: Decimal;
  netMarginRed: Decimal;
}

/** 风险分级器：红/黄/绿三级确定性阈值映射 */
export class RiskGrader {
  private t: RiskThresholds;

  constructor(thresholds: RiskThresholds = DEFAULT_RISK_THRESHOLDS) {
    this.t = thresholds;
  }

  grade(indicators: IndicatorSet): RiskReport {
    const signals: RiskSignal[] = [];
    const by = (name: string) => indicators.indicators.find((i) => i.name === name);

    const grossMargin = by("grossMargin");
    if (grossMargin) {
      if (grossMargin.value.lt(this.t.marginRed)) {
        signals.push({ type: "毛利下滑", level: "red", indicator: "grossMargin", message: `毛利率 ${grossMargin.value.toString()} 低于红线 ${this.t.marginRed.toString()}` });
      } else if (grossMargin.value.lt(this.t.marginYellow)) {
        signals.push({ type: "毛利下滑", level: "yellow", indicator: "grossMargin", message: `毛利率 ${grossMargin.value.toString()} 低于黄线 ${this.t.marginYellow.toString()}` });
      }
    }

    const netMargin = by("netMargin");
    if (netMargin && netMargin.value.lt(this.t.netMarginRed)) {
      signals.push({ type: "亏损", level: "red", indicator: "netMargin", message: `净利率为负（${netMargin.value.toString()}）` });
    }

    const expenseRatio = by("expenseRatio");
    if (expenseRatio) {
      if (expenseRatio.value.gt(this.t.expenseRed)) {
        signals.push({ type: "费用失控", level: "red", indicator: "expenseRatio", message: `费用率 ${expenseRatio.value.toString()} 高于红线 ${this.t.expenseRed.toString()}` });
      } else if (expenseRatio.value.gt(this.t.expenseYellow)) {
        signals.push({ type: "费用失控", level: "yellow", indicator: "expenseRatio", message: `费用率 ${expenseRatio.value.toString()} 高于黄线 ${this.t.expenseYellow.toString()}` });
      }
    }

    const receivableTurnover = by("receivableTurnover");
    if (receivableTurnover && receivableTurnover.value.lt(this.t.turnoverRed) && !receivableTurnover.value.isZero()) {
      signals.push({ type: "应收账款周转过慢", level: "red", indicator: "receivableTurnover", message: `应收周转 ${receivableTurnover.value.toString()} 次/期，低于红线` });
    } else if (receivableTurnover && receivableTurnover.value.lt(this.t.turnoverYellow) && !receivableTurnover.value.isZero()) {
      signals.push({ type: "应收账款周转偏慢", level: "yellow", indicator: "receivableTurnover", message: `应收周转 ${receivableTurnover.value.toString()} 次/期，低于黄线` });
    }

    const inventoryTurnover = by("inventoryTurnover");
    if (inventoryTurnover && inventoryTurnover.value.lt(this.t.turnoverRed) && !inventoryTurnover.value.isZero()) {
      signals.push({ type: "库存积压", level: "red", indicator: "inventoryTurnover", message: `库存周转 ${inventoryTurnover.value.toString()} 次/期，低于红线` });
    }

    if (signals.length === 0) {
      signals.push({ type: "健康", level: "green", message: "未识别到显著财务风险信号" });
    }
    return { signals };
  }
}