# Cadena Invisible — Checklist de prontidão para produção

**Data:** 2026-10-01
**Runtime publicado:** https://cadenaiv-tqbkbmxw.manus.space
**Callback Google/YouTube:** `https://cadenaiv-tqbkbmxw.manus.space/api/youtube/oauth/callback`

## Estado técnico atual

- [x] PostgreSQL/Supabase conectado pelo runtime publicado.
- [x] Healthcheck público respondendo `200`.
- [x] Insert e `onConflictDoUpdate` validados end-to-end.
- [x] Registros temporários removidos após os testes.
- [x] 23 tabelas criadas no schema `public`.
- [x] RLS habilitado nas 23 tabelas, sem políticas públicas.
- [x] `pnpm check` aprovado.
- [x] `pnpm test` aprovado: 124 testes passaram, 1 foi pulado por ausência de credenciais reais.
- [x] `pnpm build` aprovado.
- [x] Aprovação humana permanece obrigatória; o agente não expõe mais a opção de autopublicação.
- [x] Chave RelayModels cadastrada no cofre de produção; o valor inválido `gpt-4o-mini` foi substituído por `gpt-5.6-sol` após o erro `model_not_found`.
- [x] Fallback do código atualizado para `gpt-5.6-sol`, modelo recomendado pelo RelayModels para agentes com ferramentas.
- [x] Fallback defensivo adicionado: valores `sk-...` em `EXTERNAL_LLM_MODEL` nunca são enviados ao RelayModels como modelo.
- [x] Auditoria multicanal continuada: custódia de conexão por `projectChannelId`, bloqueio de reativação de canais pausados/revogados, deduplicação de drafts por canal e validação de canal na regeneração.
- [x] Guia sanitizado de até cinco canais criado em `docs/GUIA-CONEXAO-5-CANAIS-YOUTUBE-v1.md`.
- [x] Runtime publicado após a configuração RelayModels e healthcheck confirmado com `200`.
- [x] Auditoria somente leitura do Supabase `PROJETO CADENA YOUTUBE`: projeto ativo/saudável, PostgreSQL 17, cinco migrations registradas, 23 tabelas com RLS e zero políticas públicas.
- [x] Escopo `projectChannelId` confirmado em `automationSettings`, `drafts`, `publicationOutbox`, `publications` e `youtubeConnections`.
- [x] Nenhum projeto, membro, canal, draft, outbox ou publicação operacional ainda foi criado; não foi feito backfill nem escrita durante esta auditoria.
- [x] Uma conexão YouTube legada sem `projectChannelId` foi identificada; seus campos de tokens estão preenchidos e cifrados. Ela foi preservada para reconciliação controlada após o login, sem inferir projeto ou canal.
- [ ] Reconciliar a conexão YouTube legada somente após confirmar a identidade, o projeto e o `channelId` no fluxo autenticado.
- [ ] Teste funcional do chat autenticado com uma mensagem e uma ação de baixo risco.
- [ ] `pnpm portability:check` local em `ready` — o comando foi executado e permanece em `needs-attention` somente porque `OWNER_OPEN_ID` depende do primeiro login; nenhum secret foi impresso.
- [x] Secrets de produção do YouTube OAuth cadastrados no cofre WebDev: Client ID, Client Secret, callback HTTPS e chave de cifragem.
- [ ] Rotação da senha do Supabase — adiada por decisão do usuário.

## O que foi trazido do Google Cloud Console

Não envie Client Secret, tokens ou chaves em mensagem. Os valores foram inseridos no cartão seguro do cofre WebDev e não foram gravados no código.

### 1. Projeto e API

- Projeto Google Cloud que será usado pela Cadena Invisible.
- **YouTube Data API v3** habilitada nesse projeto.
- Conta Google proprietária do canal adicionada como usuário de teste enquanto o app estiver em modo Testing.

### 2. OAuth consent screen

- Nome do aplicativo.
- E-mail de suporte.
- E-mail de contato do desenvolvedor.
- Escopo solicitado confirmado:
  - `https://www.googleapis.com/auth/youtube.force-ssl`
- Se o app continuar em Testing, adicionar como test user cada conta que fará a conexão.
- Para uso público, avaliar a verificação OAuth do Google conforme o escopo e o público do aplicativo.

### 3. OAuth Client ID

Criar ou selecionar um cliente do tipo **Web application** e cadastrar exatamente:

```text
Authorized redirect URI:
https://cadenaiv-tqbkbmxw.manus.space/api/youtube/oauth/callback
```

Não cadastrar:

- URL do Preview;
- URL local `localhost` como callback de produção;
- URL com query string ou fragmento;
- caminho diferente de `/api/youtube/oauth/callback`.

Registrado no cofre seguro:

- `YOUTUBE_OAUTH_CLIENT_ID`
- `YOUTUBE_OAUTH_CLIENT_SECRET`

## Valores que foram configurados no cofre

Além dos dois valores do Google Console, o runtime recebeu:

- `YOUTUBE_OAUTH_REDIRECT_URI` = callback HTTPS exato acima;
- `YOUTUBE_TOKEN_ENCRYPTION_KEY` = chave Base64 que decodifica exatamente para 32 bytes.

A chave de cifragem não deve ser gerada novamente se já houver tokens YouTube que precisem ser preservados. Se não houver tokens existentes, uma nova chave pode ser criada uma única vez e guardada no cofre.

Ainda falta, após o primeiro login Manus:

- `OWNER_OPEN_ID` = identidade exata do proprietário retornada após o login; não deve ser inventado nem enviado como segredo.

## Testes após receber os valores

1. Secrets já sincronizados no runtime sem imprimir valores.
2. Fazer login Manus no painel publicado.
3. Testar início do OAuth YouTube.
4. Confirmar tela de consentimento Google.
5. Confirmar retorno pelo callback HTTPS.
6. Confirmar listagem de canais.
7. Confirmar seleção explícita de canal quando houver mais de um.
8. Confirmar token cifrado no banco.
9. Confirmar que a publicação cria rascunho/outbox somente após aprovação humana.
10. Confirmar que nenhum caminho publica externamente sem aprovação.

## Critérios para liberar piloto

- OAuth configurado e callback verificado.
- Usuário de teste confirmado.
- RLS validado com pelo menos dois contextos de usuário/projeto.
- Nenhum canal de produção usado durante o primeiro teste.
- Backfill ainda desativado (`ALLOW_PROJECT_BACKFILL=0`).
- Publicação real inicialmente limitada a um canal controlado.
- Rollback e revogação de OAuth documentados.
- Rotação da senha Supabase concluída antes da operação produtiva, mesmo que não seja necessária para o teste técnico atual.
