import type { AppError } from "../types/errors.js";
import type { RawRecord } from "../types/domain.js";
import { type Result } from "../types/result.js";
import { type IDataSourceAdapter } from "./adapters.js";
/**
 * CSV 适配器。
 *
 * 约定格式：首行为表头，须包含 `category,bizDate,amount,caliber,currency`；
 * 可选的 `dim_<name>` 列会归入维度。金额支持带符号的十进制字符串。
 */
export declare class CsvAdapter implements IDataSourceAdapter {
    readonly sourceType: "file";
    readonly format: "csv";
    parse(input: {
        sourceType: "file";
        format: "csv";
        filename: string;
        content: string | Uint8Array;
    }): Result<RawRecord[], AppError>;
}
/** 解析 CSV（支持双引号包裹字段与逗号/引号转义） */
export declare function splitCsv(text: string): {
    header: string[];
    rows: string[][];
};
