# Manifest de migrations Supabase — Cadena Invisible

**Projeto:** `PROJETO CADENA YOUTUBE`
**Project ref:** `thliiwlagdmnqjwzmiyt`
**Banco:** PostgreSQL 17
**Última verificação:** 2026-10-01

## Migrations registradas no Supabase

| Ordem | ID Supabase | Nome | Fonte versionada |
|---:|---|---|---|
| 1 | `20261001010124` | `pg_schema_part_1_types_and_core_tables` | `drizzle/pg/0000_pg_initial.sql` — tipos e tabelas core |
| 2 | `20261001010134` | `pg_schema_part_2_remaining_tables` | `drizzle/pg/0000_pg_initial.sql` — tabelas restantes |
| 3 | `20261001010151` | `pg_schema_part_3_constraints_indexes` | `drizzle/pg/0000_pg_initial.sql` — FKs e índices |
| 4 | `20261001010159` | `pg_schema_cleanup_duplicate_index` | limpeza aplicada no ambiente |
| 5 | `20261001010938` | `enable_rls_server_side_only` | RLS server-side-only |
| 6 | `20261001081227` | `integrity_and_outbox_fencing` | `drizzle/pg/0001_integrity_and_outbox_fencing.sql` |
| 7 | `20261001201800` | `security_function_search_path_hardening` | `drizzle/pg/0002_security_function_search_path_hardening.sql` |
| 8 | `20261001224419` | `source_comment_resonance` | `drizzle/pg/0003_source_comment_resonance.sql` — replyCount, resonanceScore e índice de ranking |
| 9 | `20261001232855` | `guardian_missions_and_assignments` | `drizzle/pg/0004_guardian_missions.sql` — missões de 1–5 guardiões, assignments, papéis e RLS |

## Regras de sincronização

- O nome e a ordem do Supabase devem ser registrados neste arquivo após cada aplicação.
- Nenhuma migration deve ser aplicada diretamente no painel sem receber fonte versionada no GitHub.
- Uma migration aplicada não deve ser editada; correções recebem novo arquivo.
- Antes da aplicação: backup, preflight e revisão de impacto.
- Depois da aplicação: confirmar lista de migrations, schema, RLS, advisors e auditoria de dados.
- O histórico MySQL/TiDB em `drizzle/*.sql` não faz parte deste manifest.

## Estado de dados auditado

- 1 projeto;
- 1 membro;
- 5 slots de canal;
- 5 conexões YouTube;
- 4 memórias editoriais;
- 0 drafts;
- 0 itens de outbox;
- 0 publicações.

## Segurança observada

- RLS habilitado nas 25 tabelas públicas.
- Nenhuma política pública; o acesso previsto é exclusivamente server-side.
- O advisor `rls_enabled_no_policy` permanece como informação esperada deste modelo, não como autorização para abrir acesso público.
- O hardening de `search_path` das quatro funções de trigger foi aplicado na migration 7.
- As tabelas `guardianMissions` e `guardianAssignments` foram criadas com RLS habilitado e sem políticas públicas; a verificação confirmou constraints, índices e colunas de distribuição.

Nenhum token, segredo ou texto privado é armazenado neste manifest.
