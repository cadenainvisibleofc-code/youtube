# Cadena Invisible — Leia primeiro

**Atualizado em:** 2026-10-01
**Fonte de código:** https://github.com/cadenainvisibleofc-code/youtube
**Banco primário:** Supabase `PROJETO CADENA YOUTUBE`
**Aplicação publicada:** https://cadenaiv-tqbkbmxw.manus.space

## Ordem correta

1. Leia este arquivo.
2. Leia o `README.md` do projeto.
3. Leia `PLANO-CUSTODIA-E-RECUPERACAO-2026-10-01.md` antes de trocar de conta, banco ou domínio.
4. Leia `SUPABASE-MIGRATION-MANIFEST-2026-10-01.md` antes de qualquer migration.
5. Leia `PRODUCTION-READINESS-CHECKLIST-2026-10-01.md` antes de considerar produção pronta.
6. Leia `PACTO-DOS-GUARDIOES-v1.md`, `METRICAS-DE-CUIDADO-E-COLABORACAO-v1.md` e `POLITICA-OPERACIONAL-E-CUIDADO-v2.md` antes de alterar regras editoriais.
7. Regra vigente: zero ou um guardião podem atuar sem link; com dois ou mais, exatamente um deve carregar a leitura contextual, sem linguagem de oferta, venda ou condução.

## Como o sistema funciona hoje

- A aplicação usa React, Express, tRPC, Drizzle e PostgreSQL/Supabase.
- O Supabase é a fonte primária dos dados.
- O GitHub é a fonte primária do código, testes, documentação e migrations.
- O sistema suporta até cinco canais por projeto.
- Uma mesma autorização Google pode fornecer vários canais.
- A automação pesquisa e prepara rascunhos; ela não publica automaticamente.
- Aprovação humana é obrigatória antes de qualquer publicação externa.
- A outbox possui idempotência, lease, fencing e reconciliação.
- Tokens YouTube ficam cifrados no banco; a chave de cifragem permanece somente no cofre.
- RLS está habilitado sem políticas públicas; o acesso ao banco é server-side-only.

## Como seguir uma mudança

1. Criar branch/commit no GitHub.
2. Rodar `pnpm check`, `pnpm test` e `pnpm build`.
3. Se houver banco: criar migration PostgreSQL versionada, fazer backup e executar preflight read-only.
4. Aplicar a migration no Supabase e atualizar o manifest.
5. Revisar regressões de canais, aprovação humana, outbox e métricas de cuidado.
6. Publicar somente depois dos gates.
7. Registrar o resultado nesta documentação.

## O que nunca fazer

- Não colocar secrets, tokens, cookies, dumps ou `.env` no Drive ou GitHub.
- Não usar o histórico como fonte atual.
- Não executar migrations MySQL/TiDB no Supabase.
- Não ativar autopublicação.
- Não trocar `YOUTUBE_TOKEN_ENCRYPTION_KEY` se tokens existentes precisarem continuar funcionando.
- Não apagar dados do Supabase sem backup verificado e plano de rollback.

## Organização do Drive

- **00 — ATUAL — USAR ESTA:** somente os documentos e pacote atualmente válidos.
- **01 — GUIAS — OPERAÇÃO:** guias estáveis de operação, governança e uso.
- **99 — HISTÓRICO — NÃO USAR:** versões antigas preservadas para recuperação, sem edição.

A pasta histórica é preservada porque exclusão permanente não é necessária para a limpeza e dificultaria a recuperação.
