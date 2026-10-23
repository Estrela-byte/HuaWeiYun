import type { AppError } from "../types/errors.js";
import type { RawRecord } from "../types/domain.js";
import { type Result } from "../types/result.js";
import { type IDataSourceAdapter } from "./adapters.js";
/**
 * XLSX 适配器（最小实现）。
 *
 * XLSX 本质是 ZIP(OLE 无关) 包：读取 `xl/sharedStrings.xml` 与
 * `xl/worksheets/sheet1.xml`，首行作为表头，遵循与 CSV 相同的字段约定。
 */
export declare class XlsxAdapter implements IDataSourceAdapter {
    readonly sourceType: "file";
    readonly format: "xlsx";
    parse(input: {
        sourceType: "file";
        format: "xlsx";
        filename: string;
        content: string | Uint8Array;
    }): Result<RawRecord[], AppError>;
}
