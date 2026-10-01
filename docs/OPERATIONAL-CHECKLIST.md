# Cadena Invisible — Checklist operacional

## Objetivo

Organizar o Cadena Invisible em um ciclo reproduzível de **separação, descoberta, iteração e publicação supervisionada**, priorizando o contexto do vídeo e medindo ressonância real.

## Checklist autorizado

### 1. Separação

- [x] Separar descoberta, triagem editorial, revisão humana, publicação e reconciliação.
- [x] Manter publicação automática desativada no MVP.
- [x] Isolar operações por proprietário e por canal.
- [x] Usar outbox idempotente para publicações aprovadas.
- [x] Manter vídeos, rascunhos e eventos de engajamento persistidos.

### 2. Descoberta

- [x] Buscar oportunidades por contexto, recência, conversa e potencial — sem limiar fixo de visualizações.
- [x] Deduplicar vídeos e limitar intervalo por canal.
- [x] Priorizar a ideia, a tensão e o contexto do vídeo.
- [x] Tratar “Amém”, elogios curtos, hashtags excessivas e CTAs do canal como evidência insuficiente de dor pessoal.
- [x] Usar comentários de espectadores somente quando houver exposição pessoal ou pedido real de ajuda.
- [ ] Adicionar filtros editoriais por nicho, idioma, país e tipo de oportunidade.

### 3. Iteração editorial

- [x] Gerar comentário no vídeo principal como modalidade padrão.
- [x] Gerar resposta específica somente quando houver comentário-fonte pessoal e relevante.
- [x] Manter contexto do vídeo visível na fila como “Contexto do vídeo”.
- [x] Regenerar rascunhos mantendo o mesmo vídeo validado.
- [x] Bloquear linguagem comercial, pagamento, escassez, promessa e pressão.
- [x] Manter proporção editorial de aproximadamente 80% sem link e 10% com link, sempre sujeita a revisão.
- [ ] Adicionar comparação lado a lado entre evidência do vídeo, comentário-fonte e texto gerado.
- [x] Registrar feedback humano por motivo: genérico, artificial, fora de contexto, comercial ou adequado.

### 4. Publicação

- [x] Exigir aprovação humana antes de publicar.
- [x] Publicar somente textos validados e aprovados.
- [x] Usar outbox, deduplicação e reconciliação pós-publicação.
- [x] Manter publicação separada de descoberta e geração.
- [ ] Criar visão de lote: aprovados, publicados, incertos, falhos e aguardando reconciliação.

### 5. Monitoramento de engajamento real

- [x] Monitorar respostas, menções, curtidas observadas, verificação e remoção.
- [x] Registrar eventos por publicação.
- [x] Reconciliar o estado externo do YouTube.
- [ ] Criar alerta de ressonância baseado em interação orgânica observada.
- [ ] Exibir qualidade das respostas, não apenas quantidade.
- [ ] Medir retorno voluntário ao comentário e visitas qualificadas sem inferir conversão automaticamente.
- [ ] Criar relatório por vídeo, canal, nicho e variação editorial.

## Integridade editorial

- [x] Não inventar identidade, dor, experiência ou resultado de leitura.
- [x] Usar primeira pessoa somente quando houver memória editorial confirmada.
- [x] Medir ressonância observada sem prometer alcance, ranking ou conversão.
- [x] Manter aprovação humana antes de qualquer publicação.

## Correções de lacunas — 2026-10-01

- [x] Remover o bloqueio indevido que permitia somente um vídeo por canal em cada rodada; o limite agora é o limite diário configurado por canal.
- [x] Corrigir a proporção de links para usar o limite efetivo do canal, inclusive quando configurado acima de 30 rascunhos.
- [x] Renovar o lease da outbox durante chamadas externas longas, reduzindo o risco de reaquisição prematura.
- [ ] Implementar fencing token e finalização transacional completa da outbox antes de afirmar exactly-once externo.
- [ ] Resolver estados `uncertain` somente por reconciliação ou requeue manual auditado; não automatizar retry cego.

## Critério de avanço

Um lote só avança quando:

- o vídeo foi validado;
- a evidência editorial está clara;
- o texto nasce do contexto correto;
- o risco foi avaliado;
- a revisão humana foi concluída;
- a publicação foi registrada no outbox;
- a reconciliação externa foi realizada;
- o engajamento observado foi separado de qualquer métrica artificial ou inferida.
