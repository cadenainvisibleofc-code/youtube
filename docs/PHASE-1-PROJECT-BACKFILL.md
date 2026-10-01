# Fase 1 — identidade permanente e backfill

A migration `0013_panoramic_spitfire.sql` é aditiva. Ela cria `projects`, `projectMembers` e `projectChannels`. Nenhuma tabela legada é alterada, nenhum registro existente é removido e as foreign keys usam `RESTRICT`.

O script `scripts/backfill-project.mjs` cria o projeto lógico e associa o membro fundador. Ele é deliberadamente protegido por três gates:

1. `DATABASE_URL`, `PROJECT_SLUG`, `PROJECT_NAME` e `OWNER_OPEN_ID` precisam existir no cofre do ambiente.
2. `ALLOW_PROJECT_BACKFILL=1` precisa ser definido depois de confirmar que o banco é a base nova de teste.
3. O modo padrão é dry-run; para gravar é necessário `PROJECT_BACKFILL_APPLY=1`.

## Dry-run

```bash
ALLOW_PROJECT_BACKFILL=1 \
PROJECT_SLUG=cadena-invisible \
PROJECT_NAME="Cadena Invisible" \
OWNER_OPEN_ID="<open-id-do-ambiente>" \
pnpm db:backfill-project
```

O dry-run apenas verifica a existência do projeto e do usuário e executa rollback. Ele não cria nem altera dados.

## Aplicação controlada

Somente depois de confirmar o banco TiDB/MySQL vazio correto:

```bash
ALLOW_PROJECT_BACKFILL=1 \
PROJECT_BACKFILL_APPLY=1 \
PROJECT_SLUG=cadena-invisible \
PROJECT_NAME="Cadena Invisible" \
OWNER_OPEN_ID="<open-id-do-ambiente>" \
pnpm db:backfill-project
```

O script usa transação, falha se o slug já existir com outro nome, falha se o proprietário não existir, e faz upsert apenas do membro correspondente ao projeto. Não cria canais automaticamente porque os cinco `channelId` precisam ser confirmados individualmente via OAuth/Brand Accounts.

## Rollback operacional

Não há `DELETE` automático. Para interromper a operação, o projeto deve ser marcado como `paused` e o membro como `revoked` por procedimento administrativo revisado. Como as relações usam `RESTRICT`, uma exclusão acidental do projeto não deve apagar canais ou histórico ligado a ele.

## Estado desta fase

A migration e o script foram preparados e validados estaticamente. Não foram aplicados porque esta conta ainda não possui `DATABASE_URL` configurada e não há autorização técnica para adivinhar o banco de destino.
