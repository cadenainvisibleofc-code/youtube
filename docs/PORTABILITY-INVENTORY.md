# Inventário de portabilidade — Cadena Invisible

> **Atualização 2026-10-01:** este inventário histórico foi reconciliado com o estado atual. A fonte operacional é o GitHub `cadenainvisibleofc-code/youtube` e o Supabase `PROJETO CADENA YOUTUBE`. Para backup, restauração e troca de conta, siga primeiro `docs/PLANO-CUSTODIA-E-RECUPERACAO-2026-10-01.md`.

## Baseline usado

- Projeto: `cadena-invisible-panel-migrado`
- Checkpoint atual de código: `1696126f`
- Banco: PostgreSQL 17 no Supabase `thliiwlagdmnqjwzmiyt`
- Migrations mais recentes aplicadas: `integrity_and_outbox_fencing`; hardening de `search_path` versionado para aplicação controlada
- Publicação automática: desativada no MVP
- OAuth do YouTube: callback no domínio publicado estável
- Supabase: banco primário atual; schema, RLS e dados auditados

## Componentes que precisam viajar juntos

- Código-fonte e migrations Drizzle.
- Biblioteca editorial e skill versionada.
- Runbook de portabilidade.
- `docs/ACCOUNT-ROTATION-CHECKLIST.md`.
- Contrato de nomes de secrets.
- `YOUTUBE_TOKEN_ENCRYPTION_KEY`, preservada fora do código.
- `SUPABASE_DATABASE_URL`, preservada no cofre do ambiente correto.
- Client ID, Client Secret e callback OAuth autorizados.

## Componentes que não devem ser transportados

- `.project-config.json`.
- Arquivos `.env*`.
- `node_modules`.
- `dist` e caches de build.
- `.manus-logs`.
- Tokens descriptografados.
- Dumps de banco sem criptografia.

## Gate de troca de ambiente

A nova instância só pode ser considerada válida se apresentar:

- `pnpm check` aprovado;
- `pnpm test` aprovado;
- `pnpm build` aprovado;
- `pnpm portability:check` em estado `ready`;
- migration `0012_hard_runaways` presente;
- callback OAuth com HTTPS e caminho exato;
- publicação automática ainda bloqueada;
- conexão com o banco apontando para a base pretendida;
- chave de criptografia igual à usada para os tokens existentes.

O checklist operacional completo da rotação está em `docs/ACCOUNT-ROTATION-CHECKLIST.md`.

## Estado desta fase

Concluído sem trocar o banco principal:

- preview encaminha OAuth para o domínio publicado;
- interface identifica explicitamente `Conectar no publicado`;
- erros OAuth preservam a razão devolvida pelo callback;
- verificador automatizado de portabilidade adicionado;
- runbook de rotação criado;
- nenhuma publicação foi executada.
- a nova conta será validada como cópia de desenvolvimento antes de qualquer promoção;
- a conta atual permanece como produção e rollback;
- o pacote de transição inclui o contrato do Supabase, o manifest de migrations e o plano de recuperação, mas nunca inclui valores de secrets ou dumps sem criptografia.

Pendente para uma fase separada:

- identidade permanente do projeto independente de `ownerOpenId`;
- backup externo e ensaio de restauração do PostgreSQL/Supabase;
- hospedagem externa estável;
- promoção de uma nova instância para produção.
