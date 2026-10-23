export {
  validateTestSet,
} from "./testset-validator.js";
export { computeMetrics, statConfusion, type ConfusionInput } from "./metrics.js";
export { evaluate } from "./evaluator.js";
export { judgePass } from "./judgement.js";
export { buildReport } from "./report.js";

export type {
  SampleType,
  EvalQuery,
  EvalTestSet,
  EvalThresholds,
  SearchSource,
  SearchHit,
  ReadonlySearchRequest,
  ReadonlySearchResult,
  IReadonlySearch,
  QueryEvalDetail,
  EvalMetrics,
  EvalScope,
  PassJudgement,
  EvalReport,
} from "./types.js";