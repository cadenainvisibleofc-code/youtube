import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  getYouTubeConnection: vi.fn(async () => ({
    ownerOpenId: "owner-1",
    channelId: "channel-1",
    channelName: "Canal",
    accessTokenEncrypted: "encrypted-access",
    refreshTokenEncrypted: "encrypted-refresh",
    tokenExpiresAt: new Date(Date.now() + 10 * 60_000),
    scopes: "https://www.googleapis.com/auth/youtube.force-ssl",
  })),
  upsertYouTubeConnection: vi.fn(),
}));
vi.mock("./youtube-oauth", () => ({
  decryptToken: vi.fn(() => "access-token"),
  encryptToken: vi.fn(() => "encrypted-token"),
}));

import { fetchPublishedComment, publishYouTubeComment } from "./youtube-publisher";
import * as db from "./db";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.mocked(db.getYouTubeConnection).mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

describe("publishYouTubeComment", () => {
  it("rejects publication without an explicit project channel", async () => {
    await expect(publishYouTubeComment({ ownerOpenId: "owner-1", videoId: "video-1", parentCommentId: null, text: "Sem canal." })).rejects.toThrow("canal do projeto");
    expect(db.getYouTubeConnection).not.toHaveBeenCalled();
  });

  it("publishes a top-level comment through commentThreads.insert", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ snippet: { topLevelComment: { id: "comment-1" } } }) });
    const result = await publishYouTubeComment({ ownerOpenId: "owner-1", projectChannelId: 42, videoId: "video-1", parentCommentId: null, text: "Una reflexión breve." });
    expect(result.commentId).toBe("comment-1");
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("commentThreads?part=snippet"), expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ snippet: { videoId: "video-1", topLevelComment: { snippet: { textOriginal: "Una reflexión breve." } } } });
  });

  it("resolves the connection by project channel instead of owner alone", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ snippet: { topLevelComment: { id: "comment-channel-1" } } }) });
    await publishYouTubeComment({ ownerOpenId: "owner-1", projectChannelId: 42, videoId: "video-1", parentCommentId: null, text: "Canal específico." });
    expect(db.getYouTubeConnection).toHaveBeenCalledWith("owner-1", 42);
  });

  it("publishes a reply through comments.insert", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: "reply-1" }) });
    const result = await publishYouTubeComment({ ownerOpenId: "owner-1", projectChannelId: 42, videoId: "video-1", parentCommentId: "parent-1", text: "Gracias por compartirlo." });
    expect(result.commentId).toBe("reply-1");
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("comments?part=snippet"), expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ snippet: { parentId: "parent-1", textOriginal: "Gracias por compartirlo." } });
  });

  it("does not publish a duplicate when an idempotent retry finds the same text", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ items: [{ snippet: { topLevelComment: { id: "existing-1", snippet: { textOriginal: "Una reflexión breve." } } } }] }) });
    const result = await publishYouTubeComment({ ownerOpenId: "owner-1", projectChannelId: 42, videoId: "video-1", parentCommentId: null, text: "Una reflexión breve.", idempotencyKey: "draft:1:approved" });
    expect(result).toEqual({ commentId: "existing-1", deduplicated: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("commentThreads?part=snippet");
  });

  it("reconciles existence, reply count and like count from YouTube", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ items: [{ id: "comment-1", snippet: { totalReplyCount: 2, topLevelComment: { snippet: { likeCount: 3 } } } }] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ items: [] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ items: [{ snippet: { textOriginal: "Gracias @amiga" } }, { snippet: { textOriginal: "Me ayudó mucho" } }] }) });
    await expect(fetchPublishedComment({ ownerOpenId: "owner-1", projectChannelId: 42, commentId: "comment-1" })).resolves.toEqual({ exists: true, replyCount: 2, likeCount: 3, mentionCount: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
