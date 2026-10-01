# Registro de limpeza de código — 2026-10-01

## Removidos após auditoria de imports

Os seguintes arquivos não eram importados por nenhuma rota ou módulo de produção e foram removidos do checkpoint:

- `client/src/pages/ComponentShowcase.tsx` — página demonstrativa de componentes, fora do roteador.
- `client/src/components/AIChatBox.tsx` — usado somente pela página demonstrativa removida.
- `client/src/components/ManusDialog.tsx` — componente sem referências.
- `client/src/components/Map.tsx` — componente sem referências.
- `client/src/components/ui/alert-dialog.tsx`
- `client/src/components/ui/button-group.tsx`
- `client/src/components/ui/chart.tsx`
- `client/src/components/ui/empty.tsx`
- `client/src/components/ui/field.tsx`
- `client/src/components/ui/form.tsx`
- `client/src/components/ui/input-group.tsx`
- `client/src/components/ui/item.tsx`
- `client/src/components/ui/kbd.tsx`
- `client/src/components/ui/navigation-menu.tsx`
- `client/src/components/ui/spinner.tsx`
- `server/_core/dataApi.ts` — sem referências no runtime.
- `server/_core/map.ts` — sem referências no runtime.

`server/_core/imageGeneration.ts` foi inicialmente identificado como candidato, mas foi restaurado porque `server/platform.test.ts` depende dele. Ele permanece no projeto por causa dessa cobertura de plataforma.

## Validação

- `pnpm check`: aprovado.
- `pnpm test -- --runInBand`: 131 aprovados, 1 ignorado.
- `pnpm build`: aprovado.
- `git diff --check`: aprovado.

A remoção foi feita em commit Git reversível. Nenhum arquivo de banco, migration, OAuth, outbox, governança ou regra editorial foi removido.
