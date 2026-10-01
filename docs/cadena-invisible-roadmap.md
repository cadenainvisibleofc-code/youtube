# Cadena Invisible — Plano de evolução por fases

## Objetivo

Transformar o painel de automação editorial em um sistema de inteligência de ressonância: ele descobre conversas, entende o contexto, aprende com as decisões humanas, mede o impacto real da leitura e executa somente ações compatíveis com a política editorial.

## Princípios invariáveis

- Zero venda, promoção, preço, pagamento, gratuidade ou pressão.
- Link apenas o oficial, contextual e de baixo risco.
- Shorts: somente respostas individuais; sem comentário de topo.
- Sem limite diário artificial; intervalo mínimo de 30 dias por canal e cota da API continuam valendo.
- Crise, autolesão, abuso, ódio, sexualização e baixa confiança vão para revisão humana.
- Toda publicação deve ser rastreável, reversível operacionalmente e registrada em auditoria.
- A IA nunca recebe Secrets, código arbitrário ou autorização para ignorar regras do backend.

## Fase 0 — Base e segurança (já existente)

- OAuth YouTube com refresh token cifrado, validação de escopo, retry e tratamento de `invalid_grant`.
- Busca oficial com cache de detalhes por 6 horas, deduplicação, leases, intervalo por canal, cota da API e filtro editorial determinístico.
- Fila de revisão, aprovação concorrente segura, publicação controlada e política de Shorts.
- RelayModels no backend com fallback e validação local.
- Chat operacional com ferramentas allowlisted.
- Migration journal, foreign keys, testes Vitest, TypeScript e build de produção.

## Fase 1 — Chat multimodal e memória de trabalho (implementada nesta evolução)

- Conversas persistentes separadas, com título, arquivamento e histórico independente.
- Upload controlado de imagens PNG/JPEG/WebP/GIF, PDFs e áudio.
- Armazenamento em WebDev Storage; bytes não ficam no banco.
- Imagem enviada ao modelo como conteúdo visual.
- PDF enviado ao modelo como arquivo contextual.
- Áudio gravado ou anexado, transcrito pelo serviço Whisper interno e incluído como contexto.
- Allow-list de MIME types, limite de 20 MB para imagem/PDF e 16 MB para áudio.
- Chat aceita texto + múltiplos anexos na mesma mensagem.
- Testes para formatos e codecs de gravação do navegador.

## Fase 2 — Memória editorial e aprendizado humano

### Dados

- Registrar aprovação, edição, descarte, bloqueio, motivo, versão da regra e modelo que gerou o rascunho.
- Guardar diferenças entre texto original e texto aprovado.
- Classificar feedback: abertura, estrutura, link, encerramento, tom, risco, repetição e naturalidade.
- Criar biblioteca de padrões aprovados, sem transformar padrões em textos copiados.

### Motor

- Usar feedback de edições para rebaixar padrões que são frequentemente alterados.
- Dar prioridade a estruturas aprovadas para aquele nicho e contexto.
- Detectar similaridade semântica, não apenas texto idêntico.
- Criar score de naturalidade independente do score de relevância.
- Escalonar para revisão quando os modelos discordarem ou a confiança ficar baixa.

## Fase 3 — Inteligência de canal e conversa

- Atualizar `channelProfiles` com frequência de publicação, temas, moderação, tolerância a links, respostas do criador e histórico de interações.
- Criar pontuação de compatibilidade por tipo de comentário: resposta, comentário de topo, link ou sem link.
- Registrar lista de exclusão por canal e por autor quando necessário.
- Ler comentários e respostas como uma conversa, não como itens isolados.
- Detectar pergunta aberta, exposição pessoal, conversa saturada, conflito, pedido de ajuda e comentário já atendido.
- Evitar responder quando a pessoa já recebeu respostas semelhantes.

## Fase 4 — Oportunidade e descoberta

- Guardar snapshots de views, comentários e curtidas por vídeo.
- Calcular crescimento por hora/dia, aceleração e engajamento proporcional.
- Priorizar vídeos em início de crescimento, não apenas vídeos grandes.
- Criar taxonomia de nichos com sinônimos, expressões em espanhol/português, termos de risco e padrões emocionais.
- Buscar por intenção emocional, não somente palavras-chave.
- Descobrir canais semelhantes a partir de canais de alta compatibilidade.
- Monitorar comentários novos nos vídeos elegíveis.

## Fase 5 — Atribuição e ressonância

- Redirecionador próprio para o link oficial com parâmetros de atribuição não invasivos.
- Atribuir origem por canal, vídeo, tipo de comentário, nicho e versão editorial.
- Medir acessos, sessão, retorno, profundidade de leitura e conclusão aproximada.
- Medir respostas, curtidas, resposta do criador, tempo até resposta e continuidade de conversa.
- Separar métricas de produção de métricas de ressonância.
- Nunca usar atribuição para perfil invasivo; apenas para melhorar o conteúdo e a estratégia.

## Fase 6 — Automação explicável e observabilidade

- Modo simulação antes de qualquer mudança ou execução.
- Relatório por vídeo com todos os critérios, motivos e possibilidade de reavaliação.
- Fila de exceções: risco, idioma, espiritualidade, link, canal, viralização e baixa confiança.
- Painel de execução: duração, retries, quota, erros, publicações tentadas e confirmadas.
- Pausa total, pausa de publicação, pausa de links, pausa de Shorts, pausa por canal e pausa por nicho.
- Desligamento automático após falhas ou remoções acima do limiar.
- Monitoramento de remoções, ocultações, denúncias e mudanças de reputação.

## Fase 7 — Chat operacional avançado

- Comandos compostos com plano de execução explícito.
- Separação entre fato observado, inferência, recomendação, incerteza e ação executada.
- Memória operacional estruturada de preferências, exclusões e decisões.
- Comandos como: “simule a rotina”, “compare os melhores canais”, “encontre oportunidades semelhantes” e “explique por que cada item foi bloqueado”.
- Relatório multimodal: anexar uma captura, documento ou áudio e pedir análise editorial.

## Ordem de entrega recomendada

1. Validar a Fase 1 em produção: nova conversa, upload de imagem/PDF, gravação e transcrição.
2. Implementar Fase 2: feedback de aprovação/edição e score de naturalidade.
3. Implementar Fase 3: perfil de canal e análise de conversa.
4. Implementar Fase 4: snapshots e velocidade de crescimento.
5. Implementar Fase 5: atribuição e painel de ressonância.
6. Implementar Fase 6: simulação, exceções e observabilidade.
7. Implementar Fase 7: comandos compostos e memória operacional.

## Critérios de aceite por fase

- Testes unitários e de integração sem chamadas externas reais.
- `pnpm check` sem erros.
- `pnpm build` concluído.
- Migration aplicada e journal alinhado.
- Regras editoriais preservadas.
- Nenhuma chave ou conteúdo de usuário exposto no frontend fora do necessário.
- Nenhuma publicação automática ativada por uma mudança de produto sem que a configuração existente permita.
