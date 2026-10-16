/**
 * 精度安全十进制类型。
 *
 * 内部以「缩放整数 bigint + 小数位数 scale」存储，全程避免 IEEE-754 浮点，
 * 杜绝金额运算中的浮点误差，满足"结论可复现"的硬约束。
 */
export class Decimal {
  readonly scaled: bigint;
  readonly scale: number;

  constructor(scaled: bigint, scale: number) {
    if (!Number.isInteger(scale) || scale < 0) {
      throw new Error(`Decimal: invalid scale ${scale}`);
    }
    this.scaled = scaled;
    this.scale = scale;
  }

  static fromInt(value: number | bigint): Decimal {
    return new Decimal(BigInt(value), 0);
  }

  static zero(scale = 2): Decimal {
    return new Decimal(0n, scale);
  }

  /** 从字符串构造，如 "123.45"、"-0.05"、"100" */
  static fromString(input: string): Decimal {
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
  toNumber(): number {
    return Number(this.toString());
  }

  private static align(a: Decimal, b: Decimal): [bigint, bigint, number] {
    const scale = Math.max(a.scale, b.scale);
    const aScaled = a.scaled * 10n ** BigInt(scale - a.scale);
    const bScaled = b.scaled * 10n ** BigInt(scale - b.scale);
    return [aScaled, bScaled, scale];
  }

  add(other: Decimal): Decimal {
    const [a, b, scale] = Decimal.align(this, other);
    return new Decimal(a + b, scale);
  }

  sub(other: Decimal): Decimal {
    const [a, b, scale] = Decimal.align(this, other);
    return new Decimal(a - b, scale);
  }

  mul(other: Decimal): Decimal {
    return new Decimal(this.scaled * other.scaled, this.scale + other.scale);
  }

  div(other: Decimal, scale = 4): Decimal {
    if (other.scaled === 0n) {
      throw new Error("Decimal: division by zero");
    }
    const numerator = this.scaled * 10n ** BigInt(scale + other.scale);
    return new Decimal(numerator / other.scaled, scale);
  }

  neg(): Decimal {
    return new Decimal(-this.scaled, this.scale);
  }

  abs(): Decimal {
    return new Decimal(this.scaled < 0n ? -this.scaled : this.scaled, this.scale);
  }

  cmp(other: Decimal): number {
    const [a, b] = Decimal.align(this, other);
    return a < b ? -1 : a > b ? 1 : 0;
  }

  eq(other: Decimal): boolean {
    return this.cmp(other) === 0;
  }

  lt(other: Decimal): boolean {
    return this.cmp(other) < 0;
  }

  lte(other: Decimal): boolean {
    return this.cmp(other) <= 0;
  }

  gt(other: Decimal): boolean {
    return this.cmp(other) > 0;
  }

  gte(other: Decimal): boolean {
    return this.cmp(other) >= 0;
  }

  isZero(): boolean {
    return this.scaled === 0n;
  }

  isNegative(): boolean {
    return this.scaled < 0n;
  }

  /** 四舍五入（half-away-from-zero）到指定小数位 */
  round(scale: number): Decimal {
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

  toString(): string {
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
export function percent(value: string | number): Decimal {
  const d = typeof value === "number" ? Decimal.fromString(String(value)) : Decimal.fromString(value);
  return new Decimal(d.scaled, d.scale + 2);
}