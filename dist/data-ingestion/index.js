import { randomUUID } from "node:crypto";
import { err, ok } from "../types/result.js";
import { CsvAdapter } from "./csv-parser.js";
import { JsonAdapter } from "./json-validator.js";
import { XlsxAdapter } from "./xlsx-parser.js";
import { appError } from "../types/errors.js";
function adapterFor(format) {
    switch (format) {
        case "csv":
            return new CsvAdapter();
        case "json":
            return new JsonAdapter();
        case "xlsx":
            return new XlsxAdapter();
        default:
            return null;
    }
}
/** 主入口：将多来源经营数据统一解析为标准化原始记录 */
export function ingest(sourceType, input) {
    const adapter = adapterFor(input.format);
    if (!adapter) {
        return err(appError("E_INGEST_FORMAT", `不支持的格式: ${String(input.format)}`));
    }
    const parsed = adapter.parse({ ...input, sourceType });
    if (!parsed.ok) {
        return err(parsed.error);
    }
    return ok({
        batchId: randomUUID(),
        recordCount: parsed.value.length,
        rejected: [],
        records: parsed.value,
    });
}
//# sourceMappingURL=index.js.map