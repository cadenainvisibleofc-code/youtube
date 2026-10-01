# Auditoria final — Cadena Invisible — 2026-09-30

## Resultado executivo

**Commit de referência do código publicado:** `9eb109cb01e6a6610fa1a08707893249ce3dbd0e`

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
- `pnpm portability:check`: `ready`; `OWNER_OPEN_ID` permanece `pending-login` até o primeiro login/backfill.
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
