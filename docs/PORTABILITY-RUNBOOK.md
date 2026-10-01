# Cadena Invisible — Runbook de portabilidade

> **Registro histórico do ZIP MySQL/TiDB (setembro de 2026).** As seções abaixo descrevem o ambiente original, não o código atualmente convertido para PostgreSQL. O driver e o schema atuais usam PostgreSQL; novas migrations devem ser geradas separadamente em `drizzle/pg/` e revisadas antes de qualquer aplicação. Nenhuma migration ou migração de dados foi executada nesta conversão. Consulte o README antes de operar o banco.

## Objetivo

Permitir que o painel seja reconstruído em outra conta de desenvolvimento sem interromper dados, canais conectados, fila editorial ou histórico de engajamento.

Para a transição atual, seguir primeiro `docs/ACCOUNT-ROTATION-CHECKLIST.md`. A conta nova será uma cópia de desenvolvimento validável, enquanto a conta atual continuará sendo produção e rollback. Supabase não faz parte desta fase.

## Arquitetura atual (baseline)

- Aplicação: React + Express + tRPC + Drizzle.
- Banco atual: MySQL/TiDB gerenciado pelo projeto WebDev.
- Identidade de acesso: sessão Manus; muitos registros ainda usam `ownerOpenId` como escopo.
- OAuth do YouTube: callback estável no domínio publicado, nunca no host temporário do preview.
- Publicação: somente após aprovação humana; `autoPublish` permanece bloqueado no MVP.
- Fila: `publicationOutbox` com idempotência, lease, retries e reconciliação.
- Métricas: `publicationEngagementEvents` para verificação, respostas, curtidas e menções.
- Código de referência: checkpoint `1696126f`.
- Migration de referência: `0012_hard_runaways`.

## Regra de continuidade

Trocar a conta Manus não deve ser tratado como migração de produção. A conta nova deve primeiro ser validada como cópia de desenvolvimento. O banco principal e os secrets de produção permanecem inalterados até a validação completa.

## Secrets obrigatórios

Nunca registrar valores neste arquivo, em commits ou em logs. A lista abaixo é apenas o contrato de nomes:

- `DATABASE_URL`
- `JWT_SECRET`
- `VITE_APP_ID`
- `OAUTH_SERVER_URL`
- `OWNER_OPEN_ID`
- `BUILT_IN_FORGE_API_URL`
- `BUILT_IN_FORGE_API_KEY`
- `VITE_FRONTEND_FORGE_API_URL`
- `VITE_FRONTEND_FORGE_API_KEY`
- `YOUTUBE_DATA_API_KEY`
- `YOUTUBE_OAUTH_CLIENT_ID`
- `YOUTUBE_OAUTH_CLIENT_SECRET`
- `YOUTUBE_OAUTH_REDIRECT_URI`
- `YOUTUBE_TOKEN_ENCRYPTION_KEY`
- secrets do provedor editorial externo, quando habilitado

### Regras especiais

1. `YOUTUBE_TOKEN_ENCRYPTION_KEY` deve permanecer exatamente igual para que refresh tokens existentes continuem descriptografáveis.
2. `YOUTUBE_OAUTH_REDIRECT_URI` deve continuar apontando para o domínio publicado estável.
3. Client Secret, API keys e JWT Secret devem ser rotacionados se forem expostos em arquivo, terminal, log ou mensagem.
4. O arquivo `.project-config.json` contém configuração sensível do ambiente e não deve ser enviado como ZIP público.
5. Uma cópia nova deve receber os secrets pelo cofre da plataforma, nunca por commit.

## Procedimento ao trocar de conta Manus

1. Criar um checkpoint da versão estável.
2. Exportar o código sem `.env`, cofre local, `node_modules`, `dist` e `.manus-logs`.
3. Criar o novo projeto a partir do checkpoint `1696126f` ou de um ZIP sanitizado desse estado, não de uma pasta de trabalho parcialmente modificada.
4. Inserir os secrets usando os mesmos nomes do contrato acima.
5. Rodar `pnpm install`, `pnpm check`, `pnpm test` e `pnpm build`.
6. Rodar `pnpm portability:check` e verificar apenas os nomes ausentes, sem imprimir valores.
7. Confirmar que a migration até `0012_hard_runaways` está presente.
8. Confirmar que o banco de teste é o correto antes de executar qualquer migration.
9. Validar login Manus e leitura do dashboard.
10. Validar o botão de conexão: no preview ele deve abrir o domínio publicado; não cadastrar callback temporário no Google Cloud.
11. Validar fila, aprovação, outbox e métricas com dados de teste controlados — nunca publicar automaticamente.
12. Só promover a nova instância quando todos os checks estiverem verdes.

Nenhuma etapa acima autoriza trocar o banco principal, os tokens do YouTube ou o domínio de produção. A promoção exige revisão explícita, novo checkpoint e plano de rollback.

## Identidade permanente do projeto (próxima fase)

Hoje o escopo de dados usa `ownerOpenId` da conta Manus em diversas tabelas. Antes de rotacionar contas com frequência, criar uma camada de projeto:

- `projects`: identidade permanente do Cadena Invisible;
- `projectMembers`: relação entre contas Manus e projeto, com papel e status;
- `projectId` nas conexões, automação, drafts, memórias, publicações e outbox;
- migração de dados existentes do proprietário atual para o projeto;
- fallback temporário por `ownerOpenId` durante a transição;
- remoção do fallback somente após auditoria e migração verificadas.

Não fazer essa alteração diretamente em produção sem migration, backfill, testes e rollback documentado.

## Migração futura para PostgreSQL/Supabase

A migração é uma etapa separada. O schema atual usa MySQL/TiDB e não deve receber apenas uma troca de URL.

Sequência segura:

1. Criar schema PostgreSQL equivalente em uma base de teste.
2. Adaptar o driver Drizzle e tipos (`mysqlTable`, enums, auto-incremento, upsert e timestamps).
3. Gerar migrations PostgreSQL novas; não reutilizar SQL MySQL.
4. Migrar dados por tabela com contagens e checksums de campos críticos.
5. Revalidar tokens usando a mesma chave de criptografia.
6. Rodar testes de aprovação, outbox, reconciliação e métricas.
7. Fazer um ensaio de rollback para o banco atual.
8. Só então planejar a troca do banco principal.

## Critérios de promoção

- TypeScript sem erros.
- Suíte Vitest completa aprovada.
- Build de produção aprovado.
- Banco e migration confirmados.
- OAuth publicado validado sem callback de preview.
- Nenhuma publicação automática habilitada.
- Outbox sem itens órfãos ou duplicados.
- Backup e chave de criptografia preservados.
- Rollback testado.
