import { and, desc, eq, gte, isNull, lt, ne, or } from "drizzle-orm";
import { ALLOWED_READING_URL } from "@shared/const";
import { automationSettings, commentObservations, drafts, publications, videoMetricSnapshots, videos } from "../drizzle/schema";
import { getDb, getProjectChannelForOwner, getWritableProjectChannelsForOwner } from "./db";
import { classifyConversationComment, classifyRisk, isLikelyChannelOwnerComment, isMeaningfulPersonalComment, validateFinalDraft } from "./editorial";
import { generateEditorialDraft } from "./llm-editorial";
import { getEditorialContext } from "./editorial-memory";
import { detectContentLanguage, evaluateEligibility } from "./ingestion";
import { rankSourceComments } from "./resonance";
import { getVideoDetails, listTopComments, searchRecentVideos, YouTubeApiError, type YouTubeCandidate } from "./youtube";
import { automationDedupeKey } from "./automation-channel-policy";

const DEFAULT_QUERIES = ["soledad propósito vida", "ansiedad esperanza proceso", "fe sentido experiencias", "cómo seguir cuando cuesta", "historias de cambio interior", "recomenzar y pertenencia", "duelo y reconciliación", "cansancio y esperanza práctica", "búsqueda espiritual y sentido", "cambio de vida y madurez"];
const DEFAULT_DAILY_LIMIT = 30;

function expandSearchQueries(queries: string[]) {
  const suffixes = ["experiencia", "historia", "reflexión", "cómo seguir", "qué hacer"];
  return Array.from(new Set(queries.flatMap(query => {
    const normalized = query.trim();
    if (!normalized) return [];
    return [normalized, ...suffixes.slice(0, 2).map(suffix => `${normalized} ${suffix}`)];
  }))).slice(0, 10);
}

type AutomationSettingsRow = typeof automationSettings.$inferSelect;

type RunAutomationInput = {
  ownerOpenId: string;
  ownerId: number;
  projectChannelId?: number;
  force?: boolean;
  searchQueries?: string[];
  maxDrafts?: number;
  autoPublishOverride?: boolean;
  candidatePool?: YouTubeCandidate[];
};

export type AutomationSettings = {
  enabled: boolean;
  autoPublish: boolean;
  dailyLimit: number;
  minChannelIntervalDays: number;
  includeLink: boolean;
  searchQueries: string[];
  scheduleCronTaskUid: string | null;
  lastRunAt: Date | null;
  lastError: string | null;
  pausedReason: string | null;
};

export type AutomationRunResult = {
  searched: number;
  considered: number;
  drafted: number;
  published: number;
  heldForReview: number;
  blocked: number;
  skipped: number;
  reasons: string[];
};

export type WeeklyDiscoveryResult = {
  queries: number;
  searched: number;
  saved: number;
  eligible: number;
  rejected: number;
  reasons: string[];
};

function requireDatabase() {
  return getDb().then(database => {
    if (!database) throw new Error("Banco indisponível: automação não pode executar");
    return database;
  });
}

function normalizeSettings(row: AutomationSettingsRow): AutomationSettings {
  const queries = row.searchQueries
    ? row.searchQueries.split("\n").map(value => value.trim()).filter(Boolean).slice(0, 10)
    : DEFAULT_QUERIES;
  return {
    enabled: Boolean(row.enabled),
    autoPublish: Boolean(row.autoPublish),
    dailyLimit: Math.max(1, Math.min(150, row.dailyLimit || DEFAULT_DAILY_LIMIT)),
    minChannelIntervalDays: Math.max(0, Math.min(365, row.minChannelIntervalDays ?? 30)),
    includeLink: Boolean(row.includeLink),
    searchQueries: queries.length ? queries : DEFAULT_QUERIES,
    scheduleCronTaskUid: row.scheduleCronTaskUid,
    lastRunAt: row.lastRunAt,
    lastError: row.lastError,
    pausedReason: row.pausedReason,
  };
}

export async function getAutomationSettings(ownerOpenId: string): Promise<AutomationSettings> {
  return getAutomationSettingsForChannel(ownerOpenId);
}

export async function getAutomationSettingsForChannel(ownerOpenId: string, projectChannelId?: number): Promise<AutomationSettings> {
  const database = await requireDatabase();
  if (projectChannelId !== undefined && !(await getProjectChannelForOwner(ownerOpenId, projectChannelId))) {
    throw new Error("Canal do projeto não encontrado ou sem acesso");
  }
  const filter = projectChannelId === undefined
    ? eq(automationSettings.ownerOpenId, ownerOpenId)
    : and(eq(automationSettings.ownerOpenId, ownerOpenId), eq(automationSettings.projectChannelId, projectChannelId));
  let rows = await database.select().from(automationSettings).where(filter).limit(2);
  if (projectChannelId === undefined && rows.length > 1) {
    const legacy = rows.find(row => row.projectChannelId === null);
    if (legacy && rows.filter(row => row.projectChannelId === null).length === 1) rows = [legacy];
    else throw new Error("Selecione um canal para configurar a automação");
  }
  if (!rows[0]) {
    if (projectChannelId === undefined && (await getWritableProjectChannelsForOwner(ownerOpenId)).length > 0) {
      throw new Error("Selecione um canal para configurar a automação");
    }
    await database.insert(automationSettings).values({ ownerOpenId, projectChannelId: projectChannelId ?? null, searchQueries: DEFAULT_QUERIES.join("\n") });
    rows = await database.select().from(automationSettings).where(filter).limit(1);
  }
  if (!rows[0]) throw new Error("Configuração de automação não pôde ser criada");
  return normalizeSettings(rows[0]);
}

export async function discoverWeeklyVideos(ownerOpenId: string, projectChannelId?: number): Promise<WeeklyDiscoveryResult> {
  const settings = await getAutomationSettingsForChannel(ownerOpenId, projectChannelId);
  const now = new Date();
  const result: WeeklyDiscoveryResult = { queries: 0, searched: 0, saved: 0, eligible: 0, rejected: 0, reasons: [] };
  const candidates = new Map<string, YouTubeCandidate>();
  for (const query of expandSearchQueries(settings.searchQueries)) {
    result.queries++;
    try {
      for (const candidate of await searchRecentVideos({ query, maxResults: 10, now })) candidates.set(candidate.videoId, candidate);
    } catch (error) {
      if (isQuotaError(error)) { result.reasons.push("Cota do YouTube atingida durante o garimpo semanal"); break; }
      throw error;
    }
  }
  result.searched = candidates.size;
  for (const candidate of Array.from(candidates.values())) {
    if (candidate.language !== "es") {
      result.rejected++;
      result.reasons.push(`${candidate.title}: idioma fora do espanhol (${candidate.language})`);
      continue;
    }
    await ensureVideo(0, candidate);
    result.saved++;
    if (candidate.eligibility.eligible) result.eligible++;
    else { result.rejected++; result.reasons.push(`${candidate.title}: ${candidate.eligibility.reasons.join(", ") || "fora dos critérios atuais"}`); }
  }
  return result;
}

async function loadSavedCandidatePool(ownerId: number, projectChannelId: number | undefined, limit: number) {
  const database = await requireDatabase();
  const rows = await database.select().from(videos).where(eq(videos.eligibilityStatus, "eligible")).orderBy(desc(videos.relevanceScore), desc(videos.updatedAt)).limit(Math.min(100, Math.max(1, limit)));
  const existing = await database.select({ videoId: drafts.videoId }).from(drafts).where(and(eq(drafts.createdBy, ownerId), projectChannelId === undefined ? isNull(drafts.projectChannelId) : eq(drafts.projectChannelId, projectChannelId), ne(drafts.status, "discarded")));
  const used = new Set(existing.map(row => row.videoId));
  return rows.filter(video => !used.has(video.id) && video.publishedAt).map(video => {
    const language = detectContentLanguage(video.title, video.description ?? "");
    return {
    videoId: video.youtubeVideoId,
    url: video.url,
    title: video.title,
    channelId: video.channelId,
    channelName: video.channelName,
    publishedAt: video.publishedAt as Date,
    durationSeconds: video.durationSeconds,
    isShort: Boolean(video.isShort),
    viewCount: video.viewCount,
    commentCount: video.commentCount,
    description: video.description ?? "",
    language,
    eligibility: evaluateEligibility({ publishedAt: video.publishedAt as Date, viewCount: video.viewCount, commentCount: video.commentCount, language }),
  } satisfies YouTubeCandidate;
  }).filter(candidate => candidate.language === "es" && candidate.eligibility.eligible);
}

export async function updateAutomationSettings(
  ownerOpenId: string,
  input: Partial<Pick<AutomationSettings, "enabled" | "autoPublish" | "dailyLimit" | "minChannelIntervalDays" | "includeLink" | "searchQueries">>,
  projectChannelId?: number,
) {
  const database = await requireDatabase();
  await getAutomationSettingsForChannel(ownerOpenId, projectChannelId);
  const queries = input.searchQueries?.map(value => value.trim()).filter(Boolean).slice(0, 10);
  await database.update(automationSettings).set({
    ...(input.enabled === undefined ? {} : { enabled: input.enabled ? 1 : 0 }),
    // Publicação externa permanece desligada no MVP; aprovação humana é obrigatória.
    autoPublish: 0,
    ...(input.dailyLimit === undefined ? {} : { dailyLimit: Math.max(1, Math.min(150, Math.round(input.dailyLimit))) }),
    ...(input.minChannelIntervalDays === undefined ? {} : { minChannelIntervalDays: Math.max(0, Math.min(365, Math.round(input.minChannelIntervalDays))) }),
    ...(input.includeLink === undefined ? {} : { includeLink: input.includeLink ? 1 : 0 }),
    ...(queries === undefined ? {} : { searchQueries: queries.join("\n") }),
    updatedAt: new Date(),
    lastError: null,
    pausedReason: null,
  }).where(and(eq(automationSettings.ownerOpenId, ownerOpenId), projectChannelId === undefined ? isNull(automationSettings.projectChannelId) : eq(automationSettings.projectChannelId, projectChannelId)));
  const settings = await getAutomationSettingsForChannel(ownerOpenId, projectChannelId);
  if (input.autoPublish === true) {
    await database.update(automationSettings).set({ lastError: "Publicação automática bloqueada no MVP; use a fila de revisão humana." }).where(and(eq(automationSettings.ownerOpenId, ownerOpenId), projectChannelId === undefined ? isNull(automationSettings.projectChannelId) : eq(automationSettings.projectChannelId, projectChannelId)));
    return getAutomationSettingsForChannel(ownerOpenId, projectChannelId);
  }
  return settings;
}

function isQuotaError(error: unknown) {
  return (error instanceof YouTubeApiError && ["quotaExceeded", "dailyLimitExceeded", "rateLimitExceeded", "RATE_LIMIT_EXCEEDED"].includes(error.code)) || (error instanceof Error && /quota|daily limit|rate limit/i.test(error.message));
}

async function pauseForQuota(ownerOpenId: string, projectChannelId?: number) {
  const database = await requireDatabase();
  await database.update(automationSettings).set({ enabled: 0, lastError: "Cota diária ou limite de taxa do YouTube atingido", pausedReason: "youtube_quota_exceeded", lastRunAt: new Date(), updatedAt: new Date() }).where(and(eq(automationSettings.ownerOpenId, ownerOpenId), projectChannelId === undefined ? isNull(automationSettings.projectChannelId) : eq(automationSettings.projectChannelId, projectChannelId)));
}

async function acquireAutomationLease(ownerOpenId: string, projectChannelId?: number) {
  const database = await requireDatabase();
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + 5 * 60_000);
  const updated = await database.update(automationSettings).set({ runLeaseUntil: leaseUntil, updatedAt: now }).where(and(eq(automationSettings.ownerOpenId, ownerOpenId), projectChannelId === undefined ? isNull(automationSettings.projectChannelId) : eq(automationSettings.projectChannelId, projectChannelId), or(isNull(automationSettings.runLeaseUntil), lt(automationSettings.runLeaseUntil, now)))).returning({ id: automationSettings.id });
  return updated.length === 1;
}

async function releaseAutomationLease(ownerOpenId: string, projectChannelId?: number) {
  const database = await requireDatabase();
  await database.update(automationSettings).set({ runLeaseUntil: null, updatedAt: new Date() }).where(and(eq(automationSettings.ownerOpenId, ownerOpenId), projectChannelId === undefined ? isNull(automationSettings.projectChannelId) : eq(automationSettings.projectChannelId, projectChannelId)));
}

export async function setAutomationScheduleTask(ownerOpenId: string, taskUid: string | null, projectChannelId?: number) {
  const database = await requireDatabase();
  await getAutomationSettingsForChannel(ownerOpenId, projectChannelId);
  await database.update(automationSettings).set({ scheduleCronTaskUid: taskUid, updatedAt: new Date() }).where(and(eq(automationSettings.ownerOpenId, ownerOpenId), projectChannelId === undefined ? isNull(automationSettings.projectChannelId) : eq(automationSettings.projectChannelId, projectChannelId)));
  return getAutomationSettingsForChannel(ownerOpenId, projectChannelId);
}

export async function getAutomationSettingsByTaskUid(taskUid: string) {
  const database = await requireDatabase();
  const rows = await database.select().from(automationSettings).where(eq(automationSettings.scheduleCronTaskUid, taskUid)).limit(1);
  if (!rows[0]) return null;
  return { ownerOpenId: rows[0].ownerOpenId, projectChannelId: rows[0].projectChannelId ?? undefined, settings: normalizeSettings(rows[0]) };
}

async function hasRecentContextualInteraction(ownerId: number, youtubeVideoId: string, parentCommentId: string | undefined, since: Date, projectChannelId?: number) {
  const database = await requireDatabase();
  const rows = await database.select({ id: drafts.id })
    .from(drafts)
    .innerJoin(videos, eq(drafts.videoId, videos.id))
    .where(and(eq(drafts.createdBy, ownerId), projectChannelId === undefined ? isNull(drafts.projectChannelId) : eq(drafts.projectChannelId, projectChannelId), or(eq(videos.youtubeVideoId, youtubeVideoId), parentCommentId ? eq(drafts.parentCommentId, parentCommentId) : undefined), gte(drafts.createdAt, since), ne(drafts.status, "discarded")))
    .limit(1);
  return rows.length > 0;
}

async function hasExistingDraft(ownerId: number, youtubeVideoId: string, projectChannelId?: number) {
  const database = await requireDatabase();
  const rows = await database.select({ id: drafts.id })
    .from(drafts)
    .innerJoin(videos, eq(drafts.videoId, videos.id))
    .where(and(eq(drafts.createdBy, ownerId), projectChannelId === undefined ? isNull(drafts.projectChannelId) : eq(drafts.projectChannelId, projectChannelId), eq(videos.youtubeVideoId, youtubeVideoId)))
    .limit(1);
  return rows.length > 0;
}

async function hasDuplicateDraftToday(ownerId: number, text: string, now: Date, projectChannelId?: number) {
  const database = await requireDatabase();
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const rows = await database.select({ id: drafts.id })
    .from(drafts)
    .where(and(eq(drafts.createdBy, ownerId), projectChannelId === undefined ? isNull(drafts.projectChannelId) : eq(drafts.projectChannelId, projectChannelId), eq(drafts.text, text), gte(drafts.createdAt, start)))
    .limit(1);
  return rows.length > 0;
}

async function countDraftsToday(ownerId: number, now: Date, projectChannelId?: number) {
  const database = await requireDatabase();
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const rows = await database.select({ id: drafts.id }).from(drafts).where(and(
    eq(drafts.createdBy, ownerId),
    projectChannelId === undefined ? isNull(drafts.projectChannelId) : eq(drafts.projectChannelId, projectChannelId),
    gte(drafts.createdAt, start),
    ne(drafts.status, "discarded"),
  ));
  return rows.length;
}

async function ensureVideo(ownerId: number, candidate: YouTubeCandidate) {
  const database = await requireDatabase();
  const existing = await database.select({ id: videos.id }).from(videos).where(eq(videos.youtubeVideoId, candidate.videoId)).limit(1);
  if (existing[0]) {
    await database.update(videos).set({ durationSeconds: candidate.durationSeconds, isShort: candidate.isShort ? 1 : 0, viewCount: candidate.viewCount, commentCount: candidate.commentCount, language: candidate.language, updatedAt: new Date() }).where(eq(videos.id, existing[0].id));
    await database.insert(videoMetricSnapshots).values({ videoId: existing[0].id, viewCount: candidate.viewCount, commentCount: candidate.commentCount, opportunityScore: candidate.eligibility.opportunityScore });
    return existing[0].id;
  }
  let inserted;
  try {
    inserted = await database.insert(videos).values({
    youtubeVideoId: candidate.videoId,
    url: candidate.url,
    title: candidate.title,
    channelId: candidate.channelId,
    channelName: candidate.channelName,
    publishedAt: candidate.publishedAt,
    durationSeconds: candidate.durationSeconds,
    isShort: candidate.isShort ? 1 : 0,
    viewCount: candidate.viewCount,
    commentCount: candidate.commentCount,
    language: candidate.language,
    description: candidate.description,
    source: "youtube_api",
    eligibilityStatus: "eligible",
    relevanceScore: 50,
    riskLevel: "low",
    }).returning({ id: videos.id });
  } catch (error) {
    if (!/duplicate|unique/i.test(error instanceof Error ? error.message : "")) throw error;
    const raced = await database.select({ id: videos.id }).from(videos).where(eq(videos.youtubeVideoId, candidate.videoId)).limit(1);
    if (!raced[0]) throw error;
    return raced[0].id;
  }
  void ownerId;
  const videoId = inserted[0].id;
  await database.insert(videoMetricSnapshots).values({ videoId, viewCount: candidate.viewCount, commentCount: candidate.commentCount, opportunityScore: candidate.eligibility.opportunityScore });
  return videoId;
}

async function createDraft(ownerId: number, projectChannelId: number | undefined, videoId: number, candidate: YouTubeCandidate, parentCommentId: string | null, quoteComment: string | undefined, text: string, type: "A_video" | "B_reply" | "C_link", containsLink: boolean, riskLevel: "low" | "medium" | "high" | "critical", justification: string, dedupeKey: string) {
  const database = await requireDatabase();
  try {
    const inserted = await database.insert(drafts).values({
    videoId,
    projectChannelId: projectChannelId ?? null,
    parentCommentId,
    type,
    text,
    containsLink: containsLink ? 1 : 0,
    quoteVideo: candidate.title,
    quoteComment: quoteComment ?? null,
    riskLevel,
    justification,
    model: process.env.AI_EDITORIAL_PROVIDER === "external" ? process.env.EXTERNAL_LLM_MODEL ?? "external" : "ruleset-v1",
    status: "review",
      createdBy: ownerId,
      dedupeKey,
    }).returning({ id: drafts.id });
    return inserted[0].id;
  } catch (error) {
    if (/duplicate|unique/i.test(error instanceof Error ? error.message : "")) return null;
    throw error;
  }
}

async function markAutomationRun(ownerOpenId: string, projectChannelId?: number) {
  const database = await requireDatabase();
  await database.update(automationSettings).set({ lastRunAt: new Date(), updatedAt: new Date() }).where(and(eq(automationSettings.ownerOpenId, ownerOpenId), projectChannelId === undefined ? isNull(automationSettings.projectChannelId) : eq(automationSettings.projectChannelId, projectChannelId)));
}

async function runAutomationUnlocked(input: RunAutomationInput): Promise<AutomationRunResult> {
  const settings = await getAutomationSettingsForChannel(input.ownerOpenId, input.projectChannelId);
  if (!settings.enabled && !input.force) throw new Error("Automação está pausada");
  const targetChannel = input.projectChannelId === undefined ? undefined : await getProjectChannelForOwner(input.ownerOpenId, input.projectChannelId);
  if (input.projectChannelId !== undefined && !targetChannel) throw new Error("Canal do projeto não encontrado ou sem acesso");
  const editorialContext = await getEditorialContext(input.ownerOpenId);

  const now = new Date();
  const result: AutomationRunResult = { searched: 0, considered: 0, drafted: 0, published: 0, heldForReview: 0, blocked: 0, skipped: 0, reasons: [] };
  const requestedDraftLimit = input.maxDrafts ? Math.max(1, Math.min(150, input.maxDrafts)) : null;
  const dailyRemaining = Math.max(0, settings.dailyLimit - await countDraftsToday(input.ownerId, now, input.projectChannelId));
  let remaining = Math.min(requestedDraftLimit ?? settings.dailyLimit, dailyRemaining);
  let linkDrafts = 0;
  if (remaining === 0) {
    result.reasons.push("limite diário de drafts já atingido para este canal");
    await markAutomationRun(input.ownerOpenId, input.projectChannelId);
    return result;
  }
  const maxLinkDrafts = Math.max(1, Math.floor((requestedDraftLimit ?? settings.dailyLimit) * 0.1));
  const searchQueries = expandSearchQueries(input.searchQueries?.map(query => query.trim()).filter(Boolean) ?? settings.searchQueries);
  const autoPublishRequested = input.autoPublishOverride ?? settings.autoPublish;
  if (autoPublishRequested) result.reasons.push("publicação automática bloqueada no MVP; rascunhos seguem para revisão humana");
  const candidatesById = new Map<string, YouTubeCandidate>((input.candidatePool ?? []).map(candidate => [candidate.videoId, candidate]));
  for (const query of input.candidatePool ? [] : searchQueries) {
    if (candidatesById.size >= remaining * 3) break;
    let candidates: YouTubeCandidate[];
    try {
      candidates = await searchRecentVideos({ query, maxResults: Math.min(10, remaining * 2), now });
    } catch (error) {
      if (isQuotaError(error)) {
        await pauseForQuota(input.ownerOpenId, input.projectChannelId);
        result.reasons.push("Cota do YouTube atingida; automação pausada automaticamente");
        return result;
      }
      throw error;
    }
    result.searched += candidates.length;
    for (const candidate of candidates) candidatesById.set(candidate.videoId, candidate);
  }

  const since = new Date(now.getTime() - settings.minChannelIntervalDays * 86_400_000);
  const rankedCandidates = Array.from(candidatesById.values()).sort((left, right) => right.eligibility.opportunityScore - left.eligibility.opportunityScore);
  for (const candidate of rankedCandidates) {
    if (remaining <= 0) break;
    result.considered++;
    if (!candidate.eligibility.eligible) {
      result.skipped++;
      result.reasons.push(`inelegível: ${candidate.title} — ${candidate.eligibility.reasons.join(", ") || "critérios técnicos não atendidos"}`);
      continue;
    }
    let comments;
    try {
      comments = await listTopComments(candidate.videoId, 10);
    } catch (error) {
      if (isQuotaError(error)) {
        await pauseForQuota(input.ownerOpenId, input.projectChannelId);
        result.reasons.push("Cota do YouTube atingida; automação pausada automaticamente");
        return result;
      }
      throw error;
    }
    const rankedSourceComments = rankSourceComments(comments);
    const selectedSource = rankedSourceComments.find(({ resonance }) => resonance.riskLevel !== "critical" && resonance.riskLevel !== "high");
    const selectedComment = selectedSource?.comment;
    if (await hasRecentContextualInteraction(input.ownerId, candidate.videoId, selectedComment?.commentId, since, input.projectChannelId) || await hasExistingDraft(input.ownerId, candidate.videoId, input.projectChannelId)) {
      result.skipped++;
      result.reasons.push(`já processado ou mesma conversa em cooldown contextual: ${candidate.title}`);
      continue;
    }
    const isReplyMode = Boolean(selectedComment && candidate.isShort);
    const combinedTheme = `${candidate.title}. ${candidate.description.slice(0, 1200)}`;
    const riskSignals = classifyRisk(`${combinedTheme} ${selectedComment?.text ?? ""}`);
    if (riskSignals.riskLevel === "critical") {
      result.blocked++;
      result.reasons.push(`bloqueado por crise: ${candidate.title}`);
      continue;
    }

    const linkQuotaOpen = linkDrafts < maxLinkDrafts;
    const linkPosition = result.drafted + 1;
    const linkIsDue = linkPosition % 10 === 0;
    const draft = await generateEditorialDraft({
      videoTitle: candidate.title,
      videoTheme: combinedTheme,
      commentText: isReplyMode ? selectedComment?.text : undefined,
      interestShown: Boolean(selectedComment),
      link: settings.includeLink && linkQuotaOpen && linkIsDue && riskSignals.riskLevel === "low" ? ALLOWED_READING_URL : undefined,
      responseOnly: isReplyMode,
      variationKey: `${now.toISOString().slice(0, 10)}-${result.considered}-${candidate.videoId}`,
      editorialContext,
    });
    const validation = validateFinalDraft({ text: draft.text, riskLevel: draft.riskLevel, containsLink: draft.containsLink });
    if (!validation.valid) {
      result.blocked++;
      result.reasons.push(`texto bloqueado: ${candidate.title}`);
      continue;
    }
    if (draft.containsLink) linkDrafts++;
    if (settings.includeLink && !linkQuotaOpen && riskSignals.riskLevel === "low") {
      result.reasons.push(`link mantido fora desta rodada para preservar o teto de ${maxLinkDrafts} em ${requestedDraftLimit ?? 10} drafts`);
    }
    if (isReplyMode && (draft.type !== "B_reply" || !selectedComment?.commentId)) {
      result.blocked++;
      result.reasons.push(`Short bloqueado: só respostas individuais são permitidas: ${candidate.title}`);
      continue;
    }
    if (!isReplyMode && draft.type === "B_reply") {
      result.blocked++;
      result.reasons.push(`comentário no vídeo bloqueado: não havia comentário pessoal suficiente para resposta: ${candidate.title}`);
      continue;
    }
    if (await hasDuplicateDraftToday(input.ownerId, draft.text, now, input.projectChannelId)) {
      result.skipped++;
      result.reasons.push(`texto repetido no mesmo dia: ${candidate.title}`);
      continue;
    }

    const videoId = await ensureVideo(input.ownerId, candidate);
    const database = await requireDatabase();
    for (const comment of comments) {
      const classification = classifyConversationComment(comment.text);
      await database.insert(commentObservations).values({
        videoId,
        youtubeCommentId: comment.commentId,
        authorPublicId: null,
        text: comment.text,
        likeCount: comment.likeCount,
        publishedAt: comment.publishedAt,
        classification: classification.classification,
        riskLevel: classification.riskLevel,
        exposureSignals: JSON.stringify(classification.exposureSignals),
        source: "youtube_api",
      }).onConflictDoUpdate({ target: commentObservations.youtubeCommentId, set: { text: comment.text, likeCount: comment.likeCount, classification: classification.classification, riskLevel: classification.riskLevel, exposureSignals: JSON.stringify(classification.exposureSignals) } });
    }
    const parentCommentId = isReplyMode && draft.type === "B_reply" ? selectedComment?.commentId ?? null : null;
    const dedupeKey = automationDedupeKey({ ownerId: input.ownerId, projectChannelId: input.projectChannelId, videoId: candidate.videoId, parentCommentId, day: now.toISOString().slice(0, 10) });
    const sourceEvidence = selectedSource ? ` Comentário-fonte: ${selectedComment?.likeCount ?? 0} curtidas, ${selectedComment?.replyCount ?? 0} respostas; score de ressonância ${selectedSource.resonance.score}/100 (${selectedSource.resonance.signals.join(", ") || "sinais limitados"}).` : " Sem comentário-fonte pessoal acionável; revisão deve confirmar a âncora no vídeo.";
    const draftId = await createDraft(input.ownerId, input.projectChannelId, videoId, candidate, parentCommentId, selectedComment?.text, draft.text, draft.type, draft.containsLink, draft.riskLevel, `${isReplyMode ? "Resposta a comentário pessoal" : "Comentário no vídeo principal"}. ${draft.justification}${sourceEvidence}`, dedupeKey);
    if (draftId === null) {
      result.skipped++;
      result.reasons.push(`rascunho duplicado detectado no banco: ${candidate.title}`);
      continue;
    }
    result.drafted++;
    remaining--;

    result.heldForReview++;
    if (draft.riskLevel !== "low") result.reasons.push(`mantido para revisão reforçada por risco ${draft.riskLevel}: ${candidate.title}`);
  }

  await markAutomationRun(input.ownerOpenId, input.projectChannelId);
  return result;
}

export async function runAutomation(input: RunAutomationInput): Promise<AutomationRunResult> {
  await getAutomationSettingsForChannel(input.ownerOpenId, input.projectChannelId);
  if (!(await acquireAutomationLease(input.ownerOpenId, input.projectChannelId))) return { searched: 0, considered: 0, drafted: 0, published: 0, heldForReview: 0, blocked: 0, skipped: 0, reasons: ["já existe uma execução em andamento"] };
  try {
    return await runAutomationUnlocked(input);
  } finally {
    await releaseAutomationLease(input.ownerOpenId, input.projectChannelId);
  }
}

export async function prepareSavedWeeklyBatch(input: Omit<RunAutomationInput, "candidatePool" | "force" | "maxDrafts"> & { maxDrafts?: number }) {
  const pool = await loadSavedCandidatePool(input.ownerId, input.projectChannelId, input.maxDrafts ?? 30);
  return runAutomation({ ...input, force: true, maxDrafts: input.maxDrafts ?? 30, autoPublishOverride: false, candidatePool: pool });
}
