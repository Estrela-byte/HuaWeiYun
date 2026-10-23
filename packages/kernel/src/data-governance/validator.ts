import type { RawRecord, ValidationIssue, ValidationReport } from "../types/domain.js";

/** 数据校验器：完整性、一致性、合理性三类校验 */
export class DataValidator {
  validate(records: RawRecord[], now: Date = new Date()): ValidationReport {
    const completeness: ValidationIssue[] = [];
    const consistency: ValidationIssue[] = [];
    const reasonableness: ValidationIssue[] = [];

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const seen = new Map<string, number[]>();

    records.forEach((r, i) => {
      // 完整性：必填字段语义校验
      if (!r.bizDate || !/^\d{4}-\d{2}-\d{2}$/.test(r.bizDate)) {
        completeness.push({ recordIndex: i, field: "bizDate", message: "业务日期缺失或格式非法" });
      }
      if (!r.currency) {
        completeness.push({ recordIndex: i, field: "currency", message: "币种缺失" });
      }
      if (!r.source) {
        completeness.push({ recordIndex: i, field: "source", message: "数据来源标识缺失" });
      }
      if (!r.caliber) {
        completeness.push({ recordIndex: i, field: "caliber", message: "口径类型缺失" });
      }

      // 合理性：日期非未来
      if (r.bizDate && /^\d{4}-\d{2}-\d{2}$/.test(r.bizDate)) {
        const d = new Date(r.bizDate + "T00:00:00");
        if (!Number.isNaN(d.getTime()) && d > today) {
          reasonableness.push({ recordIndex: i, field: "bizDate", message: `业务日期 ${r.bizDate} 晚于当前日期` });
        }
      }
      // 合理性：收入类金额不得为负
      if (r.category === "revenue" && r.amount.isNegative()) {
        reasonableness.push({ recordIndex: i, field: "amount", message: "收入金额不得为负" });
      }

      // 一致性：重复记录检测
      const key = `${r.bizDate}|${r.category}|${r.source}|${JSON.stringify(r.dimensions)}`;
      const idx = seen.get(key) ?? [];
      idx.push(i);
      seen.set(key, idx);
    });

    // 一致性：重复记录
    for (const [, idxList] of seen) {
      if (idxList.length > 1) {
        idxList.slice(1).forEach((i) => {
          consistency.push({ recordIndex: i, field: "duplicate", message: "与前置记录重复" });
        });
      }
    }

    // 一致性：同类目口径混用
    const caliberByCategory = new Map<string, Set<string>>();
    records.forEach((r) => {
      if (!caliberByCategory.has(r.category)) caliberByCategory.set(r.category, new Set());
      caliberByCategory.get(r.category)!.add(r.caliber);
    });
    for (const [category, calibers] of caliberByCategory) {
      if (calibers.size > 1) {
        consistency.push({ recordIndex: -1, field: "caliber", message: `类目 ${category} 混用多种口径: ${[...calibers].join(", ")}` });
      }
    }

    return { completeness, consistency, reasonableness };
  }
}