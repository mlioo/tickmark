import { describe, expect, it } from "vitest";

import {
  averageGrade,
  dankyuGradesMatchingQuery,
  formatGrade,
  gradeRank,
  remapGradeAttempts,
  remapGradeBars
} from "./grades";

describe("gradeRank", () => {
  it("orders dankyu grades from soft to hard", () => {
    expect(gradeRank("10級")).toBe(0);
    expect(gradeRank("1級")).toBeGreaterThan(gradeRank("2級"));
    expect(gradeRank("5段")).toBeGreaterThan(gradeRank("1段"));
  });

  it("returns -1 for unknown grades", () => {
    expect(gradeRank("V8")).toBe(-1);
  });
});

describe("averageGrade", () => {
  it("returns the nearest dankyu step for known grades", () => {
    expect(averageGrade(["3級", "3級", "5級"])).toBe("4級");
  });

  it("ignores unknown grades and returns an em dash when empty", () => {
    expect(averageGrade(["V99"])).toBe("—");
    expect(averageGrade([])).toBe("—");
  });
});

describe("formatGrade", () => {
  it("keeps dankyu labels and maps V-scale display labels", () => {
    expect(formatGrade("1段+", "dankyu")).toBe("1段+");
    expect(formatGrade("1段+", "vscale")).toBe("V8");
  });
});

describe("dankyuGradesMatchingQuery", () => {
  it("matches VB and spaced V-scale queries", () => {
    expect(dankyuGradesMatchingQuery("vb")).toEqual(["10級", "9級", "8級", "7級"]);
    expect(dankyuGradesMatchingQuery("V 8")).toEqual(["1段+", "2段"]);
  });

  it("returns an empty list for non V-scale queries", () => {
    expect(dankyuGradesMatchingQuery("1段")).toEqual([]);
  });
});

describe("remap helpers", () => {
  it("merges bars that share a V-scale label", () => {
    expect(
      remapGradeBars(
        [
          { label: "10級", value: 2 },
          { label: "9級", value: 3 }
        ],
        "vscale"
      )
    ).toEqual([{ label: "VB", value: 5 }]);
  });

  it("recomputes average attempts per send after merging", () => {
    expect(
      remapGradeAttempts(
        [
          { label: "1段+", attempts: 4, sends: 1, averageAttemptsPerSend: 4 },
          { label: "2段", attempts: 6, sends: 1, averageAttemptsPerSend: 6 }
        ],
        "vscale"
      )
    ).toEqual([{ label: "V8", attempts: 10, sends: 2, averageAttemptsPerSend: 5 }]);
  });
});
