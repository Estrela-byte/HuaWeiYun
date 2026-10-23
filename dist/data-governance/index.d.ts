import type { MetricDictionary, ProvenanceRecord, QualityGrade, RawRecord, UnifiedData, ValidationReport } from "../types/domain.js";
import { type UnifyOptions } from "./metric-dictionary.js";
export { DataValidator } from "./validator.js";
export { unify, buildDefaultDictionary, DEFAULT_TAX_RATE, DEFAULT_RATES, type UnifyOptions } from "./metric-dictionary.js";
export { gradeQuality } from "./quality-grader.js";
export { ProvenanceLedger } from "./provenance-ledger.js";
export interface GovernedData {
    unified: UnifiedData;
    grade: QualityGrade;
    provenance: ProvenanceRecord;
    validation: ValidationReport;
}
export interface GovernOptions {
    dictionary?: MetricDictionary;
    unifyOptions?: UnifyOptions;
}
/**
 * 数据治理编排：校验 → 口径统一 → 溯源留痕 → 质量分级。
 * 治理本身不失败，分级结论（含 C 级阻断判定）由下游守卫与编排层执行。
 */
export declare function govern(records: RawRecord[], options?: GovernOptions): GovernedData;
