import { ALLOWED_READING_URL } from "@shared/const";
import { invokeLLM } from "./_core/llm";
import { ENV } from "./_core/env";
import { externalLlmConfigured, invokeExternalLLM } from "./external-llm";
import { classifyRisk, formatEditorialText, generateDraft, sanitizeCommentText, validateFinalDraft, type DraftType, type RiskLevel } from "./editorial";
import { buildEditorialSkillContext, hasContextualAnchor } from "./editorial-skill";

export type LlmEditorialInput = {
  videoTitle: string;
  videoTheme: string;
  commentText?: string;
  link?: string;
  responseOnly?: boolean;
  variationKey?: string;
  editorialContext?: string;
};

export type LlmEditorialOutput = {
  type: DraftType;
  text: string;
  containsLink: boolean;
  riskLevel: RiskLevel;
  justification: string;
};

const schema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["A_video", "B_reply", "C_link"] },
    text: { type: "string" },
    containsLink: { type: "boolean" },
    riskLevel: { type: "string", enum: ["low", "medium", "high", "critical"] },
    justification: { type: "string" },
  },
  required: ["type", "text", "containsLink", "riskLevel", "justification"],
  additionalProperties: false,
};

const compactText = (value: string | undefined, maxLength: number) => value?.replace(/\s+/g, " ").trim().slice(0, maxLength);

export function compactEditorialInput(input: LlmEditorialInput): LlmEditorialInput {
  return {
    videoTitle: compactText(input.videoTitle, 240) ?? "",
    videoTheme: compactText(input.videoTheme, 1200) ?? "",
    commentText: compactText(input.commentText, 1600),
    link: input.link === ALLOWED_READING_URL ? input.link : undefined,
    responseOnly: Boolean(input.responseOnly),
    variationKey: compactText(input.variationKey, 80),
    editorialContext: compactText(input.editorialContext, 6000),
  };
}

export async function generateEditorialDraft(input: LlmEditorialInput): Promise<LlmEditorialOutput> {
  const safeInput = compactEditorialInput(input);
  const skillContext = buildEditorialSkillContext(safeInput.editorialContext, `${safeInput.videoTitle} ${safeInput.videoTheme} ${safeInput.commentText ?? ""}`, safeInput.link);
  const risk = classifyRisk([safeInput.videoTheme, safeInput.commentText].filter(Boolean).join(" "));
  if (risk.riskLevel === "high" || risk.riskLevel === "critical") {
    return generateDraft(safeInput);
  }

  if (process.env.AI_EDITORIAL_ENABLED !== "1") {
    return generateDraft(safeInput);
  }

  let response;
  try {
    const useExternal = process.env.AI_EDITORIAL_PROVIDER === "external" && externalLlmConfigured();
    const invoke = useExternal ? invokeExternalLLM : invokeLLM;
    response = await invoke({
      model: process.env.AI_EDITORIAL_MODEL || (useExternal ? ENV.externalLlmModel : undefined),
      messages: [
        {
          role: "system",
          content: `${skillContext}\n\nVocê é o editor de acolhimento que executa essa skill. Entregue um texto de 320 a 680 caracteres sem contar o bloco de leitura. A resposta precisa apontar um detalhe concreto do título, descrição ou comentário recebido; se não houver âncora suficiente, não invente uma. Trate comentários com várias hashtags, “link na bio”, “acompanhe mais”, “meu canal”, “suscríbete” ou chamada semelhante como possível voz do criador, não como dor de uma pessoa; nesse caso, use somente o contexto do vídeo. Quando a leitura for pertinente, a estrutura pode dizer que um texto curto chegou ao narrador em um momento em que precisava de um respiro e foi recebido de alguém, mas só use primeira pessoa se isso estiver confirmado na memória editorial. Nunca mencione pago, grátis, preço, oferta ou escassez. Se não houver uma URL oficial no campo link, é proibido falar em ler, terminar, chegar ao final ou voltar depois de ler. Nesse caso, feche falando do próprio vídeo ou da conversa. Escreva como alguém comum comentando no YouTube, com frases naturais e pontuação básica. Não use travessão, meia-risca, ponto e vírgula, hífen decorativo, listas ou tom institucional. Tipo A é comentário geral sem link; Tipo B é resposta específica; Tipo C é comentário com a URL permitida, em bloco separado e identificado apenas como LECTURA CORTA. ${input.responseOnly ? "REGRA INEGOCIÁVEL: responda somente ao comentário citado, use type B_reply e nunca escreva um comentário geral do vídeo." : ""} Retorne somente o JSON solicitado.`,
        },
        {
          role: "user",
          content: JSON.stringify({ ...safeInput, safetySignals: risk.signals, rule: "acolhimento antes de alcance" }),
        },
      ],
        maxTokens: 360,
      response_format: {
        type: "json_schema",
        json_schema: { name: "cadena_editorial_draft", strict: true, schema },
      },
    });
  } catch {
    return generateDraft(safeInput);
  }

  const content = response.choices[0]?.message.content;
  if (typeof content !== "string") return generateDraft(safeInput);

  let parsed: LlmEditorialOutput;
  try {
    parsed = JSON.parse(content) as LlmEditorialOutput;
  } catch {
    return generateDraft(safeInput);
  }

  if (!parsed || typeof parsed.text !== "string" || typeof parsed.containsLink !== "boolean" || typeof parsed.type !== "string" || typeof parsed.riskLevel !== "string") {
    return generateDraft(safeInput);
  }
  parsed.text = formatEditorialText(sanitizeCommentText(parsed.text));

  const containsUnexpectedLink = /https?:\/\//i.test(parsed.text) && (!safeInput.link || !parsed.text.includes(safeInput.link));
  const missingContextualAnchor = !hasContextualAnchor(parsed.text, safeInput);
  const linkTypeValid = parsed.type === "C_link" || (Boolean(input.responseOnly) && parsed.type === "B_reply");
  const responseTypeBroken = Boolean(input.responseOnly) && parsed.type !== "B_reply";
  const linkContractBroken = parsed.containsLink !== Boolean(safeInput.link) || (parsed.containsLink && !linkTypeValid) || responseTypeBroken;
  const unsafeText = !validateFinalDraft({ text: parsed.text, riskLevel: parsed.riskLevel, containsLink: parsed.containsLink }).valid || containsUnexpectedLink;

  if (parsed.riskLevel !== "low" || linkContractBroken || unsafeText || missingContextualAnchor) return generateDraft(safeInput);
  if (parsed.containsLink && !parsed.text.includes(safeInput.link ?? "")) return generateDraft(safeInput);
  return parsed;
}
