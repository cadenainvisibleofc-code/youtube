import { describe, expect, it } from "vitest";
import { isDashboardPath, normalizeDashboardPath } from "./dashboard-route";

describe("dashboard route normalization", () => {
  it("normalizes the root and trailing slashes", () => {
    expect(normalizeDashboardPath("/")).toBe("/");
    expect(normalizeDashboardPath("/fila/")).toBe("/fila");
  });

  it("ignores query strings without changing the section", () => {
    expect(normalizeDashboardPath("/metricas?period=7d")).toBe("/metricas");
  });

  it("recognizes only registered dashboard sections", () => {
    expect(isDashboardPath("/regras")).toBe(true);
    expect(isDashboardPath("/leitura")).toBe(false);
  });
});
