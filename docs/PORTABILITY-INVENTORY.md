# Inventário de portabilidade — Cadena Invisible

## Baseline usado

- Projeto: `cadena-invisible-panel-migrado`
- Checkpoint atual de código: `1696126f`
- Banco: MySQL/TiDB gerenciado pelo ambiente atual
- Migration mais recente aplicada: `0012_hard_runaways`
- Publicação automática: desativada no MVP
- OAuth do YouTube: callback no domínio publicado estável
- Supabase: fora do escopo desta fase

## Componentes que precisam viajar juntos

- Código-fonte e migrations Drizzle.
- Biblioteca editorial e skill versionada.
- Runbook de portabilidade.
- `docs/ACCOUNT-ROTATION-CHECKLIST.md`.
- Contrato de nomes de secrets.
- `YOUTUBE_TOKEN_ENCRYPTION_KEY`, preservada fora do código.
- `DATABASE_URL`, preservada no cofre do ambiente correto.
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
- o pacote de transição não inclui Supabase nem alteração de banco.

Pendente para uma fase separada:

- identidade permanente do projeto independente de `ownerOpenId`;
- migração opcional para PostgreSQL/Supabase, fora do escopo atual;
- hospedagem externa estável;
- promoção de uma nova instância para produção.
