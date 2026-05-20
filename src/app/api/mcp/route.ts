/**
 * Back Bar MCP connector — HTTP route handler.
 *
 * A Model Context Protocol server exposed at /api/mcp. It speaks JSON-RPC 2.0
 * over the MCP "Streamable HTTP" transport in stateless JSON mode: one
 * JSON-RPC message per POST, one JSON response back. No sessions, no SSE —
 * which keeps the connector dependency-free and durable.
 *
 * This route is permanent infrastructure. Tool domains (including the future
 * Speed Rail ERP tools) plug into the registry without touching this file.
 *
 * Auth: bearer token in the Authorization header (see lib/mcp/auth.ts).
 */

import { resolveAccess, isConfigured } from "@/lib/mcp/auth";
import { listTools, getTool, canCall } from "@/lib/mcp/registry";
import {
  SERVER_INFO,
  SERVER_INSTRUCTIONS,
  RPC,
  rpcResult,
  rpcError,
  negotiateProtocolVersion,
  type JsonRpcMessage,
} from "@/lib/mcp/protocol";
import type { AccessLevel, ToolDefinition } from "@/lib/mcp/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── Response helpers ───────────────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

/** Shape a tool for the `tools/list` response. */
function wireTool(tool: ToolDefinition) {
  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: tool.inputSchema,
    annotations: {
      readOnlyHint: tool.access === "read",
      destructiveHint: false,
    },
  };
}

// ─── Method handlers ────────────────────────────────────────────────────────

async function handleToolsCall(
  id: string | number | null,
  params: unknown,
  access: AccessLevel,
) {
  const p = asObject(params);
  const name = typeof p.name === "string" ? p.name : "";
  if (!name) {
    return rpcError(id, RPC.INVALID_PARAMS, "tools/call requires a tool name.");
  }

  const tool = getTool(name);
  if (!tool) {
    return rpcError(id, RPC.INVALID_PARAMS, `Unknown tool: "${name}".`);
  }
  if (!canCall(access, tool)) {
    return rpcError(
      id,
      RPC.INVALID_PARAMS,
      `Tool "${name}" requires a write-tier token; this token is read-only.`,
    );
  }

  // Tool execution errors are reported in the result (isError), not as a
  // JSON-RPC transport error — this is what the MCP spec requires.
  try {
    const data = await tool.handler(asObject(p.arguments));
    return rpcResult(id, {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      isError: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return rpcResult(id, {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    });
  }
}

/**
 * Dispatch a single JSON-RPC message. Returns the response object, or `null`
 * for notifications (which never get a response).
 */
async function handleMessage(
  msg: JsonRpcMessage,
  access: AccessLevel,
): Promise<object | null> {
  const hasId = !!msg && Object.prototype.hasOwnProperty.call(msg, "id");
  const id = hasId ? (msg.id ?? null) : null;
  const isNotification = !hasId;
  const method = typeof msg?.method === "string" ? msg.method : "";

  if (!method) {
    return isNotification
      ? null
      : rpcError(id, RPC.INVALID_REQUEST, "Missing method.");
  }

  // Notifications: acknowledge silently.
  if (isNotification) return null;

  switch (method) {
    case "initialize": {
      const params = asObject(msg.params);
      return rpcResult(id, {
        protocolVersion: negotiateProtocolVersion(params.protocolVersion),
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: SERVER_INSTRUCTIONS,
      });
    }
    case "ping":
      return rpcResult(id, {});
    case "tools/list":
      return rpcResult(id, { tools: listTools(access).map(wireTool) });
    case "tools/call":
      return handleToolsCall(id, msg.params, access);
    default:
      return rpcError(id, RPC.METHOD_NOT_FOUND, `Unknown method: "${method}".`);
  }
}

// ─── HTTP verbs ─────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  const access = resolveAccess(req.headers.get("authorization"));
  if (!access) {
    return isConfigured()
      ? jsonResponse(
          { error: "Unauthorized: a valid bearer token is required." },
          401,
        )
      : jsonResponse(
          { error: "MCP connector is not configured (MCP_TOKEN is unset)." },
          503,
        );
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(
      rpcError(null, RPC.PARSE_ERROR, "Request body is not valid JSON."),
      400,
    );
  }

  const isBatch = Array.isArray(payload);
  const messages = (isBatch ? payload : [payload]) as JsonRpcMessage[];
  if (messages.length === 0) {
    return jsonResponse(
      rpcError(null, RPC.INVALID_REQUEST, "Empty request."),
      400,
    );
  }

  const responses: object[] = [];
  for (const msg of messages) {
    const response = await handleMessage(msg, access);
    if (response) responses.push(response);
  }

  // All messages were notifications → nothing to return.
  if (responses.length === 0) return new Response(null, { status: 202 });

  return jsonResponse(isBatch ? responses : responses[0]);
}

/** MCP allows a GET for server-initiated SSE; this server is request/response only. */
export function GET(): Response {
  return jsonResponse(
    { error: "This MCP endpoint supports POST (JSON-RPC) only." },
    405,
  );
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204 });
}
