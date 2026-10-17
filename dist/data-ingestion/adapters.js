const CALIBER_ALIASES = {
    "tax_inclusive": "tax_inclusive",
    "含税": "tax_inclusive",
    "含": "tax_inclusive",
    "inclusive": "tax_inclusive",
    "tax_exclusive": "tax_exclusive",
    "不含税": "tax_exclusive",
    "不含": "tax_exclusive",
    "exclusive": "tax_exclusive",
};
const CATEGORY_ALIASES = {
    "revenue": "revenue",
    "收入": "revenue",
    "cost": "cost",
    "成本": "cost",
    "expense": "expense",
    "费用": "expense",
    "receivable": "receivable",
    "应收": "receivable",
    "应收账款": "receivable",
    "inventory": "inventory",
    "库存": "inventory",
    "cashflow_operating": "cashflow_operating",
    "经营现金流": "cashflow_operating",
    "cashflow_investing": "cashflow_investing",
    "投资现金流": "cashflow_investing",
    "cashflow_financing": "cashflow_financing",
    "筹资现金流": "cashflow_financing",
};
export function parseCaliber(raw) {
    const key = raw.trim();
    return CALIBER_ALIASES[key] ?? CALIBER_ALIASES[key.toLowerCase()] ?? null;
}
export function parseCategory(raw) {
    const key = raw.trim();
    return CATEGORY_ALIASES[key] ?? CATEGORY_ALIASES[key.toLowerCase()] ?? null;
}
/** 提取约定制的维度列：列名为 `dim_<name>` 时归入 dimensions */
export function extractDimensions(header, cells) {
    const dims = {};
    header.forEach((h, i) => {
        if (h.startsWith("dim_") && cells[i] !== undefined && cells[i] !== "") {
            dims[h.slice(4)] = cells[i];
        }
    });
    return dims;
}
//# sourceMappingURL=adapters.js.map