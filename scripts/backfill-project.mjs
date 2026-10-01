import pg from "pg";

const databaseUrl = process.env.SUPABASE_DATABASE_URL ?? process.env.DATABASE_URL;
const required = ["PROJECT_SLUG", "PROJECT_NAME", "OWNER_OPEN_ID"];
const missing = required.filter(name => !process.env[name]);
if (!databaseUrl) missing.unshift("SUPABASE_DATABASE_URL/DATABASE_URL");
if (missing.length) {
  console.error(`backfill bloqueado: variáveis ausentes: ${missing.join(", ")}`);
  process.exit(2);
}
if (process.env.ALLOW_PROJECT_BACKFILL !== "1") {
  console.error("backfill bloqueado: defina ALLOW_PROJECT_BACKFILL=1 somente após confirmar o banco de destino");
  process.exit(3);
}

const apply = process.env.PROJECT_BACKFILL_APPLY === "1";
const connection = new pg.Client({ connectionString: databaseUrl });

try {
  await connection.connect();
  await connection.query("BEGIN");

  const { rows: existingProjects } = await connection.query(
    'SELECT id, slug, name, status FROM "projects" WHERE slug = $1 LIMIT 1 FOR UPDATE',
    [process.env.PROJECT_SLUG],
  );
  const project = existingProjects[0];
  if (project && project.name !== process.env.PROJECT_NAME) {
    throw new Error("slug do projeto já existe com outro nome; nenhuma alteração foi feita");
  }

  const { rows: users } = await connection.query(
    'SELECT id, "openId" FROM "users" WHERE "openId" = $1 LIMIT 1',
    [process.env.OWNER_OPEN_ID],
  );
  if (!users[0]) throw new Error("OWNER_OPEN_ID não corresponde a um usuário existente");

  if (!apply) {
    console.log(JSON.stringify({ mode: "dry-run", projectExists: Boolean(project), ownerUserExists: true, projectSlug: process.env.PROJECT_SLUG }));
    await connection.query("ROLLBACK");
  } else {
    let projectId = project?.id;
    if (!projectId) {
      const { rows: inserted } = await connection.query(
        "INSERT INTO projects (slug, name, status) VALUES ($1, $2, 'active') RETURNING id",
        [process.env.PROJECT_SLUG, process.env.PROJECT_NAME],
      );
      projectId = inserted[0].id;
    }

    await connection.query(
      'INSERT INTO "projectMembers" ("projectId", "openId", role, status) VALUES ($1, $2, \'owner\', \'active\') ON CONFLICT ("projectId", "openId") DO UPDATE SET role = \'owner\', status = \'active\', "updatedAt" = CURRENT_TIMESTAMP',
      [projectId, process.env.OWNER_OPEN_ID],
    );

    await connection.query("COMMIT");
    console.log(JSON.stringify({ mode: "applied", projectId, projectSlug: process.env.PROJECT_SLUG, ownerMember: true }));
  }
} catch (error) {
  await connection.query("ROLLBACK").catch(() => undefined);
  console.error(`backfill abortado: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await connection.end();
}
