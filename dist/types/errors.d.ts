/**
 * 统一错误码枚举与错误对象，与设计 2.2 异常映射表一一对应。
 */
export type ErrorCode = "E_INGEST_FORMAT" | "E_INGEST_SOURCE" | "E_GOVERN_CONFLICT" | "E_FINANCE_INSUFFICIENT" | "E_LOW_CREDIBILITY" | "E_DIVISION_BY_ZERO" | "E_OUT_OF_RANGE" | "E_ROOT_CAUSE_UNKNOWN" | "E_CONFLICT" | "E_NO_DIAGNOSIS" | "E_MISSING_ASSUMPTION" | "E_UNCLASSIFIABLE" | "E_DEPENDENCY_FAILED" | "E_TASK_ABORTED" | "E_EVAL_INVALID_TESTSET" | "E_EVAL_READONLY_VIOLATION" | "E_EVAL_RETRIEVAL_FAILED" | "E_EVAL_INDICATOR_INCOMPUTABLE" | "E_EVAL_ABORTED";
export interface AppError {
    readonly code: ErrorCode;
    readonly message: string;
    readonly details?: unknown;
}
export declare function appError(code: ErrorCode, message: string, details?: unknown): AppError;
export declare const ERROR_LABELS: Record<ErrorCode, string>;
