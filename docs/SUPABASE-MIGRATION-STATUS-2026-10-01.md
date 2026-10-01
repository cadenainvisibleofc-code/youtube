# Cadena Invisible — Status da migração para Supabase

**Data:** 2026-10-01
**Projeto Supabase:** `PROJETO CADENA YOUTUBE`
**Destino:** PostgreSQL 17, schema `public`

## Concluído

O código foi convertido de Drizzle/MySQL-TiDB para Drizzle/PostgreSQL (`node-postgres`). Foram convertidos os upserts para `onConflictDoUpdate`, os retornos de IDs para `returning({ id })` e os retornos de linhas afetadas para os contratos PostgreSQL. Os scripts de auditoria e backfill também foram convertidos, e a dependência direta `mysql2` foi removida.

A migration PostgreSQL foi mantida isolada em `drizzle/pg/`, sem misturar o histórico MySQL/TiDB. O schema foi aplicado ao Supabase em migrations controladas: `pg_schema_part_1_types_and_core_tables`, `pg_schema_part_2_remaining_tables`, `pg_schema_part_3_constraints_indexes`, `pg_schema_cleanup_duplicate_index` e `enable_rls_server_side_only`.

A estrutura verificada no Supabase contém **23 tabelas, 25 enums, 23 FKs, 19 índices e zero linhas**. RLS está habilitado nas 23 tabelas, sem políticas públicas; o acesso pretendido é exclusivamente server-side.

## Cofre e runtime

O secret seguro `SUPABASE_DATABASE_URL` foi cadastrado no cofre do projeto WebDev e sincronizado. O runtime agora prefere `SUPABASE_DATABASE_URL` e mantém fallback compatível para `DATABASE_URL`. A senha nunca foi exposta no chat, arquivo ou comando.

O shell local mascara secrets protegidos como `*****REDACTED*****`. Por isso, `pnpm db:audit` executado diretamente neste terminal não consegue usar a URI real e falha antes da conexão, sem tocar no banco. O servidor de preview foi iniciado e o healthcheck respondeu normalmente, mas o smoke test tRPC de escrita retornou `Invalid URL` porque o processo recebeu o placeholder mascarado, não a URI real. A estrutura e o estado vazio foram validados diretamente pelo MCP do Supabase em modo read-only.

## Gates locais

`pnpm check`, `pnpm build`, `node --check scripts/audit-database.mjs` e `node --check scripts/backfill-project.mjs` passaram. A busca por referências MySQL executáveis não encontrou uso de `mysql2`, `mysql-core`, `mysqlTable`, `mysqlEnum`, `insertId` ou `affectedRows` no runtime/schema/scripts.

`pnpm portability:check` continua como `needs-attention` por secrets de produção independentes do Supabase: OAuth do YouTube, identidade pós-login e URI de callback ainda não configurados neste ambiente. Isso não invalida o schema Supabase, mas o teste end-to-end com a URI real exige um runtime gerenciado que não mascare o secret, normalmente um container publicado.

## Próxima fase

O banco está pronto para conexão server-side. O próximo passo operacional é executar o servidor WebDev no runtime gerenciado, que recebe o secret real, e verificar o healthcheck e uma operação read-only da aplicação. Depois disso, se desejado, o backfill de projeto/usuário deve ser feito separadamente, com `ALLOW_PROJECT_BACKFILL=1`, identidade confirmada e uma decisão explícita sobre quais dados históricos serão migrados. Nenhuma migração de dados foi feita; o Supabase permanece vazio.
