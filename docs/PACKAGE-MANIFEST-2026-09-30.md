# Manifesto do pacote final — Cadena Invisible

**Commit de referência do código publicado:** `9eb109cb01e6a6610fa1a08707893249ce3dbd0e`
**Snapshot exato do pacote:** registrado em `RELEASE-METADATA.txt` dentro do ZIP
**Arquivos versionados incluídos:** 238
**Arquivos de código/schema/scripts incluídos:** 194
**Data do pacote:** 2026-09-30

## Incluído

O ZIP será gerado do checkout versionado com `git archive`, portanto conterá uma árvore única e consistente: `client/`, `server/`, `shared/`, `drizzle/`, `scripts/`, configurações de build, testes, assets necessários, README, template sanitizado, handoff e auditorias.

A cadeia de banco incluída será o baseline `drizzle/0000_initial_users.sql`, o snapshot `drizzle/meta/0000_snapshot.json`, o journal e as migrations ativas `0001` até `0017` em ordem numérica. O SQL histórico em `docs/legacy-migrations/` permanecerá somente como referência não executável.

## Excluído por segurança e portabilidade

- `.git/`, `node_modules/`, `dist/`, caches, logs locais e backups.
- `.env*`, `.project-config.json`, cookies, tokens, refresh tokens, chaves privadas, Client Secrets, API keys e dumps de banco.
- Artefatos de máquina/conta específicos que não são necessários para reconstrução.

## Primeiros passos para outra IA

1. Extrair o ZIP em uma pasta vazia.
2. Ler `README.md`, `docs/AI-HANDOFF-CADENA-INVISIBLE-2026-09-30.md`, `docs/FINAL-AUDIT-2026-09-30.md` e `SECRETS-TEMPLATE.txt`.
3. Criar o ambiente seguro e preencher secrets somente no cofre.
4. Executar `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm check`, `pnpm build` e `pnpm portability:check`.
5. Confirmar o banco e o journal antes de qualquer migration.
6. Fazer login, capturar `OWNER_OPEN_ID`, rodar backfill em dry-run e revisar ambiguidades.
7. Registrar o domínio atual no Google Cloud e testar OAuth em staging.

## Não considerar como concluído

O pacote não inventa que os riscos de lease/fencing da outbox, constraints compostas, backfill de dados legados e custódia de tokens entre membros estão resolvidos. Eles estão descritos no relatório final com a ordem recomendada de implementação.
