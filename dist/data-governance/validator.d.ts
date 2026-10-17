import type { RawRecord, ValidationReport } from "../types/domain.js";
/** 数据校验器：完整性、一致性、合理性三类校验 */
export declare class DataValidator {
    validate(records: RawRecord[], now?: Date): ValidationReport;
}
