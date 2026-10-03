import { parseMinorUnits } from "#/lib/money";

export function decimalInputToMinorUnits(value: string): number {
  const text = value.trim();
  if (!text) return 0;
  const decimal = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/.exec(text);
  if (!decimal) return Number.NaN;
  const fraction = decimal[3] ?? decimal[4] ?? "";
  let digits = `${decimal[2] ?? ""}${fraction}`.replace(/^0+/, "");
  const exponent = Number(decimal[5] ?? "0");
  if (!Number.isSafeInteger(exponent)) return Number.NaN;
  if (!digits) return 0;
  const shift = 2 + exponent - fraction.length;
  if (shift >= 0) {
    if (digits.length + shift > 16) return Number.NaN;
    digits += "0".repeat(shift);
  } else {
    const removed = -shift;
    if (removed > digits.length || /[1-9]/.test(digits.slice(-removed))) return Number.NaN;
    digits = digits.slice(0, -removed);
  }
  const absolute = BigInt(digits);
  if (absolute > BigInt(Number.MAX_SAFE_INTEGER)) return Number.NaN;
  return Number(decimal[1] === "-" ? -absolute : absolute);
}

export function minorUnitsToDecimalInput(value: number | bigint | string): string {
  const minorUnits = parseMinorUnits(value);
  const absolute = minorUnits < 0n ? -minorUnits : minorUnits;
  const fraction = (absolute % 100n).toString().padStart(2, "0").replace(/0+$/, "");
  return `${minorUnits < 0n ? "-" : ""}${absolute / 100n}${fraction ? `.${fraction}` : ""}`;
}
