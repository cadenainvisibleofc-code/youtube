# Auditoria transversal — Fases 1 a 4

## Resultado executivo

Foram executadas cinco auditorias independentes sobre schema/migrations, autorização/OAuth, automação/outbox, frontend e qualidade de testes. A revisão encontrou riscos reais de integridade e regressões. Os riscos prioritários foram corrigidos nesta rodada e a base passou novamente por testes, TypeScript principal, TypeScript dos testes e build.

A validação final registrou **114 testes aprovados e 1 teste OAuth externo ignorado**, além de `pnpm check` completo e build de produção aprovado.

## Correções aplicadas

### Autorização e canais

`projectChannelId` agora é validado antes de criar ou alterar configurações de automação. A validação exige membro ativo com papel `owner` ou `editor`, projeto ativo e canal que não esteja pausado ou revogado. OAuth sem canal explícito usa somente canais graváveis; OAuth com canal explícito revalida a mesma associação no início e no callback.

O status de conexão por canal passou a filtrar `ownerOpenId`, evitando revelar a conexão de outro membro. O endpoint de integração não quebra quando há múltiplas conexões: retorna estado de seleção necessária. Viewers continuam podendo ver o canal, mas não podem selecioná-lo para ações de escrita ou OAuth na UI.

### Automação

O limite diário persistido deixou de ser ignorado: a execução calcula o saldo de drafts do dia por proprietário/canal antes de buscar e gerar novos drafts. Configurações globais duplicadas agora falham fechado em vez de escolher uma linha silenciosamente.

Também foi removido o filtro incorreto que comparava o canal de publicação com o canal de origem do vídeo. A automação pode descobrir vídeos de terceiros, mantendo o canal selecionado apenas como identidade de publicação.

### Outbox e concorrência

Antes do POST externo, um draft aprovado é reservado atomically para `publishing`; revisão, descarte ou edição posterior não pode vencer essa reserva. Após sucesso, o draft vai para `published`. Em falhas determinísticas, ele retorna a `approved`; em falhas incertas permanece protegido para reconciliação.

Itens `processing` cujo lease expirou voltam para `uncertain`. O limite de tentativas agora tem precedência sobre o estado incerto, evitando retentativas infinitas depois de `MAX_ATTEMPTS`.

### Interface

O CTA OAuth do cabeçalho agora inclui o canal selecionado. A regeneração humanizada também aceita e envia `projectChannelId`. A seleção persistida é sincronizada entre abas, canais removidos são limpos automaticamente e os botões de conexão possuem nomes acessíveis por canal.

### Cascatas e retenção

As FKs históricas de `editorialFeedback -> drafts`, `publicationEngagementEvents -> publications` e `editorialMemoryEvents -> editorialMemories` foram alteradas de `CASCADE` para `RESTRICT`. Assim, feedback, eventos de engajamento e trilhas de memória não desaparecem automaticamente quando um registro-pai é removido.

Foi removido o índice não único redundante de `youtubeConnections.projectChannelId`, mantendo o índice UNIQUE que já atende à consulta e à FK.

### Gates de testes

Foi criado `tsconfig.tests.json` e o script `check:tests`. O pipeline agora tipa também os testes backend `.test.ts`, que antes eram excluídos pelo `tsconfig` principal. A auditoria revelou e corrigiu três erros de tipagem existentes nos testes do YouTube/OAuth.

## Migrations novas

- `0016_safe_shotgun.sql`: remove o índice redundante de conexões.
- `0017_peaceful_cobalt_man.sql`: troca três FKs históricas de `CASCADE` para `RESTRICT`.

As migrations 0013–0017 foram geradas/auditadas sem `DROP TABLE`, `TRUNCATE` ou `DELETE FROM`. A 0016 contém apenas `DROP INDEX`; a 0017 remove e recria FKs com `ON DELETE restrict`.

## Riscos residuais e gates obrigatórios antes da produção

1. **Banco real:** nenhuma migration foi aplicada nesta conta porque não há `DATABASE_URL`. Antes de aplicar, fazer backup, verificar duplicidades em `automationSettings`, `youtubeConnections` e `projectChannels`, executar dry-run e confirmar o banco de destino.
2. **Conexões legadas:** `projectChannelId` nullable exige backfill somente quando `youtubeConnections.channelId` corresponder inequivocamente a `projectChannels.channelId` e o proprietário tiver associação válida. Casos ambíguos devem exigir reconexão.
3. **OAuth externo:** o smoke test real segue opt-in e foi ignorado sem credenciais. É obrigatório executar callback real em staging com usuário autorizado, escopos, nonce/cookie, canal errado, viewer, canal pausado e `invalid_grant`.
4. **Corrida de schedules:** a criação de Heartbeat ainda deve receber lock/CAS ou idempotência externa antes de habilitar múltiplos agendamentos concorrentes. O código atual não cria schedules sem ação do usuário, mas não se deve tratar a criação concorrente como resolvida.
5. **Lease longo da automação:** o lease de automação ainda não tem token de geração/renovação. Uma execução excepcionalmente longa pode exigir reforço com `leaseToken` e renovação antes de aumentar timeouts.
6. **Reconciliação periódica:** itens `succeeded` ainda podem ser verificados repetidamente; um cursor/`lastReconciledAt` pode ser adicionado quando houver volume real.

## Baseline

Snapshot anterior às correções: `/home/ubuntu/CADENA-INVISIBLE-AUDIT-BASELINE-2026-09-29.tar.gz`

SHA-256 do baseline: `57ab11bd250a74775da47339eb3e36ec5404d79ea5f61677cabc718929308c46`
