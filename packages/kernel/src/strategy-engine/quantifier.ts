import type { IndicatorResult, IndicatorSet, Period } from "../types/domain.js";
import { Decimal } from "../types/decimal.js";

export interface QuantifiedOutcome {
  benefit: Decimal;
  cost: Decimal;
  breakEven: Period;
}

/** 量化测算联动器：复用财务指标做预期收益、投入与盈亏转折点估算 */
export class Quantifier {
  quantify(direction: string, base: IndicatorSet): QuantifiedOutcome {
    const revenue = this.value(base, "revenue");
    const grossMargin = this.value(base, "grossMargin");
    const marginRate = grossMargin && !grossMargin.isZero() ? grossMargin : new Decimal(2n, 1);
    const rev = revenue ?? new Decimal(100000n, 0);
    const benefit = rev.mul(marginRate).round(2);
    const cost = rev.mul(new Decimal(1n, 1)).round(2); // 投入按营收 10% 估算
    return {
      benefit,
      cost,
      breakEven: { start: "待定", end: "待定" },
    };
  }

  private value(base: IndicatorSet, name: string): Decimal | undefined {
    const r: IndicatorResult | undefined = base.indicators.find((i) => i.name === name);
    return r?.value;
  }
}