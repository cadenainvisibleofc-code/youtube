import { classifyConversationComment, classifyRisk, isMeaningfulPersonalComment } from "./editorial";

export type ResonanceCommentInput = {
  text: string;
  likeCount: number;
  replyCount: number;
  publishedAt?: Date;
};

export type ResonanceCommentScore = {
  score: number;
  classification: ReturnType<typeof classifyConversationComment>["classification"];
  riskLevel: ReturnType<typeof classifyRisk>["riskLevel"];
  signals: string[];
};

function cappedLog(value: number, cap: number, multiplier: number) {
  return Math.min(cap, Math.round(Math.log10(Math.max(0, value) + 1) * multiplier));
}

/**
 * Ranks the source conversation, never the performance of our own comment.
 * Popularity is evidence of community identification, not a substitute for
 * specificity, a real question, or a safe contextual response.
 */
export function scoreSourceComment(comment: ResonanceCommentInput): ResonanceCommentScore {
  const classification = classifyConversationComment(comment.text);
  const risk = classifyRisk(comment.text);
  const normalized = comment.text.trim();
  const signals: string[] = [];
  let score = cappedLog(comment.likeCount, 25, 10) + cappedLog(comment.replyCount, 20, 10);

  if (comment.likeCount > 0) signals.push(`${comment.likeCount} curtidas no comentário-fonte`);
  if (comment.replyCount > 0) signals.push(`${comment.replyCount} respostas na conversa-fonte`);
  if (comment.replyCount >= 3) score += 10;
  if (normalized.length >= 80) { score += 15; signals.push("situação específica descrita"); }
  else if (normalized.length >= 40) { score += 8; signals.push("fala com contexto suficiente"); }
  if (normalized.includes("?") || normalized.includes("¿")) { score += 12; signals.push("pergunta explícita"); }
  if (classification.classification === "help_request") { score += 15; signals.push("pedido real de ajuda"); }
  else if (classification.classification === "exposure") { score += 12; signals.push("exposição pessoal explícita"); }
  if (risk.riskLevel === "critical") score -= 100;
  else if (risk.riskLevel === "high") score -= 45;
  else if (risk.riskLevel === "medium") score -= 4;
  if (risk.riskLevel === "critical" || risk.riskLevel === "high") signals.push("risco exige bloqueio ou revisão reforçada");
  if (classification.classification === "noise") { score -= 20; signals.push("fala genérica ou sem contexto acionável"); }

  return { score: Math.max(0, Math.min(100, score)), classification: classification.classification, riskLevel: risk.riskLevel, signals };
}

export function rankSourceComments<T extends ResonanceCommentInput>(comments: T[]) {
  return comments
    .filter(comment => isMeaningfulPersonalComment(comment.text))
    .map(comment => ({ comment, resonance: scoreSourceComment(comment) }))
    .sort((left, right) => right.resonance.score - left.resonance.score || right.comment.likeCount - left.comment.likeCount || right.comment.replyCount - left.comment.replyCount);
}
