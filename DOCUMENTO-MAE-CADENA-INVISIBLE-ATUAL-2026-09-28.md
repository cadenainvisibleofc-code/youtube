# Cadena Invisible — Documento-mãe atual de continuidade

**Data de referência:** 28/09/2026
**Projeto:** `cadena-invisible-panel-migrado`
**Checkpoint de referência:** `1696126f`
**Produção:** `https://cadenainv-3aa2uun3.manus.space`
**Banco:** MySQL/TiDB gerenciado pelo WebDev
**Supabase:** fora do escopo desta transição

## 1. Objetivo

O Cadena Invisible é um painel privado de inteligência editorial para descobrir vídeos em espanhol, compreender o contexto do vídeo, criar rascunhos humanizados e submetê-los à revisão humana antes de qualquer publicação.

O princípio do sistema é acolher antes de alcançar. A aplicação não deve operar como robô de spam. Publicação automática permanece bloqueada no MVP.

## 2. Estado implementado

A versão atual contém:

- React 19, TypeScript, Vite, Tailwind 4, Express, tRPC 11 e Drizzle.
- Banco MySQL/TiDB e migrations até `0012_hard_runaways`.
- Autenticação Manus e dashboard privado.
- Descoberta oficial pela YouTube Data API v3.
- Filtro determinístico que aceita apenas conteúdo claramente em espanhol.
- Prioridade para o contexto do vídeo, não para comentários curtos ou CTAs do dono do canal.
- Geração de Tipos A, B e C, com links excepcionais e sujeitos à revisão.
- Humanização sem travessão decorativo, ponto e vírgula, tom institucional ou linguagem comercial.
- Aprovação humana obrigatória.
- `publicationOutbox` com idempotência, lease, retries e deduplicação.
- `publicationEngagementEvents` e reconciliação pós-publicação.
- Métricas de respostas, menções, verificação e ressonância observada.
- Separação entre descoberta semanal, acervo, preparação, revisão, publicação e monitoramento.
- `pnpm portability:check` para validação sem expor valores de secrets.

## 3. Estado que ainda exige validação

- Rodada piloto real com poucos canais e publicação individual.
- Reconciliação real após uma publicação aprovada.
- Exportação formal do histórico em JSON/CSV.
- Filtros editoriais configuráveis por nicho, país e tipo de oportunidade.
- Comparação lado a lado entre evidência do vídeo, comentário-fonte e texto gerado.
- Feedback humano categorizado por motivo de edição.
- Identidade permanente baseada em `projectId`, substituindo gradualmente a dependência de `ownerOpenId`.

A identidade permanente não deve ser alterada durante esta troca de conta. Ela será uma fase posterior com migration, backfill, testes e rollback.

## 4. Regra de continuidade entre contas

A nova conta será uma cópia de desenvolvimento. A conta atual permanece como produção e rollback até que todos os gates sejam aprovados.

A nova conta não deve apontar para o banco principal por engano, executar migrations sem conferência ou publicar externamente durante a validação.

O fluxo é:

```text
checkpoint atual
  → pacote sanitizado
  → nova conta
  → secrets no cofre
  → banco de teste controlado
  → testes e build
  → validação editorial e OAuth
  → novo checkpoint
  → promoção controlada, se necessário
```

## 5. Pacote que deve viajar

Enviar código, migrations, testes, regras editoriais, documentação, lockfile e template de secrets sem valores.

Não enviar `.env`, `.project-config.json`, `node_modules`, `dist`, logs, tokens, cookies, refresh tokens, chaves privadas ou dumps de banco sem criptografia.

A `YOUTUBE_TOKEN_ENCRYPTION_KEY` original deve ser preservada em local seguro se tokens existentes precisarem continuar descriptografáveis. Ela nunca deve ser escrita no ZIP ou no Drive como texto aberto.

## 6. Configuração da nova conta

Na nova conta:

1. Criar projeto Fullstack/Web DB User.
2. Importar o ZIP sanitizado.
3. Rodar `pnpm install`.
4. Inserir secrets pelo cofre da plataforma.
5. Conferir o banco de teste antes de qualquer migration.
6. Rodar `pnpm test`, `pnpm check`, `pnpm build` e `pnpm portability:check`.
7. Validar login, dashboard, fila e regras.
8. Configurar OAuth somente com callback HTTPS confirmado.
9. Não usar callback temporário de preview.
10. Não publicar automaticamente.

## 7. Secrets e dependências

O pacote distribui somente os nomes das variáveis. Os valores são inseridos separadamente no cofre da nova conta:

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
- variáveis do provedor editorial externo, se habilitado

Não copiar automaticamente o `OWNER_OPEN_ID` da conta atual para dados de produção sem definir a estratégia de identidade. Para a cópia de desenvolvimento, a nova conta deve usar a identidade própria e dados controlados.

## 8. Gates de promoção

A nova conta só pode ser considerada apta quando houver:

- TypeScript sem erros.
- Suíte Vitest aprovada.
- Build de produção aprovado.
- Portability check em `ready`.
- Migrations conferidas até `0012`.
- Banco correto confirmado.
- OAuth HTTPS validado.
- Nenhum callback de preview em produção.
- Publicação automática bloqueada.
- Outbox sem órfãos ou duplicidades.
- Rollback documentado.
- Conta atual ainda preservada.

## 9. Drive e fonte de verdade

A pasta oficial atual é `00 — ATUAL — e7150755 — USAR ESTA`.

Ela deve receber o ZIP sanitizado e os documentos atuais. As pastas `99 — HISTÓRICO` não devem ser apagadas nem sobrescritas.

O documento operacional detalhado está em `docs/ACCOUNT-ROTATION-CHECKLIST.md`. O runbook está em `docs/PORTABILITY-RUNBOOK.md`. O inventário está em `docs/PORTABILITY-INVENTORY.md`.

## 10. Banco e Supabase

A troca atual não migra banco. O banco permanece MySQL/TiDB. Não criar schema PostgreSQL, não trocar driver Drizzle e não alterar `DATABASE_URL` para Supabase nesta fase.

Uma migração futura para PostgreSQL/Supabase exigirá schema equivalente, migrations próprias, contagens, checksums, revalidação de tokens e ensaio de rollback.
