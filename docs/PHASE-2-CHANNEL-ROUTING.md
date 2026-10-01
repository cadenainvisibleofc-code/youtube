# Fase 2 — roteamento seguro por canal

A Fase 2 integra `projectChannelId` sem confiar apenas em `ownerOpenId`.

## Alterações

- OAuth state assinado agora pode transportar `projectChannelId`.
- `/api/youtube/oauth/start?projectChannelId=<id>` valida o canal contra o projeto e o membro autenticado.
- Se houver mais de um canal disponível e nenhum alvo for informado, o OAuth é recusado para evitar conexão ambígua.
- No callback, o canal retornado pelo Google precisa coincidir com o `channelId` do perfil selecionado.
- Conexões YouTube podem ter múltiplas linhas por proprietário; a unicidade passou a ser o `projectChannelId` quando não nulo.
- `drafts`, `publicationOutbox` e `publications` carregam o alvo opcional.
- A aprovação de um draft pode fixar o canal e a outbox copia o mesmo alvo.
- O publisher resolve tokens pelo proprietário + canal e o tratamento de `invalid_grant` marca somente a conexão correspondente.
- Retries e reconciliação usam o mesmo alvo da outbox.
- Divergência entre alvo do draft e da outbox é rejeitada antes da publicação.
- Drafts e conexões legadas com `projectChannelId = NULL` continuam funcionando somente enquanto houver uma única opção; com múltiplas conexões, a seleção explícita passa a ser obrigatória.

## Migration 0014

`0014_fair_sharon_ventura.sql`:

- remove `youtubeConnections_ownerOpenId_unique` para permitir mais de uma conexão por proprietário;
- adiciona `projectChannelId` como coluna nullable, preservando linhas existentes;
- adiciona índices e foreign keys `RESTRICT` em drafts, conexões, outbox e publicações;
- não executa `DELETE`, `TRUNCATE`, `DROP TABLE` nem cascatas destrutivas.

A remoção do índice de unicidade não é uma remoção de dados. Mesmo assim, a migration não deve ser aplicada sobre produção sem primeiro executar backup, dry-run e validação de duplicidades.

## Estado operacional

A migration foi gerada e auditada, mas não foi aplicada porque esta conta ainda não possui `DATABASE_URL`. O backfill de projetos/canais continua separado e protegido. OAuth real, Brand Accounts e tokens não foram acessados nesta fase.
