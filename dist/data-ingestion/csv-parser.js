import { appError } from "../types/errors.js";
import { Decimal } from "../types/decimal.js";
import { err, ok } from "../types/result.js";
import { extractDimensions, parseCaliber, parseCategory } from "./adapters.js";
/**
 * CSV 适配器。
 *
 * 约定格式：首行为表头，须包含 `category,bizDate,amount,caliber,currency`；
 * 可选的 `dim_<name>` 列会归入维度。金额支持带符号的十进制字符串。
 */
export class CsvAdapter {
    sourceType = "file";
    format = "csv";
    parse(input) {
        const text = toText(input.content);
        const { header, rows } = splitCsv(text);
        if (header.length === 0) {
            return err(appError("E_INGEST_FORMAT", "CSV 文件为空", { filename: input.filename }));
        }
        const idx = requiredIndex(header);
        if (idx.err) {
            return err(idx.err);
        }
        const records = [];
        for (let r = 0; r < rows.length; r++) {
            const cells = rows[r] ?? [];
            const build = () => {
                const category = parseCategory(cell(cells, idx.category));
                if (!category) {
                    return `第 ${r + 2} 行 category 非法: ${JSON.stringify(cell(cells, idx.category))}`;
                }
                const bizDate = cell(cells, idx.bizDate);
                if (!/^\d{4}-\d{2}-\d{2}$/.test(bizDate)) {
                    return `第 ${r + 2} 行 bizDate 非法: ${JSON.stringify(bizDate)}`;
                }
                const amountStr = cell(cells, idx.amount);
                let amount;
                try {
                    amount = Decimal.fromString(amountStr);
                }
                catch {
                    return `第 ${r + 2} 行 amount 非法: ${JSON.stringify(amountStr)}`;
                }
                const caliber = parseCaliber(cell(cells, idx.caliber));
                if (!caliber) {
                    return `第 ${r + 2} 行 caliber 非法: ${JSON.stringify(cell(cells, idx.caliber))}`;
                }
                const currency = cell(cells, idx.currency).toUpperCase() || "CNY";
                return {
                    source: input.sourceType,
                    bizDate,
                    amount,
                    caliber,
                    currency,
                    category,
                    dimensions: extractDimensions(header, cells),
                };
            };
            const built = build();
            if (typeof built === "string") {
                return err(appError("E_INGEST_FORMAT", built, { filename: input.filename }));
            }
            records.push(built);
        }
        return ok(records);
    }
}
function toText(content) {
    if (typeof content === "string") {
        return content;
    }
    return new TextDecoder("utf-8").decode(content);
}
function cell(cells, i) {
    return (cells[i] ?? "").trim();
}
function requiredIndex(header) {
    const col = (name) => header.findIndex((h) => h.trim() === name);
    const category = col("category");
    const bizDate = col("bizDate");
    const amount = col("amount");
    const caliber = col("caliber");
    const currency = col("currency");
    const missing = [];
    if (category < 0)
        missing.push("category");
    if (bizDate < 0)
        missing.push("bizDate");
    if (amount < 0)
        missing.push("amount");
    if (caliber < 0)
        missing.push("caliber");
    if (currency < 0)
        missing.push("currency");
    if (missing.length > 0) {
        return { err: appError("E_INGEST_FORMAT", `CSV 缺少必填列: ${missing.join(", ")}`), category, bizDate, amount, caliber, currency };
    }
    return { category, bizDate, amount, caliber, currency };
}
/** 解析 CSV（支持双引号包裹字段与逗号/引号转义） */
export function splitCsv(text) {
    const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    const nonEmpty = lines.filter((l) => l.trim() !== "");
    if (nonEmpty.length === 0) {
        return { header: [], rows: [] };
    }
    const header = parseCsvLine(nonEmpty[0] ?? "");
    const rows = nonEmpty.slice(1).map((l) => parseCsvLine(l));
    return { header, rows };
}
function parseCsvLine(line) {
    const out = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"') {
                if (line[i + 1] === '"') {
                    cur += '"';
                    i++;
                }
                else {
                    inQuotes = false;
                }
            }
            else {
                cur += ch;
            }
        }
        else if (ch === '"') {
            inQuotes = true;
        }
        else if (ch === ",") {
            out.push(cur);
            cur = "";
        }
        else {
            cur += ch;
        }
    }
    out.push(cur);
    return out;
}
//# sourceMappingURL=csv-parser.js.map