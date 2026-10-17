import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
/** 外置化配置加载：口径/权重/阈值以 JSON 维护，支持调整后回算 */
export function loadConfig(filename) {
    const raw = readFileSync(join(here, filename), "utf-8");
    return JSON.parse(raw);
}
export function loadWeights() {
    return loadConfig("weights.json");
}
export function loadRisk() {
    return loadConfig("risk.json");
}
//# sourceMappingURL=loader.js.map