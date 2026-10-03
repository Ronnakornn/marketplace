import { describe, expect, it } from "vitest";
import { boundedMinorUnits, compareMinorUnits, formatMinorCurrency, formatMinorInteger, minorToDecimalText, minorUnitsText, parseMinorUnits } from "./money";

describe("exact money presentation", () => {
  it.each([
    [0, "0.00"], [-1, "-0.01"], [1, "0.01"], [-100, "-1.00"],
    [9007199254740991, "90071992547409.91"],
    ["9007199254740993", "90071992547409.93"],
    ["-9007199254740993", "-90071992547409.93"],
    [9223372036854775807n, "92233720368547758.07"],
  ])("renders %s without floating division", (input, expected) => {
    expect(minorToDecimalText(input)).toBe(expected);
  });

  it.each(["en-US", "th-TH"])("preserves amount digits in %s currency", (locale) => {
    expect(formatMinorCurrency("9007199254740993", locale, "THB")).toContain("90,071,992,547,409.93");
    expect(formatMinorCurrency(9007199254740991, locale, "THB")).toContain("90,071,992,547,409.91");
    expect(formatMinorCurrency(-1, locale, "THB")).toContain("0.01");
    expect(formatMinorCurrency(-1, locale, "THB")).toContain("-");
  });

  it("supports localized digits and exact coin balances", () => {
    expect(formatMinorCurrency("-1", "ar-EG", "THB")).toContain("٠٫٠١");
    expect(formatMinorInteger("9007199254740993", "en-US")).toBe("9,007,199,254,740,993");
  });

  it.each([9007199254740992, -9007199254740992, 0.1, NaN, Infinity, null, undefined, "01", "-0", "+1", "1.0", "1e2", " 1", ""]) (
    "rejects an invalid or already unsafe source %s", (input) => {
      expect(() => parseMinorUnits(input)).toThrow(RangeError);
    },
  );

  it("normalizes accepted values and compares numeric magnitude", () => {
    expect(minorUnitsText(9007199254740991)).toBe("9007199254740991");
    expect(minorUnitsText("9007199254740993")).toBe("9007199254740993");
    expect(compareMinorUnits("10", "9")).toBe(1);
    expect(compareMinorUnits("9007199254740993", "9007199254740992")).toBe(1);
    expect(compareMinorUnits("-1", "0")).toBe(-1);
  });

  it("keeps operational inputs bounded without limiting historical display", () => {
    expect(boundedMinorUnits("9007199254740991")).toBe(9007199254740991);
    expect(() => boundedMinorUnits("9007199254740993")).toThrow(RangeError);
    expect(minorToDecimalText("9007199254740993")).toBe("90071992547409.93");
  });
});
