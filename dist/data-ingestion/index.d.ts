import type { AppError } from "../types/errors.js";
import type { DataSourceType, RawRecord } from "../types/domain.js";
import type { Result } from "../types/result.js";
import type { RawInput } from "./adapters.js";
export type { RawInput, IDataSourceAdapter, FileFormat } from "./adapters.js";
export interface RejectedRecord {
    recordIndex?: number;
    reason: string;
}
export interface IngestResult {
    batchId: string;
    recordCount: number;
    rejected: RejectedRecord[];
    records: RawRecord[];
}
/** 主入口：将多来源经营数据统一解析为标准化原始记录 */
export declare function ingest(sourceType: DataSourceType, input: Omit<RawInput, "sourceType">): Result<IngestResult, AppError>;
