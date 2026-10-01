import { decryptToken, encryptToken } from "./youtube-oauth";
import * as db from "./db";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const COMMENT_THREADS_ENDPOINT = "https://www.googleapis.com/youtube/v3/commentThreads";
const COMMENTS_ENDPOINT = "https://www.googleapis.com/youtube/v3/comments";

type PublishInput = {
  videoId: string;
  parentCommentId: string | null;
  text: string;
  ownerOpenId: string;
  projectChannelId?: number | null;
  idempotencyKey?: string;
};

type PublishResponse = { id?: string; snippet?: { topLevelComment?: { id?: string } } };
const COMMENT_LOOKUP_ENDPOINT = "https://www.googleapis.com/youtube/v3/comments";

async function fetchWithRetry(input: RequestInfo | URL, init: RequestInit) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(input, init);
      if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 2) return response;
    } catch (error) {
      if (attempt === 2) throw error;
    }
    await new Promise(resolve => setTimeout(resolve, 250 * 2 ** attempt));
  }
  throw new Error("YouTube não respondeu após retentativas");
}

async function refreshAccessToken(connection: NonNullable<Awaited<ReturnType<typeof db.getYouTubeConnection>>>) {
  const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Credenciais OAuth do YouTube não configuradas");

  const response = await fetchWithRetry(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: decryptToken(connection.refreshTokenEncrypted),
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = await response.json().catch(() => ({})) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!response.ok || !body.access_token) {
    const reason = body.error_description || `Refresh do YouTube falhou com ${response.status}`;
    if (body.error === "invalid_grant") {
      await db.markYouTubeReauthorizationRequired(connection.ownerOpenId, "Refresh token revogado ou expirado: nova autorização necessária", connection.projectChannelId ?? undefined);
      throw new Error("A conexão do YouTube expirou ou foi revogada; conecte o canal novamente");
    }
    throw new Error(reason);
  }

  await db.upsertYouTubeConnection({
    ownerOpenId: connection.ownerOpenId,
    projectChannelId: connection.projectChannelId,
    channelId: connection.channelId,
    channelName: connection.channelName,
    accessTokenEncrypted: encryptToken(body.access_token),
    refreshTokenEncrypted: connection.refreshTokenEncrypted,
    tokenExpiresAt: new Date(Date.now() + (body.expires_in ?? 3600) * 1000),
    scopes: connection.scopes ?? "",
  });
  return body.access_token;
}

async function accessToken(ownerOpenId: string, projectChannelId?: number | null) {
  const connection = await db.getYouTubeConnection(ownerOpenId, projectChannelId ?? undefined);
  if (!connection) throw new Error("Canal YouTube não conectado");
  if (connection.status === "reauthorization_required") throw new Error("A conexão do YouTube exige nova autorização");
  const scopes = new Set((connection.scopes ?? "").split(/\s+/).filter(Boolean));
  if (!scopes.has("https://www.googleapis.com/auth/youtube.force-ssl")) throw new Error("O canal conectado não possui escopo de publicação");
  if (!connection.tokenExpiresAt || connection.tokenExpiresAt.getTime() > Date.now() + 60_000) {
    return decryptToken(connection.accessTokenEncrypted);
  }
  return refreshAccessToken(connection);
}

async function postComment(token: string, input: PublishInput) {
  const endpoint = input.parentCommentId ? COMMENTS_ENDPOINT : COMMENT_THREADS_ENDPOINT;
  const body = input.parentCommentId
    ? { snippet: { parentId: input.parentCommentId, textOriginal: input.text } }
    : { snippet: { videoId: input.videoId, topLevelComment: { snippet: { textOriginal: input.text } } } };
  const response = await fetchWithRetry(`${endpoint}?part=snippet`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const result = await response.json().catch(() => ({})) as PublishResponse & { error?: { message?: string } };
  if (!response.ok) throw new Error(result.error?.message || `Publicação YouTube falhou com ${response.status}`);
  const commentId = input.parentCommentId ? result.id : result.snippet?.topLevelComment?.id;
  if (!commentId) throw new Error("YouTube não retornou o ID do comentário publicado");
  return { commentId };
}

async function findExistingComment(token: string, input: PublishInput) {
  const endpoint = input.parentCommentId ? `${COMMENTS_ENDPOINT}?part=snippet&parentId=${encodeURIComponent(input.parentCommentId)}&maxResults=100` : `${COMMENT_THREADS_ENDPOINT}?part=snippet&videoId=${encodeURIComponent(input.videoId)}&maxResults=100`;
  const response = await fetchWithRetry(endpoint, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) return null;
  const body = await response.json().catch(() => ({})) as { items?: Array<{ id?: string; snippet?: { textOriginal?: string; topLevelComment?: { id?: string; snippet?: { textOriginal?: string } } } }> };
  const normalized = input.text.trim();
  for (const item of body.items ?? []) {
    const id = input.parentCommentId ? item.id : item.snippet?.topLevelComment?.id;
    const text = input.parentCommentId ? item.snippet?.textOriginal : item.snippet?.topLevelComment?.snippet?.textOriginal;
    if (id && text?.trim() === normalized) return { commentId: id, deduplicated: true as const };
  }
  return null;
}

export async function publishYouTubeComment(input: PublishInput) {
  if (!input.text.trim()) throw new Error("Comentário vazio");
  if (!input.projectChannelId || input.projectChannelId <= 0) throw new Error("Publicação exige canal do projeto explicitamente selecionado");
  const token = await accessToken(input.ownerOpenId, input.projectChannelId);
  if (input.idempotencyKey) {
    const existing = await findExistingComment(token, input);
    if (existing) return existing;
  }
  return postComment(token, input);
}

export async function fetchPublishedComment(input: { ownerOpenId: string; projectChannelId?: number | null; commentId: string }) {
  if (!input.projectChannelId || input.projectChannelId <= 0) throw new Error("Reconciliação exige canal do projeto explicitamente selecionado");
  const token = await accessToken(input.ownerOpenId, input.projectChannelId);
  const headers = { authorization: `Bearer ${token}` };
  const [threadResponse, commentResponse, repliesResponse] = await Promise.all([
    fetchWithRetry(`https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&id=${encodeURIComponent(input.commentId)}`, { headers, signal: AbortSignal.timeout(10_000) }),
    fetchWithRetry(`${COMMENT_LOOKUP_ENDPOINT}?part=snippet&id=${encodeURIComponent(input.commentId)}`, { headers, signal: AbortSignal.timeout(10_000) }),
    fetchWithRetry(`${COMMENT_LOOKUP_ENDPOINT}?part=snippet&parentId=${encodeURIComponent(input.commentId)}&maxResults=100`, { headers, signal: AbortSignal.timeout(10_000) }),
  ]);
  const threadBody = await threadResponse.json().catch(() => ({})) as { items?: Array<{ id?: string; snippet?: { totalReplyCount?: number; topLevelComment?: { snippet?: { likeCount?: number } } } }>; error?: { message?: string } };
  const commentBody = await commentResponse.json().catch(() => ({})) as { items?: Array<{ id?: string; snippet?: { likeCount?: number } }>; error?: { message?: string } };
  const repliesBody = await repliesResponse.json().catch(() => ({})) as { items?: Array<{ snippet?: { textOriginal?: string } }>; error?: { message?: string } };
  if (!threadResponse.ok && !commentResponse.ok) throw new Error(threadBody.error?.message || commentBody.error?.message || `Reconciliação YouTube falhou (${threadResponse.status}/${commentResponse.status})`);
  const thread = threadBody.items?.find(candidate => candidate.id === input.commentId);
  const comment = commentBody.items?.find(candidate => candidate.id === input.commentId);
  const mentionCount = (repliesBody.items ?? []).filter(reply => /@[A-Za-zÀ-ÿ0-9_.-]{2,}/.test(reply.snippet?.textOriginal ?? "")).length;
  return { exists: Boolean(thread || comment), replyCount: thread?.snippet?.totalReplyCount ?? 0, likeCount: thread?.snippet?.topLevelComment?.snippet?.likeCount ?? comment?.snippet?.likeCount ?? 0, mentionCount };
}
