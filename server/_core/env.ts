export const ENV = {
  appId: process.env.MANUS_PROJECT_ID ?? process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.MANUS_JWT_SECRET ?? process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.SUPABASE_DATABASE_URL ?? process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  externalLlmEnabled: process.env.EXTERNAL_LLM_ENABLED === "1",
  externalLlmBaseUrl: process.env.EXTERNAL_LLM_BASE_URL ?? "",
  externalLlmApiKey: process.env.EXTERNAL_LLM_API_KEY ?? "",
  externalLlmModel: process.env.EXTERNAL_LLM_MODEL ?? "gemini-3.7-flash",
};
