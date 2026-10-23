import type { CaliberType, Currency, MetricDictionary, RawRecord, UnifiedData } from "../types/domain.js";
import { Decimal } from "../types/decimal.js";
export declare const DEFAULT_TAX_RATE: Decimal;
export declare const DEFAULT_RATES: Record<Currency, Decimal>;
/** 各指标的默认口径（不含税、不含折旧摊销） */
export declare function buildDefaultDictionary(): MetricDictionary;
export interface UnifyOptions {
    targetCaliber?: CaliberType;
    taxRate?: Decimal;
    rates?: Record<string, Decimal>;
}
/**
 * 口径统一：将不同含税口径、不同币种的记录归一为统一口径与基准币种（CNY）。
 * 无法换算（缺少汇率）的部分计入冲突明细。
 */
export declare function unify(records: RawRecord[], _dictionary: MetricDictionary, options?: UnifyOptions): UnifiedData;
