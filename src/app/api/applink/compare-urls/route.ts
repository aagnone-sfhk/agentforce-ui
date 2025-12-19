import { NextResponse } from "next/server";
import axios from "axios";

// Force dynamic rendering
export const dynamic = "force-dynamic";

export async function GET() {
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
  };

  // 1. Get AppLink credentials
  try {
    const applink = await import("@heroku/applink");
    const sdk = applink.init();
    const auth = await sdk.addons.applink.getAuthorization("org_jwt");
    const authData = auth as unknown as { accessToken: string; domainUrl: string };
    
    results.applink = {
      success: true,
      domainUrl: authData.domainUrl,
      tokenPrefix: authData.accessToken?.substring(0, 30) + "...",
    };
  } catch (error) {
    results.applink = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }

  // 2. Try OAuth client_credentials flow (if env vars are set)
  const clientId = process.env.SF_CONSUMER_KEY;
  const clientSecret = process.env.SF_CONSUMER_SECRET;
  const myDomainUrl = process.env.SF_MY_DOMAIN_URL;

  if (clientId && clientSecret && myDomainUrl) {
    try {
      const params = new URLSearchParams();
      params.append("grant_type", "client_credentials");
      params.append("client_id", clientId);
      params.append("client_secret", clientSecret);

      const { data } = await axios({
        method: "post",
        url: `${myDomainUrl}/services/oauth2/token`,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        data: params,
        timeout: 10000,
      });

      results.oauth = {
        success: true,
        api_instance_url: data.api_instance_url,
        instance_url: data.instance_url,
        token_type: data.token_type,
        tokenPrefix: data.access_token?.substring(0, 30) + "...",
        // Show all keys returned
        response_keys: Object.keys(data),
      };
    } catch (error) {
      results.oauth = {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        env_vars_present: { clientId: !!clientId, clientSecret: !!clientSecret, myDomainUrl },
      };
    }
  } else {
    results.oauth = {
      success: false,
      error: "Missing env vars",
      env_vars_present: { 
        SF_CONSUMER_KEY: !!clientId, 
        SF_CONSUMER_SECRET: !!clientSecret, 
        SF_MY_DOMAIN_URL: myDomainUrl || null 
      },
    };
  }

  // 3. Compare
  const applinkUrl = (results.applink as Record<string, unknown>)?.domainUrl;
  const oauthApiUrl = (results.oauth as Record<string, unknown>)?.api_instance_url;
  
  results.comparison = {
    applink_domainUrl: applinkUrl,
    oauth_api_instance_url: oauthApiUrl,
    urls_match: applinkUrl === oauthApiUrl,
  };

  return NextResponse.json(results, { status: 200 });
}

