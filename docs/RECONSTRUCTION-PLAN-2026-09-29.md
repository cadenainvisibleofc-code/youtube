# Cadena Invisible — plano oficial de reconstrução

**Situação:** a conta original entrou em suspensão e o checkpoint multicanal não foi recuperado.
**Fonte oficial desta reconstrução:** `01-CODIGO-BASE`, pacote sanitizado validado localmente.
O baseline conhecido: checkpoint documentado `1696126f`, migrations até `0012_hard_runaways`.

## Regra de continuidade

A reconstrução continuará a partir do que foi recuperado. O material perdido não será tratado como disponível e nenhuma decisão de schema será inventada para parecer compatível com o checkpoint ausente `232a1b7e`.

Até existir banco de teste configurado e validado:

- não executar `drizzle-kit migrate`;
- não apontar para banco de produção;
- não reusar refresh tokens sem confirmação da chave de criptografia;
- não ativar publicação automática;
- não autorizar canais nem publicar comentários;
- não apagar ou sobrescrever o pacote recuperado.

## Baseline preservado

- React + Express + tRPC + Drizzle.
- MySQL/TiDB.
- 20 tabelas e migrations sequenciais `0000`–`0012`.
- 103 testes aprovados em ambiente sem secrets; 1 teste OAuth externo fica opt-in.
- `pnpm check` aprovado.
- `pnpm build` aprovado.
- Publicação manual apenas após aprovação humana.
- Outbox com lease, retry, idempotência e reconciliação.

## Lacuna conhecida

`youtubeConnections.ownerOpenId` é único e o código seleciona uma conexão por proprietário. Isso suporta um canal por conta, não cinco canais. Além disso, drafts, outbox, publicações e automação não possuem um alvo de canal de publicação explícito.

Não é seguro apenas remover o `UNIQUE`: isso faria a leitura de uma conta com cinco conexões ficar ambígua e poderia publicar em canal errado.

## Desenho-alvo antes da migration

A adaptação multicanal precisa estabelecer, em conjunto:

1. **Identidade permanente do projeto** — `projects` e `projectMembers`, para que a suspensão/troca de conta Manus não troque o dono lógico dos dados.
2. **Perfil de canal** — uma linha por canal-alvo, com `projectId`, `channelId`, nome, status, regras de intervalo e perfil editorial.
3. **Conexão OAuth por canal** — uma linha por `channelProfileId`, com tokens cifrados, status, escopos e expiração; `channelId` único por projeto.
4. **Alvo explícito de publicação** — drafts/outbox/publications devem carregar `channelProfileId` ou uma referência equivalente. A seleção do canal não pode depender apenas do `ownerOpenId`.
5. **Isolamento de automação** — lease, limite diário, intervalo por canal, queries e agendamento precisam ter escopo de projeto/canal.
6. **Migração compatível** — os registros atuais devem ser associados a um projeto e a um perfil de canal legado sem perder a conexão existente.
7. **Fallback temporário auditado** — consultas antigas por `ownerOpenId` somente durante a transição, com logs de qual projeto/canal foi selecionado; remoção após backfill e testes.

## Fases de implementação

### Fase 1 — contrato e segurança

- manter schema atual intacto;
- adicionar testes de contrato para rejeitar seleção ambígua de conexão;
- documentar invariantes e matriz de ownership;
- separar testes unitários de integração OAuth/banco;
- garantir que publicação continue desligada por padrão.

### Fase 2 — identidade do projeto

- criar migration de `projects` e `projectMembers`;
- backfill do proprietário atual para um projeto Cadena Invisible;
- adicionar índices e foreign keys com `RESTRICT`/`SET NULL` conforme o tipo de dado;
- validar contagens antes/depois e caminho de rollback.

### Fase 3 — canais e OAuth

- criar/normalizar `channelProfiles` com escopo do projeto;
- transformar `youtubeConnections` em relação por perfil de canal;
- atualizar OAuth para receber e validar o `channelProfileId` no state assinado;
- impedir que callback de um canal sobrescreva outro.

### Fase 4 — fila e automação

- acrescentar alvo de canal a drafts, outbox e publications;
- modificar lease/idempotência/reconciliação para incluir canal;
- testar dois canais concorrentes e retry ambíguo;
- manter aprovação humana obrigatória.

### Fase 5 — UI e ensaio controlado

- listar cinco perfis com status independente;
- conectar/reauthorizar um canal por vez;
- executar apenas ingestão e geração de rascunhos em banco de teste;
- testar publicação manual em canal de teste, com confirmação separada antes de qualquer efeito externo.

## Critérios para avançar

Cada fase só avança quando:

- `pnpm test`, `pnpm check` e `pnpm build` passam;
- migrations são verificadas contra schema e journal;
- nenhum teste usa secrets reais por padrão;
- queries têm filtro explícito de projeto/canal;
- não há seleção silenciosa quando existem múltiplas conexões;
- a outbox não possui item órfão ou duplicado;
- publicação automática permanece bloqueada;
- relatório de contagens e rollback está atualizado.

## Estado atual

A Fase 1 aditiva, a Fase 2 de roteamento, a Fase 3 de automação por canal e a Fase 4 de painel de canais foram concluídas em código: baseline congelado, migrations `0013_panoramic_spitfire`, `0014_fair_sharon_ventura` e `0015_magenta_lockheed`, backfill transacional protegido, OAuth com alvo explícito, painel de status, outbox/publicação por canal, leases, intervalos e deduplicação por canal validados. O próximo avanço depende de confirmar um banco TiDB/MySQL novo, verificar duplicidades, executar o dry-run do backfill e só então aplicar as migrations; sem `DATABASE_URL`, nenhuma migration foi aplicada.

Uma auditoria transversal posterior adicionou as migrations corretivas `0016_safe_shotgun` e `0017_peaceful_cobalt_man`, reforçou autorização, concorrência da outbox, limite diário, sincronização da UI e retenção de histórico. Antes de instalação real, os gates de banco, backfill de conexões legadas, OAuth externo, corrida de schedules e lease longo descritos em `docs/AUDIT-ALL-PHASES-2026-09-29.md` permanecem obrigatórios.
