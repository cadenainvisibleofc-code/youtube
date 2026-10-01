import { afterEach, describe, expect, it, vi } from "vitest";
import { getVideoDetails, listTopComments, searchRecentVideos, youtubeIntegrationStatus, YouTubeApiError } from "./youtube";

const configuredKey = process.env.YOUTUBE_DATA_API_KEY;

afterEach(() => {
  vi.unstubAllGlobals();
  if (configuredKey) process.env.YOUTUBE_DATA_API_KEY = configuredKey;
  else delete process.env.YOUTUBE_DATA_API_KEY;
});

describe("youtubeIntegrationStatus", () => {
  it("reports the official adapter as disabled until a key is configured", () => {
    delete process.env.YOUTUBE_DATA_API_KEY;
    expect(youtubeIntegrationStatus()).toMatchObject({ configured: false, publicationConfigured: false });
  });
});

describe("YouTube adapter", () => {
  it("fails closed when the data API key is absent", async () => {
    delete process.env.YOUTUBE_DATA_API_KEY;
    await expect(searchRecentVideos({ query: "soledad" })).rejects.toMatchObject({ code: "NOT_CONFIGURED" } satisfies Partial<YouTubeApiError>);
  });

  it("validates the configured key with a lightweight official endpoint mockado", async () => {
    const key = process.env.YOUTUBE_DATA_API_KEY;
    if (!key) {
      expect(youtubeIntegrationStatus()).toMatchObject({ configured: false });
      return;
    }

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ items: [{ id: "dQw4w9WgXcQ", snippet: { title: "Teste", channelId: "ch", channelTitle: "Canal", publishedAt: "2026-09-20T00:00:00Z", description: "desc" }, statistics: { viewCount: "1", commentCount: "1" } }] }), { status: 200 })));
    const result = await getVideoDetails(["dQw4w9WgXcQ"], new Date("2026-09-25T00:00:00Z"));
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ videoId: "dQw4w9WgXcQ" });
  });

  it("maps details and applies the opportunity-first eligibility policy", async () => {
    process.env.YOUTUBE_DATA_API_KEY = "test-key";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ items: [{ id: "abc", snippet: { title: "La soledad y el propósito", channelId: "ch", channelTitle: "Canal", publishedAt: "2026-09-20T00:00:00Z", description: "Una historia sobre cómo seguir cuando cuesta" }, statistics: { viewCount: "45000", commentCount: "120" } }] }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await getVideoDetails(["abc"], new Date("2026-09-25T00:00:00Z"));
    expect(result[0]).toMatchObject({ videoId: "abc", viewCount: 45000, commentCount: 120, eligibility: { eligible: true } });
    const calls = (fetchMock as unknown as { mock: { calls: Array<[string | URL]> } }).mock.calls;
    expect(new URL(String(calls[0]?.[0])).searchParams.get("fields")).toContain("snippet(title,publishedAt,channelId,channelTitle,description");
  });

  it("rejects Portuguese content from the Spanish editorial pool", async () => {
    process.env.YOUTUBE_DATA_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ items: [{ id: "pt-1", snippet: { title: "A maior lição de resiliência que você já viu", channelId: "ch", channelTitle: "Canal", publishedAt: "2026-09-20T00:00:00Z", description: "Conheça esta história e depois conte o que achou" }, statistics: { viewCount: "45000", commentCount: "120" } }] }), { status: 200, headers: { "content-type": "application/json" } })));
    const result = await getVideoDetails(["pt-1"], new Date("2026-09-25T00:00:00Z"));
    expect(result[0]).toMatchObject({ language: "pt", eligibility: { eligible: false } });
    expect(result[0]?.eligibility.reasons.join(" ")).toContain("idioma fora do espanhol");
  });

  it("rejects English content from the Spanish editorial pool", async () => {
    process.env.YOUTUBE_DATA_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ items: [{ id: "en-1", snippet: { title: "Some Toxic Relationships Only Heal After Death", channelId: "ch", channelTitle: "Canal", publishedAt: "2026-09-20T00:00:00Z", description: "The story explores relationships and healing" }, statistics: { viewCount: "45000", commentCount: "120" } }] }), { status: 200, headers: { "content-type": "application/json" } })));
    const result = await getVideoDetails(["en-1"], new Date("2026-09-25T00:00:00Z"));
    expect(result[0]).toMatchObject({ language: "en", eligibility: { eligible: false } });
  });

  it("identifies Shorts from the official ISO duration", async () => {
    process.env.YOUTUBE_DATA_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ items: [{ id: "short-1", snippet: { title: "Short", channelId: "ch", channelTitle: "Canal", publishedAt: "2026-09-20T00:00:00Z", description: "desc" }, contentDetails: { duration: "PT45S" }, statistics: { viewCount: "45000", commentCount: "120" } }] }), { status: 200, headers: { "content-type": "application/json" } })));
    const result = await getVideoDetails(["short-1"], new Date("2026-09-25T00:00:00Z"));
    expect(result[0]).toMatchObject({ durationSeconds: 45, isShort: true });
  });

  it("maps public comments from the official endpoint", async () => {
    process.env.YOUTUBE_DATA_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ items: [{ id: "thread-1", snippet: { topLevelComment: { snippet: { authorDisplayName: "Ana", textDisplay: "Me siento sola", likeCount: 4, publishedAt: "2026-09-24T00:00:00Z" } } } }] }), { status: 200 })));
    const result = await listTopComments("abc");
    expect(result).toEqual([expect.objectContaining({ commentId: "thread-1", text: "Me siento sola", likeCount: 4 })]);
  });
});
