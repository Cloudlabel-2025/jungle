// Keep decision arithmetic exact across weighted ratings, quiz fractions and
// objective-event ratios. Only convert to Number for display/API percentages.
const gcd = (a, b) => (b ? gcd(b, a % b) : a < 0n ? -a : a);
export function fraction(value, denominator = 1n) {
  if (Array.isArray(value)) return fraction(BigInt(value[0]), BigInt(value[1]));
  if (typeof value !== "bigint") {
    const [coefficient, exponent = "0"] = String(value)
      .toLowerCase()
      .split("e");
    const decimals = coefficient.split(".")[1]?.length || 0;
    const scale = decimals - Number(exponent);
    let numerator = BigInt(coefficient.replace(".", ""));
    if (scale < 0) numerator *= 10n ** BigInt(-scale);
    return fraction(numerator, scale > 0 ? 10n ** BigInt(scale) : 1n);
  }
  if (!denominator) throw new Error("A score denominator cannot be zero.");
  const divisor = gcd(value, denominator);
  return [value / divisor, denominator / divisor];
}
export const plus = (a, b) => fraction(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
export const times = (a, b) => fraction(a[0] * b[0], a[1] * b[1]);
export const over = (a, b) => fraction(a[0] * b[1], a[1] * b[0]);
export const sum = (values) => values.reduce(plus, fraction(0));
export const numeric = (a) => Number(a[0]) / Number(a[1]);
export const stored = (a) => a.map(String);
export const atLeast = (a, b) => a[0] * b[1] >= b[0] * a[1];
