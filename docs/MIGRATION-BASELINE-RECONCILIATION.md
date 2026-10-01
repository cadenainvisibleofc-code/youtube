# Reconciliação do baseline de migration no WebDev

O banco gerenciado foi provisionado pelo starter WebDev com `users` e a migration `0000_initial_users.sql` já aplicada. A base recuperada possuía uma migration histórica `0000_exotic_felicia_hardy.sql` que cria a mesma tabela, mas com outro nome, hash e timestamp.

Para evitar recriar `users`, a migration do starter foi mantida como baseline oficial do projeto WebDev; a cópia histórica foi movida para `docs/legacy-migrations/` e não é executável pelo Drizzle. O primeiro registro do journal foi alinhado ao tag `0000_initial_users` e ao timestamp registrado na tabela `__drizzle_migrations`.

Nenhum dado foi apagado ou alterado no banco. A partir deste baseline, somente as migrations 0001–0017 devem ser aplicadas, após a auditoria SQL e o teste de conexão.
