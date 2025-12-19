import { NextRequest, NextResponse } from "next/server";

// Force dynamic rendering - SDK cannot be evaluated at build time
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Log verbose request information
  const headersObj: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headersObj[key] = value;
  });

  const requestInfo = {
    method: request.method,
    url: request.url,
    nextUrl: {
      pathname: request.nextUrl.pathname,
      search: request.nextUrl.search,
      searchParams: Object.fromEntries(request.nextUrl.searchParams),
      host: request.nextUrl.host,
      hostname: request.nextUrl.hostname,
      port: request.nextUrl.port,
      protocol: request.nextUrl.protocol,
      origin: request.nextUrl.origin,
    },
    headers: headersObj,
  };

  console.log("=== APPLINK TEST ENDPOINT - INCOMING REQUEST ===");
  console.log(JSON.stringify(requestInfo, null, 2));
  console.log("=================================================");

  try {
    // Dynamic import to avoid build-time evaluation
    const applink = await import("@heroku/applink");
    
    // Initialize SDK
    console.log("Initializing AppLink SDK...");
    const sdk = applink.init();
    console.log("SDK initialized successfully");
    console.log("SDK structure:", JSON.stringify(Object.keys(sdk), null, 2));

    // Fetch the JWT authorization by name via addons.applink
    console.log("Fetching authorization 'org_jwt'...");
    const auth = await sdk.addons.applink.getAuthorization("org_jwt");
    console.log("Authorization fetched successfully");
    
    // Cast to any to inspect actual properties at runtime
    const authData = auth as unknown as Record<string, unknown>;
    console.log("Auth object keys:", Object.keys(authData));
    console.log("Auth object (redacted tokens):", JSON.stringify(
      Object.fromEntries(
        Object.entries(authData).map(([k, v]) => [
          k,
          typeof v === 'string' && v.length > 20 ? v.substring(0, 10) + '...[redacted]' : v
        ])
      ),
      null,
      2
    ));

    // Build response with whatever properties exist
    const response = {
      success: true,
      request: requestInfo,
      authorization: {
        name: "org_jwt",
        keys: Object.keys(authData),
        // Include all properties with token values redacted
        data: Object.fromEntries(
          Object.entries(authData).map(([k, v]) => [
            k,
            typeof v === 'string' && v.length > 20 ? v.substring(0, 10) + '...[redacted]' : v
          ])
        ),
      },
      tested_at: new Date().toISOString(),
    };

    console.log("=== RESPONSE ===");
    console.log(JSON.stringify(response, null, 2));

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const stack = error instanceof Error ? error.stack : undefined;
    
    console.error("=== APPLINK TEST ENDPOINT - ERROR ===");
    console.error("Error message:", message);
    console.error("Error stack:", stack);
    console.error("=====================================");

    return NextResponse.json(
      { 
        success: false, 
        error: message,
        request: requestInfo,
        tested_at: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
