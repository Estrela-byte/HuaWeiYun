/**
 * 精度安全十进制类型。
 *
 * 内部以「缩放整数 bigint + 小数位数 scale」存储，全程避免 IEEE-754 浮点，
 * 杜绝金额运算中的浮点误差，满足"结论可复现"的硬约束。
 */
export declare class Decimal {
    readonly scaled: bigint;
    readonly scale: number;
    constructor(scaled: bigint, scale: number);
    static fromInt(value: number | bigint): Decimal;
    static zero(scale?: number): Decimal;
    /** 从字符串构造，如 "123.45"、"-0.05"、"100" */
    static fromString(input: string): Decimal;
    /** 仅用于展示/日志等非计算场景，禁止参与精算 */
    toNumber(): number;
    private static align;
    add(other: Decimal): Decimal;
    sub(other: Decimal): Decimal;
    mul(other: Decimal): Decimal;
    div(other: Decimal, scale?: number): Decimal;
    neg(): Decimal;
    abs(): Decimal;
    cmp(other: Decimal): number;
    eq(other: Decimal): boolean;
    lt(other: Decimal): boolean;
    lte(other: Decimal): boolean;
    gt(other: Decimal): boolean;
    gte(other: Decimal): boolean;
    isZero(): boolean;
    isNegative(): boolean;
    /** 四舍五入（half-away-from-zero）到指定小数位 */
    round(scale: number): Decimal;
    toString(): string;
}
/** 百分比辅助：从字符串百分比（如 "35.2"）构造，scale 固定 2 */
export declare function percent(value: string | number): Decimal;
