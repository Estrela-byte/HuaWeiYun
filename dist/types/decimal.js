/**
 * 精度安全十进制类型。
 *
 * 内部以「缩放整数 bigint + 小数位数 scale」存储，全程避免 IEEE-754 浮点，
 * 杜绝金额运算中的浮点误差，满足"结论可复现"的硬约束。
 */
export class Decimal {
    scaled;
    scale;
    constructor(scaled, scale) {
        if (!Number.isInteger(scale) || scale < 0) {
            throw new Error(`Decimal: invalid scale ${scale}`);
        }
        this.scaled = scaled;
        this.scale = scale;
    }
    static fromInt(value) {
        return new Decimal(BigInt(value), 0);
    }
    static zero(scale = 2) {
        return new Decimal(0n, scale);
    }
    /** 从字符串构造，如 "123.45"、"-0.05"、"100" */
    static fromString(input) {
        const s = input.trim();
        const m = s.match(/^(-?)(\d+)(?:\.(\d+))?$/);
        if (!m) {
            throw new Error(`Decimal: invalid string "${input}"`);
        }
        const sign = m[1] === "-" ? -1n : 1n;
        const intPart = m[2] ?? "0";
        const fracPart = m[3] ?? "";
        const scaled = BigInt(intPart + fracPart) * sign;
        return new Decimal(scaled, fracPart.length);
    }
    /** 仅用于展示/日志等非计算场景，禁止参与精算 */
    toNumber() {
        return Number(this.toString());
    }
    static align(a, b) {
        const scale = Math.max(a.scale, b.scale);
        const aScaled = a.scaled * 10n ** BigInt(scale - a.scale);
        const bScaled = b.scaled * 10n ** BigInt(scale - b.scale);
        return [aScaled, bScaled, scale];
    }
    add(other) {
        const [a, b, scale] = Decimal.align(this, other);
        return new Decimal(a + b, scale);
    }
    sub(other) {
        const [a, b, scale] = Decimal.align(this, other);
        return new Decimal(a - b, scale);
    }
    mul(other) {
        return new Decimal(this.scaled * other.scaled, this.scale + other.scale);
    }
    div(other, scale = 4) {
        if (other.scaled === 0n) {
            throw new Error("Decimal: division by zero");
        }
        const numerator = this.scaled * 10n ** BigInt(scale + other.scale);
        return new Decimal(numerator / other.scaled, scale);
    }
    neg() {
        return new Decimal(-this.scaled, this.scale);
    }
    abs() {
        return new Decimal(this.scaled < 0n ? -this.scaled : this.scaled, this.scale);
    }
    cmp(other) {
        const [a, b] = Decimal.align(this, other);
        return a < b ? -1 : a > b ? 1 : 0;
    }
    eq(other) {
        return this.cmp(other) === 0;
    }
    lt(other) {
        return this.cmp(other) < 0;
    }
    lte(other) {
        return this.cmp(other) <= 0;
    }
    gt(other) {
        return this.cmp(other) > 0;
    }
    gte(other) {
        return this.cmp(other) >= 0;
    }
    isZero() {
        return this.scaled === 0n;
    }
    isNegative() {
        return this.scaled < 0n;
    }
    /** 四舍五入（half-away-from-zero）到指定小数位 */
    round(scale) {
        if (scale >= this.scale) {
            return this;
        }
        const diff = this.scale - scale;
        const factor = 10n ** BigInt(diff);
        const q = this.scaled / factor;
        const r = this.scaled % factor;
        const absR = r < 0n ? -r : r;
        let rounded = q;
        if (absR * 2n >= factor) {
            rounded = this.scaled < 0n ? q - 1n : q + 1n;
        }
        return new Decimal(rounded, scale);
    }
    toString() {
        const negative = this.scaled < 0n;
        const digits = (negative ? -this.scaled : this.scaled).toString().padStart(this.scale + 1, "0");
        if (this.scale === 0) {
            return (negative ? "-" : "") + digits;
        }
        const intPart = digits.slice(0, digits.length - this.scale);
        const fracPart = digits.slice(digits.length - this.scale);
        return (negative ? "-" : "") + intPart + "." + fracPart;
    }
}
/** 百分比辅助：从字符串百分比（如 "35.2"）构造，scale 固定 2 */
export function percent(value) {
    const d = typeof value === "number" ? Decimal.fromString(String(value)) : Decimal.fromString(value);
    return new Decimal(d.scaled, d.scale + 2);
}
//# sourceMappingURL=decimal.js.map