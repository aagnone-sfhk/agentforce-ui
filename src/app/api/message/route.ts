import { NextRequest, NextResponse } from "next/server";
import { sendStreamingMessage } from "@/chat/agentforce";
import { getAuthMode } from "@/config/env";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, sequenceId, agentId } = body;
    
    // Validate request body
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: "Message is required and must be a string" },
        { status: 400 }
      );
    }
    
    if (typeof sequenceId !== 'number') {
      return NextResponse.json(
        { error: "SequenceId is required and must be a number" },
        { status: 400 }
      );
    }
    
    const authMode = getAuthMode();
    console.log(`[/api/message] Auth mode: ${authMode} | Agent: ${agentId || 'default'} | Seq: ${sequenceId}`);
    const contentStream = await sendStreamingMessage(message, sequenceId, agentId, authMode);
    const headers = new Headers({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    });
    return new NextResponse(contentStream, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("API route error:", error);
    
    // Return user-friendly error messages
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    
    // For streaming endpoints, we need to return an SSE error event
    const errorEvent = `data: ${JSON.stringify({
      error: true,
      message: errorMessage,
      type: "error"
    })}\n\n`;
    
    const headers = new Headers({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    });
    
    return new NextResponse(errorEvent, {
      status: 200, // Use 200 for SSE even with errors
      headers,
    });
  }
}