# Auditoria final — Cadena Invisible — 2026-09-30

## Resultado executivo

**Commit de referência do código publicado:** `626fec8f504da49cf8b4fa02a834a998117ad345`

O checkout atual foi auditado por três revisões independentes: fluxo UI/OAuth, integridade de schema/migrations/outbox e completude do pacote de recuperação. A suíte atual passa com **125 testes**, `pnpm check`, `pnpm build` e `pnpm portability:check`.

A arquitetura normal está protegida contra seleção cruzada de canais, publicação sem revisão, cascatas históricas e corrida normal do limite de cinco. Ainda existem pontos que exigem decisão de produto ou hardening antes de afirmar exactly-once contra falhas externas. Eles estão documentados abaixo para não serem confundidos com tarefas concluídas.

## Correções aplicadas nesta rodada

### Interface e onboarding

- O projeto usado pelo botão é derivado nesta ordem: canal selecionado, canal gerenciável, qualquer canal visível, ou único projeto gravável.
- Com projeto gravável e zero canais, o painel pode mostrar `Adicionar conta`.
- Com projeto visível mas sem permissão, mostra `Sem permissão` em vez de desaparecer.
- Com OAuth incompleto, mostra `OAuth indisponível` e os nomes das configurações faltantes, sem valores.
- Falha da query de integração mostra erro e `Tentar novamente`.
- Canal pausado/revogado não é selecionável nem aparece como conectado operacionalmente.

### OAuth

- `isYouTubeOAuthConfigured()` e `youtubeOAuthConfigStatus()` usam a mesma regra de URI HTTPS/caminho.
- O estado exposto ao cliente informa apenas flags e nomes (`YOUTUBE_OAUTH_REDIRECT_URI inválida`, por exemplo).
- A chave de cifragem foi substituída pelo cartão protegido da plataforma; seu valor não está no código, logs ou pacote.

### Portabilidade

- `verify-portability.mjs` agora exige baseline `0000_initial_users.sql`, snapshot `0000` e migration final `0017_peaceful_cobalt_man.sql`, não apenas `0012`.
- O template sanitizado de ambiente foi acrescentado.
- O handoff para outra IA foi acrescentado e apontado no README.

## Auditoria de dados, cascatas e migrations

- FKs históricas relevantes são `RESTRICT` nas migrations finais.
- Não foram encontrados `DROP TABLE`, `TRUNCATE` ou deleções destrutivas nas migrations revisadas.
- `CASCADE`/`SET NULL` restantes são para dados derivados ou referências opcionais e precisam permanecer documentados.
- `UNIQUE(projectId, channelId)` evita duplicação do mesmo canal dentro do projeto.
- O limite de cinco slots ativos é garantido no helper transacional que bloqueia o projeto, mas não é uma constraint matemática do banco.
- A cadeia ativa é baseline 0000 + migrations 0001–0017. `docs/legacy-migrations/0000_exotic_felicia_hardy.sql` é somente histórico.

## Lacunas residuais — não ocultar no próximo handoff

### Alta: teto de cinco não é constraint de banco

O caminho normal usa lock transacional e conta slots não revogados. Escritas SQL ou futuros writers podem violar o contrato. Antes de criar uma migration, definir se cinco significa slots ativos ou cinco perfis históricos. A solução mais segura é modelar slots fixos ou uma constraint/mecanismo transacional que todos os writers usem.

### Alta: correspondência composta entre entidades

As FKs atuais garantem que cada ID exista, mas não garantem estruturalmente que `projectChannelId` e `channelId` sejam o mesmo alvo em conexão, draft, outbox e publicação. A aplicação compara esses valores em pontos críticos. Depois de auditar dados legados, considerar FKs/índices compostos e tornar alvos obrigatórios apenas após backfill seguro.

### Alta: backfill de dados legados

`scripts/backfill-project.mjs` cria projeto e membro, mas não consegue provar o canal de drafts, outbox e publicações antigas. Criar um backfill separado, idempotente e com dry-run/relatório: associar apenas quando projeto + `channelId` forem inequívocos; quarentenar linhas ambíguas; não inferir destino a partir de vídeo sem prova.

### Alta: lease e fencing da outbox

Um lote de 30 itens pode exceder o lease de cinco minutos. Falta renovação e token de fencing para impedir finalização por worker que perdeu o lease. Antes de operação crítica, processar item por item ou adicionar `leaseToken`/generation, renovar lease e exigir a geração na finalização.

### Alta: retry e estados incertos

Itens `failed` e alguns `publishing`/`uncertain` podem ficar sem caminho de recuperação automática. Criar requeue auditado, reconciliação de incerteza e testes para falha após POST, timeout e reinício do worker. Não prometer exactly-once para efeito externo no YouTube.

### Média: finalização local da publicação

Após chamada externa, várias gravações locais são separadas e `publications.draftId` não é unique. Auditar duplicatas, adicionar unique somente depois de deduplicar e envolver finalização local em transação idempotente.

### Média: custódia de token em projetos com vários membros

A autorização é do projeto/canal, mas buscas de conexão usam `ownerOpenId`. Um editor diferente pode ser autorizado no projeto e ainda não encontrar a credencial de outro membro. Decidir entre custódia compartilhada por slot ou restrição explícita ao membro custodiante; separar ator da ação e dono da credencial antes de múltiplos membros em produção.

## Validação executada

- `pnpm test`: 23 arquivos, 125 testes aprovados.
- `pnpm check`: aprovado.
- `pnpm build`: aprovado; há apenas aviso existente sobre script de configuração sem `type=module` e tamanho de chunk.
- `pnpm portability:check`: executado; permanece em `needs-attention` porque `OWNER_OPEN_ID` depende do primeiro login.
- Auditoria de literals de secrets: nenhum valor encontrado no código/documentação versionada.
- `git diff --check`: aprovado.
- Endpoints publicados verificados: `/api/health` e `/manus-routes.json`.

## Regras para não fazer

- Não commitar secrets, tokens, cookies, dumps ou `.project-config.json`.
- Não executar `pnpm db:push` cegamente em banco existente.
- Não reativar auto-publish.
- Não usar o SQL histórico em `docs/legacy-migrations/` como migration ativa.
- Não reatribuir drafts/outbox para outro canal para “fazer funcionar”.
- Não apagar histórico para corrigir inconsistência; usar quarentena, backfill auditável e `RESTRICT`.

## Rodada multicanal de continuidade — 2026-10-01

- O callback não reativa mais silenciosamente um slot `paused` ou `revoked`; esses estados são recusados no fluxo de reconexão/adicionar conta.
- Conexões vinculadas a `projectChannelId` passaram a ser custodiadas pelo slot do projeto, não pelo `ownerOpenId` do ator. Isso permite que owner/editor autorizados operem o mesmo canal sem criar conflito de unicidade ou parecer que o canal está desconectado.
- A ingestão manual de um mesmo vídeo agora deduplica por usuário e `projectChannelId`; canais diferentes podem manter drafts independentes.
- A regeneração de drafts valida o `projectChannelId` contra o membro owner/editor antes de consultar ou alterar dados.
- Foi criado o guia sanitizado `docs/GUIA-CONEXAO-5-CANAIS-YOUTUBE-v1.md`.

Os riscos de constraint matemática do teto de cinco, correspondência composta entre FKs, backfill ambíguo e exactly-once externo continuam abertos e não foram mascarados por esta rodada.

## Auditoria de lacunas — 2026-10-01

- Corrigido o bloqueio indevido que restringia uma rodada a um único vídeo por canal; o limite volta a ser o teto diário configurável por canal.
- Corrigido o cálculo de links para usar o limite efetivo, e não um teto implícito de 30 itens.
- O feedback humano agora registra motivo categorizado em `editorialFeedback.changeSummary` sem nova migration.
- A outbox renova o lease durante chamadas externas longas. Fencing token, finalização transacional completa e resolução automática segura de estados `uncertain` continuam abertos.

### Migration Supabase aplicada — 2026-10-01

- Preflight: zero duplicatas de publicação por draft, canais por projeto ou outbox por draft; nenhum projeto acima de cinco slots não revogados.
- Aplicada `integrity_and_outbox_fencing` no projeto `PROJETO CADENA YOUTUBE`.
- Pós-migration: `leaseToken`/`leaseVersion`, índices de FKs, unicidade de publicação, trigger de limite de cinco slots e triggers de consistência de canal confirmados.
- Estado preservado: 1 projeto, 1 membro, 5 canais, 5 conexões, 0 drafts, 0 outbox e 0 publicações.
- RLS permaneceu habilitado nas 23 tabelas, sem políticas públicas. Advisors agora mostram somente avisos informativos de índices ainda não usados; nenhuma policy pública foi criada.

## Auditoria somente leitura do Supabase — 2026-10-01

- Projeto confirmado: `PROJETO CADENA YOUTUBE`, ref `thliiwlagdmnqjwzmiyt`, região `sa-east-1`, estado `ACTIVE_HEALTHY`, PostgreSQL 17.
- Cinco migrations estão registradas: schema/types, tabelas restantes, constraints/índices, limpeza de índice duplicado e RLS server-side.
- As 23 tabelas públicas estão com RLS habilitado e sem políticas; isso mantém o acesso via servidor, conforme decisão do projeto.
- As colunas `projectChannelId` existem nas cinco entidades críticas auditadas.
- Contagens operacionais: projetos 0, membros 0, canais 0, drafts 0, outbox 0 e publicações 0.
- Há uma conexão YouTube legada com `projectChannelId = NULL`; access token e refresh token estão preenchidos como valores cifrados. Não há órfão referencial, e nenhum dado foi removido ou alterado.
- A reconciliação desse registro deve ocorrer somente após login e confirmação explícita de projeto/canal; não executar backfill inferencial.
- Advisor de segurança sinaliza corretamente as 23 tabelas com RLS sem políticas; advisor de performance sinaliza FKs sem índice de cobertura. Esses avisos não foram alterados nesta auditoria somente leitura.
