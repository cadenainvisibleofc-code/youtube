import crypto from "node:crypto";
import type { Express, Request, Response } from "express";
import { parse as parseCookieHeader } from "cookie";
import * as db from "./db";
import { sdk } from "./_core/sdk";

const AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const YOUTUBE_CHANNELS_ENDPOINT = "https://www.googleapis.com/youtube/v3/channels";
const YOUTUBE_SCOPE = "https://www.googleapis.com/auth/youtube.force-ssl";
const STATE_COOKIE = "__Host-youtube-oauth-state";
const STATE_MAX_AGE_SECONDS = 600;

// The production callback is supplied by YOUTUBE_OAUTH_REDIRECT_URI; never derive it from a preview host.

function hasValidEncryptionKey() {
  const raw = process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY;
  return Boolean(raw && Buffer.from(raw, "base64").length === 32);
}

export function isYouTubeOAuthConfigured() {
  const redirectUri = process.env.YOUTUBE_OAUTH_REDIRECT_URI;
  return Boolean(
    process.env.YOUTUBE_OAUTH_CLIENT_ID &&
      process.env.YOUTUBE_OAUTH_CLIENT_SECRET &&
      redirectUri &&
      isValidRedirectUri(redirectUri) &&
      hasValidEncryptionKey()
  );
}

export function youtubeOAuthConfigStatus() {
  const redirectUri = process.env.YOUTUBE_OAUTH_REDIRECT_URI || null;
  const hasClientId = Boolean(process.env.YOUTUBE_OAUTH_CLIENT_ID);
  const hasClientSecret = Boolean(process.env.YOUTUBE_OAUTH_CLIENT_SECRET);
  const hasRedirectUri = Boolean(redirectUri);
  const hasEncryptionKey = hasValidEncryptionKey();
  const redirectUriValid = redirectUri ? isValidRedirectUri(redirectUri) : false;
  const missing = [
    !hasClientId ? "YOUTUBE_OAUTH_CLIENT_ID" : null,
    !hasClientSecret ? "YOUTUBE_OAUTH_CLIENT_SECRET" : null,
    !hasRedirectUri ? "YOUTUBE_OAUTH_REDIRECT_URI" : !redirectUriValid ? "YOUTUBE_OAUTH_REDIRECT_URI inválida" : null,
    !hasEncryptionKey ? "YOUTUBE_TOKEN_ENCRYPTION_KEY inválida" : null,
  ].filter((value): value is string => value !== null);
  let productionOrigin: string | null = null;
  try {
    productionOrigin = redirectUri ? new URL(redirectUri).origin : null;
  } catch {
    productionOrigin = null;
  }
  return {
    configured: missing.length === 0,
    missing,
    hasClientId,
    hasClientSecret,
    hasRedirectUri,
    hasEncryptionKey,
    redirectUri,
    productionOrigin,
    redirectUriValid,
  };
}

function isValidRedirectUri(value: string) {
  try {
    const url = new URL(value);
    const localHttp = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
    return (url.protocol === "https:" || localHttp) && url.pathname === "/api/youtube/oauth/callback" && !url.search && !url.hash;
  } catch {
    return false;
  }
}

function requireOAuthConfig() {
  const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.YOUTUBE_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) throw new Error("YouTube OAuth ainda não está configurado");
  if (!isValidRedirectUri(redirectUri)) throw new Error("YOUTUBE_OAUTH_REDIRECT_URI deve ser HTTPS e terminar em /api/youtube/oauth/callback");
  return { clientId, clientSecret, redirectUri };
}

export function hasYouTubePublicationScope(scope?: string) {
  const grantedScopes = new Set((scope ?? YOUTUBE_SCOPE).split(/\s+/).filter(Boolean));
  return grantedScopes.has(YOUTUBE_SCOPE);
}

function encryptionKey() {
  const raw = process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("YOUTUBE_TOKEN_ENCRYPTION_KEY não configurada");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("YOUTUBE_TOKEN_ENCRYPTION_KEY deve ser base64 de 32 bytes");
  return key;
}

type YouTubeOAuthState = {
  redirectUri: string;
  nonce: string;
  ownerOpenId: string;
  projectChannelId?: number;
  projectId?: number;
  createProjectChannel?: boolean;
  issuedAt: number;
};

export type YouTubeOAuthChannel = { id: string; snippet?: { title?: string } };

export function selectOAuthChannels(channels: readonly YouTubeOAuthChannel[], targetChannelId?: string, addAll = false) {
  const unique = channels.filter((channel, index, all) => Boolean(channel.id) && all.findIndex(candidate => candidate.id === channel.id) === index);
  if (targetChannelId) {
    const selected = unique.find(channel => channel.id === targetChannelId);
    if (!selected) throw new Error("O canal selecionado não está disponível nesta conta Google. Para adicionar outro canal, volte ao painel e use ‘Adicionar canais’.");
    return [selected];
  }
  if (addAll) {
    if (unique.length === 0) throw new Error("A conta autorizada não possui canais YouTube acessíveis");
    return unique;
  }
  if (unique.length > 1) throw new Error("A conta Google possui múltiplos canais; use Adicionar canais desta conta");
  if (unique.length === 0) throw new Error("A conta autorizada não possui um canal YouTube acessível");
  return [unique[0]];
}

export function encodeYouTubeOAuthState(state: Omit<YouTubeOAuthState, "issuedAt">) {
  const payload = Buffer.from(JSON.stringify({ ...state, issuedAt: Date.now() }), "utf8").toString("base64url");
  const signature = crypto.createHmac("sha256", encryptionKey()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function decodeYouTubeOAuthState(value: string): YouTubeOAuthState {
  const [payload, signature] = value.split(".");
  if (!payload || !signature) throw new Error("OAuth state inválido");
  const expected = crypto.createHmac("sha256", encryptionKey()).update(payload).digest("base64url");
  const providedBuffer = Buffer.from(signature, "base64url");
  const expectedBuffer = Buffer.from(expected, "base64url");
  if (providedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) throw new Error("OAuth state inválido");
  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<YouTubeOAuthState>;
  if (typeof parsed.redirectUri !== "string" || typeof parsed.nonce !== "string" || typeof parsed.ownerOpenId !== "string" || typeof parsed.issuedAt !== "number") throw new Error("OAuth state inválido");
  if (Date.now() - parsed.issuedAt > STATE_MAX_AGE_SECONDS * 1000 || parsed.issuedAt > Date.now() + 30_000) throw new Error("OAuth state expirado");
  return parsed as YouTubeOAuthState;
}

function safeEqualText(left: string | undefined, right: string | undefined) {
  if (!left || !right) return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function encryptToken(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptToken(payload: string) {
  const [ivEncoded, tagEncoded, valueEncoded] = payload.split(".");
  if (!ivEncoded || !tagEncoded || !valueEncoded) throw new Error("Token cifrado inválido");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivEncoded, "base64url"));
  decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(valueEncoded, "base64url")), decipher.final()]).toString("utf8");
}

function safeRedirectTarget() {
  const { redirectUri } = requireOAuthConfig();
  return new URL(redirectUri).origin;
}

function redirectToApp(res: Response, status: "connected" | "error", reason?: string) {
  try {
    const query = new URLSearchParams({ youtube: status });
    if (reason) query.set("reason", reason.slice(0, 180));
    res.redirect(`${safeRedirectTarget()}/?${query.toString()}`);
  } catch {
    res.redirect(`/?youtube=${status}`);
  }
}

async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    let response: globalThis.Response;
    try {
      response = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 250 * 2 ** attempt));
      continue;
    }
    const body = await response.json().catch(() => ({}));
    if (response.ok) return body as T;
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === 2) throw new Error(body?.error_description || body?.error?.message || `YouTube OAuth falhou com ${response.status}`);
    await new Promise(resolve => setTimeout(resolve, 250 * 2 ** attempt));
  }
  throw new Error("YouTube OAuth não respondeu após retentativas");
}

async function getAuthenticatedUser(req: Request) {
  try {
    return await sdk.authenticateRequest(req);
  } catch {
    return null;
  }
}

export function registerYouTubeOAuthRoutes(app: Express) {
  app.get("/api/youtube/oauth/start", async (req: Request, res: Response) => {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: "Autenticação do painel necessária" });
      return;
    }
    if (!isYouTubeOAuthConfigured()) {
      res.status(503).json({ error: "YouTube OAuth ainda não configurado" });
      return;
    }

    try {
      const { clientId, redirectUri } = requireOAuthConfig();
      const rawProjectChannelId = typeof req.query.projectChannelId === "string" ? req.query.projectChannelId : undefined;
      const parsedProjectChannelId = rawProjectChannelId ? Number(rawProjectChannelId) : undefined;
      const rawProjectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
      const parsedProjectId = rawProjectId ? Number(rawProjectId) : undefined;
      const createProjectChannel = req.query.addAccount === "1";
      if (rawProjectChannelId && (parsedProjectChannelId === undefined || !Number.isInteger(parsedProjectChannelId) || parsedProjectChannelId <= 0)) {
        res.status(400).json({ error: "projectChannelId inválido" });
        return;
      }
      if (rawProjectId && (parsedProjectId === undefined || !Number.isInteger(parsedProjectId) || parsedProjectId <= 0)) {
        res.status(400).json({ error: "projectId inválido" });
        return;
      }
      if (createProjectChannel && parsedProjectChannelId !== undefined) {
        res.status(400).json({ error: "Escolha entre reconectar um canal ou adicionar uma nova conta" });
        return;
      }
      let projectChannelId = parsedProjectChannelId;
      let projectId = parsedProjectId;
      if (createProjectChannel) {
        const project = await db.getWritableProjectsForOwner(user.openId);
        const selectedProject = projectId === undefined ? project.length === 1 ? project[0] : undefined : project.find(item => item.id === projectId);
        if (!selectedProject) {
          res.status(400).json({ error: "Selecione um projeto válido antes de adicionar uma conta" });
          return;
        }
        projectId = selectedProject.id;
        const existingChannels = await db.getProjectChannelsForOwner(user.openId);
        const projectChannelCount = existingChannels.filter(channel => channel.projectId === projectId && channel.status !== "revoked").length;
        if (projectChannelCount >= db.MAX_PROJECT_CHANNELS) {
          res.status(409).json({ error: "O projeto já possui o limite de cinco canais" });
          return;
        }
      } else if (projectChannelId !== undefined) {
        const target = await db.getProjectChannelForOwner(user.openId, projectChannelId);
        if (!target) {
          res.status(403).json({ error: "Canal do projeto não encontrado ou sem acesso" });
          return;
        }
      } else {
        const availableChannels = await db.getWritableProjectChannelsForOwner(user.openId);
        if (availableChannels.length > 1) {
          res.status(400).json({ error: "Selecione o canal antes de iniciar o OAuth" });
          return;
        }
        projectChannelId = availableChannels[0]?.id;
      }
      const nonce = crypto.randomBytes(24).toString("base64url");
      const state = encodeYouTubeOAuthState({ redirectUri, nonce, ownerOpenId: user.openId, projectChannelId, projectId, createProjectChannel });
      res.cookie(STATE_COOKIE, nonce, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/",
        maxAge: STATE_MAX_AGE_SECONDS * 1000,
      });
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        access_type: "offline",
        prompt: "consent",
        scope: YOUTUBE_SCOPE,
        state,
      });
      res.redirect(`${AUTHORIZATION_ENDPOINT}?${params.toString()}`);
    } catch (error) {
      console.error("[YouTube OAuth] Start failed", error);
      res.status(500).json({ error: "Não foi possível iniciar o OAuth" });
    }
  });

  app.get("/api/youtube/oauth/callback", async (req: Request, res: Response) => {
    const code = typeof req.query.code === "string" ? req.query.code : undefined;
    const state = typeof req.query.state === "string" ? req.query.state : undefined;
    const oauthError = typeof req.query.error === "string" ? req.query.error : undefined;

    if (oauthError || !code || !state) {
      redirectToApp(res, "error", oauthError || "code e state são obrigatórios");
      return;
    }

    let decoded: YouTubeOAuthState;
    try {
      decoded = decodeYouTubeOAuthState(state);
    } catch {
      console.warn("[YouTube OAuth] State rejected: signature_or_expiry");
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    const expectedNonce = parseCookieHeader(req.headers.cookie ?? "")[STATE_COOKIE];
    if (!safeEqualText(decoded.nonce, expectedNonce)) {
      console.warn("[YouTube OAuth] State rejected: cookie_mismatch", { hasStateCookie: Boolean(expectedNonce) });
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(STATE_COOKIE, { httpOnly: true, path: "/", secure: true, sameSite: "none" });

    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: "Sessão do painel expirada" });
      return;
    }
    if (decoded.ownerOpenId !== user.openId) {
      res.status(403).json({ error: "OAuth iniciado por outro usuário" });
      return;
    }

    try {
      const { clientId, clientSecret, redirectUri } = requireOAuthConfig();
      if (decoded.redirectUri !== redirectUri) {
        res.status(400).json({ error: "redirect_uri inválida" });
        return;
      }

      let target = decoded.projectChannelId === undefined ? undefined : await db.getProjectChannelForOwner(user.openId, decoded.projectChannelId);
      if (decoded.projectChannelId !== undefined && !target) {
        res.status(403).json({ error: "Canal do projeto não encontrado ou sem acesso" });
        return;
      }

      const token = await fetchJson<{ access_token: string; refresh_token?: string; expires_in?: number; scope?: string }>(TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
      });

      if (!hasYouTubePublicationScope(token.scope)) throw new Error("O token do YouTube não concedeu o escopo de publicação necessário");

      const channels = await fetchJson<{ items?: YouTubeOAuthChannel[] }>(`${YOUTUBE_CHANNELS_ENDPOINT}?part=snippet&mine=true&fields=items(id,snippet(title))`, {
        headers: { authorization: `Bearer ${token.access_token}` },
      });
      const targetChannelId = target?.channelId;
      const selectedChannels = selectOAuthChannels(channels.items ?? [], targetChannelId, decoded.createProjectChannel === true);
      if (decoded.createProjectChannel && decoded.projectId === undefined) throw new Error("Projeto não informado para a nova conta");
      if (decoded.createProjectChannel) {
        const projectChannels = (await db.getProjectChannelsForOwner(user.openId)).filter(item => item.projectId === decoded.projectId);
        const existingIds = new Set(projectChannels.filter(item => item.status !== "revoked").map(item => item.channelId));
        const newChannels = selectedChannels.filter(channel => !existingIds.has(channel.id));
        const activeCount = projectChannels.filter(item => item.status !== "revoked").length;
        if (activeCount + newChannels.length > db.MAX_PROJECT_CHANNELS) throw new Error(`A conta possui ${newChannels.length} canais novos, mas o projeto só tem ${Math.max(0, db.MAX_PROJECT_CHANNELS - activeCount)} slot(s) disponível(is)`);
      }

      const previous = target ? await db.getYouTubeConnection(user.openId, target.id) : undefined;
      const refreshTokenEncrypted = token.refresh_token ? encryptToken(token.refresh_token) : previous?.refreshTokenEncrypted;
      if (!refreshTokenEncrypted) throw new Error("O Google não retornou refresh token; tente novamente com consentimento");
      for (const channel of selectedChannels) {
        let channelTarget = targetChannelId === channel.id ? target : undefined;
        if (decoded.createProjectChannel) {
          channelTarget = await db.getProjectChannelByYouTubeChannelForOwner(user.openId, decoded.projectId!, channel.id);
          if (!channelTarget) channelTarget = await db.createProjectChannelForOwner({ ownerOpenId: user.openId, projectId: decoded.projectId, channelId: channel.id, channelName: channel.snippet?.title || "Canal YouTube" });
        }
        await db.upsertYouTubeConnection({
          ownerOpenId: user.openId,
          projectChannelId: channelTarget?.id,
          channelId: channel.id,
          channelName: channel.snippet?.title || "Canal YouTube",
          accessTokenEncrypted: encryptToken(token.access_token),
          refreshTokenEncrypted,
          tokenExpiresAt: new Date(Date.now() + (token.expires_in ?? 3600) * 1000),
          scopes: token.scope ?? YOUTUBE_SCOPE,
          status: "connected",
          lastError: null,
        });
      }

      redirectToApp(res, "connected");
    } catch (error) {
      console.error("[YouTube OAuth] Callback failed", error);
      redirectToApp(res, "error", error instanceof Error ? error.message : "Não foi possível concluir a conexão do YouTube");
    }
  });
}

export async function getYouTubeConnectionStatus(ownerOpenId: string, projectChannelId?: number) {
  const connection = await db.getYouTubeConnection(ownerOpenId, projectChannelId);
  return {
    connected: Boolean(connection && connection.status !== "reauthorization_required"),
    reauthorizationRequired: connection?.status === "reauthorization_required",
    channelId: connection?.channelId ?? null,
    channelName: connection?.channelName ?? null,
  };
}
