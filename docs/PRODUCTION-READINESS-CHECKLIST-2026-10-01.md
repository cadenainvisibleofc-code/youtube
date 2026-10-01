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
- [ ] `pnpm portability:check` em `ready` — depende dos secrets OAuth e da identidade pós-login.
- [ ] Rotação da senha do Supabase — adiada por decisão do usuário.

## O que trazer do Google Cloud Console

Não envie Client Secret, tokens ou chaves em mensagem. Depois de obter os valores, eles devem ser inseridos no cartão seguro do cofre WebDev.

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

Trazer para o cofre seguro:

- `YOUTUBE_OAUTH_CLIENT_ID`
- `YOUTUBE_OAUTH_CLIENT_SECRET`

## Valores que ainda precisam ser configurados no cofre

Além dos dois valores do Google Console, o runtime precisa de:

- `YOUTUBE_OAUTH_REDIRECT_URI` = callback HTTPS exato acima;
- `YOUTUBE_TOKEN_ENCRYPTION_KEY` = chave Base64 que decodifica exatamente para 32 bytes.

A chave de cifragem não deve ser gerada novamente se já houver tokens YouTube que precisem ser preservados. Se não houver tokens existentes, uma nova chave pode ser criada uma única vez e guardada no cofre.

Também falta, após o primeiro login Manus:

- `OWNER_OPEN_ID` = identidade exata do proprietário retornada após o login.

## Testes após receber os valores

1. Sincronizar secrets no runtime sem imprimir valores.
2. Executar `pnpm portability:check` e confirmar `ready`.
3. Publicar a versão com configuração OAuth.
4. Testar login Manus.
5. Testar início do OAuth YouTube.
6. Confirmar tela de consentimento Google.
7. Confirmar retorno pelo callback HTTPS.
8. Confirmar listagem de canais.
9. Confirmar seleção explícita de canal quando houver mais de um.
10. Confirmar token cifrado no banco.
11. Confirmar que a publicação cria rascunho/outbox somente após aprovação humana.
12. Confirmar que nenhum caminho publica externamente sem aprovação.

## Critérios para liberar piloto

- OAuth configurado e callback verificado.
- Usuário de teste confirmado.
- RLS validado com pelo menos dois contextos de usuário/projeto.
- Nenhum canal de produção usado durante o primeiro teste.
- Backfill ainda desativado (`ALLOW_PROJECT_BACKFILL=0`).
- Publicação real inicialmente limitada a um canal controlado.
- Rollback e revogação de OAuth documentados.
- Rotação da senha Supabase concluída antes da operação produtiva, mesmo que não seja necessária para o teste técnico atual.
