import type { DiagnosticAnomaly, IndicatorSet, RootCause } from "../types/domain.js";
/** 根因定位器：决策树下钻，从现象定位到市场/产品/价格/渠道/成本结构/资金链层 */
export declare class RootCauseLocator {
    locate(anomalies: DiagnosticAnomaly[], indicators: IndicatorSet): RootCause[];
}
