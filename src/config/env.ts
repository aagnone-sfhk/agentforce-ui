import { z } from "zod";

const envSchema = z.object({
  // Salesforce Configuration
  SF_MY_DOMAIN_URL: z.string().url(),
  SF_CONSUMER_KEY: z.string().min(1),
  SF_CONSUMER_SECRET: z.string().min(1),
  SF_AGENT_ID: z.string().min(1),
  
  // UI Configuration (shared between client and server)
  NEXT_PUBLIC_APP_TITLE: z.string().min(1).default("AI Chat Assistant"),
  NEXT_PUBLIC_APP_DESCRIPTION: z.string().min(1).default("Your intelligent AI assistant powered by Agentforce"),
  NEXT_PUBLIC_APP_INTRO_MESSAGE: z.string().min(1).default("Hello! I'm your AI assistant. How can I help you today?"),
});

type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  try {
    return envSchema.parse({
      SF_MY_DOMAIN_URL: process.env.SF_MY_DOMAIN_URL,
      SF_CONSUMER_KEY: process.env.SF_CONSUMER_KEY,
      SF_CONSUMER_SECRET: process.env.SF_CONSUMER_SECRET,
      SF_AGENT_ID: process.env.SF_AGENT_ID,
      NEXT_PUBLIC_APP_TITLE: process.env.NEXT_PUBLIC_APP_TITLE,
      NEXT_PUBLIC_APP_DESCRIPTION: process.env.NEXT_PUBLIC_APP_DESCRIPTION,
      NEXT_PUBLIC_APP_INTRO_MESSAGE: process.env.NEXT_PUBLIC_APP_INTRO_MESSAGE,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map((err) => err.path.join(".")).join(", ");
      throw new Error(`❌ Invalid environment variables: ${missingVars}`);
    }
    throw error;
  }
}

export const env = validateEnv(); 