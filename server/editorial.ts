import { ALLOWED_READING_URL } from "@shared/const";

export type RiskLevel = "low" | "medium" | "high" | "critical";
export type DraftType = "A_video" | "B_reply" | "C_link";

const criticalTerms = ["suicid", "suicídio", "suicidio", "matarme", "quiero morir", "quero morrer", "violación", "violacao", "abuso", "maltrato", "emergência", "emergencia", "urgente", "no quiero vivir", "não quero viver"];
const highRiskTerms = ["violencia", "violência", "ameaça", "amenaza", "adicción", "adiccao", "autolesión", "autolesion", "autolesão", "diagnóstico", "diagnostico", "medicación", "medicacao", "pastillas", "remédios", "remedios", "menor de idade", "menor", "niño", "niña", "nino", "nina", "violência doméstica", "violencia doméstica", "agressão", "agresion"];
const exposureTerms = ["me pasa", "estoy solo", "no sé qué hacer", "necesito ayuda", "me siento", "desde que", "mi familia"];
const unsafeContentTerms = ["porn", "nudes", "desnuda", "desnudo", "sexo explícito", "sexual explícito", "pedofil", "abuso sexual", "odio racial", "racista", "xenófob", "xenofob", "homofób", "homofob", "misógin", "misogin", "terrorista", "matar a todos", "matar todos"];
const promotionalSignals = ["compre", "compra", "comprar", "venda", "vender", "venta", "oferta", "ofertas", "desconto", "descuentos", "descuento", "promocao", "promo", "pago", "pagar", "gratis", "gratuito", "gratuita", "free", "preco", "precio", "custo", "costo", "valor", "checkout", "produto", "producto", "servico", "servicio", "adquirir", "inversao", "inversion", "clique aqui", "haz clic", "garantido", "garantizado", "sem pressao", "sin presion", "sem insistir", "sin insistir", "cura", "diagnostico", "prescrevo", "prescribo", "publicidade", "publicidad", "marketing"];
const channelOwnerSignals = ["link na bio", "link en bio", "acessa o link", "accede al enlace", "acompanhe mais", "sígueme", "sigueme", "inscreva-se", "suscríbete", "suscribete", "meu canal", "mi canal", "youtube.com", "instagram.com", "formação", "formacion"];

function normalizeEditorialText(value: string) {
  return value.toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function includesAnyTerm(value: string, terms: string[]) {
  const normalized = normalizeEditorialText(value);
  return terms.some(term => normalized.includes(normalizeEditorialText(term)));
}

export function isAllowedOfficialProtectionUrl(value: string) {
  const configured = (process.env.OFFICIAL_PROTECTION_URLS ?? "").split(",").map(url => url.trim()).filter(Boolean);
  return configured.includes(value.replace(/[.,;!?]+$/, ""));
}

/** Detecta sinais de texto publicado pelo próprio canal, não de uma pessoa da conversa. */
export function isLikelyChannelOwnerComment(text: string | undefined) {
  if (!text) return false;
  const normalized = normalizeEditorialText(text);
  const hashtagCount = text.match(/#[\wÀ-ÿ-]+/g)?.length ?? 0;
  return hashtagCount >= 3 || channelOwnerSignals.some(signal => normalized.includes(normalizeEditorialText(signal)));
}

/** Só permite resposta ao comentário quando existe conteúdo pessoal ou pedido real de ajuda. */
export function isMeaningfulPersonalComment(text: string | undefined) {
  if (!text || isLikelyChannelOwnerComment(text)) return false;
  const classification = classifyConversationComment(text);
  return classification.classification === "exposure" || classification.classification === "help_request";
}

export function classifyRisk(text: string): { riskLevel: RiskLevel; signals: string[] } {
  const signals: string[] = [];
  if (includesAnyTerm(text, criticalTerms)) signals.push("indicador de crisis o urgencia");
  if (includesAnyTerm(text, highRiskTerms)) signals.push("tema sensible de alto riesgo");
  if (includesAnyTerm(text, exposureTerms)) signals.push("exposição pessoal explícita");
  if (includesAnyTerm(text, unsafeContentTerms)) signals.push("conteúdo abusivo, sexual ou de ódio");

  if (signals.some(signal => signal.includes("crisis"))) return { riskLevel: "critical", signals };
  if (signals.some(signal => signal.includes("alto riesgo"))) return { riskLevel: "high", signals };
  if (signals.some(signal => signal.includes("abusivo"))) return { riskLevel: "high", signals };
  if (signals.some(signal => signal.includes("exposição"))) return { riskLevel: "medium", signals };
  return { riskLevel: "low", signals };
}

export type ConversationClassification = "noise" | "conversation" | "exposure" | "help_request" | "risk";

export function classifyConversationComment(text: string): { classification: ConversationClassification; riskLevel: RiskLevel; exposureSignals: string[] } {
  const normalized = text.toLocaleLowerCase().trim();
  const risk = classifyRisk(normalized);
  const exposureSignals = exposureTerms.filter(term => normalized.includes(term));
  const asksForHelp = /\b(necesito ayuda|preciso de ajuda|¿?cómo sigo|como sigo|qué hago|o que faço|no sé qué hacer|não sei o que fazer)\b/i.test(normalized);
  const asksAQuestion = normalized.includes("?") || normalized.includes("¿");
  if (risk.riskLevel === "high" || risk.riskLevel === "critical") return { classification: "risk", riskLevel: risk.riskLevel, exposureSignals: [...risk.signals, ...exposureSignals] };
  if (asksForHelp) return { classification: "help_request", riskLevel: risk.riskLevel, exposureSignals: [...risk.signals, ...exposureSignals] };
  if (exposureSignals.length > 0) return { classification: "exposure", riskLevel: risk.riskLevel, exposureSignals: [...risk.signals, ...exposureSignals] };
  if (asksAQuestion || normalized.length >= 40) return { classification: "conversation", riskLevel: risk.riskLevel, exposureSignals: risk.signals };
  return { classification: "noise", riskLevel: risk.riskLevel, exposureSignals: risk.signals };
}

export function chooseDraftType(input: { hasPersonalExposure: boolean; riskLevel: RiskLevel; linkRequested?: boolean }): DraftType {
  if (input.riskLevel === "critical" || input.riskLevel === "high") return "A_video";
  if (input.hasPersonalExposure && input.riskLevel === "medium") return "B_reply";
  if (input.linkRequested && input.riskLevel === "low") return "C_link";
  return "A_video";
}

export function canApproveDraft(input: {
  currentStatus: "drafted" | "review" | "edited" | "approved" | "discarded" | "publishing" | "published" | "blocked";
  riskLevel: RiskLevel;
  containsLink: boolean;
  text?: string;
}) {
  if (input.currentStatus !== "review" && input.currentStatus !== "edited") return false;
  if (input.containsLink && input.riskLevel !== "low" && input.text === undefined) return false;
  if (input.text !== undefined && !validateFinalDraft({ text: input.text, riskLevel: input.riskLevel, containsLink: input.containsLink }).valid) return false;
  return true;
}

export function validateFinalDraft(input: { text: string; riskLevel: RiskLevel; containsLink: boolean }) {
  const text = sanitizeCommentText(input.text);
  if (!text) return { valid: false as const, reason: "O texto do rascunho não pode ficar vazio" };
  if (text.length > 5000) return { valid: false as const, reason: "O texto do rascunho excede o limite permitido" };

  const normalized = normalizeEditorialText(text);
  const urls = text.match(/https?:\/\/[^\s)]+/gi) ?? [];
  const hasAnyUrl = urls.length > 0;
  const normalizedUrls = urls.map(url => url.replace(/[.,;!?]+$/, ""));
  const hasAllowedUrl = normalizedUrls.every(url => url === ALLOWED_READING_URL || isAllowedOfficialProtectionUrl(url));
  const hasProtectionUrl = normalizedUrls.length > 0 && normalizedUrls.every(url => isAllowedOfficialProtectionUrl(url));
  const detectedRisk = classifyRisk(text).riskLevel;
  const riskRank: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2, critical: 3 };
  const effectiveRisk = riskRank[detectedRisk] > riskRank[input.riskLevel] ? detectedRisk : input.riskLevel;
  if (hasAnyUrl && !hasAllowedUrl) return { valid: false as const, reason: "O texto contém uma URL não permitida" };
  if (hasProtectionUrl && effectiveRisk !== "high" && effectiveRisk !== "critical") return { valid: false as const, reason: "Recursos oficiais de proteção só podem aparecer em contexto sensível" };
  if (hasProtectionUrl && !/recurso oficial|apoyo seguro|servicio local de emergencia|serviço local de emergência/i.test(text)) return { valid: false as const, reason: "O recurso de proteção precisa ser identificado como encaminhamento oficial" };
  if ((effectiveRisk === "high" || effectiveRisk === "critical") && !hasProtectionUrl) return { valid: false as const, reason: "O texto final exige revisão reforçada por risco" };
  if (input.containsLink && (!hasAllowedUrl || (!hasProtectionUrl && (effectiveRisk !== "low" || !text.includes(READING_BLOCK_MARKER))))) return { valid: false as const, reason: "O link só pode ser leitura oficial de baixo risco ou recurso de proteção em contexto sensível" };
  if (!input.containsLink && hasAnyUrl) return { valid: false as const, reason: "Este rascunho não pode conter link" };
  if (includesAnyTerm(text, promotionalSignals)) return { valid: false as const, reason: "O texto contém linguagem promocional ou promessa indevida" };
  if (includesAnyTerm(text, unsafeContentTerms)) return { valid: false as const, reason: "O texto contém ódio, abuso ou sexualização indevida" };
  return { valid: true as const };
}

export function sanitizeCommentText(value: string) {
  return value
    .replace(/^\s*```(?:json|markdown|text)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[—–]/g, "-")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

const EDITORIAL_MAX_BODY_CHARS = 1000;
const EDITORIAL_MAX_PARAGRAPHS = 3;
const EDITORIAL_MAX_SENTENCES = 6;
const READING_BLOCK_MARKER = "LECTURA CORTA";

function clipAtWordBoundary(value: string, maxChars: number) {
  if (value.length <= maxChars) return value;
  const clipped = value.slice(0, maxChars).replace(/\s+\S*$/, "").trim();
  return `${clipped.replace(/[,:;–—-]+$/, "")}…`;
}

/** Gives generated copy a readable cadence without changing its safety meaning. */
export function formatEditorialText(value: string) {
  const sanitized = sanitizeCommentText(value);
  if (!sanitized) return sanitized;

  const blocks = sanitized.split(/\n{2,}/).map(block => block.trim()).filter(Boolean);
  const readingBlockIndex = blocks.findIndex(block => block.includes(READING_BLOCK_MARKER));
  const readingBlock = readingBlockIndex >= 0 ? blocks[readingBlockIndex] : undefined;
  const bodyBlocks = blocks.filter((_, index) => index !== readingBlockIndex);
  const sentences = bodyBlocks.flatMap(block => {
    const matches = block.match(/[^.!?…]+(?:[.!?…]+|$)/g)?.map(sentence => sentence.trim()).filter(Boolean);
    return matches?.length ? matches : [block];
  }).slice(0, EDITORIAL_MAX_SENTENCES);
  const paragraphs: string[] = [];
  for (let index = 0; index < sentences.length && paragraphs.length < EDITORIAL_MAX_PARAGRAPHS; index += 2) {
    paragraphs.push(sentences.slice(index, index + 2).join(" "));
  }

  const body = clipAtWordBoundary(paragraphs.join("\n\n"), EDITORIAL_MAX_BODY_CHARS);
  return readingBlock ? `${body}\n\n${readingBlock}` : body;
}

const readingEndings = [
  "Cuando termines, si te nace, vuelve a este comentario y dime qué te pareció.",
  "Si llegas hasta el final, puedes volver por aquí y contarme qué parte resonó contigo.",
  "Después de leerla completa, vuelve a este comentario y dime qué te dejó.",
  "Cuando la termines, me gustaría saber qué encontraste en ella.",
];

const conversationEndings = [
  "Si te quedas con esa pregunta, vuelve luego y dime qué parte del video se te quedó contigo.",
  "Si algo de esto te mueve, puedes volver y contarme qué te hizo pensar.",
  "Me gustaría saber qué parte del tema te resonó, aunque también puede que no conecte contigo.",
  "Si vuelves a pensar en esto después, cuéntame qué fue lo que más se te quedó.",
];

function readingInvitation(context: string, link: string | undefined) {
  const variant = context.split("").reduce((total, character) => total + character.charCodeAt(0), 0) % readingEndings.length;
  const ending = readingEndings[variant];
  if (!link) return "";
  return `\n\nLECTURA CORTA\n${link}\n\n${ending}`;
}

function conversationInvitation(context: string) {
  const variant = context.split("").reduce((total, character) => total + character.charCodeAt(0), 0) % conversationEndings.length;
  return `\n\n${conversationEndings[variant]}`;
}

function contextSnippet(value: string | undefined, maxLength = 150) {
  if (!value) return "";
  const clean = sanitizeCommentText(value).replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength).replace(/\s+\S*$/, "").trim()}…`;
}

const ANCHOR_STOPWORDS = new Set([
  "sobre", "desde", "entre", "para", "porque", "quando", "donde", "hasta", "este", "esta", "esto", "esa", "ese", "como", "pero", "tambien", "tiene", "hace", "solo", "mais", "muito",
]);

function anchorDetails(input: { videoTitle: string; commentText?: string }) {
  const source = input.commentText || input.videoTitle;
  const words = sanitizeCommentText(source)
    .replace(/https?:\/\/\S+/gi, "")
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9áéíóúüñ]+/i)
    .filter(word => word.length >= 5 && !ANCHOR_STOPWORDS.has(word));
  const unique = Array.from(new Set(words)).slice(0, 3);
  return unique.length ? unique.join(", ") : contextSnippet(input.videoTitle, 90);
}

function contextualAnchor(input: { videoTitle: string; commentText?: string }, variationKey?: string) {
  const details = anchorDetails(input);
  const variant = (variationKey ?? "").split("").reduce((total, character) => total + character.charCodeAt(0), 0) % 4;
  if (input.commentText) {
    const openings = [
      `Me quedé pensando en esa mezcla de ${details}`,
      `Hay algo en esa combinación de ${details} que no suena a una frase al pasar`,
      `No me quedé solo con el tema del video; me llamó la atención cómo aparecen ${details}`,
      `La forma en que se cruzan ${details} abre una pregunta más grande que el comentario`,
    ];
    return openings[variant];
  }
  const openings = [
    `Más que repetir el título, me quedé con la tensión que deja entre ${details}`,
    `Ese título toca una pregunta concreta: qué hacemos con ${details}`,
    `Hay algo en la forma de plantear ${details} que merece una pausa`,
    `El tema no parece quedarse en ${details}; también deja abierta una inquietud`,
  ];
  return openings[variant];
}

export function generateDraft(input: { videoTitle: string; videoTheme: string; commentText?: string; link?: string; responseOnly?: boolean; interestShown?: boolean; variationKey?: string }): {
  type: DraftType;
  text: string;
  containsLink: boolean;
  riskLevel: RiskLevel;
  justification: string;
} {
  const context = [input.videoTheme, input.commentText, input.variationKey].filter(Boolean).join(" ");
  const classification = classifyRisk(context);
  const safeLink = input.link === ALLOWED_READING_URL ? input.link : undefined;
  const type = input.responseOnly ? "B_reply" : chooseDraftType({
    hasPersonalExposure: Boolean(input.commentText && classification.signals.some(signal => signal.includes("exposição"))),
    riskLevel: classification.riskLevel,
    linkRequested: Boolean(safeLink),
  });

  if (classification.riskLevel === "critical" || classification.riskLevel === "high") {
    return {
      type: "A_video",
      text: `${contextualAnchor(input, input.variationKey)}. No quiero reducir una situación delicada a una respuesta automática. Si hay riesgo inmediato, busca apoyo seguro y cercano en tu entorno o en un servicio local de emergencia.`,
      containsLink: false,
      riskLevel: classification.riskLevel,
      justification: "Tema sensible detectado: bloqueado cualquier diagnóstico, promesa o enlace promocional.",
    };
  }

  if (input.responseOnly && input.commentText) {
    const linkText = readingInvitation(context, safeLink);
    const closing = safeLink ? "Si esta lectura te sirve, puedes acercarte a ella sin tener que explicar nada." : "Puedes quedarte con esa pregunta por ahora, sin tener que resolverla aquí.";
    return {
      type: "B_reply",
      text: `${contextualAnchor(input, input.variationKey)}. No sé qué hay detrás de esas palabras y no quiero inventarlo.\n\nA veces poner algo en palabras ya cambia la forma de mirarlo. ${closing}${safeLink ? linkText : input.interestShown ? conversationInvitation(context) : ""}`,
      containsLink: Boolean(safeLink),
      riskLevel: classification.riskLevel,
      justification: safeLink ? "Resposta individual de baixo risco com link permitido e contextual." : "Exposição pessoal: resposta específica sem link.",
    };
  }

  if (type === "B_reply" && input.commentText) {
    return {
      type,
      text: `${contextualAnchor(input, input.variationKey)}. No sé qué hay detrás de esas palabras y no quiero inventarlo.\n\nA veces poner algo en palabras ya cambia la forma de mirarlo. Puedes quedarte con esa pregunta por ahora, sin tener que resolverla aquí.${input.interestShown ? conversationInvitation(context) : ""}`,
      containsLink: false,
      riskLevel: classification.riskLevel,
      justification: "Exposição pessoal de baixo risco: resposta específica sem link.",
    };
  }

  const linkText = readingInvitation(context, safeLink);
  const humanClosings = [
    "A veces una frase así no busca una respuesta perfecta. Solo deja ver que hay algo que todavía se está ordenando.",
    "Quizá por eso este tema encuentra eco: toca una parte que seguimos intentando entender, sin tenerla resuelta.",
    "No hace falta cerrar la idea ahora. Algunas preguntas necesitan quedarse un rato antes de encontrar palabras.",
    "Hay conversaciones que no piden una conclusión rápida. A veces solo necesitan un lugar para mirarlas con un poco más de honestidad.",
  ];
  const variant = (input.variationKey ?? context).split("").reduce((total, character) => total + character.charCodeAt(0), 0) % humanClosings.length;
  return {
    type,
      text: `${contextualAnchor(input, input.variationKey)}. ${humanClosings[variant]}${safeLink ? `\n\nHay una lectura corta que puede acompañar esa reflexión. Si te sirve, puedes verla y volver cuando quieras.${linkText}` : input.interestShown ? conversationInvitation(context) : ""}`,
    containsLink: Boolean(safeLink),
    riskLevel: classification.riskLevel,
    justification: safeLink ? "Link permitido apenas como exceção e após revisão humana." : "Acolhimento contextual sem link.",
  };
}
