export type MinorUnitValue = number | bigint | string;

export function parseMinorUnits(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === "string" && /^(?:0|[1-9]\d*|-[1-9]\d*)$/.test(value)) return BigInt(value);
  throw new RangeError("Money must be an exact integer in minor units");
}

export function minorUnitsText(value: unknown): string {
  return parseMinorUnits(value).toString();
}

export function boundedMinorUnits(value: MinorUnitValue): number {
  const minor = parseMinorUnits(value);
  if (minor < -9007199254740991n || minor > 9007199254740991n) {
    throw new RangeError("Operational amount exceeds the supported range");
  }
  return Number(minor);
}

export function minorToDecimalText(value: MinorUnitValue): string {
  const minor = parseMinorUnits(value);
  const absolute = minor < 0n ? -minor : minor;
  return `${minor < 0n ? "-" : ""}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, "0")}`;
}

export function formatMinorCurrency(value: MinorUnitValue, locale: string, currency: string): string {
  const minor = parseMinorUnits(value);
  const absolute = minor < 0n ? -minor : minor;
  const whole = absolute / 100n;
  const signedWhole = minor < 0n ? whole === 0n ? -0 : -whole : whole;
  const fraction = new Intl.NumberFormat(locale, { useGrouping: false, minimumIntegerDigits: 2 })
    .format(absolute % 100n);
  return new Intl.NumberFormat(locale, {
    style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).formatToParts(signedWhole).map((part) => part.type === "fraction" ? fraction : part.value).join("");
}

export function formatMinorInteger(value: MinorUnitValue, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(parseMinorUnits(value));
}

export function compareMinorUnits(left: MinorUnitValue, right: MinorUnitValue): number {
  const a = parseMinorUnits(left);
  const b = parseMinorUnits(right);
  return a < b ? -1 : a > b ? 1 : 0;
}

export function displayDiscountPercent(originalPrice: MinorUnitValue | null, currentPrice: MinorUnitValue): number | null {
  if (originalPrice === null) return null;
  const original = parseMinorUnits(originalPrice);
  const current = parseMinorUnits(currentPrice);
  if (original <= current || current < 1n) return null;
  return Number(((original - current) * 200n + original) / (original * 2n));
}
