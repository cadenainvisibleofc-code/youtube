# Cadena Invisible — Política de elegibilidade v2

**Versão:** `opportunity-first-v2`

## Decisão operacional

A descoberta **não usa um piso fixo de visualizações** como requisito geral. O sistema procura conversas recentes, ativas e contextualmente relevantes; visualizações são um sinal de oportunidade, não um substituto para contexto.

## Critérios obrigatórios

- janela de descoberta: até 30 dias;
- vídeo futuro: bloqueado;
- visualizações indisponíveis ou iguais a zero: rejeitado;
- menos de 5 comentários: rejeitado por conversa insuficiente;
- comentários desativados: bloqueado;
- pelo menos um sinal de oportunidade: vídeo recente (até 7 dias) **ou** engajamento proporcional de comentários.

## Oportunidade emergente

Um vídeo é marcado como `emergingOpportunity` somente quando reúne todos os critérios:

- entre 1.000 e 29.999 visualizações;
- até 7 dias de publicação;
- pelo menos 20 comentários;
- pelo menos 5 comentários por mil visualizações.

Essa marcação prioriza a triagem; não libera publicação, link ou bypass de risco.

## Guardrails

Todo candidato continua sujeito a risco editorial, Shorts, intervalo de 30 dias por canal, deduplicação, leases, quota da API, evidência e revisão humana. A política pode ser alterada somente com atualização simultânea do código, testes e documentação.
