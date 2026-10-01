# Cadena Invisible — Handoff completo para outra IA

**Estado:** snapshot sanitizado e auditado em 2026-09-30
**Commit de referência do código publicado:** `9eb109cb01e6a6610fa1a08707893249ce3dbd0e`
**Produção:** https://cadenainv-3aa2uun3.manus.space
**Stack:** React 19, TypeScript, Vite, Tailwind 4, Express 4, tRPC 11, Drizzle ORM, MySQL/TiDB, Manus Auth, YouTube OAuth/Data API v3 e RelayModels opcional.

> **Objetivo:** preservar uma aplicação editorial humana, empática e segura que descobre conversas públicas em espanhol, prepara rascunhos contextualizados e só publica depois de revisão humana.

## 1. Fonte de verdade

1. Este checkout e o ZIP gerado a partir dele são a fonte de código.
2. `README.md` é o índice curto.
3. Este documento é o mapa operacional para outra IA.
4. `docs/FINAL-AUDIT-2026-09-30.md` registra achados, correções e riscos residuais.
5. `drizzle/0000_initial_users.sql` + `drizzle/0010...` até `drizzle/0017...` são a cadeia ativa; o SQL em `docs/legacy-migrations/` é histórico e não deve ser executado.
6. Secrets reais ficam apenas no cofre da plataforma. Este pacote nunca contém valores reais.

## 2. O que o produto faz

- Descobre vídeos/conversas públicas em espanhol com contexto e elegibilidade.
- Gera rascunhos editoriais humanizados, sem inventar experiência, promessa ou diagnóstico.
- Mantém biblioteca, histórico, feedback, métricas e memória editorial.
- Permite organizar até **cinco canais ativos por projeto**.
- Usa OAuth YouTube com estado assinado e canal/projeto explícitos.
- Mantém automação, drafts, outbox e publicações escopados por `projectChannelId`.
- Bloqueia publicação automática no MVP: toda publicação deve passar por aprovação humana.

## 2.1 Governança humana

O produto deve ser lido junto com `docs/PACTO-DOS-GUARDIOES-v1.md` e `docs/METRICAS-DE-CUIDADO-E-COLABORACAO-v1.md`. Os guardiões oferecem presença contextual e discreta, mas nunca tratam pessoas como leads ou oportunidades de conversão. A colaboração é consequência de identificação e escolha própria.

O sucesso deve priorizar relevância contextual, respeito à autonomia, ausência de invasão, arquivamento responsável e segurança do contexto. Volume, cliques, velocidade e conversão não podem comandar o sistema nem justificar pressão. Se uma prática aumentar colaboração e também aumentar sensação de uso, pressão ou invasão, ela deve ser pausada.

## 3. Arquitetura multicanal

### Entidades

- `projects`: unidade lógica do cliente/projeto.
- `projectMembers`: associação do usuário ao projeto (`owner`, `editor`, `viewer`).
- `projectChannels`: até cinco slots ativos por projeto, com `pending`, `connected`, `reauthorization_required`, `paused` ou `revoked`.
- `youtubeConnections`: tokens cifrados e conexão OAuth vinculados ao canal/projeto.
- `drafts`, `publicationOutbox`, `publications`, automação e métricas carregam `projectChannelId` quando a operação é de canal.

### Regras

- `owner` e `editor` podem administrar canais; `viewer` só visualiza.
- Um canal pausado ou revogado nunca deve ser selecionável nem reconectável.
- Um draft não pode ser reatribuído silenciosamente a outro canal.
- A outbox valida que draft, item e publicação apontam para o mesmo canal.
- Publicação sem `projectChannelId` é rejeitada no caminho multicanal.
- O teto normal é cinco canais não revogados. A criação usa lock transacional no projeto.
- Exclusões históricas relevantes usam `RESTRICT`; dados derivados específicos podem usar `CASCADE`/`SET NULL` quando documentado.

## 4. Fluxo para conectar mais canais

1. A sessão entra com Manus Auth.
2. `dashboard.integrationStatus` retorna canais, projetos graváveis e diagnóstico OAuth sem valores secretos.
3. O painel escolhe o projeto do canal atual; se não houver canal, usa o único projeto gravável disponível.
4. O botão mostra um estado explícito: `Adicionar conta`, `OAuth indisponível`, `Sem permissão` ou `5/5 contas`.
5. `Adicionar conta` chama:

```text
/api/youtube/oauth/start?addAccount=1&projectId=<ID_DO_PROJETO>
```

6. O backend valida sessão, projeto, papel `owner/editor`, limite, redirect e cria state OAuth assinado.
7. O callback valida state, nonce, expiração, projeto e canal retornado pelo Google.
8. O slot só é criado após token válido, refresh token válido e conferência do canal.
9. O usuário retorna ao painel, que refaz o status dos canais.

Para reconectar um slot existente, usar:

```text
/api/youtube/oauth/start?projectChannelId=<ID_DO_SLOT>
```

## 5. Integração que a próxima IA precisa fazer

### Antes de alterar código

- Ler este documento, `README.md`, `docs/FINAL-AUDIT-2026-09-30.md`, `docs/MULTICHANNEL-INVARIANTS.md` e `docs/PORTABILITY-RUNBOOK.md`.
- Confirmar o commit/hash do pacote e o ambiente WebDev destino.
- Não executar migration em banco existente sem backup/dry-run.
- Não copiar secrets do ambiente antigo.

### Para conectar Google/YouTube

1. Criar ou selecionar credencial OAuth Web Application no Google Cloud.
2. Registrar exatamente:

```text
https://<DOMINIO_ATUAL>/api/youtube/oauth/callback
```

3. Inserir no cofre: Client ID, Client Secret, callback e chave AES-256-GCM Base64.
4. Garantir que a chave AES seja preservada quando já existirem tokens.
5. Fazer login, confirmar `OWNER_OPEN_ID`, executar o backfill em dry-run e só depois aplicar.
6. Testar uma conta autorizada e depois a segunda conta em projeto de teste.

### Para mudar domínio

- Atualizar `YOUTUBE_OAUTH_REDIRECT_URI` e `OAUTH_SERVER_URL` no cofre.
- Atualizar o redirect autorizado no Google Cloud.
- Nunca manter o domínio antigo como fallback silencioso.
- Executar `pnpm portability:check` e conferir HTTPS/caminho.

### Para mudar banco

- Confirmar MySQL/TiDB e a linha de base real.
- Verificar journal e schema aplicado.
- Aplicar `0000` e `0001`–`0017` somente onde ainda não estiverem aplicadas.
- Fazer relatório de linhas com `NULL projectChannelId`, órfãos, duplicatas e estados divergentes antes de tornar campos obrigatórios.

## 6. Secrets e arquivos proibidos no pacote

Nunca incluir `.env*`, `.project-config.json`, tokens, cookies, refresh tokens, Client Secret, API keys, `DATABASE_URL`, dumps de banco, logs com payload ou chaves privadas. Use `SECRETS-TEMPLATE.txt` somente como mapa de nomes e contratos.

## 7. Gates obrigatórios

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm check
pnpm build
pnpm portability:check
```

A publicação é manual e controlada. O código nunca deve habilitar auto-publish no MVP. Testes unitários não substituem teste OAuth real em staging, auditoria do banco ou confirmação humana da publicação.

## 8. O que já foi corrigido nesta recuperação

- Reconstrução do código sanitizado em projeto WebDev novo.
- Migrations reconciliadas até `0017`.
- Projetos, membros e canais adicionados.
- `projectChannelId` propagado por OAuth, drafts, automação, outbox e publicação.
- State YouTube assinado com nonce/expiração.
- Limite de cinco canais protegido por lock transacional no caminho normal.
- CAS e leases da outbox endurecidos.
- Auto-publish bloqueado.
- Cascatas históricas perigosas trocadas por `RESTRICT`.
- Painel com seleção persistente, badges e conexão por canal.
- Botão de adição torna-se visível mesmo sem canal existente quando há projeto gravável.
- OAuth inválido não fica silencioso: o painel exibe o estado e nomes de configurações faltantes, sem valores.
- URI inválida agora torna `isYouTubeOAuthConfigured()` falso de forma consistente.
- Canal pausado/revogado tem precedência sobre status de conexão.
- Falha de `integrationStatus` exibe retry em vez de carregamento infinito.

## 9. Próxima sequência recomendada

1. Fazer login com a conta proprietária e confirmar o papel `owner`.
2. Se necessário, executar `scripts/backfill-project.mjs --dry-run` e revisar ambiguidades.
3. Conectar o primeiro canal pelo novo domínio.
4. Clicar em `Adicionar conta` e conectar um segundo canal de teste.
5. Confirmar que cada canal recebe drafts, automação e outbox separados.
6. Testar aprovação humana sem publicar automaticamente.
7. Fazer dry-run de banco para linhas legadas sem canal.
8. Decidir o modelo de custódia de tokens quando houver vários membros.
9. Implementar lease/fencing da outbox e requeue auditado antes de operação crítica.
10. Só então promover mudanças de produção com confirmação explícita.
