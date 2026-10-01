import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(user: AuthenticatedUser | null): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const user: AuthenticatedUser = {
  id: 1,
  openId: "dashboard-test-user",
  email: "test@example.com",
  name: "Test User",
  loginMethod: "manus",
  role: "admin",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

describe("dashboard.snapshot", () => {
  it("returns a structured snapshot for an authenticated user", async () => {
    const caller = appRouter.createCaller(createContext(user));
    const result = await caller.dashboard.snapshot();

    expect(result.metrics).toMatchObject({
      analyzed: expect.any(Number),
      candidates: expect.any(Number),
      pending: expect.any(Number),
    });
    expect(["demo", "database"]).toContain(result.mode);
    if (result.mode === "demo") {
      expect(result.drafts.length).toBeGreaterThan(0);
      expect(result.drafts[0]).toHaveProperty("text");
      expect(result.drafts[0]).toHaveProperty("riskLevel");
    } else {
      expect(Array.isArray(result.drafts)).toBe(true);
      expect(result.drafts.every(draft => typeof draft.text === "string")).toBe(true);
    }
  });

  it("rejects unauthenticated access", async () => {
    const caller = appRouter.createCaller(createContext(null));
    await expect(caller.dashboard.snapshot()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("dashboard.reviewDraft", () => {
  it("keeps demo drafts out of persistence while updating the review result", async () => {
    const caller = appRouter.createCaller(createContext(user));
    const result = await caller.dashboard.reviewDraft({ id: -1, status: "approved" });

    expect(result).toEqual({ persisted: false, status: "approved" });
  });

  it("validates review status values", async () => {
    const caller = appRouter.createCaller(createContext(user));
    await expect(
      caller.dashboard.reviewDraft({ id: -1, status: "blocked" as never }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects an unknown draft instead of reporting a false success", async () => {
    const caller = appRouter.createCaller(createContext(user));
    await expect(caller.dashboard.reviewDraft({ id: -999, status: "approved" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
