/** Minimal decimal helpers for order book math (string in/out, bigint inside). */

function parseDecimal(value: string): { neg: boolean; digits: bigint; scale: number } {
  const trimmed = value.trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`Invalid decimal: ${value}`);
  }
  const neg = trimmed.startsWith("-");
  const raw = neg ? trimmed.slice(1) : trimmed;
  const [whole, frac = ""] = raw.split(".");
  if (frac.length > 18) {
    throw new Error(`Decimal scale too large: ${value}`);
  }
  return { neg, digits: BigInt(whole + frac), scale: frac.length };
}

export function toScaled(value: string, scale = 18): bigint {
  const { neg, digits, scale: s } = parseDecimal(value);
  if (s > scale) throw new Error(`Decimal exceeds scale ${scale}: ${value}`);
  const scaled = digits * 10n ** BigInt(scale - s);
  return neg ? -scaled : scaled;
}

export function fromScaled(value: bigint, scale = 18): string {
  const neg = value < 0n;
  const abs = neg ? -value : value;
  const base = 10n ** BigInt(scale);
  const whole = abs / base;
  const frac = (abs % base).toString().padStart(scale, "0").replace(/0+$/, "");
  const body = frac.length ? `${whole}.${frac}` : `${whole}`;
  return neg ? `-${body}` : body;
}

export function cmpDecimal(a: string, b: string, scale = 18): number {
  const left = toScaled(a, scale);
  const right = toScaled(b, scale);
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

export function minDecimal(a: string, b: string, scale = 18): string {
  return cmpDecimal(a, b, scale) <= 0 ? a : b;
}

export function subDecimal(a: string, b: string, scale = 18): string {
  return fromScaled(toScaled(a, scale) - toScaled(b, scale), scale);
}

export function addDecimal(a: string, b: string, scale = 18): string {
  return fromScaled(toScaled(a, scale) + toScaled(b, scale), scale);
}

export function isPositiveDecimal(value: string, scale = 18): boolean {
  return toScaled(value, scale) > 0n;
}
