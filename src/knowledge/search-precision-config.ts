import { Decimal } from "../types/decimal.js";
import { loadConfig } from "../config/loader.js";
import type { AppError } from "../types/errors.js";
import { appError } from "../types/errors.js";
import type { Result } from "../types/result.js";
import { err, ok } from "../types/result.js";
import type { KnowledgeDoc } from "../types/knowledge.js";

/** 检索精确度策略配置：权重/阈值/断层参数一律 Decimal，maxTopK 为整数 */
export interface SearchPrecisionConfig {
  readonly wTitle: Decimal;
  readonly wTag: Decimal;
  readonly wContent: Decimal;
  readonly relevanceThreshold: Decimal;
  readonly scoreGapThreshold: Decimal;
  readonly maxTopK: number;
}

/** 命中计数（证据链：标题/标签/正文各自命中次数） */
export interface HitCounts {
  readonly titleHits: number;
  readonly tagHits: number;
  readonly contentHits: number;
}

/** 带分文档：score 为 Decimal（精算用），counts 为证据链 */
export interface ScoredDoc {
  readonly doc: KnowledgeDoc;
  readonly score: Decimal;
  readonly counts: HitCounts;
}

/** 阈值过滤结果 */
export interface FilterResult {
  readonly kept: readonly ScoredDoc[];
  readonly filteredCount: number;
}

/** 默认配置：标题 20 / 标签 8 / 正文 1，阈值与断层参数经评估标定 */
export const DEFAULT_SEARCH_PRECISION_CONFIG: SearchPrecisionConfig = {
  wTitle: Decimal.fromInt(20),
  wTag: Decimal.fromInt(8),
  wContent: Decimal.fromInt(1),
  relevanceThreshold: Decimal.fromInt(9),
  scoreGapThreshold: Decimal.fromInt(50),
  maxTopK: 5,
};

interface ValidationProblem {
  readonly field: string;
  readonly reason: string;
}

function parseDecimalField(raw: Record<string, unknown>, field: string, problems: ValidationProblem[]): Decimal | undefined {
  const v = raw[field];
  if (v === undefined || v === null) {
    problems.push({ field, reason: "缺失" });
    return undefined;
  }
  if (typeof v === "number") {
    return Decimal.fromInt(v);
  }
  if (typeof v === "string") {
    try {
      return Decimal.fromString(v);
    } catch {
      problems.push({ field, reason: "无法解析为 Decimal" });
      return undefined;
    }
  }
  problems.push({ field, reason: "类型非法" });
  return undefined;
}

/**
 * 校验检索策略配置：权重正数且 wTitle > wTag > wContent、阈值非负、断层参数正数、maxTopK ∈ [1,10] 整数。
 * 字符串/数字形态的权重经 Decimal.fromString/fromInt 转换。
 */
export function validateSearchConfig(config: unknown): Result<SearchPrecisionConfig, AppError> {
  if (typeof config !== "object" || config === null) {
    return err(appError("E_SEARCH_WEIGHT_INVALID", "配置非对象", { config }));
  }
  const raw = config as Record<string, unknown>;
  const problems: ValidationProblem[] = [];

  const wTitle = parseDecimalField(raw, "wTitle", problems);
  const wTag = parseDecimalField(raw, "wTag", problems);
  const wContent = parseDecimalField(raw, "wContent", problems);
  const relevanceThreshold = parseDecimalField(raw, "relevanceThreshold", problems);
  const scoreGapThreshold = parseDecimalField(raw, "scoreGapThreshold", problems);

  const zero = Decimal.fromInt(0);
  if (wTitle !== undefined && !wTitle.gt(zero)) problems.push({ field: "wTitle", reason: "须为正数" });
  if (wTag !== undefined && !wTag.gt(zero)) problems.push({ field: "wTag", reason: "须为正数" });
  if (wContent !== undefined && !wContent.gt(zero)) problems.push({ field: "wContent", reason: "须为正数" });
  if (wTitle !== undefined && wTag !== undefined && !wTitle.gt(wTag)) {
    problems.push({ field: "wTitle/wTag", reason: "须 wTitle > wTag" });
  }
  if (wTag !== undefined && wContent !== undefined && !wTag.gt(wContent)) {
    problems.push({ field: "wTag/wContent", reason: "须 wTag > wContent" });
  }
  if (relevanceThreshold !== undefined && relevanceThreshold.isNegative()) {
    problems.push({ field: "relevanceThreshold", reason: "须非负" });
  }
  if (scoreGapThreshold !== undefined && !scoreGapThreshold.gt(zero)) {
    problems.push({ field: "scoreGapThreshold", reason: "须为正数" });
  }

  const maxTopK = raw.maxTopK;
  if (typeof maxTopK !== "number" || !Number.isInteger(maxTopK) || maxTopK < 1 || maxTopK > 10) {
    problems.push({ field: "maxTopK", reason: "须为 1-10 整数" });
  }

  if (problems.length > 0) {
    const hasGap = problems.some((p) => p.field === "scoreGapThreshold");
    const hasThreshold = problems.some((p) => p.field === "relevanceThreshold");
    const code = hasGap ? "E_SEARCH_GAP_PARAM_MISSING" : hasThreshold ? "E_SEARCH_THRESHOLD_MISSING" : "E_SEARCH_WEIGHT_INVALID";
    return err(appError(code, "检索配置校验失败", { problems }));
  }

  return ok({
    wTitle: wTitle!,
    wTag: wTag!,
    wContent: wContent!,
    relevanceThreshold: relevanceThreshold!,
    scoreGapThreshold: scoreGapThreshold!,
    maxTopK: maxTopK as number,
  });
}

/**
 * 加载外置化检索策略配置：读取 search-precision.json 并校验。
 * 文件缺失或校验失败时回退默认配置（不抛错中断）。
 */
export function loadSearchPrecisionConfig(): SearchPrecisionConfig {
  try {
    const raw = loadConfig<unknown>("search-precision.json");
    const result = validateSearchConfig(raw);
    if (result.ok) {
      return result.value;
    }
    return DEFAULT_SEARCH_PRECISION_CONFIG;
  } catch {
    return DEFAULT_SEARCH_PRECISION_CONFIG;
  }
}