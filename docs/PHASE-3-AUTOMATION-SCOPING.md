# Fase 3 — automação por projeto e canal

A automação agora aceita `projectChannelId` opcional e usa esse valor como escopo de configuração, lease, quota, intervalo, deduplicação e criação de drafts. O modo legado continua disponível quando nenhum canal é informado, mas não pode escolher silenciosamente entre múltiplos canais.

A configuração `automationSettings` ganhou uma coluna nullable e uma relação `RESTRICT` com `projectChannels`. A migration `0015_magenta_lockheed.sql` remove a unicidade antiga por proprietário para permitir configurações por canal, preserva os registros existentes e cria índice por proprietário. Como nos passos anteriores, nenhuma tabela ou linha é apagada.

Durante a execução, o sistema valida que o canal selecionado pertence ao projeto ativo do usuário. Candidatos de outro `channelId` são ignorados antes da leitura de comentários. O intervalo mínimo de 30 dias, a verificação de draft existente, a deduplicação diária de texto, o lease de cinco minutos e a pausa por quota são todos filtrados pelo canal selecionado. A `dedupeKey` inclui proprietário, canal, vídeo, comentário-pai e dia; portanto, o mesmo texto no mesmo vídeo pode ser distinguido entre canais quando o projeto permite esse comportamento.

A aprovação humana permanece obrigatória. `autoPublish` continua sendo forçado para zero. As rotas de publicação e reconciliação aceitam filtro opcional de canal, e a execução agendada transporta o `projectChannelId` salvo na configuração.

## Limite deliberado

A descoberta semanal continua salvando vídeos em um acervo global, porque `videos` representa a fonte pública e não uma decisão de publicação. O escopo por canal é aplicado na preparação de drafts e na automação. Não foi criada uma cópia de vídeos por canal, evitando duplicação de catálogo e cascatas desnecessárias.

## Estado de aplicação

A migration foi gerada, auditada e testada estaticamente, mas não foi aplicada porque ainda não há `DATABASE_URL` nesta conta. Antes de aplicar, executar backup, verificar duplicidades em `automationSettings`, rodar o dry-run do projeto e validar que a base de destino é a correta.
