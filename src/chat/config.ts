import { env } from "@/config/env";

export interface AgentForceConfig {
  baseUrl: string;
  credentials: {
    clientId: string;
    clientSecret: string;
  };
  agentId: string;
}

class AgentForceConfiguration implements AgentForceConfig {
  // Use getters for lazy evaluation - only access env at runtime, not build time
  get baseUrl(): string {
    return env.SF_MY_DOMAIN_URL.replace("https://", "");
  }

  get credentials(): { clientId: string; clientSecret: string } {
    return {
      clientId: env.SF_CONSUMER_KEY,
      clientSecret: env.SF_CONSUMER_SECRET,
    };
  }

  get agentId(): string {
    return env.SF_AGENT_ID;
  }

  getAuthEndpoint(): string {
    return `https://${this.baseUrl}/services/oauth2/token`;
  }

  getApiEndpoint(path: string): string {
    return `https://${this.baseUrl}${path}`;
  }

  getAgentSessionEndpoint(): string {
    return `/einstein/ai-agent/v1/agents/${this.agentId}/sessions`;
  }

  getSessionEndpoint(sessionId: string): string {
    return `/einstein/ai-agent/v1/sessions/${sessionId}`;
  }

  getStreamingEndpoint(sessionId: string): string {
    return `/einstein/ai-agent/v1/sessions/${sessionId}/messages/stream`;
  }
}

export const agentConfig = new AgentForceConfiguration();
