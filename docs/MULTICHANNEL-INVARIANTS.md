# Invariantes multicanal — Cadena Invisible

Este documento é um contrato de segurança para a reconstrução. Ele não altera o banco atual.

## Ownership

- Todo dado operacional deve pertencer a um projeto lógico.
- Conta Manus é membro/autorização; não deve ser a identidade permanente dos dados.
- Toda operação protegida deve resolver `projectId` antes de ler ou escrever dados.
- Um membro não pode ler ou publicar em outro projeto.

## Canais

- Um projeto pode ter até cinco perfis de canal na primeira implantação multicanal.
- O botão de nova conta usa um state OAuth assinado com `projectId`; o callback cria o slot somente após identificar o `channelId` retornado pelo Google.
- Reautorizar uma conta existente reutiliza o slot pelo par projeto + `channelId`; não cria uma sexta linha nem substitui outro canal.
- `channelId` não pode ser duplicado dentro do mesmo projeto.
- Cada conexão OAuth pertence a exatamente um perfil de canal.
- Uma reautorização atualiza somente o canal indicado no state assinado.
- Se houver mais de uma conexão elegível e nenhum canal for informado, a operação deve falhar de forma explícita; nunca escolher a primeira linha.

## Publicação

- Draft aprovado deve ter alvo de canal resolvido antes de entrar na outbox.
- Outbox, publicação e idempotency key devem identificar o canal-alvo.
- Retry/reconciliação deve permanecer no mesmo canal do item original.
- Token de um canal nunca pode ser usado para publicar em outro.
- Publicação automática permanece desligada até a conclusão do ensaio controlado.

## Cascatas

- Excluir projeto/canal não deve apagar silenciosamente histórico de publicações, auditoria ou decisões editoriais.
- Dados derivados podem usar `CASCADE` somente quando o pai for exclusivamente derivado.
- Dados de auditoria devem preferir `SET NULL` ou bloqueio (`RESTRICT`), conforme o caso.
- Migrations novas devem ter backfill verificável e plano de rollback.

## OAuth

- State deve conter nonce, projeto, canal e identidade iniciadora, assinado/validado.
- Cookie de nonce deve ser comparado em tempo constante quando aplicável.
- Redirect URI deve continuar HTTPS e usar exclusivamente o caminho publicado aprovado.
- Secrets nunca aparecem em logs, testes padrão, ZIP ou documentação.
