import { inflateRawSync } from "node:zlib";
import { appError } from "../types/errors.js";
import { Decimal } from "../types/decimal.js";
import { err, ok } from "../types/result.js";
import { parseCaliber, parseCategory } from "./adapters.js";
/**
 * XLSX 适配器（最小实现）。
 *
 * XLSX 本质是 ZIP(OLE 无关) 包：读取 `xl/sharedStrings.xml` 与
 * `xl/worksheets/sheet1.xml`，首行作为表头，遵循与 CSV 相同的字段约定。
 */
export class XlsxAdapter {
    sourceType = "file";
    format = "xlsx";
    parse(input) {
        if (typeof input.content === "string") {
            return err(appError("E_INGEST_FORMAT", "XLSX 内容须为二进制数据", { filename: input.filename }));
        }
        const entries = readZip(input.content);
        if (entries === null) {
            return err(appError("E_INGEST_FORMAT", "无法解析 XLSX 文件（非有效 ZIP 包）", { filename: input.filename }));
        }
        const sharedStrings = parseSharedStrings(entries.get("xl/sharedStrings.xml"));
        const sheetEntry = entries.get("xl/worksheets/sheet1.xml");
        if (!sheetEntry) {
            return err(appError("E_INGEST_FORMAT", "XLSX 缺少工作表 sheet1", { filename: input.filename }));
        }
        const sheetXml = new TextDecoder("utf-8").decode(sheetEntry);
        const rows = parseSheetRows(sheetXml, sharedStrings);
        if (rows.length === 0) {
            return err(appError("E_INGEST_FORMAT", "XLSX 工作表为空", { filename: input.filename }));
        }
        const header = rows[0] ?? [];
        const col = (name) => header.findIndex((h) => h === name);
        const cat = col("category");
        const biz = col("bizDate");
        const amt = col("amount");
        const cal = col("caliber");
        const cur = col("currency");
        if (cat < 0 || biz < 0 || amt < 0 || cal < 0 || cur < 0) {
            const missing = ["category", "bizDate", "amount", "caliber", "currency"].filter((n) => col(n) < 0);
            return err(appError("E_INGEST_FORMAT", `XLSX 缺少必填列: ${missing.join(", ")}`, { filename: input.filename }));
        }
        const records = [];
        for (let r = 1; r < rows.length; r++) {
            const cells = rows[r] ?? [];
            const build = () => {
                const category = parseCategory(cells[cat] ?? "");
                if (!category)
                    return `第 ${r + 1} 行 category 非法`;
                const bizDate = cells[biz] ?? "";
                if (!/^\d{4}-\d{2}-\d{2}$/.test(bizDate))
                    return `第 ${r + 1} 行 bizDate 非法`;
                const caliber = parseCaliber(cells[cal] ?? "");
                if (!caliber)
                    return `第 ${r + 1} 行 caliber 非法`;
                let amount;
                try {
                    amount = Decimal.fromString(cells[amt] ?? "");
                }
                catch {
                    return `第 ${r + 1} 行 amount 非法`;
                }
                const dims = {};
                header.forEach((h, i) => {
                    if (h.startsWith("dim_") && (cells[i] ?? "") !== "") {
                        dims[h.slice(4)] = cells[i];
                    }
                });
                return {
                    source: input.sourceType,
                    bizDate,
                    amount,
                    caliber,
                    currency: (cells[cur] || "CNY").toUpperCase(),
                    category,
                    dimensions: dims,
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
function parseSharedStrings(xml) {
    if (!xml)
        return [];
    const text = new TextDecoder("utf-8").decode(xml);
    const out = [];
    const siRe = /<si[^>]*>([\s\S]*?)<\/si>/g;
    let m;
    while ((m = siRe.exec(text)) !== null) {
        const tRe = /<t[^>]*>([\s\S]*?)<\/t>/g;
        let parts = "";
        let tm;
        while ((tm = tRe.exec(m[1] ?? "")) !== null) {
            parts += decodeXml(tm[1] ?? "");
        }
        out.push(parts);
    }
    return out;
}
function parseSheetRows(xml, sharedStrings) {
    const rows = [];
    const rowRe = /<row[^>]*>([\s\S]*?)<\/row>/g;
    let rm;
    while ((rm = rowRe.exec(xml)) !== null) {
        const cells = [];
        const cRe = /<c[^>]*>([\s\S]*?)<\/c>/g;
        let cm;
        while ((cm = cRe.exec(rm[1] ?? "")) !== null) {
            const cellXml = cm[1] ?? "";
            const tMatch = cm[0].match(/\bt="([^"]+)"/);
            const type = tMatch ? tMatch[1] : undefined;
            const vMatch = cellXml.match(/<v>([\s\S]*?)<\/v>/);
            let value = vMatch ? decodeXml(vMatch[1] ?? "") : "";
            if (type === "s" && sharedStrings.length > 0) {
                const idx = Number(value);
                value = sharedStrings[idx] ?? value;
            }
            cells.push(value);
        }
        rows.push(cells);
    }
    return rows;
}
function decodeXml(s) {
    return s
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
}
/** 精简 ZIP 读取器，返回文件名 → 解压后字节 */
function readZip(buf) {
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const eocd = findSignature(buf, 0x06054b50);
    if (eocd < 0)
        return null;
    const entriesCount = view.getUint16(eocd + 10, true);
    const cdOffset = view.getUint32(eocd + 16, true);
    const out = new Map();
    let p = cdOffset;
    for (let i = 0; i < entriesCount; i++) {
        if (view.getUint32(p, true) !== 0x02014b50)
            break;
        const method = view.getUint16(p + 10, true);
        const compressedSize = view.getUint32(p + 20, true);
        const filenameLength = view.getUint16(p + 28, true);
        const extraLength = view.getUint16(p + 30, true);
        const commentLength = view.getUint16(p + 32, true);
        const localOffset = view.getUint32(p + 42, true);
        const name = new TextDecoder("utf-8").decode(buf.slice(p + 46, p + 46 + filenameLength));
        if (!name.endsWith("/")) {
            const localNameLen = view.getUint16(localOffset + 26, true);
            const localExtraLen = view.getUint16(localOffset + 28, true);
            const dataStart = localOffset + 30 + localNameLen + localExtraLen;
            const compressed = buf.slice(dataStart, dataStart + compressedSize);
            let data;
            if (method === 0) {
                data = compressed;
            }
            else if (method === 8) {
                try {
                    data = inflateRawSync(compressed);
                }
                catch {
                    data = compressed;
                }
            }
            else {
                data = compressed;
            }
            out.set(name, data);
        }
        p += 46 + filenameLength + extraLength + commentLength;
    }
    return out;
}
function findSignature(buf, signature) {
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    for (let i = buf.byteLength - 22; i >= 0 && i >= buf.byteLength - 65557; i--) {
        if (view.getUint32(i, true) === signature)
            return i;
    }
    return -1;
}
//# sourceMappingURL=xlsx-parser.js.map