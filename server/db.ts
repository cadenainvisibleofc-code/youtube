import { and, desc, eq, isNull, ne, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { randomUUID } from "node:crypto";
import { InsertUser, chainEvents, drafts, editorialFeedback, projectChannels, projectMembers, projects, publicationEngagementEvents, publicationOutbox, publications, readingVisits, users, videos, videoMetricSnapshots, youtubeConnections } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { canApproveDraft, generateDraft, isMeaningfulPersonalComment, validateFinalDraft } from "./editorial";
import { evaluateEligibility, extractYouTubeVideoId } from "./ingestion";
import { getEditorialContext } from "./editorial-memory";
import { generateEditorialDraft } from "./llm-editorial";
import { canReuseOAuthSlot } from "./channel-selection";

let _db: ReturnType<typeof drizzle> | null = null;

export class DatabaseUnavailableError extends Error {
  constructor(message = "Banco indisponível: operação não persistida") {
    super(message);
    this.name = "DatabaseUnavailableError";
  }
}

export async function getDb() {
  if (!_db && ENV.databaseUrl) {
    try {
      _db = drizzle(ENV.databaseUrl);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

function requireDatabase<T>(db: T | null | undefined): T {
  if (!db) throw new DatabaseUnavailableError();
  return db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Partial<InsertUser> = {};
  const textFields = ["name", "email", "loginMethod"] as const;

  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  values.lastSignedIn ??= new Date();
  updateSet.lastSignedIn ??= new Date();
  updateSet.updatedAt = new Date();

  await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

const demoDrafts = [
  {
    id: -1,
    videoId: -1,
    title: "Si Tienes Miedo A Estar Solo, Necesitas Escuchar Esto",
    channelName: "Crecimiento Consciente",
    videoUrl: "https://www.youtube.com/watch?v=IIoMdipFhY4",
    type: "A_video" as const,
    text: "El título habla de sentirse solo incluso estando acompañado. No quiero convertir eso en una frase bonita: a veces hay gente alrededor y, aun así, pedir ayuda parece demasiado difícil. Puedes quedarte con esa pregunta un momento, sin tener que responderla aquí.",
    containsLink: false,
    riskLevel: "low" as const,
    relevanceScore: 94,
    quote: "La conversación conecta directamente con soledad y propósito.",
    recommendation: "Acolhimento sem link",
    status: "review" as "review" | "approved" | "discarded" | "edited",
  },
  {
    id: -2,
    videoId: -2,
    title: "Oración de la mañana — comenzar el día con calma",
    channelName: "Oraciones amor a Jesús",
    videoUrl: "https://www.youtube.com/watch?v=c8GrteknOX8",
    type: "C_link" as const,
    text: "La oración de la mañana abre un espacio para hablar con Dios sin convertir las dudas en culpa. Hay una lectura corta sobre buscar sentido cuando por dentro todavía hay preguntas; dura 15–20 minutos y está aquí: https://tinyurl.com/cadenainvisible-lectura\n\nSi te sirve, puedes volver después y decirme qué te pareció, incluso si no conectó contigo.",
    containsLink: true,
    riskLevel: "low" as const,
    relevanceScore: 88,
    quote: "El video propone comenzar el día en conversación con Dios.",
    recommendation: "Revisar link antes de aprobar",
    status: "review" as "review" | "approved" | "discarded" | "edited",
  },
  {
    id: -3,
    videoId: -3,
    title: "Este Test Revelará el Don con el que Naciste",
    channelName: "Universo CarlJung",
    videoUrl: "https://www.youtube.com/watch?v=5k8yTF6_fW0",
    type: "B_reply" as const,
    text: "Leí que escribiste sobre ignorar una parte de ti. No sé qué hay detrás de esas palabras y no quiero inventarlo; a veces nombrar lo que evitamos ya cambia la forma de mirarlo. Si quieres, puedes quedarte con esa pregunta por ahora.",
    containsLink: false,
    riskLevel: "low" as const,
    relevanceScore: 82,
    quote: "Comentário identificado como exposição pessoal de baixo risco.",
    recommendation: "Resposta específica sem link",
    status: "review" as "review" | "approved" | "discarded" | "edited",
  },
];
let currentDemoDrafts = demoDrafts;

export async function getDashboardSnapshot(ownerId: number) {
  const db = await getDb();
  if (!db) {
    if (process.env.NODE_ENV === "production") throw new DatabaseUnavailableError("Banco indisponível: não é seguro exibir dados demo em produção");
    return buildDemoSnapshot();
  }

  try {
    const database = requireDatabase(db);
    const rows = await db
      .select({ draft: drafts, video: videos })
      .from(drafts)
      .leftJoin(videos, eq(drafts.videoId, videos.id))
      .where(eq(drafts.createdBy, ownerId))
      .orderBy(desc(drafts.createdAt))
      .limit(25);

    const mapped = rows.map(({ draft, video }) => ({
      id: draft.id,
      videoId: draft.videoId,
      title: video?.title ?? "Vídeo sem título",
      channelName: video?.channelName ?? "Canal não informado",
      videoUrl: video?.url ?? "#",
      type: draft.type,
      text: draft.text,
      containsLink: Boolean(draft.containsLink),
      riskLevel: draft.riskLevel,
      relevanceScore: video?.relevanceScore ?? 0,
      status: draft.status,
      quote: draft.type === "B_reply" ? draft.quoteComment ?? "Resposta sem comentário-fonte registrado." : draft.quoteVideo ?? "Contexto do vídeo não registrado.",
      recommendation: draft.type === "C_link" ? "Revisar link antes de aprovar" : "Acolhimento contextual",
    }));

    const [publicationRows, engagementRows] = await Promise.all([
      database.select({ id: publications.id, draftId: publications.draftId }).from(publications).innerJoin(drafts, eq(publications.draftId, drafts.id)).where(eq(drafts.createdBy, ownerId)),
      database.select({ eventType: publicationEngagementEvents.eventType }).from(publicationEngagementEvents).innerJoin(publications, eq(publicationEngagementEvents.publicationId, publications.id)).innerJoin(drafts, eq(publications.draftId, drafts.id)).where(eq(drafts.createdBy, ownerId)),
    ]);
    const engagementCounts = engagementRows.reduce<Record<string, number>>((counts, row) => { counts[row.eventType] = (counts[row.eventType] ?? 0) + 1; return counts; }, {});
    return {
      mode: "database" as const,
      metrics: { analyzed: mapped.length, candidates: mapped.length, pending: mapped.filter(item => item.status === "review").length, published: publicationRows.length, replies: engagementCounts.reply ?? 0, mentions: engagementCounts.mention ?? 0, likes: engagementCounts.like ?? 0, verified: engagementCounts.verified ?? 0, removed: engagementCounts.removed ?? 0 },
      drafts: mapped,
    };
  } catch (error) {
    console.error("[Database] Failed to load dashboard snapshot", error instanceof Error ? error.message : String(error));
    throw new DatabaseUnavailableError("Banco indisponível: não foi possível carregar a fila");
  }
}

function buildDemoSnapshot() {
  return {
    mode: "demo" as const,
    metrics: { analyzed: 48, candidates: 17, pending: currentDemoDrafts.filter(item => item.status === "review").length + 5, published: 5, replies: 2, mentions: 3, likes: 0, verified: 0, removed: 0 },
    drafts: currentDemoDrafts,
  };
}

export async function updateDraftReview(input: { id: number; ownerId: number; status: "approved" | "discarded" | "edited"; text?: string; projectChannelId?: number }) {
  const db = await getDb();
  if (input.id < 0) {
    const existing = currentDemoDrafts.find(draft => draft.id === input.id);
    if (!existing) throw new Error("Rascunho não encontrado");
    const finalText = input.text ?? existing.text;
    if (input.status !== "discarded" && !validateFinalDraft({ text: finalText, riskLevel: existing.riskLevel, containsLink: existing.containsLink }).valid) {
      throw new Error("O texto final não passou na validação editorial");
    }
    if (input.status === "approved" && !canApproveDraft({ currentStatus: existing.status, riskLevel: existing.riskLevel, containsLink: existing.containsLink, text: finalText })) {
      throw new Error("Este rascunho não pode ser aprovado no estado ou risco atual");
    }
    currentDemoDrafts = currentDemoDrafts.map(draft => draft.id === input.id
      ? { ...draft, status: input.status, ...(input.text !== undefined ? { text: input.text } : {}) }
      : draft);
    return { persisted: false, status: input.status };
  }

  const database = requireDatabase(db);
  try {
    const existing = await database.select({ status: drafts.status, riskLevel: drafts.riskLevel, containsLink: drafts.containsLink, text: drafts.text, projectChannelId: drafts.projectChannelId }).from(drafts).where(and(eq(drafts.id, input.id), eq(drafts.createdBy, input.ownerId))).limit(1);
    if (!existing[0]) throw new Error("Rascunho não encontrado");
    if (["publishing", "published", "discarded"].includes(existing[0].status)) throw new Error("Este rascunho não pode mais ser revisado neste estado");
    const finalText = input.text ?? existing[0].text;
    if (input.status !== "discarded" && !validateFinalDraft({ text: finalText, riskLevel: existing[0].riskLevel, containsLink: Boolean(existing[0].containsLink) }).valid) {
      throw new Error("O texto final não passou na validação editorial");
    }
    if (input.status === "approved" && !canApproveDraft({ currentStatus: existing[0].status, riskLevel: existing[0].riskLevel, containsLink: Boolean(existing[0].containsLink), text: finalText })) {
      throw new Error("Este rascunho não pode ser aprovado no estado ou risco atual");
    }
    const projectChannelId = input.projectChannelId ?? existing[0].projectChannelId ?? undefined;
    if (existing[0].projectChannelId != null && input.projectChannelId != null && input.projectChannelId !== existing[0].projectChannelId) {
      throw new Error("O rascunho já pertence a outro canal do projeto");
    }
    if (input.status === "approved" && projectChannelId === undefined) {
      throw new Error("Selecione um canal do projeto antes de aprovar o rascunho");
    }
    if (projectChannelId !== undefined) {
      const owner = await database.select({ openId: users.openId }).from(users).where(eq(users.id, input.ownerId)).limit(1);
      const target = owner[0] ? await getProjectChannelForOwner(owner[0].openId, projectChannelId) : undefined;
      if (!target) throw new Error("Canal do projeto não encontrado ou sem acesso");
    }
    return await database.transaction(async transaction => {
      const updateResult = await transaction.update(drafts).set({ status: input.status, projectChannelId: projectChannelId ?? null, ...(input.text !== undefined ? { text: input.text } : {}) }).where(and(eq(drafts.id, input.id), eq(drafts.createdBy, input.ownerId), eq(drafts.status, existing[0].status))).returning({ id: drafts.id });
      if (updateResult.length !== 1) throw new Error("O rascunho já foi alterado por outra operação");
      await transaction.insert(editorialFeedback).values({
        draftId: input.id,
        ownerId: input.ownerId,
        outcome: input.status,
        originalText: existing[0].text,
        finalText: input.status === "discarded" ? null : finalText,
        changeSummary: JSON.stringify({ edited: input.text !== undefined, originalLength: existing[0].text.length, finalLength: finalText.length }),
      });
      await transaction.insert(chainEvents).values({
        eventType: `draft_${input.status}`,
        source: "human_review",
        metadata: JSON.stringify({ draftId: input.id, ownerId: input.ownerId, hasEditedText: input.text !== undefined }),
      });
      if (input.status === "approved") {
        const owner = await transaction.select({ openId: users.openId }).from(users).where(eq(users.id, input.ownerId)).limit(1);
        if (!owner[0]) throw new Error("Usuário responsável não encontrado");
        await transaction.insert(publicationOutbox).values({
          draftId: input.id,
          ownerOpenId: owner[0].openId,
          projectChannelId: projectChannelId ?? null,
          idempotencyKey: `draft:${input.id}:approved`,
          status: "pending",
        }).onConflictDoUpdate({ target: publicationOutbox.draftId, set: { projectChannelId: projectChannelId ?? null, updatedAt: new Date(), lastError: null } });
      }
      return { persisted: true, status: input.status };
    });
  } catch (error) {
    if (error instanceof Error && (error.message === "Rascunho não encontrado" || error.message === "O texto final não passou na validação editorial" || error.message === "Este rascunho não pode ser aprovado no estado ou risco atual" || error.message === "Este rascunho não pode mais ser revisado neste estado" || error.message === "O rascunho já foi alterado por outra operação" || error.message === "Selecione um canal do projeto antes de aprovar o rascunho" || error.message === "Canal do projeto não encontrado ou sem acesso" || error.message === "O rascunho já pertence a outro canal do projeto")) throw error;
    console.error("[Database] Failed to update draft review", error instanceof Error ? error.name : "unknown");
    throw new DatabaseUnavailableError("Banco indisponível: revisão não persistida");
  }
}

export async function getProjectChannelsForOwner(ownerOpenId: string) {
  const database = requireDatabase(await getDb());
  return database.select({
    id: projectChannels.id,
    projectId: projectChannels.projectId,
    role: projectMembers.role,
    channelId: projectChannels.channelId,
    channelName: projectChannels.channelName,
    status: projectChannels.status,
    minInteractionIntervalDays: projectChannels.minInteractionIntervalDays,
  }).from(projectChannels)
    .innerJoin(projectMembers, eq(projectMembers.projectId, projectChannels.projectId))
    .innerJoin(projects, eq(projects.id, projectChannels.projectId))
    .where(and(eq(projectMembers.openId, ownerOpenId), eq(projectMembers.status, "active"), eq(projects.status, "active")));
}

export const MAX_PROJECT_CHANNELS = 5;

export async function getWritableProjectsForOwner(ownerOpenId: string) {
  const database = requireDatabase(await getDb());
  return database.select({ id: projects.id, name: projects.name }).from(projects)
    .innerJoin(projectMembers, eq(projectMembers.projectId, projects.id))
    .where(and(eq(projectMembers.openId, ownerOpenId), eq(projectMembers.status, "active"), or(eq(projectMembers.role, "owner"), eq(projectMembers.role, "editor")), eq(projects.status, "active")))
    .limit(MAX_PROJECT_CHANNELS + 1);
}

export async function createProjectForOwner(ownerOpenId: string, name = "Cadena Invisible") {
  const database = requireDatabase(await getDb());
  const cleanName = name.trim().slice(0, 180) || "Cadena Invisible";
  return database.transaction(async transaction => {
    const project = (await transaction.insert(projects).values({ slug: `cadena-${randomUUID().slice(0, 8)}`, name: cleanName, status: "active" }).returning({ id: projects.id, name: projects.name }))[0];
    if (!project) throw new Error("Projeto não pôde ser criado");
    await transaction.insert(projectMembers).values({ projectId: project.id, openId: ownerOpenId, role: "owner", status: "active" });
    return project;
  });
}

export async function organizeLegacyYouTubeConnection(ownerOpenId: string, name = "Cadena Invisible") {
  const database = requireDatabase(await getDb());
  return database.transaction(async transaction => {
    const legacy = await transaction.select().from(youtubeConnections).where(and(eq(youtubeConnections.ownerOpenId, ownerOpenId), isNull(youtubeConnections.projectChannelId))).limit(2);
    if (legacy.length > 1) throw new Error("Há múltiplas conexões legadas; a organização precisa ser feita manualmente");
    if (!legacy[0]) return null;
    const cleanName = name.trim().slice(0, 180) || "Cadena Invisible";
    const project = (await transaction.insert(projects).values({ slug: `cadena-${randomUUID().slice(0, 8)}`, name: cleanName, status: "active" }).returning({ id: projects.id, name: projects.name }))[0];
    if (!project) throw new Error("Projeto não pôde ser criado");
    await transaction.insert(projectMembers).values({ projectId: project.id, openId: ownerOpenId, role: "owner", status: "active" });
    const channel = (await transaction.insert(projectChannels).values({ projectId: project.id, channelId: legacy[0].channelId, channelName: legacy[0].channelName, status: legacy[0].status === "connected" ? "connected" : "reauthorization_required" }).returning({ id: projectChannels.id, projectId: projectChannels.projectId, channelId: projectChannels.channelId, channelName: projectChannels.channelName, status: projectChannels.status, minInteractionIntervalDays: projectChannels.minInteractionIntervalDays }))[0];
    if (!channel) throw new Error("Canal não pôde ser organizado");
    await transaction.update(youtubeConnections).set({ projectChannelId: channel.id, updatedAt: new Date() }).where(eq(youtubeConnections.id, legacy[0].id));
    return { project, channel };
  });
}

async function resolveWritableProjectForOwner(ownerOpenId: string, projectId?: number) {
  const available = await getWritableProjectsForOwner(ownerOpenId);
  const matches = projectId === undefined ? available : available.filter(project => project.id === projectId);
  if (matches.length !== 1) throw new Error(projectId === undefined ? "É necessário informar um projeto válido para adicionar o canal" : "Projeto não encontrado ou sem acesso");
  return matches[0];
}

export async function getProjectChannelByYouTubeChannelForOwner(ownerOpenId: string, projectId: number, channelId: string) {
  const database = requireDatabase(await getDb());
  const rows = await database.select({ id: projectChannels.id, projectId: projectChannels.projectId, channelId: projectChannels.channelId, channelName: projectChannels.channelName, status: projectChannels.status, minInteractionIntervalDays: projectChannels.minInteractionIntervalDays }).from(projectChannels)
    .innerJoin(projectMembers, eq(projectMembers.projectId, projectChannels.projectId))
    .innerJoin(projects, eq(projects.id, projectChannels.projectId))
    .where(and(eq(projectChannels.projectId, projectId), eq(projectChannels.channelId, channelId), eq(projectMembers.openId, ownerOpenId), eq(projectMembers.status, "active"), or(eq(projectMembers.role, "owner"), eq(projectMembers.role, "editor")), eq(projects.status, "active"), ne(projectChannels.status, "paused"), ne(projectChannels.status, "revoked")))
    .limit(1);
  return rows[0];
}

export async function createProjectChannelForOwner(input: { ownerOpenId: string; projectId?: number; channelId: string; channelName: string }) {
  const database = requireDatabase(await getDb());
  const project = await resolveWritableProjectForOwner(input.ownerOpenId, input.projectId);
  return database.transaction(async transaction => {
    const writable = await transaction.select({ id: projects.id }).from(projects)
      .innerJoin(projectMembers, eq(projectMembers.projectId, projects.id))
      .where(and(eq(projects.id, project.id), eq(projects.status, "active"), eq(projectMembers.openId, input.ownerOpenId), eq(projectMembers.status, "active"), or(eq(projectMembers.role, "owner"), eq(projectMembers.role, "editor"))))
      .limit(1);
    if (!writable[0]) throw new Error("Projeto não encontrado ou sem acesso");
    await transaction.execute(sql`SELECT id FROM projects WHERE id = ${project.id} FOR UPDATE`);
    const existing = await transaction.select({ id: projectChannels.id, projectId: projectChannels.projectId, channelId: projectChannels.channelId, channelName: projectChannels.channelName, status: projectChannels.status, minInteractionIntervalDays: projectChannels.minInteractionIntervalDays }).from(projectChannels)
      .where(and(eq(projectChannels.projectId, project.id), eq(projectChannels.channelId, input.channelId))).limit(1);
    if (existing[0]) {
      if (!canReuseOAuthSlot(existing[0].status)) throw new Error("Canal pausado ou revogado não pode ser reconectado");
      return existing[0];
    }
    const current = await transaction.select({ id: projectChannels.id }).from(projectChannels).where(and(eq(projectChannels.projectId, project.id), ne(projectChannels.status, "revoked"))).limit(MAX_PROJECT_CHANNELS);
    if (current.length >= MAX_PROJECT_CHANNELS) throw new Error("O projeto já possui o limite de cinco canais");
    const inserted = await transaction.insert(projectChannels).values({ projectId: project.id, channelId: input.channelId, channelName: input.channelName.slice(0, 255), status: "pending" }).returning({ id: projectChannels.id });
    const id = inserted[0].id;
    const created = await transaction.select({ id: projectChannels.id, projectId: projectChannels.projectId, channelId: projectChannels.channelId, channelName: projectChannels.channelName, status: projectChannels.status, minInteractionIntervalDays: projectChannels.minInteractionIntervalDays }).from(projectChannels).where(eq(projectChannels.id, id)).limit(1);
    if (!created[0]) throw new Error("Canal criado, mas não pôde ser lido");
    return created[0];
  });
}

export async function getProjectChannelForOwner(ownerOpenId: string, projectChannelId: number) {
  const database = requireDatabase(await getDb());
  const rows = await database.select({
    id: projectChannels.id,
    projectId: projectChannels.projectId,
    channelId: projectChannels.channelId,
    channelName: projectChannels.channelName,
    status: projectChannels.status,
    minInteractionIntervalDays: projectChannels.minInteractionIntervalDays,
  }).from(projectChannels)
    .innerJoin(projectMembers, eq(projectMembers.projectId, projectChannels.projectId))
    .innerJoin(projects, eq(projects.id, projectChannels.projectId))
    .where(and(
      eq(projectChannels.id, projectChannelId),
      eq(projectMembers.openId, ownerOpenId),
      eq(projectMembers.status, "active"),
      or(eq(projectMembers.role, "owner"), eq(projectMembers.role, "editor")),
      eq(projects.status, "active"),
      ne(projectChannels.status, "paused"),
      ne(projectChannels.status, "revoked"),
    )).limit(1);
  return rows[0];
}

export async function getWritableProjectChannelsForOwner(ownerOpenId: string) {
  const rows = await getProjectChannelsForOwner(ownerOpenId);
  return rows.filter(row => ["owner", "editor"].includes(row.role) && !["paused", "revoked"].includes(row.status));
}

export async function getProjectChannelStatuses(ownerOpenId: string) {
  const database = await getDb();
  if (!database) return [];
  const rows = await database.select({
    channel: projectChannels,
    memberRole: projectMembers.role,
    connection: youtubeConnections,
  }).from(projectChannels)
    .innerJoin(projectMembers, eq(projectMembers.projectId, projectChannels.projectId))
    .innerJoin(projects, eq(projects.id, projectChannels.projectId))
    .leftJoin(youtubeConnections, eq(youtubeConnections.projectChannelId, projectChannels.id))
    .where(and(eq(projectMembers.openId, ownerOpenId), eq(projectMembers.status, "active"), eq(projects.status, "active")));
  return rows.map(row => ({
    status: ["paused", "revoked"].includes(row.channel.status) ? row.channel.status : row.connection?.status ?? row.channel.status,
    id: row.channel.id,
    projectId: row.channel.projectId,
    channelId: row.channel.channelId,
    channelName: row.channel.channelName,
    reauthorizationRequired: row.channel.status !== "paused" && row.channel.status !== "revoked" && (row.connection?.status === "reauthorization_required" || row.channel.status === "reauthorization_required"),
    connected: row.channel.status !== "paused" && row.channel.status !== "revoked" && row.connection?.status === "connected",
    connectionId: row.connection?.id ?? null,
    canManage: row.memberRole === "owner" || row.memberRole === "editor",
  }));
}

export async function getYouTubeConnection(ownerOpenId: string, projectChannelId?: number) {
  const db = await getDb();
  if (!db) return undefined;
  const filters = projectChannelId === undefined
    ? eq(youtubeConnections.ownerOpenId, ownerOpenId)
    : eq(youtubeConnections.projectChannelId, projectChannelId);
  const result = await db.select().from(youtubeConnections).where(filters).limit(2);
  if (projectChannelId === undefined && result.length > 1) throw new Error("É necessário informar o canal quando há múltiplas conexões");
  return result[0];
}

export async function recordReadingVisit(input: { visitToken: string; source?: string; campaign?: string; videoReference?: string; secondsRead?: number; completed?: boolean }) {
  const database = requireDatabase(await getDb());
  const values = {
    visitToken: input.visitToken.slice(0, 80),
    source: (input.source ?? "direct").slice(0, 80),
    campaign: (input.campaign ?? "none").slice(0, 120),
    videoReference: (input.videoReference ?? "unknown").slice(0, 200),
    secondsRead: Math.max(0, Math.min(86_400, Math.floor(input.secondsRead ?? 0))),
    completed: input.completed ? 1 : 0,
    updatedAt: new Date(),
  };
  await database.insert(readingVisits).values(values).onConflictDoUpdate({ target: readingVisits.visitToken, set: { source: values.source, campaign: values.campaign, videoReference: values.videoReference, secondsRead: values.secondsRead, completed: values.completed, updatedAt: values.updatedAt } });
  return { persisted: true };
}

export async function getResonanceMetrics() {
  const database = requireDatabase(await getDb());
  const rows = await database.select().from(readingVisits).orderBy(desc(readingVisits.createdAt)).limit(10_000);
  return {
    visits: rows.length,
    completed: rows.filter(row => Boolean(row.completed)).length,
    averageSeconds: rows.length ? Math.round(rows.reduce((sum, row) => sum + row.secondsRead, 0) / rows.length) : 0,
    sources: rows.reduce<Record<string, number>>((counts, row) => { counts[row.source] = (counts[row.source] ?? 0) + 1; return counts; }, {}),
  };
}

export async function saveVideoMetricSnapshot(input: { videoId: number; viewCount: number; commentCount: number; likeCount?: number; opportunityScore: number }) {
  const database = requireDatabase(await getDb());
  await database.insert(videoMetricSnapshots).values({ videoId: input.videoId, viewCount: Math.max(0, input.viewCount), commentCount: Math.max(0, input.commentCount), likeCount: Math.max(0, input.likeCount ?? 0), opportunityScore: Math.max(0, Math.min(100, input.opportunityScore)) });
  return { persisted: true };
}

export async function markYouTubeReauthorizationRequired(ownerOpenId: string, reason: string, projectChannelId?: number) {
  const database = requireDatabase(await getDb());
  const filter = projectChannelId === undefined
    ? eq(youtubeConnections.ownerOpenId, ownerOpenId)
    : eq(youtubeConnections.projectChannelId, projectChannelId);
  await database.update(youtubeConnections).set({ status: "reauthorization_required", lastError: reason.slice(0, 500), updatedAt: new Date() }).where(filter);
}

export async function upsertYouTubeConnection(input: {
  ownerOpenId: string;
  projectChannelId?: number | null;
  channelId: string;
  channelName: string;
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string;
  tokenExpiresAt: Date;
  scopes: string;
  status?: "connected" | "reauthorization_required";
  lastError?: string | null;
}) {
  const db = requireDatabase(await getDb());
  const filter = input.projectChannelId == null
    ? eq(youtubeConnections.ownerOpenId, input.ownerOpenId)
    : eq(youtubeConnections.projectChannelId, input.projectChannelId);
  const existing = await db.select({ id: youtubeConnections.id }).from(youtubeConnections).where(filter).limit(1);
  const values = { ...input, projectChannelId: input.projectChannelId ?? null };
  if (existing[0]) {
    await db.update(youtubeConnections).set({
      projectChannelId: values.projectChannelId,
      channelId: values.channelId,
      channelName: values.channelName,
      accessTokenEncrypted: values.accessTokenEncrypted,
      refreshTokenEncrypted: values.refreshTokenEncrypted,
      tokenExpiresAt: values.tokenExpiresAt,
      scopes: values.scopes,
      status: values.status ?? "connected",
      lastError: values.lastError ?? null,
      updatedAt: new Date(),
    }).where(eq(youtubeConnections.id, existing[0].id));
  } else {
    await db.insert(youtubeConnections).values(values);
  }
  if (values.projectChannelId != null) {
    await db.update(projectChannels).set({ status: values.status === "reauthorization_required" ? "reauthorization_required" : "connected", channelId: values.channelId, channelName: values.channelName, updatedAt: new Date() }).where(eq(projectChannels.id, values.projectChannelId));
  }
  return { persisted: true };
}

export async function ingestManualVideo(input: { url: string; title?: string; channelName?: string; publishedAt?: Date; viewCount?: number; commentCount?: number; createdBy: number; ownerOpenId?: string; projectChannelId?: number }) {
  const videoId = extractYouTubeVideoId(input.url);
  if (!videoId) throw new Error("URL do YouTube inválida");

  const publishedAt = input.publishedAt ?? new Date();
  const eligibility = evaluateEligibility({
    publishedAt,
    viewCount: input.viewCount ?? 0,
    commentCount: input.commentCount ?? 0,
  });
  const db = requireDatabase(await getDb());
  if (input.projectChannelId !== undefined) {
    if (!input.ownerOpenId || !(await getProjectChannelForOwner(input.ownerOpenId, input.projectChannelId))) throw new Error("Canal do projeto não encontrado ou sem acesso");
  }

  try {
    const existing = await db.select({ id: videos.id }).from(videos).where(eq(videos.youtubeVideoId, videoId)).limit(1);
    if (existing.length > 0) {
      if (eligibility.eligible) await ensureDraftForVideo(db, existing[0].id, input, input.createdBy, input.projectChannelId);
      return { persisted: true, duplicate: true, videoId, eligibility };
    }

    const inserted = await db.insert(videos).values({
      youtubeVideoId: videoId,
      url: input.url,
      title: input.title ?? "Vídeo importado para triagem",
      channelId: `manual:${videoId}`,
      channelName: input.channelName ?? "Canal a identificar",
      publishedAt,
      viewCount: input.viewCount ?? 0,
      commentCount: input.commentCount ?? 0,
      source: "manual",
      eligibilityStatus: eligibility.status,
      relevanceScore: eligibility.eligible ? 50 : 0,
    }).returning({ id: videos.id });
    if (eligibility.eligible) await ensureDraftForVideo(db, inserted[0].id, input, input.createdBy, input.projectChannelId);
    return { persisted: true, duplicate: false, videoId, eligibility };
  } catch (error) {
    console.error("[Database] Failed to ingest video", error instanceof Error ? error.name : "unknown");
    throw new DatabaseUnavailableError("Banco indisponível: importação não persistida");
  }
}

const channelCtaSignals = ["link na bio", "link en bio", "acessa o link", "accede al enlace", "formação", "formacion", "inscreva-se", "suscríbete", "suscribete", "acompanhe mais", "sígueme", "sigueme", "meu canal", "mi canal", "youtube.com", "instagram.com"];

function isLikelyChannelCta(text: string | null | undefined) {
  if (!text) return false;
  const normalized = text.toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const hashtagCount = text.match(/#[\wÀ-ÿ-]+/g)?.length ?? 0;
  return hashtagCount >= 3 || channelCtaSignals.some(signal => normalized.includes(signal.normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
}

export async function regenerateHumanizedDrafts(ownerOpenId: string, ownerId: number, limit = 25, projectChannelId?: number) {
  const database = requireDatabase(await getDb());
  if (projectChannelId !== undefined && !(await getProjectChannelForOwner(ownerOpenId, projectChannelId))) throw new Error("Canal do projeto não encontrado ou sem acesso");
  const editorialContext = await getEditorialContext(ownerOpenId);
  const rows = await database.select({ draft: drafts, video: videos }).from(drafts).innerJoin(videos, eq(drafts.videoId, videos.id)).where(and(eq(drafts.createdBy, ownerId), projectChannelId === undefined ? isNull(drafts.projectChannelId) : eq(drafts.projectChannelId, projectChannelId), eq(drafts.status, "review"))).orderBy(desc(drafts.createdAt)).limit(Math.min(25, Math.max(1, limit)));
  let regenerated = 0;
  let skipped = 0;

  for (const { draft, video } of rows) {
    const sourceComment = draft.quoteComment && isMeaningfulPersonalComment(draft.quoteComment) && !isLikelyChannelCta(draft.quoteComment) ? draft.quoteComment : undefined;
    const videoTheme = [video.title, video.description ? video.description.slice(0, 1200) : "", sourceComment ? `Contexto conversacional observado: ${sourceComment}` : "Sem comentário pessoal confiável; trabalhar apenas a tensão do vídeo."].filter(Boolean).join(". ");
    const regeneratedDraft = await generateEditorialDraft({
      videoTitle: video.title,
      videoTheme,
      responseOnly: false,
      variationKey: `humanized-${draft.id}`,
      editorialContext,
    });
    const validation = validateFinalDraft({ text: regeneratedDraft.text, riskLevel: regeneratedDraft.riskLevel, containsLink: regeneratedDraft.containsLink });
    if (!validation.valid || regeneratedDraft.containsLink || regeneratedDraft.type !== "A_video") {
      skipped++;
      continue;
    }
    await database.update(drafts).set({ type: "A_video", text: regeneratedDraft.text, containsLink: 0, riskLevel: regeneratedDraft.riskLevel, quoteVideo: video.title, quoteComment: sourceComment ?? null, justification: `${regeneratedDraft.justification} Evidência: ${sourceComment ? "comentário conversacional" : "tensão do vídeo"}; CTA promocional descartada quando presente.`, model: "cadena-editorial-human-v2", status: "edited", updatedAt: new Date() }).where(and(eq(drafts.id, draft.id), eq(drafts.createdBy, ownerId), eq(drafts.status, "review")));
    regenerated++;
  }
  return { regenerated, skipped, inspected: rows.length };
}

async function ensureDraftForVideo(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, videoId: number, input: { title?: string; channelName?: string }, ownerId: number, projectChannelId?: number) {
  const existingDraft = await db.select({ id: drafts.id }).from(drafts).where(and(eq(drafts.videoId, videoId), eq(drafts.createdBy, ownerId), projectChannelId === undefined ? isNull(drafts.projectChannelId) : eq(drafts.projectChannelId, projectChannelId))).limit(1);
  if (existingDraft.length > 0) return;

  const title = input.title ?? "o vídeo importado";
  const draft = generateDraft({ videoTitle: title, videoTheme: input.channelName ? `${input.channelName} — ${title}` : title });
  await db.insert(drafts).values({
    videoId,
    projectChannelId: projectChannelId ?? null,
    type: draft.type,
    text: draft.text,
    containsLink: draft.containsLink ? 1 : 0,
    riskLevel: draft.riskLevel,
    quoteVideo: title,
    justification: draft.justification,
    model: "ruleset-v1",
    status: "review",
    createdBy: ownerId,
  });
}
