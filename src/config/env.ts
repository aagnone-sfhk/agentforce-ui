import { z } from "zod";

// Auth mode schema - validates "direct" or "applink"
const authModeSchema = z.enum(["direct", "applink"]).default("direct");

const envSchema = z.object({
  // Salesforce Configuration
  SF_MY_DOMAIN_URL: z.string().url(),
  SF_CONSUMER_KEY: z.string().min(1),
  SF_CONSUMER_SECRET: z.string().min(1),
  SF_AGENT_ID: z.string().min(1),
  
  // Authentication mode: "direct" (OAuth) or "applink" (Heroku AppLink SDK)
  SF_AUTH_MODE: authModeSchema,
  
  // UI Configuration (shared between client and server)
  NEXT_PUBLIC_APP_TITLE: z.string().min(1).default("AI Chat Assistant"),
  NEXT_PUBLIC_APP_DESCRIPTION: z.string().min(1).default("Your intelligent AI assistant powered by Agentforce"),
  NEXT_PUBLIC_APP_INTRO_MESSAGE: z.string().min(1).default("Hello! I'm your AI assistant. How can I help you today?"),
});

type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

function validateEnv(): Env {
  if (cachedEnv) {
    return cachedEnv;
  }
  
  try {
    cachedEnv = envSchema.parse({
      SF_MY_DOMAIN_URL: process.env.SF_MY_DOMAIN_URL,
      SF_CONSUMER_KEY: process.env.SF_CONSUMER_KEY,
      SF_CONSUMER_SECRET: process.env.SF_CONSUMER_SECRET,
      SF_AGENT_ID: process.env.SF_AGENT_ID,
      SF_AUTH_MODE: process.env.SF_AUTH_MODE,
      NEXT_PUBLIC_APP_TITLE: process.env.NEXT_PUBLIC_APP_TITLE,
      NEXT_PUBLIC_APP_DESCRIPTION: process.env.NEXT_PUBLIC_APP_DESCRIPTION,
      NEXT_PUBLIC_APP_INTRO_MESSAGE: process.env.NEXT_PUBLIC_APP_INTRO_MESSAGE,
    });
    return cachedEnv;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map((err) => err.path.join(".")).join(", ");
      throw new Error(`❌ Invalid environment variables: ${missingVars}`);
    }
    throw error;
  }
}

// Lazy getter - only validates when accessed at runtime, not at build time
export const env = new Proxy({} as Env, {
  get(_target, prop: keyof Env) {
    return validateEnv()[prop];
  },
});

// Export auth mode type for use in other modules
export type AuthModeConfig = "direct" | "applink";

/**
 * Get the configured authentication mode.
 * Can be accessed independently without validating all env vars.
 */
export function getAuthMode(): AuthModeConfig {
  const mode = process.env.SF_AUTH_MODE;
  if (mode === "applink") return "applink";
  return "direct"; // default
}

/**
 * Get the JWT connection name for AppLink authorization.
 * Must be set when SF_AUTH_MODE is "applink".
 */
export function getJwtConnectionName(): string {
  const name = process.env.JWT_CONNECTION_NAME;
  if (!name) {
    throw new Error("JWT_CONNECTION_NAME env var is required when using AppLink authentication");
  }
  return name;
}
