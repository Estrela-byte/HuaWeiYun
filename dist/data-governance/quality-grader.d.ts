import type { QualityGrade, UnifiedData, ValidationReport } from "../types/domain.js";
/**
 * 质量分级器：A/B/C 三级确定性判定。
 * - C 级：存在无法归一口径冲突，或关键字段（金额/日期/来源/口径）缺失；
 * - B 级：存在少量异常、缺失或一致性问题；
 * - A 级：完整、口径明确、可追溯。
 */
export declare function gradeQuality(unified: UnifiedData, validation: ValidationReport): QualityGrade;
