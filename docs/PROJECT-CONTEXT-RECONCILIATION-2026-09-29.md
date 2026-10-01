# Cadena Invisible — reconciliação do contexto recebido

**Fonte:** material complementar enviado em 29/09/2026.
**Uso:** alinhar visão, filosofia editorial e estado técnico real da reconstrução.

## Visão incorporada

O Cadena Invisible deve ser tratado como um projeto de acolhimento e ressonância, não como marketing agressivo. A regra central é **empatia antes de volume**: qualquer leitura externa ou caminho de contribuição deve ser secundário à utilidade, ao respeito e ao contexto da conversa.

O produto editorial deve evitar promessas milagrosas, diagnóstico clínico, pressão comercial, urgência artificial e linguagem de venda. Conteúdos relacionados a crise crítica, autolesão, ideação suicida imediata, violência extrema ou abuso devem receber bloqueio de link e tratamento de acolhimento/revisão humana conforme as regras editoriais existentes.

A ideia de cinco funções editoriais — curiosidade, caminho, racional, resposta e curadoria — é útil como taxonomia de rascunhos. Ela pode orientar tipos, regras de link, seleção de comentários e prompts, desde que cada interação continue contextual, não repetitiva e sujeita à revisão humana.

O calendário de garimpo semanal e preparação a partir do acervo também é compatível com a base recuperada: o código já possui descoberta, pool salvo, limites de canal e processamento separado. A cota exata da API não deve ser assumida como contrato sem confirmação atual da documentação oficial e da configuração do projeto.

## O que o pacote recuperado realmente confirma

A auditoria local confirma migrations até `0012_hard_runaways`, 20 tabelas, publicação automática bloqueada no MVP, outbox com lease/retry/idempotência/reconciliação, tratamento de `invalid_grant` para reautorização e configuração editorial externa opcional no servidor.

A base atual contém `channelProfiles`, mas `youtubeConnections.ownerOpenId` é único e o backend lê uma conexão por proprietário. Drafts, outbox e publications não têm um alvo explícito de canal de publicação. Portanto, o pacote recuperado **não confirma** a arquitetura de cinco canais, Brand Accounts, seletor “Enviar por”, Gemini 3.7 Flash via RelayModels nem 128 testes do checkpoint `232a1b7e`.

O texto recebido afirma que essas mudanças já estão no pacote, porém elas não foram encontradas na inspeção do ZIP e do código recuperados. Elas devem ser tratadas como especificação histórica desejada, não como funcionalidade instalada.

## Funcionalidade que não será implementada

Não será implementada automação de curtidas cruzadas, atrasos aleatórios ou qualquer comportamento desenhado para simular usuários orgânicos, manipular prova social ou evitar sistemas anti-spam. Também não será implementada uma cascata automatizada de comentários e links baseada em engajamento artificial.

A alternativa segura é permitir somente ações legítimas, limitadas e auditáveis: rascunhos contextualizados, aprovação humana, intervalo por canal, deduplicação, respeito ao criador, publicação manual controlada e reconciliação factual. Curtidas e demais ações de engajamento não devem ser automatizadas para fabricar popularidade.

## Contrato editorial operacional

| Área | Regra adotada |
|---|---|
| Acolhimento | Utilidade e empatia antes de qualquer link ou contribuição |
| Comercial | Sem venda agressiva, promessa, diagnóstico, urgência ou pressão |
| Crise | Bloquear CTA/link e encaminhar para revisão humana; não substituir suporte profissional |
| Criador | Uma interação por canal no intervalo configurado; sem repetição e sem invasão |
| Canais | O alvo deve ser explícito; seleção ambígua deve falhar |
| Publicação | Aprovação humana obrigatória; auto-publicação permanece desligada |
| Auditoria | Registrar decisão, canal, conteúdo, fonte, status e reconciliação |
| Engajamento | Sem automação de curtidas ou simulação de comportamento orgânico |

## Próxima implementação coerente

A especificação histórica será reconstruída em etapas: identidade permanente do projeto, perfis de canal por projeto, conexão OAuth por perfil, alvo de canal em draft/outbox/publication e seletor explícito na fila. Cada etapa terá migration, backfill, testes de isolamento e rollback.

Antes de qualquer conexão com o banco, o contrato deve ser validado contra o código recuperado. Os secrets da RelayModels, OAuth e banco continuam fora do código e fora dos relatórios.

## Validação das diretrizes técnicas adicionais

| Diretriz recebida | Estado no código recuperado | Decisão |
|---|---|---|
| AES-256-GCM para tokens | Confirmado em `server/youtube-oauth.ts`; payload guarda IV, tag e ciphertext | Preservar na migração por canal |
| Chave de 32 bytes | Confirmado, mas o código espera base64 decodificando para 32 bytes; o texto recebido menciona hexadecimal | Não converter nem rotacionar sem plano; documentar formato real do ambiente |
| `invalid_grant` | Confirmado no refresh; marca a conexão por `ownerOpenId` como `reauthorization_required` e impede uso | Reaplicar por `channelProfileId` no multicanal |
| Filtro de ruído | Parcialmente confirmado: `classifyConversationComment` classifica ruído por pergunta/exposição/tamanho e a automação só seleciona exposição/pedido de ajuda | Adicionar testes de casos curtos/emojis; não assumir limiar fixo de 15 caracteres sem validação histórica |
| Janela de 30 dias | Confirmada como configuração mínima e consulta em `drafts` + `videos.channelId`, considerando rascunhos não descartados | Migrar para alvo de projeto/canal e ampliar a auditoria para publicações/outbox |
| Parâmetro `fields` no YouTube v3 | Não encontrado nas chamadas atuais de `search`, `videos` e `commentThreads` | Pode ser otimização posterior, com testes de resposta e sem alterar semântica |

O ponto de `fields` é uma melhoria de eficiência, não uma autorização para alterar o fluxo sem testes. A mudança deve preservar todos os campos usados pelo parser: título, canal, publicação, descrição, duração, visualizações, comentários e dados de comentários.
