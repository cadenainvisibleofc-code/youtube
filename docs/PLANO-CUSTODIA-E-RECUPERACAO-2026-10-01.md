# Cadena Invisible — Plano canônico de custódia e recuperação

**Data:** 2026-10-01
**Fonte de código:** GitHub `cadenainvisibleofc-code/youtube`
**Banco primário:** Supabase `PROJETO CADENA YOUTUBE` (`thliiwlagdmnqjwzmiyt`)
**Deploy atual:** `https://cadenaiv-tqbkbmxw.manus.space`
**Status:** fonte de verdade operacional

## 1. Objetivo

Garantir que o Cadena Invisible possa ser reconstruído em outra conta Manus sem perder código, schema, migrations, dados, histórico editorial, conexões, regras, documentos ou capacidade de recuperação.

A conta Manus é ambiente de execução e publicação. Ela não deve ser a única custódia do projeto.

## 2. Fontes de verdade

| Recurso | Fonte primária | Cópia/controle |
|---|---|---|
| Código e testes | GitHub `cadenainvisibleofc-code/youtube` | checkout local e checkpoint Git |
| Schema e migrations | GitHub, `drizzle/schema.ts`, `drizzle/pg/` | manifest de migrations aplicado no Supabase |
| Dados operacionais | Supabase PostgreSQL | dumps criptografados e verificados |
| Secrets | cofre da conta ativa | inventário de nomes e procedimento de reentrada, nunca valores no GitHub |
| Tokens YouTube | Supabase cifrados + chave no cofre | backup cifrado da chave em custódia separada |
| Arquivos enviados | storage do projeto | inventário e cópia externa controlada |
| Regras editoriais | GitHub em `docs/` e `shared/` | export do projeto Manus quando disponível |
| Deploy | Manus/WebDev | URL, projeto, checkpoint e procedimento de republicação |

## 3. Regra de ouro

Nenhuma conta Manus, repositório, cofre ou banco isoladamente é backup suficiente. A recuperação exige a combinação de:

1. checkout GitHub;
2. banco Supabase ou dump restaurável;
3. secrets reintroduzidos por nomes e ambiente;
4. arquivos do storage;
5. configuração OAuth revisada;
6. testes de reconstrução.

## 4. Estado auditado em 2026-10-01

- GitHub autenticado como `cadenainvisibleofc-code`.
- Repositório `cadenainvisibleofc-code/youtube` existente e inicialmente vazio; o código local deve ser enviado para ele.
- Supabase ativo e saudável em `sa-east-1`.
- 23 tabelas públicas com RLS habilitado.
- Nenhuma política pública; o acesso pretendido é server-side.
- 1 projeto, 1 membro, 5 slots de canal e 5 conexões YouTube.
- 4 memórias editoriais.
- 0 drafts, 0 itens de outbox e 0 publicações.
- Preflight sem nulos de escopo ou duplicatas nas verificações executadas.
- Advisors: 23 avisos informativos de RLS sem política, coerentes com o modelo server-side; 4 funções com `search_path` mutável, que devem ser corrigidas.
- Advisors de performance apresentam índices ainda não utilizados; não remover índices em banco de produção sem histórico de carga.

## 5. O que deve estar no GitHub

Versionar:

- `client/`, `server/`, `shared/`;
- `drizzle/schema.ts`, `drizzle/relations.ts`;
- `drizzle/pg/` e o manifest de aplicação;
- testes;
- scripts de auditoria, backup e restauração;
- `package.json`, `pnpm-lock.yaml`, configurações de build;
- documentação de governança, operação, portabilidade e recuperação;
- `SECRETS-TEMPLATE.txt` sem valores reais;
- assets necessários ao build.

Nunca versionar:

- `.env*`;
- `.project-config.json`;
- tokens OAuth ou cookies;
- secrets e chaves de API;
- a chave de cifragem em texto claro;
- dumps de banco não criptografados;
- logs com payloads;
- `node_modules`, `dist`, caches ou arquivos de runtime.

## 6. Backup do Supabase

O backup de dados deve ser criado fora da Manus, em armazenamento privado e criptografado. O arquivo deve conter schema e dados do PostgreSQL, inclusive tokens já cifrados. A chave `YOUTUBE_TOKEN_ENCRYPTION_KEY` continua sendo necessária para tornar os tokens úteis após a restauração.

### Rotina mínima

- backup completo semanal;
- backup antes de qualquer migration;
- backup após mudança estrutural importante;
- backup antes de trocar conta Manus, domínio ou OAuth;
- retenção de pelo menos três pontos de restauração;
- checksum SHA-256 de cada artefato;
- teste de restauração mensal em banco separado.

O script versionado `scripts/export-supabase-backup.sh` não imprime a URI nem os dados. Ele exige confirmação explícita via `BACKUP_CONFIRM=YES`, cria dump customizado, gera checksum e escreve um manifesto sem secrets.

### Antes de restaurar

1. confirmar que o arquivo e o checksum correspondem;
2. confirmar que o destino é um projeto Supabase de restauração, nunca o primário;
3. confirmar a compatibilidade de PostgreSQL;
4. restaurar schema e dados;
5. aplicar somente migrations posteriores ao ponto do dump;
6. executar auditoria read-only;
7. testar login, isolamento, OAuth e fila sem publicar;
8. só então considerar promoção.

## 7. Migrations e drift

Toda mudança de banco deve seguir esta ordem:

1. alteração no schema Drizzle;
2. migration PostgreSQL versionada em `drizzle/pg/`;
3. preflight read-only;
4. backup verificado;
5. aplicação no Supabase;
6. verificação de migration, colunas, índices, FKs, RLS e dados;
7. teste local e publicação compatível;
8. atualização do manifest e da documentação.

Nunca usar `pnpm db:push` cegamente em produção. O histórico MySQL/TiDB em `drizzle/*.sql` é legado e não deve ser executado no Supabase.

## 8. Segredos e chaves

O GitHub guarda somente nomes, contratos e placeholders. Os valores permanecem no cofre. Para trocar de conta Manus:

1. criar o projeto novo;
2. inserir os mesmos nomes de secrets no cofre novo;
3. reutilizar a mesma `YOUTUBE_TOKEN_ENCRYPTION_KEY` se tokens existentes forem restaurados;
4. apontar `SUPABASE_DATABASE_URL` para o Supabase correto;
5. configurar `OWNER_OPEN_ID` somente após login real;
6. revisar `YOUTUBE_OAUTH_REDIRECT_URI` e Google Cloud;
7. validar que nenhum valor apareceu em logs.

Se a chave de cifragem for perdida, os tokens YouTube existentes não podem ser recuperados; nesse caso, é necessária reautorização controlada dos canais.

## 9. Procedimento de troca de conta Manus

### Preparação

- congelar o checkpoint estável;
- confirmar GitHub atualizado;
- criar backup do Supabase e verificar checksum;
- exportar/inventariar arquivos de storage;
- registrar migrations aplicadas;
- registrar nomes de secrets, sem valores;
- manter a conta atual como rollback.

### Nova conta

- importar o projeto a partir do GitHub;
- instalar dependências;
- inserir secrets pelo cofre;
- conectar ao Supabase primário somente se o teste não escrever dados reais;
- preferencialmente usar uma cópia restaurada do Supabase para desenvolvimento;
- rodar `pnpm check`, `pnpm test`, `pnpm build` e `pnpm portability:check`;
- validar login e dashboard;
- validar isolamento de cinco canais;
- testar geração e revisão sem publicação externa;
- confirmar callback OAuth HTTPS.

### Promoção

A promoção é controlada, não automática:

1. comparar commit e manifest;
2. confirmar banco e secrets;
3. executar smoke test;
4. manter domínio e conta anterior prontos para rollback;
5. publicar uma única alteração;
6. verificar healthcheck e fluxo autenticado;
7. só depois encerrar a instância anterior.

## 10. Auditoria periódica

Mensalmente verificar:

- GitHub com histórico íntegro e branch principal atualizada;
- ausência de secrets rastreados;
- dump recente e restaurável;
- checksum e manifesto presentes;
- migrations GitHub = migrations aplicadas no Supabase;
- RLS habilitado;
- nenhuma política pública inesperada;
- zero órfãos, duplicatas ou divergências de canal;
- outbox sem estado incerto não tratado;
- tokens cifrados e chave preservada;
- callback OAuth e domínio vigentes;
- backups de storage disponíveis;
- procedimento de restauração executável por outra pessoa.

## 11. Limite de garantia

Este plano reduz o risco de perda, mas não cria sincronização automática entre GitHub, Supabase e Manus. Cada backup é um ponto no tempo. O backup só é considerado válido quando foi criado, checksum foi conferido e uma restauração de teste demonstrou que ele funciona.
