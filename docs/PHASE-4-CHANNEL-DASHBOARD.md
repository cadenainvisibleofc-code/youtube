# Fase 4 — painel e seleção explícita de canais

A interface agora apresenta os perfis de canal do projeto em um painel próprio. Cada canal mostra nome, `channelId`, estado da conexão e necessidade de reautorização. O usuário pode selecionar um canal ativo; a seleção é persistida no navegador e compartilhada entre o painel de canais e os controles de automação.

Quando um canal é selecionado, a UI envia `projectChannelId` para configurações, descoberta semanal, preparação de acervo, preparação diária, execução manual, publicação aprovada, reconciliação, agendamento e pausa. O botão OAuth também inclui o mesmo identificador na URL de início, evitando que a autorização seja vinculada a um canal diferente do escolhido.

O endpoint `integrationStatus` passou a retornar a lista de canais acessíveis ao usuário, com status de conexão individual. A consulta usa associação ativa de membro e projeto, e o relacionamento com conexões é restritivo. Se o banco não estiver disponível, a lista retorna vazia sem inventar conexão ou canal.

O modo legado continua visível e intencional quando nenhum canal foi selecionado. Isso permite a compatibilidade com dados antigos, mas o painel informa que a configuração não está isolada. Não há seleção silenciosa de canal.

## Validação

A Fase 4 terminou com 114 testes aprovados, 1 teste OAuth externo opt-in ignorado, TypeScript aprovado e build de produção aprovado. A migration de automação e as migrations anteriores continuam não aplicadas, pois esta conta ainda não possui `DATABASE_URL`.
