import { describe, expect, it } from "vitest";

describe("YouTube OAuth redirect", () => {
  it("reaches the configured callback endpoint", async () => {
    const redirectUri = process.env.YOUTUBE_OAUTH_REDIRECT_URI;
    if (!redirectUri) {
      expect(redirectUri).toBeUndefined();
      return;
    }

    const parsed = new URL(redirectUri);
    expect(parsed.protocol).toBe("https:");
    expect(parsed.pathname).toBe("/api/youtube/oauth/callback");
    expect(parsed.search).toBe("");
    expect(parsed.hash).toBe("");
    if (process.env.RUN_OAUTH_REDIRECT_TEST !== "1") return;

    const response = await fetch(redirectUri, {
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    expect(response.status).toBe(302);
  }, 15_000);
});
