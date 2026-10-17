import type { DiagnosticAnomaly, IndicatorSet } from "../types/domain.js";
/**
 * 异常识别器：三通道检测（阈值超限 / 趋势突变 / 同环比偏离）。
 * 趋势与同环比通道依赖历史或基准数据，缺失时不编造、显式标注。
 */
export declare class AnomalyDetector {
    detect(indicators: IndicatorSet, options?: {
        hasHistory?: boolean;
        hasBenchmark?: boolean;
    }): DiagnosticAnomaly[];
}
