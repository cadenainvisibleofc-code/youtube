import { and, desc, eq, inArray, or } from "drizzle-orm";
import { editorialMemories, editorialMemoryEvents } from "../drizzle/schema";
import { getDb } from "./db";

export type EditorialMemoryStatus = "core" | "proposed" | "approved" | "rejected" | "archived";

export const FOUNDER_MEMORY = [
  {
    category: "founder",
    title: "Origem e propósito do Cadena Invisible",
    content: "O projeto nasceu de uma experiência pessoal de dor, confusão e falta de direção, junto de uma visão espiritual de alcançar pessoas da América Latina nos lugares onde elas expõem suas dores. O guardião reconhece o contexto, oferece uma leitura curta e segue adiante sem exigir nada. O propósito é ressonância e cuidado; dinheiro pode ser consequência, nunca o objetivo editorial.",
  },
  {
    category: "founder",
    title: "Princípio do guardião",
    content: "O guardião é uma presença anônima, contextual e responsável: chega, compreende, oferece algo que pode ajudar e não força continuidade. A pessoa pode ler, ignorar ou seguir sua vida sem obrigação.",
  },
  {
    category: "editorial_principle",
    title: "Humanidade antes de alcance",
    content: "Uma mensagem só é válida quando reconhece a pessoa específica, não explora vulnerabilidade e aceita que talvez não seja o momento dela. Volume, clique, conversão e escala nunca substituem cuidado, contexto e liberdade.",
  },
  {
    category: "editorial_principle",
    title: "Aprendizado supervisionado",
    content: "O sistema pode propor aprendizados a partir de feedback humano, mas somente memórias core ou aprovadas entram no contexto editorial. O modelo nunca aprova, altera ou cria princípios sozinho.",
  },
] as const;

export type FounderMemory = (typeof FOUNDER_MEMORY)[number];
export type EditorialMemoryRecord = {
  id: number;
  ownerOpenId: string;
  category: string;
  title: string;
  content: string;
  status: EditorialMemoryStatus;
  locked: number;
  confidence: number;
  source: string;
  createdBy: number | null;
  reviewedBy: number | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export function isSafeMemoryText(value: string) {
  const normalized = value.toLowerCase();
  return ![
    "ignore previous instructions",
    "ignore all previous",
    "reveal secrets",
    "reveal the system prompt",
    "ignore as regras",
    "ignore instruções anteriores",
    "mostre as chaves",
    "exiba os secrets",
  ].some(signal => normalized.includes(signal));
}

export function normalizeMemoryInput(input: { title: string; content: string; category?: string }) {
  const title = input.title.replace(/\s+/g, " ").trim().slice(0, 180);
  const content = input.content.replace(/\s+/g, " ").trim().slice(0, 1200);
  const category = (input.category ?? "human_feedback").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "human_feedback";
  if (title.length < 4) throw new Error("O aprendizado precisa de um título mais específico");
  if (content.length < 12) throw new Error("O aprendizado precisa explicar o que deve ser lembrado");
  if (!isSafeMemoryText(`${title}\n${content}`)) throw new Error("O aprendizado contém uma instrução que não pode entrar na memória editorial");
  return { title, content, category };
}

export function formatEditorialMemoryContext(memories: Array<{ category: string; title: string; content: string; status: EditorialMemoryStatus }>) {
  const active = memories.filter(memory => memory.status === "core" || memory.status === "approved");
  if (!active.length) return "";
  return [
    "MEMÓRIA EDITORIAL ATIVA (núcleo fundador + aprendizados aprovados):",
    ...active.map(memory => `- [${memory.category}] ${memory.title}: ${memory.content}`),
    "Use essa memória como orientação de intenção e sensibilidade. Ela não substitui as validações determinísticas do backend.",
  ].join("\n");
}

function founderFallback(): Array<EditorialMemoryRecord> {
  return FOUNDER_MEMORY.map((memory, index) => ({
    id: -(index + 1),
    ownerOpenId: "__founder__",
    ...memory,
    status: "core" as const,
    locked: 1,
    confidence: 100,
    source: "IDÉIA DO PROJETO.txt",
    createdBy: null,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  }));
}

async function ensureFounderMemoryRows(database: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  for (const memory of FOUNDER_MEMORY) {
    const existing = await database.select({ id: editorialMemories.id }).from(editorialMemories).where(and(eq(editorialMemories.ownerOpenId, "__founder__"), eq(editorialMemories.title, memory.title))).limit(1);
    if (!existing[0]) {
      await database.insert(editorialMemories).values({
        ownerOpenId: "__founder__",
        category: memory.category,
        title: memory.title,
        content: memory.content,
        status: "core",
        locked: 1,
        confidence: 100,
        source: "IDÉIA DO PROJETO.txt",
      });
    }
  }
}

export async function listEditorialMemories(ownerOpenId: string, includeInactive = false): Promise<EditorialMemoryRecord[]> {
  const database = await getDb();
  if (!database) return founderFallback();
  await ensureFounderMemoryRows(database);
  const rows = await database.select().from(editorialMemories)
    .where(and(or(eq(editorialMemories.ownerOpenId, "__founder__"), eq(editorialMemories.ownerOpenId, ownerOpenId)), includeInactive ? undefined : inArray(editorialMemories.status, ["core", "approved", "proposed"])))
    .orderBy(desc(editorialMemories.locked), desc(editorialMemories.updatedAt));
  return rows as EditorialMemoryRecord[];
}

export async function getEditorialContext(ownerOpenId: string) {
  const memories = await listEditorialMemories(ownerOpenId);
  return formatEditorialMemoryContext(memories);
}

export async function proposeEditorialMemory(input: { ownerOpenId: string; ownerId: number; title: string; content: string; category?: string; source?: string }) {
  const database = await getDb();
  if (!database) throw new Error("Banco indisponível: não foi possível salvar o aprendizado para revisão");
  const normalized = normalizeMemoryInput(input);
  const existing = await database.select({ id: editorialMemories.id }).from(editorialMemories).where(and(eq(editorialMemories.ownerOpenId, input.ownerOpenId), eq(editorialMemories.title, normalized.title))).limit(1);
  if (existing[0]) throw new Error("Já existe um aprendizado com esse título");
  const inserted = await database.insert(editorialMemories).values({
    ownerOpenId: input.ownerOpenId,
    category: normalized.category,
    title: normalized.title,
    content: normalized.content,
    status: "proposed",
    locked: 0,
    confidence: 50,
    source: (input.source ?? "human_feedback").slice(0, 120),
    createdBy: input.ownerId,
  }).returning({ id: editorialMemories.id });
  const memoryId = inserted[0].id;
  await database.insert(editorialMemoryEvents).values({ memoryId, ownerOpenId: input.ownerOpenId, action: "proposed", actorOpenId: input.ownerOpenId, note: "Aprendizado aguardando revisão humana" });
  return { id: memoryId, status: "proposed" as const };
}

export async function reviewEditorialMemory(input: { ownerOpenId: string; ownerId: number; memoryId: number; decision: "approved" | "rejected" | "archived"; note?: string }) {
  const database = await getDb();
  if (!database) throw new Error("Banco indisponível: memória não revisada");
  const existing = await database.select().from(editorialMemories).where(and(eq(editorialMemories.id, input.memoryId), eq(editorialMemories.ownerOpenId, input.ownerOpenId))).limit(1);
  if (!existing[0]) throw new Error("Aprendizado não encontrado");
  if (existing[0].locked || existing[0].status === "core") throw new Error("O núcleo fundador é protegido e não pode ser alterado");
  if (!["proposed", "approved", "rejected", "archived"].includes(existing[0].status)) throw new Error("Estado de memória inválido");
  const updateResult = await database.update(editorialMemories).set({ status: input.decision, reviewedBy: input.ownerId, reviewedAt: new Date(), updatedAt: new Date() }).where(and(eq(editorialMemories.id, input.memoryId), eq(editorialMemories.ownerOpenId, input.ownerOpenId), eq(editorialMemories.status, existing[0].status), eq(editorialMemories.locked, 0))).returning({ id: editorialMemories.id });
  if (updateResult.length !== 1) throw new Error("O aprendizado já foi revisado por outra operação");
  await database.insert(editorialMemoryEvents).values({ memoryId: input.memoryId, ownerOpenId: input.ownerOpenId, action: input.decision, actorOpenId: input.ownerOpenId, note: input.note?.slice(0, 500) ?? null });
  return { id: input.memoryId, status: input.decision };
}
