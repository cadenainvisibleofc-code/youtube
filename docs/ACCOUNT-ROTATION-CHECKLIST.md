# Checklist de transição entre contas — Cadena Invisible

> **Checklist histórico do ZIP original MySQL/TiDB.** A afirmação de "banco atual" abaixo se refere ao ambiente de referência datado de 28/09/2026, não ao código agora convertido para PostgreSQL; nenhuma migration nem dados foram transferidos nesta conversão. Veja README antes de executar procedimentos de banco.

**Data de referência:** 28/09/2026
**Checkpoint de código:** `cb280bbe`
**Projeto atual:** `cadena-invisible-panel-migrado`
**Domínio de produção:** `https://cadenainv-3aa2uun3.manus.space`
**Banco atual:** MySQL/TiDB gerenciado pelo WebDev
**Supabase:** não faz parte desta fase

## Objetivo

Preparar uma segunda conta Manus para continuar o desenvolvimento sem interromper a produção, perder histórico, quebrar OAuth ou misturar dados de teste com o banco principal.

A troca de conta será tratada como **criação de uma cópia de desenvolvimento validável**, não como migração imediata da produção.

## Estado atual confirmado

- [x] Código atualizado até o checkpoint `cb280bbe`.
- [x] Migrations Drizzle presentes até `0012_hard_runaways`.
- [x] `pnpm portability:check` em estado `ready`.
- [x] `pnpm check` e `pnpm build` aprovados no último ciclo.
- [x] Publicação automática bloqueada no MVP.
- [x] Aprovação humana obrigatória antes de qualquer publicação.
- [x] Outbox idempotente e reconciliação pós-publicação implementados.
- [x] Filtro editorial de espanhol e bloqueio de português brasileiro/inglês implementados.
- [x] Contexto do vídeo priorizado na geração editorial.
- [x] Runbook de portabilidade e inventário existentes.
- [x] Domínio publicado estável usado para OAuth do YouTube.
- [ ] Publicação piloto real validada em produção.
- [ ] Desacoplamento estrutural de `ownerOpenId` concluído.
- [ ] Exportação formal de histórico em JSON/CSV criada.

## O que permanece na conta atual

A conta atual continua sendo o **ponto de produção e rollback** até a nova conta passar por todos os gates.

- [ ] Projeto publicado e domínio estável.
- [ ] Banco MySQL/TiDB principal.
- [ ] Dados atuais, vídeos, rascunhos, publicações e eventos.
- [ ] Conexão OAuth do YouTube e tokens cifrados.
- [ ] `YOUTUBE_TOKEN_ENCRYPTION_KEY` original, preservada sem alteração.
- [ ] Secrets de produção no cofre da plataforma.
- [ ] Cliente OAuth atual e callback de produção.
- [ ] Checkpoint estável para rollback.
- [ ] Acesso ao Drive e aos arquivos oficiais.

**Regra:** não apagar, resetar, migrar ou apontar a nova conta para o banco principal durante a validação inicial.

## O que vai para a nova conta

Transportar somente artefatos reproduzíveis e sem segredos:

- [ ] Código-fonte completo.
- [ ] `package.json` e `pnpm-lock.yaml`.
- [ ] `drizzle/schema.ts`, `drizzle/relations.ts` e todas as migrations até `0012`.
- [ ] Testes Vitest.
- [ ] Biblioteca editorial e regras de humanização.
- [ ] Documentação de operação, portabilidade e continuidade.
- [ ] `SECRETS-TEMPLATE.txt`, somente com nomes e formatos.
- [ ] Patches necessários, como o patch do Wouter.
- [ ] Configuração necessária para build, sem valores privados.
- [ ] Um ZIP sanitizado gerado a partir do checkpoint estável.

Não transportar:

- `.env`, `.env.*` ou arquivos de cofre.
- `.project-config.json`.
- `node_modules`.
- `dist` e caches de build.
- `.manus-logs`.
- Tokens OAuth, refresh tokens, cookies ou sessões.
- Dumps de banco sem criptografia.
- Chaves de API, client secrets, JWT secrets ou chaves de cifragem.

## O que pode ser atualizado a partir da nova conta

Pode voltar para a conta atual após revisão e novo checkpoint:

- Correções de código.
- Melhorias da interface.
- Testes e documentação.
- Ajustes editoriais.
- Melhorias de idempotência, outbox e reconciliação.
- Correções que não exigem mudança de schema.
- Migrations novas, desde que revisadas, testadas e aplicadas explicitamente.

Não deve ser sincronizado automaticamente:

- Banco de produção.
- Secrets.
- Tokens do YouTube.
- Identidade Manus da conta atual.
- Configuração OAuth sem revisar callback e cliente.
- Dados de teste misturados aos dados reais.
- Publicação externa.

O fluxo seguro é: **nova conta → testes → revisão → checkpoint → promoção controlada na conta atual**.

## Plano por fases

### Fase 0 — Congelamento e fotografia do estado

- [ ] Não executar migrations na produção.
- [ ] Não trocar `DATABASE_URL`.
- [ ] Não trocar `YOUTUBE_TOKEN_ENCRYPTION_KEY`.
- [ ] Não reautorizar o YouTube na conta nova apontando para produção sem plano de rollback.
- [ ] Salvar o checkpoint atual e registrar sua identificação.
- [ ] Registrar a lista de migrations presentes.
- [ ] Registrar o resultado de `pnpm test`, `pnpm check`, `pnpm build` e `pnpm portability:check`.

### Fase 1 — Preparação do pacote

- [ ] Gerar ZIP sanitizado do código.
- [ ] Conferir que o ZIP não contém `.env`, `.project-config.json`, `node_modules`, `dist` ou logs.
- [ ] Conferir que contém `package.json`, lockfile, `drizzle/`, `server/`, `client/`, `shared/`, `docs/` e testes.
- [ ] Atualizar este checklist e o inventário.
- [ ] Subir o ZIP e os documentos atuais na pasta `00 — ATUAL — ... USAR ESTA` do Drive.
- [ ] Manter as pastas `99 — HISTÓRICO` sem alterações destrutivas.

### Fase 2 — Criação da cópia na nova conta

- [ ] Criar projeto Fullstack/Web DB User na nova conta.
- [ ] Importar o ZIP sanitizado.
- [ ] Rodar `pnpm install`.
- [ ] Inserir secrets somente pelo cofre da nova conta.
- [ ] Usar nomes de variáveis idênticos aos do template.
- [ ] Usar banco de teste ou cópia controlada, nunca o banco principal por engano.
- [ ] Não executar `pnpm db:push` cegamente.
- [ ] Comparar schema e migrations antes de aplicar qualquer migration.

### Fase 3 — Validação técnica da nova conta

- [ ] `pnpm test` aprovado.
- [ ] `pnpm check` aprovado.
- [ ] `pnpm build` aprovado.
- [ ] `pnpm portability:check` em `ready`.
- [ ] Servidor e preview saudáveis.
- [ ] Login Manus funcionando.
- [ ] Dashboard e rotas principais funcionando.
- [ ] Fila de revisão funcionando.
- [ ] Regras editoriais carregadas.
- [ ] Publicação automática continua bloqueada.
- [ ] Outbox e reconciliação passam nos testes.
- [ ] Nenhum callback aponta para host temporário de preview.

### Fase 4 — OAuth e YouTube

- [ ] Confirmar se a nova conta usará o domínio publicado atual ou um novo domínio.
- [ ] Cadastrar o callback HTTPS exato no Google Cloud somente quando definido.
- [ ] Não remover o callback de produção atual.
- [ ] Adicionar a conta do canal como Test user quando o OAuth estiver em Testing.
- [ ] Reautorizar o canal somente em ambiente controlado.
- [ ] Confirmar escopo de publicação necessário.
- [ ] Confirmar que a chave de cifragem é compatível com tokens que precisem ser preservados.
- [ ] Testar conexão, listagem de canais e retorno do callback.

### Fase 5 — Validação editorial e operacional

- [ ] Importar ou criar dados de teste controlados.
- [ ] Validar vídeo em espanhol.
- [ ] Validar contexto do vídeo antes do comentário-fonte.
- [ ] Validar texto sem tom robótico, comercial ou pressionador.
- [ ] Validar proporção aproximada 80/10/10.
- [ ] Validar link somente quando fizer sentido.
- [ ] Editar, aprovar e descartar rascunhos.
- [ ] Simular publicação sem executar publicação externa.
- [ ] Conferir outbox, deduplicação, retries e reconciliação.

### Fase 6 — Promoção controlada

- [ ] Comparar a nova conta com o checkpoint atual.
- [ ] Revisar diferenças de código, migrations e secrets.
- [ ] Criar novo checkpoint na nova conta.
- [ ] Definir se a nova conta será apenas desenvolvimento ou futura produção.
- [ ] Promover somente uma mudança por vez.
- [ ] Manter a conta atual como rollback.
- [ ] Após cada promoção, executar testes e smoke test.
- [ ] Só então considerar piloto real com poucos canais.

## Critérios de promoção

A nova conta não pode assumir produção enquanto algum item abaixo estiver pendente:

- TypeScript sem erros.
- Suíte Vitest aprovada.
- Build aprovado.
- Portability check em `ready`.
- Banco correto confirmado.
- Migrations conferidas.
- OAuth HTTPS validado.
- Nenhum callback de preview em produção.
- Publicação automática bloqueada.
- Backup e chave de cifragem preservados.
- Rollback documentado.
- Outbox sem itens órfãos ou duplicados.

## Decisão sobre a identidade do projeto

O sistema ainda usa `ownerOpenId` em várias tabelas. Portanto, **não vamos tentar resolver a identidade permanente nesta troca de conta**.

A fase futura deverá criar `projectId` e `projectMembers`, fazer backfill e manter fallback temporário. Isso exige migration, testes, auditoria e rollback próprios.

## Banco e Supabase

Nesta transição:

- O banco continua MySQL/TiDB.
- Nenhum schema PostgreSQL será criado.
- Nenhum dado será migrado para Supabase.
- Nenhuma URL de banco será trocada para PostgreSQL.
- O plano de portabilidade permanece independente de Supabase.

## Organização recomendada no Drive

Pasta atual oficial:

- `00 — ATUAL — ... — USAR ESTA`

Colocar nessa pasta:

- ZIP sanitizado mais recente.
- Este checklist.
- Runbook atualizado.
- Inventário atualizado.
- Documento-mãe atualizado.
- Template de secrets sem valores.
- Registro do último checkpoint.

Manter sem alteração destrutiva:

- `99 — HISTÓRICO — TRANSFERÊNCIA LIMPA ...`
- `99 — HISTÓRICO — ARQUIVOS ORIGINAIS`
- `99 — HISTÓRICO — NÃO USAR PARA NOVA INSTALAÇÃO`

## Regra prática sobre créditos

A continuidade do projeto não deve depender de uma quantidade específica de créditos. A conta atual pode permanecer como conta de produção, rollback e manutenção, enquanto a nova conta recebe o desenvolvimento exploratório.

Não é necessário consumir os créditos da conta atual para fazer a transição. O importante é preservar o estado, o código, o banco, os secrets e o checkpoint. Qualquer decisão sobre quantos créditos manter em cada conta é uma decisão operacional separada deste checklist.

## Rollback

Se a nova conta falhar:

1. Não alterar o domínio de produção.
2. Não alterar o banco principal.
3. Não trocar secrets da produção.
4. Voltar ao checkpoint estável da conta atual.
5. Registrar o erro na pasta de histórico.
6. Corrigir na nova conta sem tocar na produção.
7. Repetir os gates antes de tentar nova promoção.
