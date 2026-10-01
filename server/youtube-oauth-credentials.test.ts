import { describe, expect, it } from "vitest";

describe("YouTube OAuth credentials", () => {
  it.skipIf(!process.env.YOUTUBE_OAUTH_CLIENT_ID || !process.env.YOUTUBE_OAUTH_CLIENT_SECRET || !process.env.YOUTUBE_OAUTH_REDIRECT_URI)("reaches Google token validation without an invalid_client response", async () => {
    const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_OAUTH_CLIENT_SECRET;
    const redirectUri = process.env.YOUTUBE_OAUTH_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) return;

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: "cadena-validation-only-invalid-code",
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    const body = await response.json().catch(() => ({})) as { error?: string };

    expect(body.error).not.toBe("invalid_client");
    expect(body.error).toBe("invalid_grant");
  }, 15_000);
});
