# Cadena Invisible — Painel de Ressonância

Painel privado de inteligência editorial para descobrir conversas públicas em espanhol, compreender o contexto do vídeo, criar rascunhos humanizados e submeter cada publicação à revisão humana.

> **Empatia antes de volume.** A publicação automática permanece bloqueada no MVP.

## Fonte de verdade

Os documentos datados abaixo registram o ZIP original em MySQL/TiDB e suas decisões de época; para o código e o banco de dados atuais, prevalecem o schema e as notas de migrations deste README.

- [Handoff completo para outra IA (2026-09-30)](./docs/AI-HANDOFF-CADENA-INVISIBLE-2026-09-30.md)
- [Auditoria final e lacunas conhecidas (2026-09-30)](./docs/FINAL-AUDIT-2026-09-30.md)
- [Guia de conexão de até cinco canais](./docs/GUIA-CONEXAO-5-CANAIS-YOUTUBE-v1.md)
- [Pacto dos Guardiões v1](./docs/PACTO-DOS-GUARDIOES-v1.md)
- [Métricas de cuidado e colaboração v1](./docs/METRICAS-DE-CUIDADO-E-COLABORACAO-v1.md)
- [Documento-mãe atual](./DOCUMENTO-MAE-CADENA-INVISIBLE-ATUAL-2026-09-28.md)
- [Checklist operacional](./docs/OPERATIONAL-CHECKLIST.md)
- [Checklist de rotação entre contas](./docs/ACCOUNT-ROTATION-CHECKLIST.md)
- [Runbook de portabilidade](./docs/PORTABILITY-RUNBOOK.md)
- [Inventário de portabilidade](./docs/PORTABILITY-INVENTORY.md)
- [Política de elegibilidade](./docs/ELIGIBILITY-POLICY-v2.md)
- [Playbook de descoberta semanal](./docs/WEEKLY-DISCOVERY-PLAYBOOK.md)

## Stack

React 19, TypeScript, Vite, Tailwind 4, Express 4, tRPC 11, Drizzle ORM, PostgreSQL (`pg`, preparado para Supabase), Manus Auth e YouTube Data API v3. `SUPABASE_DATABASE_URL` deve apontar para o PostgreSQL do Supabase, com fallback compatível para `DATABASE_URL`; a conversão não transfere dados de negócio.

## Desenvolvimento

```bash
pnpm install
pnpm test
pnpm check
pnpm build
pnpm dev
```

## Comandos

| Comando | Uso |
|---|---|
| `pnpm dev` | Inicia o servidor em desenvolvimento com hot reload |
| `pnpm test` | Executa a suíte Vitest |
| `pnpm check` | Valida TypeScript sem emitir arquivos |
| `pnpm build` | Gera o build frontend e backend |
| `pnpm portability:check` | Verifica arquivos, schema, guardrails e callback OAuth sem exibir secrets |
| `pnpm db:push` | Gera e **aplica** migrations PostgreSQL; não executar sem plano, revisão e confirmação do banco de destino |

## Migrations

O schema ativo está em `drizzle/schema.ts` e o Drizzle Kit está configurado para **gerar novas migrations PostgreSQL em `drizzle/pg/`**. A migration inicial `drizzle/pg/0000_pg_initial.sql` foi revisada e aplicada ao Supabase em etapas controladas; o banco está vazio e com RLS habilitado. O baseline `0000_initial_users.sql` até `0017_peaceful_cobalt_man.sql`, incluindo `drizzle/meta/`, é **histórico MySQL/TiDB do ZIP original**, não deve ser executado em PostgreSQL; o SQL em `docs/legacy-migrations/` também é histórico. Antes de qualquer `pnpm db:push`, revisar a migration incremental, permissões/RLS e plano de rollback.

## Regras operacionais

- 100% do conteúdo descoberto precisa ser claramente em espanhol.
- O contexto do vídeo é a evidência padrão.
- Comentário-fonte só entra quando houver exposição pessoal ou pedido real de ajuda.
- Aprovação humana é obrigatória antes de publicar.
- A maioria dos textos é sem link; links são exceção, oficiais e contextuais.
- Não usar venda, preço, pagamento, promessa, diagnóstico, pressão ou experiência inventada.
- Não automatizar curtidas nem fabricar testemunhos.
- `publicationOutbox` e reconciliação protegem a publicação individual futura.
- O banco principal, OAuth e secrets permanecem no ambiente de produção.

## Segurança

Nunca comite `.env`, `.project-config.json`, API keys, OAuth client secrets, tokens, cookies, chaves de cifragem ou dumps de banco. Use o cofre de secrets da plataforma. O ZIP de transferência deve ser sanitizado.

## Continuidade entre contas

A conta atual permanece como produção e rollback. Uma segunda conta pode ser usada como desenvolvimento, mas a sincronização só ocorre por projeto compartilhado, repositório privado ou promoção controlada de um pacote sanitizado. Duas cópias independentes não se sincronizam sozinhas.
