"use server";

import "server-only";
import { unstable_cacheTag as cacheTag, revalidateTag } from "next/cache";
import axios from "axios";
import { agentConfig } from "./config";
import { getJwtConnectionName } from "@/config/env";

// Authentication mode types
export type AuthMode = "direct" | "applink";

interface AuthCredentials {
  accessToken: string;
  apiInstanceUrl: string;
}

// Simple retry utility for transient failures
const retryOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 2,
  delayMs: number = 1000
): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on authentication or client errors (4xx)
      if (axios.isAxiosError(error) && error.response?.status && error.response.status < 500) {
        throw error;
      }
      
      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        break;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
    }
  }
  
  throw lastError!;
};

const getToken = async (): Promise<AuthCredentials> => {
  "use cache";
  try {
    const params = new URLSearchParams();
    params.append("grant_type", "client_credentials");
    params.append("client_id", agentConfig.credentials.clientId);
    params.append("client_secret", agentConfig.credentials.clientSecret);
    
    const { data } = await axios({
      method: "post",
      url: agentConfig.getAuthEndpoint(),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data: params,
      timeout: 10000, // 10 second timeout
    });
    
    if (!data["access_token"] || !data["api_instance_url"]) {
      throw new Error("Invalid authentication response: missing access token or API instance URL");
    }
    
    const accessToken = data["access_token"];
    const apiInstanceUrl = data["api_instance_url"];
    cacheTag("token");
    return { accessToken, apiInstanceUrl };
  } catch (error) {
    console.error("Authentication failed:", error);
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        throw new Error("Authentication timeout: Unable to connect to Salesforce");
      }
      if (error.response?.status === 401) {
        throw new Error("Authentication failed: Invalid client credentials");
      }
      if (error.response && error.response.status >= 500) {
        throw new Error("Authentication failed: Salesforce service temporarily unavailable");
      }
      throw new Error(`Authentication failed: ${error.response?.status || 'Network error'}`);
    }
    throw new Error("Authentication failed: Unable to connect to Salesforce");
  }
};

/**
 * Get authentication credentials from Heroku AppLink SDK.
 * Uses the JWT authorization configured via `heroku salesforce:authorizations:add:jwt`.
 * The authorization name is read from the SF_JWT_CONNECTION_NAME env var.
 */
const getTokenFromAppLink = async (): Promise<AuthCredentials> => {
  const authorizationName = getJwtConnectionName();
  try {
    const applink = await import("@heroku/applink");
    const sdk = applink.init();
    const auth = await sdk.addons.applink.getAuthorization(authorizationName);
    
    const authData = auth as unknown as { accessToken: string; domainUrl: string };
    
    if (!authData.accessToken) {
      throw new Error("Invalid AppLink authorization response: missing access token");
    }
    
    return {
      accessToken: authData.accessToken,
      // Agent API uses api.salesforce.com, not the My Domain URL
      apiInstanceUrl: "https://api.salesforce.com",
    };
  } catch (error) {
    console.error("AppLink authentication failed:", error);
    if (error instanceof Error) {
      throw new Error(`AppLink authentication failed: ${error.message}`);
    }
    throw new Error("AppLink authentication failed: Unable to retrieve credentials");
  }
};

/**
 * Get authentication credentials using the specified mode.
 * @param mode - "direct" for OAuth client credentials, "applink" for Heroku AppLink SDK
 */
const getCredentials = async (mode: AuthMode = "direct"): Promise<AuthCredentials> => {
  if (mode === "applink") {
    return getTokenFromAppLink();
  }
  return getToken();
};

export const newSession = async (agentId?: string, authMode: AuthMode = "direct") => {
  return retryOperation(async () => {
    try {
      const { accessToken, apiInstanceUrl } = await getCredentials(authMode);
      const uuid = crypto.randomUUID();
      const targetAgentId = agentId || agentConfig.agentId;
      
      if (!targetAgentId) {
        throw new Error("No agent ID provided and no default agent configured");
      }
      
      const payload = {
        externalSessionKey: uuid,
        instanceConfig: {
          endpoint: `https://${agentConfig.baseUrl}/`,
        },
        featureSupport: "Streaming",
        streamingCapabilities: {
          chunkTypes: ["Text"],
        },
        bypassUser: true,
      };
      
      const { data } = await axios({
        method: "post",
        url: `${apiInstanceUrl}/einstein/ai-agent/v1/agents/${targetAgentId}/sessions`,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        data: payload,
        timeout: 15000, // 15 second timeout for session creation
      });
      
      if (!data.sessionId) {
        throw new Error("Invalid session response: missing session ID");
      }
      
      return data;
    } catch (error) {
      console.error("Session creation failed:", error);
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new Error("Session creation timeout: Agentforce service is taking too long to respond");
        }
        if (error.response?.status === 401) {
          throw new Error("Session creation failed: Authentication expired");
        }
        if (error.response?.status === 403) {
          throw new Error("Session creation failed: Access denied to Agentforce agent");
        }
        if (error.response?.status === 404) {
          throw new Error("Session creation failed: Agentforce agent not found");
        }
        if (error.response && error.response.status >= 500) {
          throw new Error("Session creation failed: Agentforce service temporarily unavailable");
        }
        throw new Error(`Session creation failed: ${error.response?.statusText || 'Network error'}`);
      }
      throw error; // Re-throw non-axios errors (like authentication errors)
    }
  }, 2, 1500); // Retry up to 2 times with 1.5s base delay
};

export const getSession = async (agentId?: string, authMode: AuthMode = "direct") => {
  "use cache";
  const session = await newSession(agentId, authMode);
  cacheTag("session");
  return session;
};

export const endSession = async (authMode: AuthMode = "direct") => {
  try {
    const { accessToken, apiInstanceUrl } = await getCredentials(authMode);
    const { sessionId } = await getSession(undefined, authMode);
    
    const { data } = await axios({
      method: "delete",
      url: `${apiInstanceUrl}${agentConfig.getSessionEndpoint(sessionId)}`,
      headers: {
        "x-session-end-reason": "UserRequest",
        Authorization: `Bearer ${accessToken}`,
      },
      timeout: 10000, // 10 second timeout
    });
    revalidateTag("session");
    return data;
  } catch (error) {
    console.error("Session end failed:", error);
    // Don't throw on session end failures - it's not critical
    // The session will expire naturally
    if (axios.isAxiosError(error) && error.response?.status !== 404) {
      console.warn("Failed to properly end session, but continuing...");
    }
    return null;
  }
};

export const sendStreamingMessage = async (
  text: string,
  sequenceId: number,
  agentId?: string,
  authMode: AuthMode = "direct"
) => {
  try {
    if (!text || text.trim().length === 0) {
      throw new Error("Message text cannot be empty");
    }
    
    if (typeof sequenceId !== 'number' || sequenceId < 0) {
      throw new Error("Invalid sequence ID");
    }
    
    const { accessToken, apiInstanceUrl } = await getCredentials(authMode);
    const { sessionId } = await getSession(agentId, authMode);

    const { data } = await axios({
      method: "post",
      url: `${apiInstanceUrl}${agentConfig.getStreamingEndpoint(sessionId)}`,
      headers: {
        Accept: "text/event-stream",
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        message: {
          sequenceId,
          type: "Text",
          text: text.trim(),
        },
      },
      responseType: "stream",
      timeout: 30000, // 30 second timeout for streaming
    });
    return data;
  } catch (error) {
    console.error("Streaming message failed:", error);
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        throw new Error("Request timeout: Agentforce is taking too long to respond");
      }
      if (error.response?.status === 401) {
        throw new Error("Authentication expired: Please refresh and try again");
      }
      if (error.response?.status === 403) {
        throw new Error("Access denied: You don't have permission to use this agent");
      }
      if (error.response?.status === 404) {
        throw new Error("Session not found: Please refresh and try again");
      }
      if (error.response?.status === 429) {
        throw new Error("Rate limit exceeded: Please wait a moment and try again");
      }
      if (error.response && error.response.status >= 500) {
        throw new Error("Agentforce service is temporarily unavailable. Please try again in a few moments");
      }
      throw new Error(`Failed to send message: ${error.response?.statusText || 'Network error'}`);
    }
    throw error; // Re-throw non-axios errors (like validation or session errors)
  }
};


