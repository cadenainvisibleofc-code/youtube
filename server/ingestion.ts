export type EligibilityInput = {
  publishedAt: Date;
  viewCount: number;
  commentCount: number;
  commentsEnabled?: boolean;
  language?: ContentLanguage;
  now?: Date;
};

export type ContentLanguage = "es" | "pt" | "en" | "other" | "unknown";

export type EligibilityResult = {
  eligible: boolean;
  emergingOpportunity: boolean;
  opportunityScore: number;
  status: "eligible" | "rejected" | "blocked";
  ageDays: number;
  reasons: string[];
};

export const ELIGIBILITY_POLICY_VERSION = "opportunity-first-v2";

const LANGUAGE_MARKERS = {
  es: ["¿", "qué", "cómo", "estás", "soledad", "propósito", "depresión", "historia", "dios", "sientes", "escucha", "nadie", "experiencia", "una", "para"],
  pt: ["você", "história", "resiliência", "não", "conheça", "sua", "está", "isso", "clique", "lição", "maior", "viver", "ajudou", "também", "depois"],
  en: ["the", "what", "how", "your", "only", "heal", "death", "relationship", "life", "story", "after"],
};

export function detectContentLanguage(title: string, description = ""): ContentLanguage {
  const text = `${title} ${description}`.toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const score = (markers: string[]) => markers.reduce((total, marker) => total + (text.includes(marker.normalize("NFD").replace(/[\u0300-\u036f]/g, "")) ? 1 : 0), 0);
  const scores = { es: score(LANGUAGE_MARKERS.es), pt: score(LANGUAGE_MARKERS.pt), en: score(LANGUAGE_MARKERS.en) };
  const ordered = Object.entries(scores).sort((left, right) => right[1] - left[1]);
  if (ordered[0][1] < 2 || ordered[0][1] === ordered[1][1]) return "unknown";
  return ordered[0][0] as ContentLanguage;
}

export function extractYouTubeVideoId(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") return parsed.pathname.slice(1).split("/")[0] || null;
    if (parsed.hostname === "youtube.com" || parsed.hostname.endsWith(".youtube.com")) {
      if (parsed.pathname === "/watch") return parsed.searchParams.get("v");
      if (parsed.pathname.startsWith("/shorts/")) return parsed.pathname.split("/")[2] || null;
      if (parsed.pathname.startsWith("/embed/")) return parsed.pathname.split("/")[2] || null;
    }
  } catch {
    return null;
  }
  return null;
}

export function evaluateEligibility(input: EligibilityInput): EligibilityResult {
  const now = input.now ?? new Date();
  const ageDays = Math.floor((now.getTime() - input.publishedAt.getTime()) / 86_400_000);
  const reasons: string[] = [];

  if (ageDays < 0) reasons.push("data de publicação está no futuro");
  if (ageDays > 30) reasons.push("vídeo fora da janela de descoberta de 30 dias");
  if (input.language && input.language !== "es") reasons.push(`idioma fora do espanhol: ${input.language}`);
  if (input.viewCount <= 0) reasons.push("métricas de alcance indisponíveis");
  if (input.commentCount < 5) reasons.push("conversa ainda insuficiente para leitura contextual");
  if (input.commentsEnabled === false) reasons.push("comentários desativados");

  if (reasons.some(reason => reason.includes("comentários desativados"))) {
    return { eligible: false, emergingOpportunity: false, opportunityScore: 0, status: "blocked", ageDays, reasons };
  }
  const commentsPerThousandViews = input.viewCount > 0 ? (input.commentCount / input.viewCount) * 1000 : 0;
  const emergingOpportunity = ageDays >= 0 && ageDays <= 7 && input.viewCount >= 1_000 && input.viewCount < 30_000 && input.commentCount >= 20 && commentsPerThousandViews >= 5;
  const conversationOpportunity = input.commentCount >= 5 && (ageDays <= 7 || commentsPerThousandViews >= 1.5);
  const opportunityScore = Math.round(Math.min(100, commentsPerThousandViews * 12 + Math.min(30, input.commentCount) + Math.max(0, 30 - ageDays)));
  if (emergingOpportunity) reasons.push("oportunidade emergente por engajamento proporcional");
  const hardReasons = reasons.filter(reason => reason !== "oportunidade emergente por engajamento proporcional");
  return {
    eligible: hardReasons.length === 0 && conversationOpportunity,
    emergingOpportunity,
    opportunityScore: hardReasons.length === 0 && conversationOpportunity ? opportunityScore : 0,
    status: hardReasons.length === 0 && conversationOpportunity ? "eligible" : "rejected",
    ageDays,
    reasons: hardReasons.length === 0 && conversationOpportunity ? reasons : [...hardReasons, ...(conversationOpportunity ? [] : ["conversa sem sinal suficiente de oportunidade"])],
  };
}
