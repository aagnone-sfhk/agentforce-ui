import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

// Force dynamic rendering - SDK cannot be evaluated at build time
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const agentId = body.agentId || process.env.SF_AGENT_ID;

  console.log("=== AGENTFORCE TEST WITH APPLINK CREDENTIALS ===");
  console.log("Agent ID:", agentId);

  if (!agentId) {
    return NextResponse.json(
      { success: false, error: "No agent ID provided. Pass agentId in body or set SF_AGENT_ID env var." },
      { status: 400 }
    );
  }

  try {
    // Get credentials from AppLink SDK
    const applink = await import("@heroku/applink");
    const sdk = applink.init();
    const auth = await sdk.addons.applink.getAuthorization("org_jwt");

    // Extract what we need - cast to access the actual properties
    const authData = auth as unknown as {
      accessToken: string;
      domainUrl: string;
      dataApi?: { accessToken: string; domainUrl: string };
    };

    const accessToken = authData.accessToken;
    const instanceUrl = authData.domainUrl;

    console.log("Got AppLink credentials:");
    console.log("  - Token prefix:", accessToken?.substring(0, 20) + "...");
    console.log("  - Instance URL:", instanceUrl);

    // Try to create an Agentforce session using AppLink credentials
    const uuid = crypto.randomUUID();
    const sessionPayload = {
      externalSessionKey: uuid,
      instanceConfig: {
        endpoint: instanceUrl + "/",
      },
      featureSupport: "Streaming",
      streamingCapabilities: {
        chunkTypes: ["Text"],
      },
      bypassUser: true,
    };

    console.log("Creating Agentforce session...");
    console.log("URL:", `${instanceUrl}/einstein/ai-agent/v1/agents/${agentId}/sessions`);

    const sessionResponse = await axios({
      method: "post",
      url: `${instanceUrl}/einstein/ai-agent/v1/agents/${agentId}/sessions`,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      data: sessionPayload,
      timeout: 15000,
    });

    console.log("Session created successfully!");
    console.log("Session ID:", sessionResponse.data.sessionId);

    return NextResponse.json({
      success: true,
      message: "Successfully created Agentforce session using AppLink credentials!",
      session: {
        sessionId: sessionResponse.data.sessionId,
        externalSessionKey: uuid,
      },
      credentials_used: {
        token_preview: accessToken?.substring(0, 20) + "...",
        instance_url: instanceUrl,
      },
      tested_at: new Date().toISOString(),
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    
    // Extract axios error details if available
    let details = {};
    if (axios.isAxiosError(error)) {
      details = {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      };
    }

    console.error("=== AGENTFORCE TEST FAILED ===");
    console.error("Error:", message);
    console.error("Details:", JSON.stringify(details, null, 2));

    return NextResponse.json(
      { 
        success: false, 
        error: message,
        details,
        tested_at: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

