import type { AppError } from "../types/errors.js";
import type { RawRecord } from "../types/domain.js";
import { appError } from "../types/errors.js";
import { Decimal } from "../types/decimal.js";
import { err, ok, type Result } from "../types/result.js";
import { parseCaliber, parseCategory, type IDataSourceAdapter } from "./adapters.js";

interface JsonRecordInput {
  source?: string;
  category?: string;
  bizDate?: string;
  amount?: string | number;
  caliber?: string;
  currency?: string;
  dimensions?: Record<string, string>;
}

/**
 * JSON 适配器。
 *
 * 约定格式：`{ "records": [...] }` 或顶层数组，每条记录含
 * `category,bizDate,amount,caliber,currency`，`dimensions` 为可选维度对象。
 */
export class JsonAdapter implements IDataSourceAdapter {
  readonly sourceType = "file" as const;
  readonly format = "json" as const;

  parse(input: { sourceType: "file"; format: "json"; filename: string; content: string | Uint8Array }): Result<RawRecord[], AppError> {
    const text = typeof input.content === "string" ? input.content : new TextDecoder("utf-8").decode(input.content);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      return err(appError("E_INGEST_FORMAT", `JSON 解析失败: ${(e as Error).message}`, { filename: input.filename }));
    }
    const list = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { records?: unknown[] }).records)
        ? ((parsed as { records: unknown[] }).records)
        : null;
    if (!list) {
      return err(appError("E_INGEST_FORMAT", "JSON 需为数组或含 records 数组的对象", { filename: input.filename }));
    }
    const records: RawRecord[] = [];
    for (let i = 0; i < list.length; i++) {
      const item = list[i] as JsonRecordInput;
      const failure = (msg: string): Result<RawRecord[], AppError> =>
        err(appError("E_INGEST_FORMAT", `第 ${i + 1} 条记录: ${msg}`, { filename: input.filename }));
      if (item.category === undefined) return failure("缺少 category");
      if (item.bizDate === undefined || !/^\d{4}-\d{2}-\d{2}$/.test(String(item.bizDate))) return failure("bizDate 非法或缺失");
      if (item.amount === undefined) return failure("缺少 amount");
      const category = parseCategory(String(item.category));
      if (!category) return failure(`category 非法: ${item.category}`);
      const caliber = parseCaliber(String(item.caliber));
      if (!caliber) return failure(`caliber 非法: ${item.caliber}`);
      let amount: Decimal;
      try {
        amount = Decimal.fromString(String(item.amount));
      } catch {
        return failure(`amount 非法: ${item.amount}`);
      }
      records.push({
        source: input.sourceType,
        bizDate: String(item.bizDate),
        amount,
        caliber,
        currency: (item.currency ?? "CNY").toUpperCase(),
        category,
        dimensions: item.dimensions ?? {},
      });
    }
    return ok(records);
  }
}