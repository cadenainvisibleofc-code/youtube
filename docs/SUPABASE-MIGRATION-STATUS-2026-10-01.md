# Cadena Invisible — Status da migração para Supabase

**Data:** 2026-10-01
**Projeto Supabase:** `PROJETO CADENA YOUTUBE`
**Destino:** PostgreSQL 17, schema `public`

## Concluído

O código foi convertido de Drizzle/MySQL-TiDB para Drizzle/PostgreSQL (`node-postgres`). Foram convertidos os upserts para `onConflictDoUpdate`, os retornos de IDs para `returning({ id })` e os retornos de linhas afetadas para os contratos PostgreSQL. Os scripts de auditoria e backfill também foram convertidos, e a dependência direta `mysql2` foi removida.

A migration PostgreSQL foi mantida isolada em `drizzle/pg/`, sem misturar o histórico MySQL/TiDB. O schema foi aplicado ao Supabase em migrations controladas: `pg_schema_part_1_types_and_core_tables`, `pg_schema_part_2_remaining_tables`, `pg_schema_part_3_constraints_indexes`, `pg_schema_cleanup_duplicate_index` e `enable_rls_server_side_only`.

A estrutura verificada no Supabase contém **23 tabelas, 25 enums, 23 FKs, 19 índices e zero linhas**. RLS está habilitado nas 23 tabelas, sem políticas públicas; o acesso pretendido é exclusivamente server-side.

## Cofre e runtime

O secret seguro `SUPABASE_DATABASE_URL` foi cadastrado no cofre do projeto WebDev e sincronizado. A URI usa o Session Pooler IPv4 do Supabase, com caracteres especiais da senha percent-encoded. O runtime prefere `SUPABASE_DATABASE_URL` e mantém fallback compatível para `DATABASE_URL`. A senha não foi gravada em arquivo ou comando.

O shell local mascara secrets protegidos como `*****REDACTED*****`, portanto o auditor local não pode consumir a URI real. No entanto, o runtime publicado `https://cadenaiv-tqbkbmxw.manus.space` foi validado end-to-end: `/api/health` respondeu `200`, a operação tRPC `analytics.recordReadingVisit` inseriu uma linha no Supabase e a leitura direta confirmou os valores. Um segundo ciclo com o mesmo token confirmou `onConflictDoUpdate`, alterando `source`, `campaign`, `videoReference`, `secondsRead` e `completed`. Os dois registros temporários foram removidos; a verificação final retornou zero registros de smoke test.

## Gates locais

`pnpm check`, `pnpm build`, `node --check scripts/audit-database.mjs` e `node --check scripts/backfill-project.mjs` passaram. A busca por referências MySQL executáveis não encontrou uso de `mysql2`, `mysql-core`, `mysqlTable`, `mysqlEnum`, `insertId` ou `affectedRows` no runtime/schema/scripts.

`pnpm portability:check` continua como `needs-attention` por secrets de produção independentes do Supabase: OAuth do YouTube, identidade pós-login e URI de callback ainda não configurados neste ambiente. Isso não invalida a conexão Supabase. A validação confirmou o schema completo, RLS nas 23 tabelas, contagens sem dados de negócio e as operações de inserção/upsert exercitáveis sem autenticação. As rotas protegidas e CRUD de entidades editoriais continuam aguardando uma identidade de usuário e dados de teste deliberadamente preparados; não foram inventados registros reais.

## Próxima fase

O banco está pronto para conexão server-side e a conexão real foi comprovada. O próximo passo, se desejado, é configurar os secrets OAuth/identidade e fazer um backfill separado de projeto/usuário, com `ALLOW_PROJECT_BACKFILL=1`, identidade confirmada e uma decisão explícita sobre quais dados históricos serão migrados. Nenhuma migração de dados foi feita; o Supabase permanece vazio.
