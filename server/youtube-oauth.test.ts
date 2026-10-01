import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeYouTubeOAuthState, decryptToken, encodeYouTubeOAuthState, encryptToken, hasYouTubePublicationScope, isYouTubeOAuthConfigured, youtubeOAuthConfigStatus } from "./youtube-oauth";
import { decodeOAuthState, encodeOAuthState } from "@shared/const";

const original = {
  clientId: process.env.YOUTUBE_OAUTH_CLIENT_ID,
  clientSecret: process.env.YOUTUBE_OAUTH_CLIENT_SECRET,
  redirectUri: process.env.YOUTUBE_OAUTH_REDIRECT_URI,
  encryptionKey: process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY,
};

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

afterEach(() => {
  restoreEnv("YOUTUBE_OAUTH_CLIENT_ID", original.clientId);
  restoreEnv("YOUTUBE_OAUTH_CLIENT_SECRET", original.clientSecret);
  restoreEnv("YOUTUBE_OAUTH_REDIRECT_URI", original.redirectUri);
  restoreEnv("YOUTUBE_TOKEN_ENCRYPTION_KEY", original.encryptionKey);
});

describe("YouTube OAuth configuration", () => {
  it("round-trips the selected project channel without breaking legacy state", () => {
    const encoded = encodeOAuthState({ redirectUri: "https://example.com/api/youtube/oauth/callback", nonce: "nonce", ownerOpenId: "owner", projectChannelId: 42 });
    expect(decodeOAuthState(encoded)).toMatchObject({ projectChannelId: 42, ownerOpenId: "owner" });
    expect(decodeOAuthState(btoa("https://example.com/api/youtube/oauth/callback"))).toEqual({ redirectUri: "https://example.com/api/youtube/oauth/callback" });
  });

  it("rejects a tampered YouTube OAuth state", () => {
    process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    const encoded = encodeYouTubeOAuthState({ redirectUri: "https://example.com/api/youtube/oauth/callback", nonce: "nonce", ownerOpenId: "owner", projectChannelId: 42 });
    const [payload, signature] = encoded.split(".");
    expect(() => decodeYouTubeOAuthState(`${payload}.tampered${signature}`)).toThrow("OAuth state inválido");
  });

  it("round-trips the new-account project target in the signed state", () => {
    process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 8).toString("base64");
    const encoded = encodeYouTubeOAuthState({ redirectUri: "https://example.com/api/youtube/oauth/callback", nonce: "nonce", ownerOpenId: "owner", projectId: 7, createProjectChannel: true });
    expect(decodeYouTubeOAuthState(encoded)).toMatchObject({ projectId: 7, createProjectChannel: true });
  });

  it("accepts the requested publication scope when Google omits an identical scope in the token response", () => {
    expect(hasYouTubePublicationScope()).toBe(true);
    expect(hasYouTubePublicationScope("openid email")).toBe(false);
    expect(hasYouTubePublicationScope("https://www.googleapis.com/auth/youtube.force-ssl openid")).toBe(true);
  });

  it("reports the four required server-side values without exposing them", () => {
    const validEncryptionKey = Boolean(original.encryptionKey && Buffer.from(original.encryptionKey, "base64").length === 32);
    const expectedMissing = [
      !original.clientId ? "YOUTUBE_OAUTH_CLIENT_ID" : null,
      !original.clientSecret ? "YOUTUBE_OAUTH_CLIENT_SECRET" : null,
      !original.redirectUri ? "YOUTUBE_OAUTH_REDIRECT_URI" : null,
      !validEncryptionKey ? "YOUTUBE_TOKEN_ENCRYPTION_KEY inválida" : null,
    ].filter((value): value is string => value !== null);
    expect(youtubeOAuthConfigStatus()).toEqual({
      configured: Boolean(original.clientId && original.clientSecret && original.redirectUri && validEncryptionKey),
      missing: expectedMissing,
      hasClientId: Boolean(original.clientId),
      hasClientSecret: Boolean(original.clientSecret),
      hasRedirectUri: Boolean(original.redirectUri),
      hasEncryptionKey: validEncryptionKey,
      redirectUri: original.redirectUri ?? null,
      productionOrigin: original.redirectUri ? new URL(original.redirectUri).origin : null,
      redirectUriValid: Boolean(original.redirectUri && new URL(original.redirectUri).pathname === "/api/youtube/oauth/callback"),
    });
  });

  it("rejects a redirect URI that Google cannot authorize safely", () => {
    process.env.YOUTUBE_OAUTH_CLIENT_ID = "client-id";
    process.env.YOUTUBE_OAUTH_CLIENT_SECRET = "client-secret";
    process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32).toString("base64");
    process.env.YOUTUBE_OAUTH_REDIRECT_URI = "https://example.com/oauth/callback";
    expect(youtubeOAuthConfigStatus().redirectUriValid).toBe(false);
    expect(isYouTubeOAuthConfigured()).toBe(false);
  });

  it("round-trips a token through AES-256-GCM when the encryption secret is available", () => {
    if (!original.encryptionKey || Buffer.from(original.encryptionKey, "base64").length !== 32) return;
    const encrypted = encryptToken("refresh-token-test");
    expect(encrypted).not.toContain("refresh-token-test");
    expect(decryptToken(encrypted)).toBe("refresh-token-test");
  });

  it("checks the configured OAuth client against Google's token endpoint without redeeming a code", async () => {
    if (!original.clientId || !original.clientSecret) return;

    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: "invalid_grant", error_description: "Mocked code rejected" }), { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST" });
    const body = await response.json().catch(() => ({}));
    expect(response.status).toBe(400);
    expect(body.error).toBe("invalid_grant");
  });
});
