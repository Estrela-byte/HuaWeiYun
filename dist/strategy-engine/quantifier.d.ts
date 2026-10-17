import type { IndicatorSet, Period } from "../types/domain.js";
import { Decimal } from "../types/decimal.js";
export interface QuantifiedOutcome {
    benefit: Decimal;
    cost: Decimal;
    breakEven: Period;
}
/** 量化测算联动器：复用财务指标做预期收益、投入与盈亏转折点估算 */
export declare class Quantifier {
    quantify(direction: string, base: IndicatorSet): QuantifiedOutcome;
    private value;
}
