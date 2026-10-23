/**
 * 统一结果类型，杜绝裸 `Map<string, string>` 作为接口出入口，
 * 保证类型安全与错误可追踪。
 */
export type Result<T, E> = {
    ok: true;
    value: T;
} | {
    ok: false;
    error: E;
};
export declare function ok<T, E>(value: T): Result<T, E>;
export declare function err<T, E>(error: E): Result<T, E>;
export declare function isOk<T, E>(r: Result<T, E>): r is {
    ok: true;
    value: T;
};
export declare function isErr<T, E>(r: Result<T, E>): r is {
    ok: false;
    error: E;
};
