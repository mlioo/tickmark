import { describe, expect, it } from "vitest";

import { assertAllowedUrl } from "./allowlist";

describe("assertAllowedUrl", () => {
  it("allows HTTPS GitHub API and raw content hosts", () => {
    expect(assertAllowedUrl("https://api.github.com/repos/mlioo/opentopo/commits").hostname).toBe(
      "api.github.com"
    );
    expect(
      assertAllowedUrl("https://raw.githubusercontent.com/mlioo/opentopo/main/content/areas/kasama/area.json")
        .hostname
    ).toBe("raw.githubusercontent.com");
  });

  it("blocks non-HTTPS and unknown hosts", () => {
    expect(() => assertAllowedUrl("http://api.github.com/repos/mlioo/opentopo")).toThrow(
      /Blocked non-OpenTopo/
    );
    expect(() => assertAllowedUrl("https://example.com/topo.json")).toThrow(/Blocked non-OpenTopo/);
  });
});
