import type { AppError } from "../types/errors.js";
import type { RawRecord } from "../types/domain.js";
import { type Result } from "../types/result.js";
import { type IDataSourceAdapter } from "./adapters.js";
/**
 * JSON 适配器。
 *
 * 约定格式：`{ "records": [...] }` 或顶层数组，每条记录含
 * `category,bizDate,amount,caliber,currency`，`dimensions` 为可选维度对象。
 */
export declare class JsonAdapter implements IDataSourceAdapter {
    readonly sourceType: "file";
    readonly format: "json";
    parse(input: {
        sourceType: "file";
        format: "json";
        filename: string;
        content: string | Uint8Array;
    }): Result<RawRecord[], AppError>;
}
