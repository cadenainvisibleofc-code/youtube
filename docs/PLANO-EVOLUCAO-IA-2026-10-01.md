# Cadena Invisible — Plano de evolução da IA

**Data:** 2026-10-01
**Status:** planejamento aprovado para execução posterior
**Escopo:** humanização, economia de tokens, pesquisa editorial, planejamento semanal, preparação diária por clique e aprendizado supervisionado

> Este documento define **o que será construído e em que ordem**. Nenhuma mudança de código, migration, configuração de modelo ou publicação é autorizada por este documento isoladamente.

---

## 1. Objetivo do programa

Evoluir a IA do Cadena Invisible de um assistente que já pesquisa, gera rascunhos e mantém aprovação humana para uma **mesa editorial supervisionada**, capaz de:

1. entender melhor o contexto humano de cada vídeo;
2. escrever com voz própria por canal sem parecer robótica;
3. pesquisar mais oportunidades com menos chamadas caras;
4. economizar tokens por compactação semântica e roteamento de modelos;
5. montar um planejamento semanal explícito;
6. preparar o conteúdo do dia somente quando o operador clicar;
7. manter cada canal, fila, memória e decisão isolados;
8. aprender com feedback humano sem alterar princípios por conta própria;
9. nunca publicar externamente sem aprovação humana explícita.

---

## 2. Invariantes que não podem ser quebrados

Estas regras são pré-condições de todas as fases:

- Aprovação humana continua obrigatória para toda publicação externa.
- Autopublicação permanece desativada.
- A IA pode pesquisar, classificar, sugerir, gerar e preparar; não pode aprovar por inferência.
- O clique diário prepara ou publica somente o que o operador autorizou naquela ação.
- O canal de destino deve ser explícito quando houver mais de um canal.
- Nunca misturar tokens, conexão OAuth, memória, histórico, drafts ou outbox entre canais.
- Nunca alterar automaticamente o Pacto dos Guardiões, regras de risco ou princípios editoriais.
- Feedback humano pode alterar estilo operacional somente após revisão e aprovação registrada.
- Estados incertos de publicação nunca devem ser retentados cegamente.
- Pesquisas e análises devem respeitar a cota do YouTube e os limites de custo de IA.
- Nenhum resultado editorial deve inventar fato, dor, experiência, intenção ou resultado.
- Em crise, abuso, violência, risco médico ou vulnerabilidade intensa, não deve haver promoção.
- Secrets, tokens, URLs privadas e credenciais nunca entram em prompts, logs ou documentos.

---

## 3. Estado atual conhecido

O sistema já possui:

- geração editorial com contexto do vídeo e comentário;
- fallback determinístico quando o LLM falha;
- compactação básica dos campos de entrada;
- histórico do chat limitado;
- limite de ciclos de ferramentas;
- ferramentas de busca, preparação, automação e fila;
- garimpo semanal que salva vídeos no acervo;
- preparação diária de drafts;
- configuração por canal para limite, cooldown, consultas e link;
- feedback humano categorizado;
- até cinco canais por projeto;
- outbox idempotente e reconciliação;
- RLS e escopo de canal no Supabase;
- publicação humana obrigatória.

As lacunas principais são:

- não existe perfil de voz persistente por canal;
- a memória do chat ainda pode enviar histórico bruto demais;
- resultados de ferramentas ainda podem ser mais compactos;
- não existe orçamento de tokens por operação;
- a pesquisa ainda é principalmente baseada em consultas e expansão simples;
- o garimpo semanal ainda não é um plano editorial persistente;
- não existe calendário semanal com estados e aprovação de pauta;
- não existe um fluxo explícito de “preparar conteúdo de hoje” baseado em pautas aprovadas;
- métricas de qualidade, custo, tokens e ressonância ainda são incompletas;
- falta uma avaliação lado a lado da evidência e do texto gerado.

---

# 4. Arquitetura-alvo

## 4.1 Pipeline editorial

```text
Pesquisa ampla
  ↓
Triagem programática
  ↓
Enriquecimento seletivo
  ↓
Ranking editorial
  ↓
Planejamento semanal
  ↓
Aprovação/edição da pauta
  ↓
Preparação diária por clique
  ↓
Geração por canal
  ↓
Validação determinística
  ↓
Avaliação de qualidade
  ↓
Fila de revisão humana
  ↓
Aprovação humana individual
  ↓
Outbox
  ↓
Publicação externa
  ↓
Reconciliação e métricas
```

A IA nunca deve saltar diretamente de pesquisa para publicação.

## 4.2 Separação de responsabilidades

### Código determinístico

Responsável por:

- canal e autorização;
- limites diários;
- cooldown;
- deduplicação;
- cotas;
- risco técnico;
- estados de workflow;
- aprovação humana;
- outbox;
- reconciliação;
- cálculo de orçamento;
- isolamento de dados.

### Modelo de IA

Responsável por:

- resumir e interpretar contexto;
- classificar oportunidade;
- identificar tensão narrativa;
- sugerir pauta;
- redigir variações;
- avaliar naturalidade;
- sugerir aprendizados pendentes.

### Operador humano

Responsável por:

- aprovar perfil de voz;
- aprovar pautas semanais;
- editar ou descartar drafts;
- aprovar publicação individual;
- aprovar aprendizados;
- decidir casos ambíguos ou de risco.

---

# 5. Fases de execução

## Fase 0 — Instrumentação e linha de base

### Objetivo

Medir o sistema atual antes de mudar o comportamento editorial.

### Entregas

- registrar tokens de entrada e saída por operação, quando o provedor disponibilizar;
- registrar modelo usado, latência e status da chamada;
- registrar número de regenerações por draft;
- registrar tempo entre geração, revisão e decisão;
- registrar motivos de bloqueio;
- separar chamadas de pesquisa, classificação, geração e avaliação;
- criar dashboard interno de custo e qualidade por canal.

### Critérios de aceite

- nenhuma chave ou conteúdo sensível aparece nos logs;
- cada chamada recebe `operationType`, `projectChannelId`, `model`, `success` e duração;
- falhas de observabilidade não bloqueiam o fluxo editorial;
- a instrumentação não envia o texto completo para logs por padrão;
- é possível comparar a linha de base antes e depois das próximas fases.

### Dependências

Nenhuma migration de conteúdo. Pode começar somente com índices e métricas técnicas.

---

## Fase 1 — Humanização e voz por canal

### Objetivo

Fazer a IA escrever de forma mais natural e diferente para cada canal, sem transformar exemplos em regras rígidas.

### Dados a criar

Criar um perfil de voz por `projectChannelId`, contendo:

- nome do perfil;
- descrição do tom;
- nível de informalidade;
- comprimento preferido;
- vocabulário preferido;
- vocabulário a evitar;
- uso de primeira pessoa permitido ou não;
- grau de espiritualidade explícito;
- exemplos aprovados;
- exemplos rejeitados e motivo;
- versão do perfil;
- status `draft`, `approved` ou `archived`;
- quem aprovou e quando.

### Comportamento

- exemplos aprovados servem como referência de ritmo e voz;
- nunca copiar literalmente exemplos sem necessidade;
- o perfil não pode relaxar os guardrails;
- qualquer alteração do perfil passa por aprovação humana;
- cada canal possui perfil independente;
- na ausência de perfil, usar o padrão editorial atual.

### Avaliação de humanização

Adicionar avaliador com saída estruturada:

- `contextualAnchor`: possui detalhe concreto?
- `naturalnessScore`: parece comentário humano?
- `specificityScore`: evita generalidade?
- `commercialityRisk`: há tom promocional?
- `roboticSignals`: lista de sinais artificiais;
- `needsHumanReview`: booleano;
- `reason`: justificativa curta.

O avaliador não aprova publicação. Ele apenas prioriza a revisão.

### Critérios de aceite

- dois canais podem receber textos diferentes para o mesmo vídeo;
- a identidade editorial de um canal não vaza para outro;
- drafts sem âncora contextual são bloqueados ou marcados para revisão reforçada;
- a IA não usa experiência pessoal inventada;
- feedback “artificial” e “genérico” pode ser associado ao canal correto;
- o perfil nunca modifica o Pacto ou regras de risco.

---

## Fase 2 — Economia de tokens e contexto compacto

### Objetivo

Reduzir custo e latência sem reduzir qualidade editorial.

### 2.1 Memória compacta do chat

Substituir o envio de histórico bruto por:

- resumo persistente da conversa;
- últimas 4–6 mensagens completas;
- decisões e pendências relevantes;
- preferências operacionais atuais;
- resultados de ferramentas somente quando ainda forem necessários.

Manter o histórico integral no banco, mas não reenviar tudo ao modelo.

### 2.2 Compressão semântica

Criar funções separadas para compactar:

- vídeo;
- comentário;
- resultado de busca;
- memória editorial;
- histórico de ferramentas;
- anexos transcritos.

A compactação deve preservar:

- entidade;
- data;
- canal;
- evidência;
- risco;
- decisão;
- incerteza.

Não deve preservar texto ornamental desnecessário.

### 2.3 Roteamento por custo

Usar modelo econômico para:

- classificação;
- extração de tema;
- resumo;
- tags;
- primeiro filtro de naturalidade.

Usar modelo intermediário para:

- redação editorial;
- planejamento semanal;
- comparação de evidências.

Usar modelo forte somente para:

- casos ambíguos;
- conflito entre evidências;
- risco editorial relevante;
- revisão de qualidade que falhou no modelo econômico.

### 2.4 Orçamento por operação

Cada operação deve ter orçamento explícito:

| Operação | Entrada máxima | Saída máxima | Estratégia |
|---|---:|---:|---|
| Resumo de vídeo | compacta | curta | modelo econômico |
| Classificação de comentário | compacta | JSON pequeno | modelo econômico |
| Geração de draft | contexto necessário | 250–360 tokens | modelo editorial |
| Avaliação de naturalidade | draft + evidência | JSON curto | modelo econômico |
| Planejamento semanal | candidatos resumidos | JSON estruturado | modelo intermediário |
| Caso ambíguo | evidência selecionada | curta | modelo forte sob demanda |

### 2.5 Cache

Criar cache por hash de:

- vídeo + descrição;
- comentário;
- versão do prompt;
- modelo;
- idioma;
- canal quando a análise depender do perfil.

A cache factual pode ser compartilhada entre canais. A cache de voz deve ser específica por canal.

### Critérios de aceite

- o contexto enviado ao modelo pode ser inspecionado por tamanho e categoria;
- resultados de busca não carregam campos desnecessários;
- chamadas repetidas para a mesma evidência são reutilizadas quando seguro;
- a qualidade não cai além do limite definido na linha de base;
- o sistema degrada para regras determinísticas quando o orçamento é excedido;
- nenhum limite de token é usado para cortar uma decisão crítica sem sinalizar incerteza.

---

## Fase 3 — Pesquisa editorial em funil

### Objetivo

Pesquisar uma quantidade maior de oportunidades sem multiplicar proporcionalmente o custo da API e do LLM.

### Etapas

1. gerar consultas a partir de temas e subtemas do canal;
2. adicionar variações semânticas e perguntas reais;
3. buscar candidatos em volume controlado;
4. deduplicar por vídeo, canal e tema;
5. aplicar filtros determinísticos de idioma, idade, duração, elegibilidade e risco;
6. calcular score técnico inicial;
7. aplicar classificação semântica barata somente aos candidatos restantes;
8. enriquecer comentários apenas nos candidatos finalistas;
9. aplicar ranking editorial;
10. salvar os candidatos no acervo com evidências resumidas.

### Taxonomia de oportunidades

Cada candidato deve poder ser classificado como:

- comentário geral no vídeo;
- resposta a comentário pessoal;
- oportunidade de série;
- tema emergente;
- conversa com alta especificidade;
- possível risco ou caso de revisão reforçada;
- descartado por evidência insuficiente.

### Filtros planejados

- idioma;
- país/região quando disponível;
- nicho;
- tipo de oportunidade;
- faixa de recência;
- duração;
- Shorts versus vídeo longo;
- canal de origem;
- tema já usado;
- risco editorial;
- saturação no acervo.

### Critérios de aceite

- a pesquisa retorna mais candidatos iniciais que o fluxo atual sem ultrapassar a cota configurada;
- somente finalistas recebem enriquecimento caro;
- o ranking mostra evidências e motivo, não somente score;
- o operador pode filtrar por nicho, idioma, país e oportunidade;
- a mesma oportunidade não reaparece indistintamente em canais diferentes;
- candidatos sem evidência pessoal não são tratados como dor pessoal.

---

## Fase 4 — Planejamento semanal persistente

### Objetivo

Transformar o garimpo semanal em um calendário editorial explícito, editável e aprovado.

### Entidades propostas

Criar uma tabela `editorialWeekPlans`:

- `id`;
- `ownerOpenId`;
- `projectChannelId`;
- `weekStart`;
- `weekEnd`;
- `status` (`draft`, `review`, `approved`, `active`, `closed`, `archived`);
- `version`;
- `createdBy`;
- `approvedBy`;
- `approvedAt`;
- `createdAt`;
- `updatedAt`.

Criar uma tabela `editorialWeekItems`:

- `id`;
- `planId`;
- `projectChannelId`;
- `scheduledDate`;
- `priority`;
- `opportunityType`;
- `videoId`;
- `parentCommentId` opcional;
- `evidenceSummary`;
- `editorialRationale`;
- `riskLevel`;
- `status` (`suggested`, `approved`, `blocked`, `prepared`, `review`, `used`, `skipped`);
- `draftId` opcional;
- `skipReason`;
- `createdAt`;
- `updatedAt`.

### Regras

- todos os itens pertencem a um canal explícito;
- o plano semanal pode ser editado antes de aprovação;
- aprovação do plano não aprova publicação;
- um item aprovado pode gerar um draft depois;
- alterar canal, data ou vídeo cria evento de histórico;
- não permitir dois itens incompatíveis no mesmo canal/data sem aviso;
- itens de risco alto/crítico ficam bloqueados ou em revisão reforçada;
- o plano pode ser descartado sem apagar evidências históricas.

### Critérios de aceite

- o usuário consegue visualizar uma semana por canal;
- a IA propõe um plano com justificativa por item;
- o operador pode trocar, bloquear, reordenar ou aprovar itens;
- a semana aprovada não publica nada automaticamente;
- a mesma pauta não é duplicada entre planos ativos;
- a criação de drafts mantém o vínculo com o item da semana.

---

## Fase 5 — Preparação diária por clique

### Objetivo

Executar somente a pauta do dia quando o operador solicitar.

### Fluxo

Botão principal:

> **Preparar conteúdo de hoje**

A ação deve:

1. identificar o canal selecionado;
2. carregar o plano semanal aprovado;
3. selecionar itens do dia ainda não preparados;
4. verificar cooldown, cota e duplicidade;
5. reutilizar evidência já coletada quando válida;
6. buscar atualização somente quando necessário;
7. gerar drafts com o perfil de voz do canal;
8. executar validação determinística;
9. executar avaliação de humanização;
10. colocar os drafts na fila de revisão;
11. marcar os itens como `prepared` ou `review`;
12. mostrar exatamente o que foi preparado e o que foi bloqueado.

### Publicação diária

Botão separado:

> **Publicar aprovados**

Esse botão nunca deve ser acionado pelo planejamento semanal ou pela preparação diária.

### Critérios de aceite

- clicar em preparar não publica nada;
- clicar novamente não duplica drafts;
- o sistema mostra o canal e a data antes de executar;
- nenhum item de outro canal entra na fila selecionada;
- itens sem pauta aprovada não são preparados silenciosamente;
- a publicação continua individualmente aprovada.

---

## Fase 6 — Aprendizado supervisionado

### Objetivo

Fazer a IA melhorar com as decisões humanas sem autoalterar princípios.

### Ciclo

1. registrar feedback por draft;
2. agrupar por canal e tipo de conteúdo;
3. detectar padrões com volume mínimo;
4. gerar proposta de aprendizado;
5. manter a proposta pendente;
6. permitir revisão humana;
7. aplicar somente mudanças de estilo aprovadas;
8. versionar o perfil e permitir rollback.

### Exemplos de aprendizados permitidos

- “Este canal prefere frases mais curtas.”
- “Evitar abertura com fórmula muito institucional.”
- “Em vídeos de luto, usar menos abstração e mais reconhecimento concreto.”
- “Para este canal, respostas específicas funcionam melhor que comentários gerais.”

### Exemplos proibidos de autoaplicação

- remover bloqueio de risco;
- permitir promoção em crise;
- liberar publicação automática;
- aceitar qualquer link;
- ignorar aprovação humana;
- mudar o Pacto dos Guardiões;
- alterar limites de segurança sem revisão.

---

## Fase 7 — Métricas e aprendizado de negócio/editorial

### Métricas de qualidade

- taxa de drafts aprovados sem edição;
- taxa de drafts editados;
- taxa de descarte por “genérico”;
- taxa de descarte por “artificial”;
- taxa de descarte por “fora de contexto”;
- taxa de bloqueio comercial;
- taxa de regeneração;
- qualidade por canal;
- qualidade por tipo de oportunidade;
- qualidade por modelo.

### Métricas de custo

- tokens de entrada por operação;
- tokens de saída por operação;
- custo estimado por draft;
- custo por candidato pesquisado;
- custo por pauta semanal;
- chamadas evitadas por cache;
- chamadas premium evitadas por triagem;
- latência média e p95.

### Métricas de ressonância

- respostas recebidas;
- retorno voluntário ao comentário;
- menções;
- curtidas observadas;
- remoções;
- visitas qualificadas quando disponíveis;
- retorno por canal, vídeo, tema e tipo de abordagem.

Essas métricas não devem ser apresentadas como conversão, cura, alcance garantido ou causalidade sem evidência.

---

# 6. Ordem recomendada de execução

## Marco A — Segurança e observabilidade

1. instrumentação de tokens e latência;
2. compactação do chat;
3. perfis de voz em modo somente leitura/fallback;
4. testes de isolamento por canal.

## Marco B — Qualidade editorial

5. avaliador de naturalidade;
6. comparação lado a lado;
7. feedback associado ao perfil de voz;
8. ranking editorial melhorado.

## Marco C — Pesquisa de maior volume

9. pesquisa em funil;
10. filtros adicionais;
11. cache factual;
12. enriquecimento seletivo.

## Marco D — Planejamento semanal

13. migration das entidades de plano;
14. backend de criação e aprovação;
15. interface semanal;
16. testes de concorrência, duplicidade e canal.

## Marco E — Preparação diária

17. botão e fluxo “Preparar conteúdo de hoje”;
18. vínculo plano → draft;
19. estados e explicações de bloqueio;
20. teste com publicação externa desabilitada.

## Marco F — Otimização e aprendizado

21. roteamento de modelos;
22. orçamento por operação;
23. propostas de aprendizado por feedback;
24. relatório de qualidade, custo e ressonância.

---

# 7. Estratégia de testes

## Testes unitários

- compactação de contexto;
- truncamento seguro;
- orçamento por operação;
- ranking editorial;
- deduplicação de candidatos;
- distribuição semanal;
- vínculo canal/plano/item/draft;
- transições de estado;
- perfil de voz sem relaxar guardrails;
- requeue sem publicação automática.

## Testes de integração

- criar plano para cada um dos cinco canais;
- impedir mistura entre canais;
- preparar o dia duas vezes sem duplicar drafts;
- aprovar plano sem publicar;
- preparar sem plano aprovado;
- bloquear item de risco alto;
- falha de API do YouTube;
- falha de LLM;
- orçamento de tokens excedido;
- concorrência de dois cliques no mesmo dia;
- reconciliação de publicação incerta.

## Testes de regressão

Manter todos os gates existentes:

- `pnpm check`;
- suíte Vitest completa;
- `pnpm build`;
- `pnpm portability:check` quando houver identidade disponível;
- `git diff --check`;
- auditoria SQL read-only;
- verificação de RLS;
- healthcheck público.

Nenhuma migration deve ser aplicada antes de:

1. preflight de duplicatas;
2. dry-run de nulos e órfãos;
3. verificação de constraints atuais;
4. plano de rollback;
5. confirmação de que não haverá backfill implícito.

---

# 8. Rollout seguro

Cada marco deve ser publicado separadamente, com:

1. migration reversível ou compatível com leitura antiga;
2. feature flag por canal;
3. fallback para comportamento anterior;
4. métricas comparáveis;
5. teste em um canal antes dos cinco;
6. período de observação;
7. rollback documentado.

### Sequência de ativação

- primeiro somente observação;
- depois sugestão de perfil;
- depois planejamento semanal em modo rascunho;
- depois preparação diária em um canal;
- depois expansão para os cinco canais;
- publicação humana permanece no fluxo atual durante todo o rollout.

---

# 9. Critérios de sucesso do programa

O programa será considerado concluído quando:

- a IA produzir textos mais específicos e menos genéricos;
- cada canal puder ter voz e planejamento próprios;
- o volume de pesquisa aumentar sem aumento proporcional de custo;
- o custo médio por draft for medido e controlável;
- o histórico enviado ao modelo for compacto e auditável;
- existir um plano semanal persistente e editável;
- o conteúdo diário só for preparado mediante clique;
- a publicação continuar exigindo aprovação humana individual;
- não houver mistura de canais, memórias ou filas;
- feedback humano gerar melhorias versionadas e reversíveis;
- os testes de regressão permanecerem verdes;
- nenhuma regra de segurança tiver sido relaxada para ganhar volume.

---

# 10. Decisões pendentes antes da execução

Estas escolhas devem ser confirmadas ou definidas durante a implementação, não durante a publicação:

1. Quantos drafts por canal devem ser planejados por semana: 5, 7, 10 ou outro número?
2. O plano semanal será por dia fixo ou terá janela flexível?
3. Quais canais terão perfis de voz diferentes inicialmente?
4. Qual é a meta aceitável de custo por draft?
5. Qual queda máxima de qualidade será aceita para reduzir custo?
6. O planejamento semanal deverá incluir somente comentários ou também respostas a comentários?
7. Quais filtros de país e nicho são prioritários?
8. Qual quantidade inicial de candidatos será pesquisada por canal?
9. O plano semanal poderá ser aprovado inteiro ou somente item a item?
10. Quais métricas de ressonância serão consideradas úteis na primeira versão?

Enquanto essas decisões não forem necessárias para uma implementação específica, usar defaults conservadores: **7 itens potenciais por canal/semana, aprovação item a item, preparação diária somente por clique, publicação humana individual e nenhum aumento de cota sem observabilidade**.
