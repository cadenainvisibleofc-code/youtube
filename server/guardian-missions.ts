import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb, requireDatabase } from "./db";
import { classifyRisk, canApproveDraft, validateFinalDraft } from "./editorial";
import { generateEditorialDraft } from "./llm-editorial";
import { getEditorialContext } from "./editorial-memory";
import { ALLOWED_READING_URL } from "@shared/const";
import { getProjectChannelsForOwner } from "./db";
import {
  chainEvents,
  drafts,
  guardianAssignments,
  guardianMissions,
  publicationOutbox,
  projectChannels,
  projects,
  projectMembers,
  users,
  videos,
} from "../drizzle/schema";

export const MAX_GUARDIANS_PER_MISSION = 5;

type GuardianRole = "presence" | "perspective" | "reading";

export type PrepareGuardianMissionInput = {
  ownerOpenId: string;
  ownerId: number;
  videoId: number;
  projectChannelIds: number[];
  sourceCommentId?: string;
  sourceCommentText?: string;
  resonanceScore?: number;
  targetCommentIds?: Array<string | undefined>;
};

function normalizeChannelIds(ids: number[]) {
  return Array.from(new Set(ids)).filter(id => Number.isInteger(id) && id > 0);
}

function roleForSequence(sequence: number, selectedCount: number): GuardianRole {
  if (selectedCount === 1) return "presence";
  if (sequence === 1) return "presence";
  if (sequence === 2) return "reading";
  return "perspective";
}

export function planGuardianRoles(count: number): GuardianRole[] {
  if (!Number.isInteger(count) || count < 1 || count > MAX_GUARDIANS_PER_MISSION) throw new Error("A missão precisa ter entre 1 e 5 guardiões");
  const roles: GuardianRole[] = [];
  for (let sequence = 1; sequence <= count; sequence++) roles.push(roleForSequence(sequence, count));
  return roles;
}

function roleInstructions(role: GuardianRole) {
  if (role === "reading") return "Você é o guardião da leitura: reconheça primeiro a sensação concreta e apresente a leitura oficial como algo que encontrou o narrador em fase semelhante. Nunca venda, ofereça ou conduza; o link deve ser uma reciprocidade curta e natural.";
  if (role === "presence") return "Você é o guardião da presença: acolha um detalhe concreto e deixe uma frase que ajude a pessoa a se sentir vista. Não use link nem repita a intenção de outro guardião.";
  return "Você é um guardião de perspectiva: acrescente uma observação humana nova, complementar e específica. Não use link, não faça eco promocional e não repita o que outro guardião já disse.";
}

export async function prepareGuardianMission(input: PrepareGuardianMissionInput) {
  const ids = normalizeChannelIds(input.projectChannelIds);
  if (ids.length < 1 || ids.length > MAX_GUARDIANS_PER_MISSION) throw new Error("Escolha entre 1 e 5 canais para a missão");

  const database = requireDatabase(await getDb());
  const video = (await database.select({ id: videos.id, title: videos.title, description: videos.description, riskLevel: videos.riskLevel }).from(videos).where(eq(videos.id, input.videoId)).limit(1))[0];
  if (!video) throw new Error("Vídeo não encontrado");

  const channels = await getProjectChannelsForOwner(input.ownerOpenId);
  const selectedChannels = ids.map(id => channels.find(channel => channel.id === id));
  if (selectedChannels.some(channel => !channel || !["connected", "pending"].includes(channel.status))) throw new Error("Todos os canais escolhidos precisam pertencer ao projeto e estar disponíveis");
  if (new Set(selectedChannels.map(channel => channel?.projectId)).size !== 1) throw new Error("Os guardiões sincronizados precisam pertencer ao mesmo projeto");

  const sourceText = input.sourceCommentText?.trim() || "";
  if (ids.length > 1 && !sourceText) throw new Error("Missões com múltiplos guardiões precisam de um comentário-fonte para manter o tom empático");
  const safety = classifyRisk(`${video.title}. ${video.description ?? ""}. ${sourceText}`);
  const safeForReading = safety.riskLevel !== "high" && safety.riskLevel !== "critical";
  const effectiveIds = ids.length > 1 && !safeForReading ? ids.slice(0, 1) : ids;
  const selectedCount = effectiveIds.length;
  const editorialContext = await getEditorialContext(input.ownerOpenId);
  const assignments: Array<{ channelId: number; role: GuardianRole; sequence: number; draft: { text: string; type: "A_video" | "B_reply" | "C_link"; containsLink: boolean; riskLevel: "low" | "medium" | "high" | "critical"; justification: string }; targetCommentId?: string }> = [];
  const plannedRoles = planGuardianRoles(selectedCount);

  for (let index = 0; index < effectiveIds.length; index++) {
    const sequence = index + 1;
    const role = plannedRoles[index];
    const targetCommentId = input.targetCommentIds?.[index] || input.sourceCommentId;
    const generated = await generateEditorialDraft({
      videoTitle: video.title,
      videoTheme: `${video.title}. ${video.description ?? ""}`,
      commentText: sourceText || undefined,
      interestShown: Boolean(sourceText),
      link: role === "reading" && safeForReading ? ALLOWED_READING_URL : undefined,
      responseOnly: Boolean(targetCommentId),
      variationKey: `guardian-mission-${input.videoId}-${sequence}-${role}`,
      editorialContext: `${editorialContext}\nMISSÃO SINCRONIZADA\nPapel: ${role}.\n${roleInstructions(role)}\nCada assignment deve soar como uma pessoa independente; nunca explique a estratégia.`,
    });
    const validation = validateFinalDraft({ text: generated.text, riskLevel: generated.riskLevel, containsLink: generated.containsLink });
    if (!validation.valid) throw new Error(`O texto do guardião ${sequence} não passou na validação editorial: ${validation.reason}`);
    if (role === "reading" && !generated.containsLink) throw new Error("O guardião da leitura não produziu o link contextual obrigatório; a missão não foi criada");
    if (role !== "reading" && generated.containsLink) throw new Error("Somente o guardião da leitura pode conter link");
    assignments.push({ channelId: effectiveIds[index], role, sequence, draft: generated, targetCommentId });
  }

  const projectId = selectedChannels.find(channel => channel)?.projectId;
  const inserted = await database.transaction(async transaction => {
    const mission = (await transaction.insert(guardianMissions).values({
      ownerId: input.ownerId,
      videoId: input.videoId,
      sourceCommentId: input.sourceCommentId ?? null,
      sourceCommentText: sourceText || null,
      resonanceScore: Math.max(0, Math.min(100, input.resonanceScore ?? 0)),
      requestedGuardianCount: ids.length,
      selectedGuardianCount: selectedCount,
      linkPolicy: selectedCount > 1 ? "exactly_one_when_multiple" : "none",
      status: "review",
    }).returning({ id: guardianMissions.id }))[0];
    if (!mission) throw new Error("Missão não pôde ser criada");

    for (const assignment of assignments) {
      const draft = (await transaction.insert(drafts).values({
        videoId: input.videoId,
        projectChannelId: assignment.channelId,
        parentCommentId: assignment.targetCommentId ?? null,
        type: assignment.draft.type,
        text: assignment.draft.text,
        containsLink: assignment.draft.containsLink ? 1 : 0,
        utmUrl: assignment.draft.containsLink ? ALLOWED_READING_URL : null,
        quoteVideo: video.title,
        quoteComment: sourceText || null,
        riskLevel: assignment.draft.riskLevel,
        justification: `Missão sincronizada ${mission.id}; papel ${assignment.role}. ${assignment.draft.justification}`,
        model: "guardian-mission-v1",
        status: "review",
        createdBy: input.ownerId,
        dedupeKey: `guardian-mission:${mission.id}:${assignment.sequence}`,
      }).returning({ id: drafts.id }))[0];
      if (!draft) throw new Error("Draft do guardião não pôde ser criado");
      await transaction.insert(guardianAssignments).values({
        missionId: mission.id,
        projectChannelId: assignment.channelId,
        draftId: draft.id,
        role: assignment.role,
        sequence: assignment.sequence,
        targetCommentId: assignment.targetCommentId ?? null,
        containsLink: assignment.draft.containsLink ? 1 : 0,
        status: "review",
      });
    }
    await transaction.insert(chainEvents).values({ eventType: "guardian_mission_prepared", source: "human_review", metadata: JSON.stringify({ missionId: mission.id, requestedCount: ids.length, selectedCount, projectId }) });
    return mission;
  });

  return { missionId: inserted.id, requestedGuardianCount: ids.length, selectedGuardianCount: selectedCount, linkAssignmentCount: selectedCount > 1 ? 1 : 0, reducedForSafety: selectedCount !== ids.length };
}

export async function listGuardianMissions(ownerId: number) {
  const database = requireDatabase(await getDb());
  const missions = await database.select({ mission: guardianMissions, videoTitle: videos.title }).from(guardianMissions).innerJoin(videos, eq(videos.id, guardianMissions.videoId)).where(eq(guardianMissions.ownerId, ownerId)).orderBy(asc(guardianMissions.createdAt)).limit(30);
  const output = [];
  for (const row of missions) {
    const assignments = await database.select({ assignment: guardianAssignments, draft: drafts, channelName: projectChannels.channelName }).from(guardianAssignments).innerJoin(drafts, eq(drafts.id, guardianAssignments.draftId)).innerJoin(projectChannels, eq(projectChannels.id, guardianAssignments.projectChannelId)).where(eq(guardianAssignments.missionId, row.mission.id)).orderBy(asc(guardianAssignments.sequence));
    output.push({ ...row.mission, videoTitle: row.videoTitle, assignments });
  }
  return output;
}

export async function approveGuardianMission(ownerId: number, missionId: number) {
  const database = requireDatabase(await getDb());
  return database.transaction(async transaction => {
    const mission = (await transaction.select().from(guardianMissions).where(and(eq(guardianMissions.id, missionId), eq(guardianMissions.ownerId, ownerId))).limit(1))[0];
    if (!mission) throw new Error("Missão não encontrada");
    if (["approved", "partially_published", "completed", "archived"].includes(mission.status)) throw new Error("A missão já foi encerrada ou aprovada");
    const rows = await transaction.select({ assignment: guardianAssignments, draft: drafts }).from(guardianAssignments).innerJoin(drafts, eq(drafts.id, guardianAssignments.draftId)).where(eq(guardianAssignments.missionId, missionId)).orderBy(asc(guardianAssignments.sequence));
    if (rows.length !== mission.selectedGuardianCount || rows.length < 1 || rows.length > MAX_GUARDIANS_PER_MISSION) throw new Error("A missão não possui todos os assignments esperados");
    const linkCount = rows.filter(row => Boolean(row.assignment.containsLink)).length;
    if ((rows.length > 1 && linkCount !== 1) || (rows.length === 1 && linkCount !== 0)) throw new Error("A missão precisa ter exatamente um link somente quando possui múltiplos guardiões");
    for (const row of rows) {
      if (!canApproveDraft({ currentStatus: row.draft.status, riskLevel: row.draft.riskLevel, containsLink: Boolean(row.draft.containsLink), text: row.draft.text })) throw new Error(`O draft ${row.draft.id} ainda não está apto para aprovação`);
      if (!validateFinalDraft({ text: row.draft.text, riskLevel: row.draft.riskLevel, containsLink: Boolean(row.draft.containsLink) }).valid) throw new Error(`O draft ${row.draft.id} falhou na validação final`);
    }
    const owner = (await transaction.select({ openId: users.openId }).from(users).where(eq(users.id, ownerId)).limit(1))[0];
    if (!owner) throw new Error("Usuário responsável não encontrado");
    for (const row of rows) {
      await transaction.update(drafts).set({ status: "approved", updatedAt: new Date() }).where(and(eq(drafts.id, row.draft.id), eq(drafts.status, row.draft.status)));
      await transaction.update(guardianAssignments).set({ status: "approved", updatedAt: new Date() }).where(eq(guardianAssignments.id, row.assignment.id));
      await transaction.insert(publicationOutbox).values({ draftId: row.draft.id, ownerOpenId: owner.openId, projectChannelId: row.assignment.projectChannelId, idempotencyKey: `draft:${row.draft.id}:approved`, status: "pending" }).onConflictDoUpdate({ target: publicationOutbox.draftId, set: { projectChannelId: row.assignment.projectChannelId, updatedAt: new Date(), lastError: null } });
    }
    await transaction.update(guardianMissions).set({ status: "approved", updatedAt: new Date() }).where(eq(guardianMissions.id, missionId));
    await transaction.insert(chainEvents).values({ eventType: "guardian_mission_approved", source: "human_review", metadata: JSON.stringify({ missionId, ownerId, assignmentCount: rows.length, linkCount }) });
    return { missionId, approvedAssignments: rows.length, linkAssignments: linkCount, status: "approved" as const };
  });
}
