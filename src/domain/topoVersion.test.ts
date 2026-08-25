import { describe, expect, it } from "vitest";

import { datePrefix, formatTopoVersionLabel, latestTopoVersion } from "./topoVersion";

describe("datePrefix", () => {
  it("extracts a calendar date from ISO timestamps", () => {
    expect(datePrefix("2026-08-24T12:04:00Z")).toBe("2026-08-24");
    expect(datePrefix("2026-08-14")).toBe("2026-08-14");
  });

  it("rejects git SHAs and empty values", () => {
    expect(datePrefix("")).toBeNull();
    expect(datePrefix("a1b2c3d4e5f67890")).toBeNull();
  });
});

describe("latestTopoVersion", () => {
  it("picks the newest area or commit date", () => {
    expect(
      latestTopoVersion(["2026-08-08", "2026-08-24T01:00:00Z", "2026-06-30"], "2020-01-01")
    ).toBe("2026-08-24");
  });

  it("falls back when no candidate is a date", () => {
    expect(latestTopoVersion(["abc", undefined], "2026-08-24T18:00:00.000Z")).toBe("2026-08-24");
  });
});

describe("formatTopoVersionLabel", () => {
  it("shows the calendar date for content versions", () => {
    expect(formatTopoVersionLabel("2026-08-14")).toBe("2026-08-14");
    expect(formatTopoVersionLabel("2026-08-14-anapower")).toBe("2026-08-14");
  });

  it("shortens leftover git SHAs", () => {
    expect(formatTopoVersionLabel("a1b2c3d4e5f6789012345678")).toBe("a1b2c3d4");
  });
});
