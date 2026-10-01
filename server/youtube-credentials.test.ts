import { describe, expect, it } from "vitest";

describe("YouTube credentials", () => {
  it("accepts the configured Data API key on a lightweight metadata request", async () => {
    const apiKey = process.env.YOUTUBE_DATA_API_KEY;
    if (!apiKey) {
      expect(apiKey).toBeUndefined();
      return;
    }

    const params = new URLSearchParams({
      part: "id",
      id: "dQw4w9WgXcQ",
      key: apiKey,
    });
    const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params.toString()}`, {
      signal: AbortSignal.timeout(10_000),
    });

    expect(response.ok).toBe(true);
  }, 15_000);
});
