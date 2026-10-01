import { and, eq, lte, or, isNull, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { drafts, publicationEngagementEvents, publicationOutbox, publications, videos, chainEvents } from "../drizzle/schema";
import { getDb } from "./db";
import { publishYouTubeComment, fetchPublishedComment } from "./youtube-publisher";

const LEASE_MS = 5 * 60_000;
const MAX_ATTEMPTS = 5;

type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;

function requireDatabase(database: Database | null) {
  if (!database) throw new Error("Banco indisponível: outbox não pode executar");
  return database;
}

function isUncertainError(error: unknown) {
  return error instanceof Error && /timeout|network|fetch|não respondeu|nao respondeu|502|503|504/i.test(error.message);
}

async function renewPublicationLease(database: Database, outboxId: number, leaseToken: string) {
  const now = new Date();
  const lockedUntil = new Date(now.getTime() + LEASE_MS);
  const updated = await database.update(publicationOutbox).set({ lockedUntil, updatedAt: now }).where(and(eq(publicationOutbox.id, outboxId), eq(publicationOutbox.status, "processing"), eq(publicationOutbox.leaseToken, leaseToken))).returning({ id: publicationOutbox.id });
  return updated.length === 1;
}

export async function claimPublicationOutbox(ownerOpenId: string, limit = 10, projectChannelId?: number) {
  const database = requireDatabase(await getDb());
  const now = new Date();
  await database.update(publicationOutbox).set({ status: "uncertain", lockedUntil: null, nextAttemptAt: now, updatedAt: now }).where(and(
    eq(publicationOutbox.ownerOpenId, ownerOpenId),
    eq(publicationOutbox.status, "processing"),
    lte(publicationOutbox.lockedUntil, now),
    ...(projectChannelId === undefined ? [] : [eq(publicationOutbox.projectChannelId, projectChannelId)]),
  ));
  const rows = await database.select().from(publicationOutbox)
    .where(and(
      eq(publicationOutbox.status, "pending"),
      eq(publicationOutbox.ownerOpenId, ownerOpenId),
      ...(projectChannelId === undefined ? [] : [eq(publicationOutbox.projectChannelId, projectChannelId)]),
      lte(publicationOutbox.nextAttemptAt, now),
      or(isNull(publicationOutbox.lockedUntil), lte(publicationOutbox.lockedUntil, now)),
    ))
    .limit(Math.min(30, Math.max(1, limit)));
  const claimed = [];
  for (const row of rows) {
    const lockedUntil = new Date(now.getTime() + LEASE_MS);
    const leaseToken = randomUUID();
    const leaseVersion = row.leaseVersion + 1;
    const updated = await database.update(publicationOutbox).set({ status: "processing", lockedUntil, leaseToken, leaseVersion: sql`${publicationOutbox.leaseVersion} + 1`, attempts: row.attempts + 1, updatedAt: now })
      .where(and(eq(publicationOutbox.id, row.id), eq(publicationOutbox.status, "pending"), or(isNull(publicationOutbox.lockedUntil), lte(publicationOutbox.lockedUntil, now)))).returning({ id: publicationOutbox.id });
    if (updated.length === 1) claimed.push({ ...row, status: "processing" as const, leaseToken, leaseVersion, lockedUntil, attempts: row.attempts + 1 });
  }
  return claimed;
}

export async function processPublicationOutbox(ownerOpenId: string, limit = 10, projectChannelId?: number) {
  const database = requireDatabase(await getDb());
  const items = await claimPublicationOutbox(ownerOpenId, limit, projectChannelId);
  const result = { claimed: items.length, published: 0, uncertain: 0, failed: 0, reasons: [] as string[] };
  for (const item of items) {
    try {
      const source = await database.select({ draft: drafts, video: videos }).from(drafts).innerJoin(videos, eq(drafts.videoId, videos.id)).where(eq(drafts.id, item.draftId)).limit(1);
      if (!source[0]) throw new Error("Rascunho ou vídeo não encontrado");
      if (item.projectChannelId == null || source[0].draft.projectChannelId == null || item.projectChannelId !== source[0].draft.projectChannelId) throw new Error("Alvo de canal ausente ou divergente entre draft e outbox");
      const projectChannelId = item.projectChannelId ?? source[0].draft.projectChannelId ?? null;
      if (item.youtubeCommentId) {
        await reconcilePublicationOutbox(item.id, item.youtubeCommentId, ownerOpenId, item.leaseToken);
        continue;
      }
      if (source[0].draft.status === "approved") {
        const reserved = await database.update(drafts).set({ status: "publishing", updatedAt: new Date() }).where(and(eq(drafts.id, item.draftId), eq(drafts.status, "approved"))).returning({ id: drafts.id });
        if (reserved.length !== 1) throw new Error("Rascunho alterado antes da reserva de publicação");
      } else if (source[0].draft.status !== "publishing") {
        throw new Error("Somente rascunhos aprovados podem entrar no publisher");
      }
      if (!(await renewPublicationLease(database, item.id, item.leaseToken))) throw new Error("Lease da publicação expirou antes da chamada externa");
      const leaseRenewalTimer = setInterval(() => { void renewPublicationLease(database, item.id, item.leaseToken); }, Math.max(30_000, Math.floor(LEASE_MS / 3)));
      let published;
      try {
        published = await publishYouTubeComment({ ownerOpenId: item.ownerOpenId, projectChannelId, videoId: source[0].video.youtubeVideoId, parentCommentId: source[0].draft.parentCommentId, text: source[0].draft.text, idempotencyKey: item.idempotencyKey });
      } finally {
        clearInterval(leaseRenewalTimer);
      }
      await database.transaction(async transaction => {
        const existingPublication = await transaction.select({ id: publications.id }).from(publications).where(eq(publications.draftId, item.draftId)).limit(1);
        let publicationId: number;
        if (existingPublication[0]) {
          publicationId = existingPublication[0].id;
          await transaction.update(publications).set({ projectChannelId, youtubeCommentId: published.commentId, publishedAt: new Date(), verificationStatus: "pending", notes: `outbox:${item.idempotencyKey}` }).where(eq(publications.id, publicationId));
        } else {
          const inserted = await transaction.insert(publications).values({ draftId: item.draftId, videoId: source[0].video.id, projectChannelId, youtubeCommentId: published.commentId, parentCommentId: source[0].draft.parentCommentId, publishedAt: new Date(), verificationStatus: "pending", likeStatus: "pending_manual", notes: `outbox:${item.idempotencyKey}` }).returning({ id: publications.id });
          publicationId = inserted[0].id;
        }
        const finalized = await transaction.update(publicationOutbox).set({ status: "succeeded", youtubeCommentId: published.commentId, leaseToken: null, lockedUntil: null, lastError: null, updatedAt: new Date() }).where(and(eq(publicationOutbox.id, item.id), eq(publicationOutbox.status, "processing"), eq(publicationOutbox.leaseToken, item.leaseToken))).returning({ id: publicationOutbox.id });
        if (finalized.length !== 1) throw new Error("Lease da publicação foi perdido antes da finalização");
        await transaction.update(drafts).set({ status: "published", updatedAt: new Date() }).where(eq(drafts.id, item.draftId));
        await transaction.insert(chainEvents).values({ publicationId, eventType: "comment_published", source: "publication_outbox", metadata: JSON.stringify({ idempotencyKey: item.idempotencyKey }) });
      });
      result.published++;
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "erro desconhecido";
      const uncertain = isUncertainError(error);
      const exhausted = item.attempts >= MAX_ATTEMPTS;
      const nextStatus = exhausted ? "failed" : uncertain ? "uncertain" : "pending";
      await database.update(publicationOutbox).set({ status: nextStatus, leaseToken: null, lockedUntil: null, lastError: message, nextAttemptAt: new Date(Date.now() + (uncertain || exhausted ? 60 * 60_000 : 2 ** item.attempts * 60_000)), updatedAt: new Date() }).where(and(eq(publicationOutbox.id, item.id), eq(publicationOutbox.status, "processing"), eq(publicationOutbox.leaseToken, item.leaseToken)));
      if (!uncertain) await database.update(drafts).set({ status: "approved", updatedAt: new Date() }).where(and(eq(drafts.id, item.draftId), eq(drafts.status, "publishing")));
      result[uncertain && !exhausted ? "uncertain" : "failed"]++;
      result.reasons.push(`${item.idempotencyKey}: ${message}`);
    }
  }
  return result;
}

export async function requeueUncertainPublicationOutbox(ownerOpenId: string, outboxId: number, projectChannelId?: number) {
  const database = requireDatabase(await getDb());
  const updated = await database.update(publicationOutbox).set({
    status: "pending",
    leaseToken: null,
    lockedUntil: null,
    nextAttemptAt: new Date(),
    lastError: "Requeue manual confirmado pelo operador; reconciliação prévia recomendada",
    updatedAt: new Date(),
  }).where(and(
    eq(publicationOutbox.id, outboxId),
    eq(publicationOutbox.ownerOpenId, ownerOpenId),
    eq(publicationOutbox.status, "uncertain"),
    ...(projectChannelId === undefined ? [] : [eq(publicationOutbox.projectChannelId, projectChannelId)]),
  )).returning({ id: publicationOutbox.id });
  if (updated.length !== 1) throw new Error("Item incerto não encontrado ou já alterado");
  return { requeued: true, id: outboxId };
}

export async function reconcilePublicationOutbox(outboxId: number, youtubeCommentId: string, ownerOpenId: string, leaseToken?: string | null) {
  const database = requireDatabase(await getDb());
  const item = await database.select().from(publicationOutbox).where(and(eq(publicationOutbox.id, outboxId), eq(publicationOutbox.ownerOpenId, ownerOpenId), ...(leaseToken ? [eq(publicationOutbox.status, "processing"), eq(publicationOutbox.leaseToken, leaseToken)] : []))).limit(1);
  if (!item[0]) throw new Error("Item do outbox não encontrado");
  const status = await fetchPublishedComment({ ownerOpenId: item[0].ownerOpenId, projectChannelId: item[0].projectChannelId, commentId: youtubeCommentId });
  if (!status.exists) {
    await database.update(publicationOutbox).set({ status: "failed", youtubeCommentId, leaseToken: null, lockedUntil: null, lastError: "Comentário não localizado na reconciliação", updatedAt: new Date() }).where(and(eq(publicationOutbox.id, outboxId), ...(leaseToken ? [eq(publicationOutbox.status, "processing"), eq(publicationOutbox.leaseToken, leaseToken)] : [])));
    return { status: "missing" as const };
  }
  await database.update(publicationOutbox).set({ status: "succeeded", youtubeCommentId, leaseToken: null, lockedUntil: null, lastError: null, updatedAt: new Date() }).where(and(eq(publicationOutbox.id, outboxId), ...(leaseToken ? [eq(publicationOutbox.status, "processing"), eq(publicationOutbox.leaseToken, leaseToken)] : [])));
  const publication = await database.select({ id: publications.id }).from(publications).where(eq(publications.draftId, item[0].draftId)).limit(1);
  if (publication[0]) {
    await database.update(publications).set({ verificationStatus: "verified", youtubeCommentId, replyCount: status.replyCount }).where(eq(publications.id, publication[0].id));
    const recordEvent = async (eventType: "reply" | "mention" | "like" | "verified", externalEventId: string, metadata: Record<string, number | string>) => {
      const existing = await database.select({ id: publicationEngagementEvents.id }).from(publicationEngagementEvents).where(and(eq(publicationEngagementEvents.eventType, eventType), eq(publicationEngagementEvents.externalEventId, externalEventId))).limit(1);
      if (!existing[0]) await database.insert(publicationEngagementEvents).values({ publicationId: publication[0].id, eventType, externalEventId, metadata: JSON.stringify(metadata) });
    };
    await recordEvent("verified", `${youtubeCommentId}:verified`, { commentId: youtubeCommentId });
    if (status.replyCount > 0) {
      await recordEvent("reply", `${youtubeCommentId}:reply`, { commentId: youtubeCommentId, replyCount: status.replyCount });
      await database.insert(chainEvents).values({ publicationId: publication[0].id, eventType: "reply_count_observed", source: "youtube_reconciliation", metadata: JSON.stringify({ replyCount: status.replyCount }) });
    }
    if (status.likeCount > 0) await recordEvent("like", `${youtubeCommentId}:like`, { commentId: youtubeCommentId, likeCount: status.likeCount });
    if (status.mentionCount > 0) await recordEvent("mention", `${youtubeCommentId}:mention`, { commentId: youtubeCommentId, mentionCount: status.mentionCount });
  }
  return { status: "verified" as const, replyCount: status.replyCount, likeCount: status.likeCount, mentionCount: status.mentionCount };
}

export async function reconcilePublishedOutbox(ownerOpenId: string, limit = 30, projectChannelId?: number) {
  const database = requireDatabase(await getDb());
  const items = await database.select({ id: publicationOutbox.id, youtubeCommentId: publicationOutbox.youtubeCommentId, projectChannelId: publicationOutbox.projectChannelId })
    .from(publicationOutbox)
    .where(and(eq(publicationOutbox.ownerOpenId, ownerOpenId), eq(publicationOutbox.status, "succeeded"), ...(projectChannelId === undefined ? [] : [eq(publicationOutbox.projectChannelId, projectChannelId)])))
    .limit(Math.min(30, Math.max(1, limit)));
  const result = { checked: 0, verified: 0, missing: 0, replies: 0, likes: 0, mentions: 0, errors: [] as string[] };
  for (const item of items) {
    if (!item.youtubeCommentId) continue;
    try {
      const reconciliation = await reconcilePublicationOutbox(item.id, item.youtubeCommentId, ownerOpenId);
      result.checked++;
      if (reconciliation.status === "verified") {
        result.verified++;
        result.replies += reconciliation.replyCount;
        result.likes += reconciliation.likeCount;
        result.mentions += reconciliation.mentionCount;
      } else result.missing++;
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : "falha desconhecida");
    }
  }
  return result;
}
