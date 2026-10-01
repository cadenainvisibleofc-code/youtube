# Cadena Invisible — Estado da reconstrução

**Data:** 2026-10-01 00:44 UTC
**Projeto Manus novo:** Cadena Invisible
**Modo:** cópia de desenvolvimento via ZIP sanitizado

## Importação

O ZIP oficial `CADENA-INVISIBLE-PACOTE-COMPLETO-2026-09-30.zip` foi importado para o projeto novo `/home/ubuntu/cadenaiv`. O SHA-256 observado do pacote foi `c1848d5082cd0bb79ad4895e1d8bd78298215454406a0b5c663cc81bc9478256`.

O banco gerenciado Manus está provisionado e o processo recebeu `DATABASE_URL` pelo ambiente do projeto. Nenhum valor de secret foi impresso ou gravado no workspace.

## Auditoria read-only

`pnpm db:audit` foi executado contra o TiDB gerenciado. O primeiro probe encontrou a limitação de `SET TRANSACTION READ ONLY` no TiDB; o auditor foi adaptado para usar um fallback estritamente `SELECT-only` quando o TiDB rejeita essa função.

Resultado final:

```text
status: blocked_missing_application_schema
applied: false
migrationsApplied: false
existingTables: __drizzle_migrations, users
missing: videos, projects, projectMembers, projectChannels,
         youtubeConnections, automationSettings, drafts,
         publications, publicationOutbox
```

Isso significa que o banco novo está vazio no nível da aplicação: não há dados legados, órfãos ou duplicatas para auditar ainda. O auditor não executou `INSERT`, `UPDATE`, `DELETE`, `ALTER`, `DROP`, `TRUNCATE`, migration ou backfill.

## Gates

- `pnpm check`: aprovado.
- `pnpm build`: aprovado, com os avisos conhecidos do script sem `type=module` e do chunk grande.
- `pnpm test`: 122 testes aprovados, 2 falhas dependentes de ambiente/schema.
  - dashboard tenta consultar `drafts` antes da migration da aplicação;
  - OAuth não possui ainda Client ID, Client Secret, redirect URI e chave de cifragem.
- `pnpm portability:check`: `needs-attention`, com 5 de 10 variáveis obrigatórias presentes; faltam OAuth server e credenciais OAuth/token encryption.
- Guarda de auto-publicação: aprovado.
- Referências de auto-publicação na `AutomationPanel`: zero.
- Arquivos sensíveis detectados: zero.

## Alteração de produto aplicada

A interface importada tinha um checkbox que permitia marcar publicação automática, embora o backend sempre bloqueasse essa opção. O controle foi removido. A interface agora informa que a revisão humana é obrigatória e mantém apenas a publicação manual de itens aprovados.

## Próximo passo bloqueado intencionalmente

As migrations oficiais `0000`–`0017` ainda não foram aplicadas porque a confirmação recebida autorizou somente auditoria read-only, check, testes e build. Para continuar, será necessária uma etapa separada autorizando a aplicação do baseline/migrations no banco novo, depois de conferir o journal. A aplicação deve ocorrer somente nesse banco gerenciado novo, nunca em um banco antigo ou desconhecido.
