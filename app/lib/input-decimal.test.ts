import { describe, expect, it } from "vitest";
import { decimalInputToMinorUnits, minorUnitsToDecimalInput } from "./input-decimal";

describe("decimal input to minor units", () => {
  it.each([
    ["0.29", 29], ["1.15", 115], ["19.99", 1999], [".29", 29],
    [" 001.15 ", 115], ["12.5", 1250], ["12.", 1200], ["", 0],
    ["-1.15", -115], ["+1.15", 115], ["1.000", 100], ["1e3", 100000], ["29e-2", 29],
    ["90071992547409.90", 9007199254740990],
    ["90071992547409.91", 9007199254740991],
  ] as const)("preserves exact decimal text %s", (input, expected) => {
    expect(decimalInputToMinorUnits(input)).toBe(expected);
  });

  it.each(["90071992547409.92", "-90071992547409.92", "1.001", "NaN", "Infinity", "1e-7", ".", "+"])(
    "leaves invalid or unsafe text %s for API validation", input => {
      expect(decimalInputToMinorUnits(input)).toBeNaN();
    },
  );
});

describe("minor units to decimal input", () => {
  it.each([[29, "0.29"], [115, "1.15"], [100, "1"], [150, "1.5"], [0, "0"], [-29, "-0.29"],
    [9007199254740990, "90071992547409.9"], [9007199254740991, "90071992547409.91"]] as const)(
    "preserves exact stored minor units %s", (amount, expected) => {
      expect(minorUnitsToDecimalInput(amount)).toBe(expected);
    },
  );
});
