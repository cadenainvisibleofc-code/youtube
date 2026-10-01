# Guia de conexão de até cinco canais do YouTube

**Estado:** contrato operacional do checkout PostgreSQL/Supabase — 2026-10-01

## Modelo

Um projeto possui membros e até cinco perfis em `projectChannels`. Cada conexão, configuração de automação, draft, item de outbox e publicação de canal deve carregar o `projectChannelId` correspondente.

- `owner` e `editor` podem administrar canais; `viewer` não pode iniciar OAuth.
- O primeiro canal permanece no próprio slot; adicionar outro canal não substitui o primeiro.
- O mesmo `channelId` não pode ser duplicado no mesmo projeto.
- Canais `paused` e `revoked` não são selecionáveis nem podem ser reativados pelo fluxo de adicionar conta.
- A publicação automática continua desativada; aprovação humana é obrigatória.

## OAuth

### Adicionar uma conta/canal

```text
/api/youtube/oauth/start?addAccount=1&projectId=<PROJECT_ID>
```

O servidor autentica a sessão, valida o projeto e o papel do membro, conta os slots não revogados e bloqueia a sexta tentativa. O state assinado contém o projeto, o modo de criação, o nonce, a identidade iniciadora, o redirect URI e a expiração.

### Reconectar um slot existente

```text
/api/youtube/oauth/start?projectChannelId=<PROJECT_CHANNEL_ID>
```

O servidor valida o slot e a permissão. O callback só aceita o canal retornado pelo Google quando ele corresponde ao slot selecionado. Para uma conta Google com múltiplos canais sem slot previamente selecionado, o fluxo falha de forma explícita em vez de escolher o primeiro silenciosamente.

### Callback

O callback valida assinatura, expiração, nonce em cookie, identidade da sessão, redirect URI, projeto, papel e canal retornado. Tokens de acesso e refresh são cifrados com AES-256-GCM antes de persistir; valores de token não devem aparecer em logs ou respostas.

A custódia de uma conexão vinculada a `projectChannelId` é compartilhada pelo slot do projeto, permitindo que owner/editor autorizados usem o mesmo token cifrado. Conexões legadas sem slot continuam resolvidas apenas por `ownerOpenId` e não devem ser usadas quando houver múltiplas conexões.

## Operações por canal

A seleção do painel é persistida no navegador e enviada explicitamente às rotas de automação, ingestão, revisão, outbox e reconciliação. Drafts manuais são deduplicados por vídeo, usuário e canal; o mesmo vídeo pode gerar drafts independentes para canais diferentes.

Antes de aprovar ou publicar, o servidor deve confirmar:

1. membro e permissão no projeto;
2. canal ativo e pertencente ao projeto;
3. draft e outbox com o mesmo `projectChannelId`;
4. conexão e token do mesmo slot;
5. aprovação humana e transição CAS;
6. nenhum caminho de autopublicação.

## Checklist manual segura

1. Login com owner.
2. Confirmar o canal 1 no painel.
3. Adicionar um canal 2 de teste.
4. Atualizar a página e confirmar que canais 1 e 2 continuam visíveis.
5. Repetir até o quinto slot.
6. Confirmar que a sexta tentativa é bloqueada.
7. Selecionar cada canal e criar um draft de teste.
8. Confirmar que os drafts e automações permanecem separados.
9. Tentar selecionar um canal pausado/revogado e confirmar que a UI e o backend recusam.
10. Aprovar apenas um draft e verificar que a publicação entra na outbox sem autopublicar.

## Limitações conhecidas

- O teto de cinco é protegido pelo lock transacional do projeto no caminho normal, mas ainda não é uma constraint matemática independente de todos os writers SQL.
- FKs simples garantem existência dos IDs, mas não provam sozinhas a correspondência composta entre todos os pares de canal; o backend valida os pares nos caminhos críticos.
- Exatamente uma publicação externa no YouTube não pode ser garantida após uma falha de rede depois do POST; a outbox usa idempotência, reconciliação e estado `uncertain`.
- A seleção de Brand Account com múltiplos canais sem slot conhecido continua sendo explícita/recusada, nunca inferida silenciosamente.

## Segredos

Client Secret, tokens, refresh tokens, chaves e URLs de banco ficam somente no cofre da plataforma. Este guia é sanitizado e não contém valores reais.
