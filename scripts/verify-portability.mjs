import { existsSync, readFileSync } from "node:fs";

const requiredEnv = [
  ["SUPABASE_DATABASE_URL", "DATABASE_URL"],
  ["JWT_SECRET", "MANUS_JWT_SECRET"],
  ["VITE_APP_ID", "MANUS_PROJECT_ID"],
  ["OAUTH_SERVER_URL"],
  ["BUILT_IN_FORGE_API_URL"],
  ["BUILT_IN_FORGE_API_KEY"],
  ["YOUTUBE_OAUTH_CLIENT_ID"],
  ["YOUTUBE_OAUTH_CLIENT_SECRET"],
  ["YOUTUBE_OAUTH_REDIRECT_URI"],
  ["YOUTUBE_TOKEN_ENCRYPTION_KEY"],
];

const postLoginEnv = [["OWNER_OPEN_ID"]];
const optionalEnv = [["YOUTUBE_DATA_API_KEY"]];

const requiredFiles = [
  "drizzle/pg/0000_pg_initial.sql",
  "drizzle/pg/0001_integrity_and_outbox_fencing.sql",
  "docs/SUPABASE-MIGRATION-MANIFEST-2026-10-01.md",
  "docs/PLANO-CUSTODIA-E-RECUPERACAO-2026-10-01.md",
  "scripts/export-supabase-backup.sh",
  "drizzle/schema.ts",
  "server/publication-outbox.ts",
  "server/youtube-oauth.ts",
  "docs/PORTABILITY-RUNBOOK.md",
];

let projectConfig = {};
try {
  projectConfig = JSON.parse(readFileSync(".project-config.json", "utf8"));
} catch {
  projectConfig = {};
}
const configuredNames = new Set([
  ...Object.keys(projectConfig.env_vars ?? {}),
  ...Object.keys(projectConfig.secrets ?? {}),
]);
const isConfigured = names => names.some(name => Boolean(process.env[name]) || configuredNames.has(name));
const missingEnv = requiredEnv.filter(names => !isConfigured(names)).map(names => names[0]);
const missingPostLoginEnv = postLoginEnv.filter(names => !isConfigured(names)).map(names => names[0]);
const missingOptionalEnv = optionalEnv.filter(names => !isConfigured(names)).map(names => names[0]);
const missingFiles = requiredFiles.filter(path => !existsSync(path));
const redirectUri = process.env.YOUTUBE_OAUTH_REDIRECT_URI ?? projectConfig.secrets?.YOUTUBE_OAUTH_REDIRECT_URI ?? "";
let redirectValid = false;
try {
  const parsed = new URL(redirectUri);
  redirectValid = parsed.protocol === "https:" && parsed.pathname === "/api/youtube/oauth/callback" && !parsed.search && !parsed.hash;
} catch {
  redirectValid = false;
}

const schema = readFileSync("drizzle/schema.ts", "utf8");
const source = readFileSync("server/automation.ts", "utf8");
const checks = [
  ["outbox_schema", schema.includes("publicationOutbox")],
  ["engagement_schema", schema.includes("publicationEngagementEvents")],
  ["auto_publish_guard", source.includes("publicação automática bloqueada no MVP")],
  ["runbook", existsSync("docs/PORTABILITY-RUNBOOK.md")],
];

console.log(`portability: ${missingEnv.length === 0 && missingFiles.length === 0 && redirectValid && checks.every(([, ok]) => ok) ? "ready" : "needs-attention"}`);
console.log(`required_env: ${requiredEnv.length - missingEnv.length}/${requiredEnv.length}`);
console.log(`post_login_identity: ${missingPostLoginEnv.length === 0 ? "configured" : "pending-login"}`);
console.log(`optional_env: ${missingOptionalEnv.length === 0 ? "configured" : "missing"}`);
console.log(`required_files: ${requiredFiles.length - missingFiles.length}/${requiredFiles.length}`);
console.log(`redirect_uri_valid: ${redirectValid}`);
for (const [name, ok] of checks) console.log(`${name}: ${ok ? "ok" : "missing"}`);
if (missingEnv.length) console.log(`missing_env_names: ${missingEnv.join(", ")}`);
if (missingPostLoginEnv.length) console.log(`post_login_env_names: ${missingPostLoginEnv.join(", ")}`);
if (missingOptionalEnv.length) console.log(`optional_env_names: ${missingOptionalEnv.join(", ")}`);
if (missingFiles.length) console.log(`missing_files: ${missingFiles.join(", ")}`);
process.exit(missingEnv.length || missingFiles.length || !redirectValid || checks.some(([, ok]) => !ok) ? 1 : 0);
