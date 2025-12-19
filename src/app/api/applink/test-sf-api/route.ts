import { NextResponse } from "next/server";
import axios from "axios";

// Force dynamic rendering
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Get credentials from AppLink SDK
    const applink = await import("@heroku/applink");
    const sdk = applink.init();
    const auth = await sdk.addons.applink.getAuthorization("org_jwt");

    const authData = auth as unknown as {
      accessToken: string;
      domainUrl: string;
    };

    const accessToken = authData.accessToken;
    const domainUrl = authData.domainUrl.replace(/\/$/, '');

    const results: Record<string, unknown> = {
      domainUrl,
      tokenPrefix: accessToken?.substring(0, 30) + "...",
      tests: {},
    };

    // Test 1: Try /services/data to list API versions
    try {
      const versionsRes = await axios.get(`${domainUrl}/services/data`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10000,
      });
      results.tests = {
        ...results.tests as object,
        api_versions: { success: true, data: versionsRes.data?.slice(0, 3) },
      };
    } catch (error) {
      results.tests = {
        ...results.tests as object,
        api_versions: { 
          success: false, 
          error: axios.isAxiosError(error) ? error.response?.data : (error as Error).message 
        },
      };
    }

    // Test 2: Try /services/data/v65.0/sobjects to list objects
    try {
      const objectsRes = await axios.get(`${domainUrl}/services/data/v65.0/sobjects`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10000,
      });
      results.tests = {
        ...results.tests as object,
        sobjects: { success: true, totalObjects: objectsRes.data?.sobjects?.length },
      };
    } catch (error) {
      results.tests = {
        ...results.tests as object,
        sobjects: { 
          success: false, 
          error: axios.isAxiosError(error) ? error.response?.data : (error as Error).message 
        },
      };
    }

    // Test 3: Try Einstein Agent API endpoint directly
    const agentId = process.env.SF_AGENT_ID;
    if (agentId) {
      try {
        const agentRes = await axios.post(
          `${domainUrl}/einstein/ai-agent/v1/agents/${agentId}/sessions`,
          {
            externalSessionKey: crypto.randomUUID(),
            instanceConfig: { endpoint: domainUrl + "/" },
            featureSupport: "Streaming",
            streamingCapabilities: { chunkTypes: ["Text"] },
            bypassUser: true,
          },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            timeout: 15000,
          }
        );
        results.tests = {
          ...results.tests as object,
          agent_api: { success: true, sessionId: agentRes.data?.sessionId },
        };
      } catch (error) {
        const axiosErr = axios.isAxiosError(error);
        results.tests = {
          ...results.tests as object,
          agent_api: { 
            success: false,
            status: axiosErr ? error.response?.status : undefined,
            error: axiosErr ? error.response?.data : (error as Error).message,
            url: `${domainUrl}/einstein/ai-agent/v1/agents/${agentId}/sessions`,
          },
        };
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

