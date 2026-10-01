import { detectContentLanguage, evaluateEligibility } from "./ingestion";
import { inArray } from "drizzle-orm";
import { videos } from "../drizzle/schema";
import { getDb } from "./db";

const API_ROOT = "https://www.googleapis.com/youtube/v3";
const VIDEO_DETAILS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_COMMENT_RESULTS = 50;

export type YouTubeCandidate = {
  videoId: string;
  url: string;
  title: string;
  channelId: string;
  channelName: string;
  publishedAt: Date;
  durationSeconds: number;
  isShort: boolean;
  viewCount: number;
  commentCount: number;
  description: string;
  language: ReturnType<typeof detectContentLanguage>;
  eligibility: ReturnType<typeof evaluateEligibility>;
};

export type YouTubeComment = {
  commentId: string;
  authorDisplayName: string;
  text: string;
  likeCount: number;
  replyCount: number;
  publishedAt: Date;
};

export class YouTubeApiError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "YouTubeApiError";
  }
}

function apiKey() {
  const key = process.env.YOUTUBE_DATA_API_KEY;
  if (!key) throw new YouTubeApiError("NOT_CONFIGURED", "YOUTUBE_DATA_API_KEY não configurada");
  return key;
}

function isoDurationToSeconds(value: string | undefined) {
  if (!value) return 0;
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
}

async function request<T>(endpoint: string, params: Record<string, string>) {
  const search = new URLSearchParams({ ...params, key: apiKey() });
  const url = `${API_ROOT}/${endpoint}?${search.toString()}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      const body = await response.json().catch(() => ({}));
      if (response.ok) return body as T;
      const reason = body?.error?.errors?.[0]?.reason ?? "YOUTUBE_API_ERROR";
      const retryable = response.status === 429 || response.status === 500 || response.status === 502 || response.status === 503 || response.status === 504;
      if (!retryable || attempt === 2) throw new YouTubeApiError(reason, body?.error?.message ?? `YouTube API falhou com ${response.status}`);
    } catch (error) {
      if (error instanceof YouTubeApiError) throw error;
      if (attempt === 2) throw new YouTubeApiError("NETWORK_ERROR", error instanceof Error ? error.message : "Falha de rede no YouTube");
    }
    await new Promise(resolve => setTimeout(resolve, 250 * 2 ** attempt));
  }
  throw new YouTubeApiError("NETWORK_ERROR", "YouTube não respondeu após retentativas");
}

export async function searchRecentVideos(input: { query: string; now?: Date; maxResults?: number }): Promise<YouTubeCandidate[]> {
  const now = input.now ?? new Date();
  const publishedAfter = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const search = await request<{ items: Array<{ id: { videoId: string } }> }>("search", {
    part: "snippet",
    fields: "items(id(videoId))",
    q: input.query,
    type: "video",
    order: "date",
    maxResults: String(Math.min(input.maxResults ?? 10, 25)),
    publishedAfter,
  });
  const ids = search.items.map(item => item.id.videoId).filter(Boolean);
  return ids.length ? getVideoDetails(ids, now, { useCache: true }) : [];
}

type VideoDetailsOptions = { useCache?: boolean };

function candidateFromStoredVideo(video: typeof videos.$inferSelect, now: Date): YouTubeCandidate | null {
  if (!video.publishedAt) return null;
  const publishedAt = new Date(video.publishedAt);
  const language = detectContentLanguage(video.title, video.description ?? "");
  return {
    videoId: video.youtubeVideoId,
    url: video.url,
    title: video.title,
    channelId: video.channelId,
    channelName: video.channelName,
    publishedAt,
    durationSeconds: video.durationSeconds,
    isShort: Boolean(video.isShort),
    viewCount: video.viewCount,
    commentCount: video.commentCount,
    description: video.description ?? "",
    language,
    eligibility: evaluateEligibility({ publishedAt, viewCount: video.viewCount, commentCount: video.commentCount, commentsEnabled: video.commentCount > 0, language, now }),
  };
}

async function readCachedVideoDetails(ids: string[], now: Date) {
  try {
    const database = await getDb();
    if (!database) return new Map<string, YouTubeCandidate>();
    const rows = await database.select().from(videos).where(inArray(videos.youtubeVideoId, ids));
    const fresh = new Map<string, YouTubeCandidate>();
    for (const row of rows) {
      if (now.getTime() - new Date(row.updatedAt).getTime() > VIDEO_DETAILS_CACHE_TTL_MS) continue;
      const candidate = candidateFromStoredVideo(row, now);
      if (candidate) fresh.set(candidate.videoId, candidate);
    }
    return fresh;
  } catch {
    // Cache is an optimization only; a database/cache failure must never hide YouTube results.
    return new Map<string, YouTubeCandidate>();
  }
}

export async function getVideoDetails(ids: string[], now = new Date(), options: VideoDetailsOptions = {}): Promise<YouTubeCandidate[]> {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean))).slice(0, 50);
  const cached = options.useCache ? await readCachedVideoDetails(uniqueIds, now) : new Map<string, YouTubeCandidate>();
  const missingIds = uniqueIds.filter(id => !cached.has(id));
  if (!missingIds.length) return uniqueIds.map(id => cached.get(id)).filter((item): item is YouTubeCandidate => Boolean(item));
  const details = await request<{ items: Array<{ id: string; snippet: { title: string; channelId: string; channelTitle: string; publishedAt: string; description: string; defaultAudioLanguage?: string }; contentDetails?: { duration?: string }; statistics?: { viewCount?: string; commentCount?: string } }> }>("videos", {
    part: "snippet,contentDetails,statistics",
    fields: "items(id,snippet(title,publishedAt,channelId,channelTitle,description,defaultAudioLanguage),contentDetails(duration),statistics(viewCount,commentCount))",
    id: missingIds.join(","),
  });
  const fetched = details.items.map(item => {
    const publishedAt = new Date(item.snippet.publishedAt);
    const viewCount = Number(item.statistics?.viewCount ?? 0);
    const commentCount = Number(item.statistics?.commentCount ?? 0);
    const durationSeconds = isoDurationToSeconds(item.contentDetails?.duration);
    const language = detectContentLanguage(item.snippet.title, item.snippet.description ?? "");
    return {
      videoId: item.id,
      url: `https://www.youtube.com/watch?v=${item.id}`,
      title: item.snippet.title,
      channelId: item.snippet.channelId,
      channelName: item.snippet.channelTitle,
      publishedAt,
      durationSeconds,
      isShort: durationSeconds > 0 && durationSeconds <= 60,
      viewCount,
      commentCount,
      description: item.snippet.description,
      language,
      eligibility: evaluateEligibility({ publishedAt, viewCount, commentCount, commentsEnabled: commentCount > 0, language, now }),
    };
  });
  const byId = new Map(Array.from(cached.entries()).concat(fetched.map(item => [item.videoId, item] as const)));
  return uniqueIds.map(id => byId.get(id)).filter((item): item is YouTubeCandidate => Boolean(item));
}

export async function listTopComments(videoId: string, maxResults = 20): Promise<YouTubeComment[]> {
  const data = await request<{ items: Array<{ id: string; snippet: { totalReplyCount?: number; topLevelComment: { snippet: { authorDisplayName: string; textDisplay: string; likeCount: number; publishedAt: string } } } }> }>("commentThreads", {
    part: "snippet",
    fields: "items(id,snippet(totalReplyCount,topLevelComment(snippet(authorDisplayName,textDisplay,likeCount,publishedAt))))",
    videoId,
    order: "relevance",
    maxResults: String(Math.min(Math.max(1, maxResults), MAX_COMMENT_RESULTS)),
    textFormat: "plainText",
  });
  return data.items.map(item => {
    const snippet = item.snippet.topLevelComment.snippet;
    return { commentId: item.id, authorDisplayName: snippet.authorDisplayName, text: snippet.textDisplay, likeCount: snippet.likeCount, replyCount: item.snippet.totalReplyCount ?? 0, publishedAt: new Date(snippet.publishedAt) };
  });
}

export function youtubeIntegrationStatus() {
  return { configured: Boolean(process.env.YOUTUBE_DATA_API_KEY), publicationConfigured: false, source: "official_data_api" as const };
}
