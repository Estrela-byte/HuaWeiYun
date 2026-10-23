import type { AppError } from "../types/errors.js";
import type { CaliberType, DataSourceType, RawRecord, RecordCategory } from "../types/domain.js";
import type { Result } from "../types/result.js";
export type FileFormat = "csv" | "xlsx" | "json";
export interface RawInput {
    sourceType: DataSourceType;
    format: FileFormat;
    filename: string;
    content: string | Uint8Array;
}
export interface IDataSourceAdapter {
    readonly sourceType: DataSourceType;
    readonly format: FileFormat;
    parse(input: RawInput): Result<RawRecord[], AppError>;
}
export declare function parseCaliber(raw: string): CaliberType | null;
export declare function parseCategory(raw: string): RecordCategory | null;
/** 提取约定制的维度列：列名为 `dim_<name>` 时归入 dimensions */
export declare function extractDimensions(header: string[], cells: string[]): Record<string, string>;
