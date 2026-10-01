# Cadena Invisible — auditoria técnica de recuperação

**Data:** 29/09/2026
**Base auditada:** pacote sanitizado `CADENA-INVISIBLE-PACOTE-LIMPO-2026-09-28.zip`
**Objetivo:** validar a base como cópia de desenvolvimento sem tocar em produção, credenciais ou banco externo.

## Gates executados

- `pnpm install --frozen-lockfile`: aprovado.
- `pnpm test`: aprovado após corrigir isolamento de `process.env` no teste OAuth; 19 arquivos e 104 testes aprovados. O teste que chama o endpoint de token do Google agora é explicitamente opt-in e fica skipped sem credenciais.
- `pnpm check`: aprovado.
- `pnpm build`: aprovado.
- Schema/migrations: 20 tabelas no `drizzle/schema.ts` e 20 tabelas no SQL; journal sequencial de `0000` a `0012_hard_runaways`.
- Integridade de migrations: foreign keys e ações `ON DELETE` revisadas; não há ação de exclusão em cascata sobre `users`, `videos`, `drafts` ou `publications`.
- `pnpm portability:check`: executa, mas permanece `needs-attention` porque nenhum dos 14 secrets está configurado no Sandbox e não há callback configurado localmente. Isso é esperado nesta fase.

## Correções feitas

1. O teste `server/youtube-oauth.test.ts` restaurava variáveis ausentes atribuindo `undefined` a `process.env`. Em Node isso pode resultar na string literal `"undefined"`, contaminando testes seguintes. Foi criada restauração que remove a variável quando ela não existia originalmente.
2. O teste `server/youtube-oauth-credentials.test.ts` exigia secrets de produção mesmo em CI local e podia falhar por ausência de configuração. Ele agora é um teste de integração opt-in, explicitamente skipped sem secrets.
3. Nenhuma credencial foi adicionada ao código, ao Sandbox ou ao ZIP.
4. Adicionado `server/channel-selection.ts`, um resolvedor puro que rejeita seleção ambígua, canal inexistente, duplicidade e conexão em reautorização. Foram adicionados cinco testes de contrato. A proteção ainda não foi ligada ao publisher porque a migration multicanal e o alvo de canal ainda precisam ser definidos em conjunto.

## Continuidade após suspensão da conta original

A conta original foi considerada indisponível. A base recuperada passou a ser a fonte oficial de reconstrução. Foram adicionados `docs/RECONSTRUCTION-PLAN-2026-09-29.md` e `docs/MULTICHANNEL-INVARIANTS.md`, sem alterar o banco ou habilitar publicação. A validação posterior passou com 108 testes, 1 teste OAuth externo opt-in ignorado sem secrets, TypeScript e build.

## Auditoria de cascatas e publicação

- `commentObservations -> videos`: `RESTRICT`.
- `drafts -> videos`: `RESTRICT`.
- `publications -> drafts/videos`: `RESTRICT`.
- `publicationOutbox -> drafts`: `RESTRICT`.
- Eventos de engajamento, feedback, métricas e anexos são dados derivados e usam `CASCADE` em seus pais apropriados.
- `chainEvents` e referências de revisão usam `SET NULL` quando o registro pai pode desaparecer.
- A publicação externa só é iniciada pelo endpoint autenticado `dashboard.publishApproved`, após o rascunho estar `approved` e existir na outbox. A automação força `autoPublish = 0`.
- A outbox usa lease, idempotency key, tentativa limitada e reconciliação. Ainda falta cobertura de integração da outbox contra um banco real vazio; não executar sem banco de teste controlado.

## Bloqueio funcional: o pacote não é o checkpoint multicanal

O schema atual define `youtubeConnections.ownerOpenId` como `UNIQUE` e a aplicação lê uma única conexão por proprietário. O OAuth salva apenas um `channelId` por `ownerOpenId`. Portanto, esta base **não suporta cinco canais por proprietário** sem uma migration e mudanças coordenadas em schema, backend, UI, publicação e reconciliação.

O checkpoint `232a1b7e`, a arquitetura multicanal e a informação de 128 testes aprovados não aparecem no Drive inventariado nem nos dois ZIPs recuperados. Não é seguro criar uma migration improvisada de cinco canais a partir do pacote `0012`, porque isso poderia divergir do contrato do checkpoint verdadeiro.

## Continuidade executada após a suspensão da conta

Foi criado um snapshot do baseline antes das alterações. A migration aditiva `0013_panoramic_spitfire.sql` cria apenas `projects`, `projectMembers` e `projectChannels`, com `RESTRICT` nas relações e sem `DROP`, `DELETE`, `TRUNCATE` ou alteração de tabelas legadas. O script `scripts/backfill-project.mjs` é transacional, idempotente, começa em dry-run e exige gates explícitos para aplicação.

Também foram adicionados o contrato de seleção ambígua de canais e parâmetros `fields` nas chamadas de `search`, `videos` e `commentThreads` da API oficial, preservando os campos usados pelo parser. A fase passou com 108 testes aprovados, 1 teste OAuth externo opt-in ignorado, TypeScript e build.

## Fase 2 — roteamento por canal

A migration `0014_fair_sharon_ventura.sql` e o código agora carregam `projectChannelId` no OAuth state, conexão, draft, outbox, publicação e reconciliação. A unicidade legada por `ownerOpenId` foi removida sem apagar linhas para permitir múltiplas conexões; a conexão é resolvida por proprietário + alvo quando informado, e o fallback legado falha fechado se houver ambiguidade. A Fase 2 terminou com 110 testes aprovados, 1 teste OAuth externo opt-in ignorado, TypeScript e build.

## Fase 3 — automação por canal

A migration `0015_magenta_lockheed.sql` adiciona escopo opcional por `projectChannelId` às configurações de automação. Lease, quota, intervalo mínimo, deduplicação, drafts, rotas de outbox e execução agendada foram adaptados para preservar esse escopo. Candidatos de canais diferentes são rejeitados quando há alvo selecionado, e a publicação automática continua bloqueada. A Fase 3 terminou com 113 testes aprovados, 1 teste OAuth externo opt-in ignorado, TypeScript e build.

## Fase 4 — painel de canais

O endpoint de integração agora lista canais e status individuais. A Home ganhou seletor persistente de canal, conexão OAuth direcionada ao `projectChannelId` escolhido e propagação do alvo para automação, agendamento, outbox e reconciliação. A Fase 4 terminou com 114 testes aprovados, 1 teste OAuth externo opt-in ignorado, TypeScript e build.

## Auditoria transversal pós-Fase 4

Foram executados cinco agentes independentes sobre schema, backend, automação/outbox, frontend e qualidade. Foram corrigidos: autorização owner/editor antes de gravar configurações; status de conexão filtrado por proprietário; múltiplas conexões no endpoint de integração; limite diário; filtro incorreto que descartava vídeos de terceiros; reserva CAS do draft antes de publicar; claims `processing` expirados; retentativas uncertain limitadas; OAuth do cabeçalho; regeneração por canal; sincronização entre abas; e cascatas históricas destrutivas.

As migrations `0016_safe_shotgun.sql` e `0017_peaceful_cobalt_man.sql` foram geradas e auditadas. O pipeline agora inclui `check:tests` através de `tsconfig.tests.json`. O resultado final foi 114 testes aprovados, 1 teste externo ignorado, checks e build aprovados. Riscos residuais dependentes de staging estão documentados em `docs/AUDIT-ALL-PHASES-2026-09-29.md`.

## Próximo gate seguro

1. Obter o pacote ou acesso ao projeto que contém `232a1b7e`.
2. Comparar schema, migrations, rotas, testes e UI desse checkpoint com esta base.
3. Criar banco TiDB/MySQL vazio na nova conta, sem apontar para produção.
4. Aplicar somente as migrations do checkpoint confirmado, em ordem, pelo executor gerenciado.
5. Configurar secrets no cofre. Como credenciais OAuth foram coladas em mensagem, rotacionar o client secret antes de uso e não registrá-lo em arquivos, logs ou chat.
6. Rodar a suíte completa do checkpoint, `check`, `build` e `portability:check` com configuração segura.
7. Validar os cinco canais individualmente, sem publicação automática, e somente depois testar publicação manual controlada.

## Não executado

Não houve conexão com banco, aplicação de migration, alteração no Drive, alteração no Google Cloud Console, reautorização OAuth, publicação no YouTube ou promoção para produção.
