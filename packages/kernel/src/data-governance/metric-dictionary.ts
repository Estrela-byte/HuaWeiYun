import type { CaliberType, ConflictItem, Currency, MetricDictionary, MetricDictionaryEntry, RawRecord, UnifiedData, UnifiedRecord } from "../types/domain.js";
import { Decimal } from "../types/decimal.js";

export const DEFAULT_TAX_RATE: Decimal = new Decimal(13n, 2); // 13%

export const DEFAULT_RATES: Record<Currency, Decimal> = {
  CNY: Decimal.fromInt(1),
  USD: Decimal.fromString("7.2"),
  EUR: Decimal.fromString("7.8"),
  JPY: Decimal.fromString("0.05"),
};

const ONE = Decimal.fromInt(1);

/** 各指标的默认口径（不含税、不含折旧摊销） */
export function buildDefaultDictionary(): MetricDictionary {
  const caliber = {
    tax: "tax_exclusive" as CaliberType,
    includeDepreciation: false,
    description: "不含税口径，不含折旧摊销",
  };
  const period = { start: "1900-01-01", end: "9999-12-31" };
  return {
    revenue: entry("revenue", caliber, period),
    grossProfit: entry("grossProfit", caliber, period),
    grossMargin: entry("grossMargin", caliber, period),
    netMargin: entry("netMargin", caliber, period),
    expenseRatio: entry("expenseRatio", caliber, period),
    receivableTurnover: entry("receivableTurnover", caliber, period),
    inventoryTurnover: entry("inventoryTurnover", caliber, period),
    operatingCashflow: entry("operatingCashflow", caliber, period),
    breakEvenPoint: entry("breakEvenPoint", caliber, period),
  };
}

function entry(name: MetricDictionaryEntry["name"], caliber: MetricDictionaryEntry["caliber"], period: MetricDictionaryEntry["effectivePeriod"]): MetricDictionaryEntry {
  return { name, caliber, version: 1, effectivePeriod: period };
}

export interface UnifyOptions {
  targetCaliber?: CaliberType;
  taxRate?: Decimal;
  rates?: Record<string, Decimal>;
}

/**
 * 口径统一：将不同含税口径、不同币种的记录归一为统一口径与基准币种（CNY）。
 * 无法换算（缺少汇率）的部分计入冲突明细。
 */
export function unify(records: RawRecord[], _dictionary: MetricDictionary, options: UnifyOptions = {}): UnifiedData {
  const targetCaliber = options.targetCaliber ?? "tax_exclusive";
  const taxRate = options.taxRate ?? DEFAULT_TAX_RATE;
  const rates = options.rates ?? DEFAULT_RATES;
  const unified: UnifiedRecord[] = [];
  const conflicts: ConflictItem[] = [];

  records.forEach((r, i) => {
    let amount = r.amount;
    if (r.caliber !== targetCaliber) {
      if (targetCaliber === "tax_exclusive") {
        amount = amount.div(ONE.add(taxRate), 4);
      } else {
        amount = amount.mul(ONE.add(taxRate));
      }
    }
    const rate = rates[r.currency];
    let convertedCurrency: Currency = "CNY";
    let conflict: ConflictItem | undefined;
    if (rate === undefined) {
      conflict = { recordIndex: i, message: `缺少币种 ${r.currency} 的汇率，无法统一换算` };
      convertedCurrency = r.currency;
    } else if (!rate.eq(ONE)) {
      amount = amount.mul(rate);
    }
    unified.push({
      amount,
      caliberNormalized: targetCaliber,
      convertedCurrency,
      provenanceRef: r.source,
      bizDate: r.bizDate,
      category: r.category,
      dimensions: r.dimensions,
    });
    if (conflict) {
      conflicts.push(conflict);
    }
  });

  return { records: unified, conflicts };
}