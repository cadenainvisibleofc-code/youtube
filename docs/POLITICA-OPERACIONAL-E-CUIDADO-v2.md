# Política operacional e de cuidado v2

**Data:** 2026-10-01
**Escopo:** automação editorial multicanal do Cadena Invisible

## Guardrails invioláveis

Estas regras não são flexibilizadas por configuração, modelo ou canal:

- Não inventar fatos, falas, intenções, experiências ou resultados.
- Não diagnosticar, prometer cura, criar urgência artificial ou explorar vulnerabilidade.
- Não misturar canais, tokens, drafts, históricos ou filas.
- Não publicar automaticamente. Toda publicação externa exige aprovação humana explícita.
- Nunca expor secrets ou tokens.
- Não reativar silenciosamente canais pausados ou revogados.
- Não escolher um canal quando houver ambiguidade.
- Preservar histórico e evitar cascatas destrutivas.
- Em crise, violência, abuso ou risco médico, acolher, bloquear promoção e manter o caso em revisão reforçada.

## Configuração por canal

Cada canal pode ajustar operacionalmente:

- limite diário de rascunhos, de 1 a 150, com padrão de 30;
- cooldown contextual, de 0 a 365 dias, com padrão conservador de 30;
- consultas e subtemas de busca, até dez linhas;
- idioma e tom, quando esses campos estiverem disponíveis no perfil do canal;
- permissão de incluir o link oficial, sempre sujeita a risco baixo e validação;
- horários e agendamento.

O limite é por canal, não uma autorização para publicação automática. O sistema continua limitado pela cota do YouTube, pela elegibilidade, pela qualidade da evidência, pela deduplicação e pela revisão humana.

## Cooldown contextual

O cooldown não bloqueia um canal inteiro por 30 dias. Ele considera a mesma conversa operacional:

- o mesmo vídeo não deve receber novo rascunho no intervalo configurado;
- a mesma thread ou comentário-pai não deve ser abordada novamente no intervalo configurado;
- outro vídeo do mesmo canal pode ser considerado quando houver contexto diferente;
- a deduplicação continua protegendo contra repetição no mesmo dia.

## Busca e taxonomia

As consultas padrão cobrem solidão, propósito, ansiedade, esperança, fé, sentido, recomeço, pertencimento, luto, reconciliação, cansaço, mudança de vida, amadurecimento e esperança prática. O owner/editor pode acrescentar subtemas por canal.

A inclusão de novos princípios editoriais não ocorre automaticamente. Uma sugestão pode ser registrada como proposta, mas só memórias `core` ou `approved` entram no contexto editorial.

## Padrão de escrita

O padrão é flexível: normalmente 1 a 3 parágrafos curtos e 1 a 6 frases. O texto deve ser tão breve quanto possível para demonstrar compreensão sem parecer um anúncio, instituição ou texto acadêmico.

Pontuação normal é permitida quando melhora a clareza. Ornamentação, spam e linguagem corporativa continuam indesejáveis. Primeira pessoa é permitida para descrever algo verdadeiro e transparente do projeto, mas continua proibida como testemunho ou experiência pessoal inventada.

## Links e convites

- O link do projeto continua restrito ao endereço oficial configurado e a contexto de baixo risco.
- Link do próprio projeto não deve ser usado em crise ou vulnerabilidade intensa.
- Recursos oficiais de proteção ou emergência só podem ser adicionados quando houver uma URL oficial previamente autorizada e revisão humana.
- Convites de continuidade não são obrigatórios. O sistema só sugere uma continuação quando há interesse explícito, pedido de material ou resposta pessoal pertinente.
- Nenhuma resposta exige leitura, retorno, clique ou continuidade.

## Revisão por risco

| Nível | Conduta |
| --- | --- |
| Baixo | Contexto específico, sem oferta, revisão humana normal. |
| Médio | Resposta mais curta, sem link do projeto, revisão reforçada. |
| Alto | Não abordar automaticamente; encaminhar para revisão ou arquivar. |
| Crítico | Acolher com cuidado, sem promoção; considerar apenas recurso oficial de proteção revisado por humano. |

## Governança de aprendizado

O sistema pode identificar padrões e propor aprendizados, exemplos, subtemas e sinais de risco. Propostas ficam pendentes, não orientam textos e não alteram prompts, limites, princípios ou regras até decisão humana registrada.

Configuração operacional pode ser alterada por owner/editor autorizado. Prompt editorial e princípio do Pacto exigem revisão e registro. OAuth, tokens, permissões e banco seguem procedimento técnico separado.

> Ser rigoroso contra manipulação e flexível na forma humana de cuidar.
