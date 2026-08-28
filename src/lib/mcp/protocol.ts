/**
 * Back Bar MCP connector — JSON-RPC 2.0 / MCP protocol helpers.
 *
 * The connector implements the MCP "Streamable HTTP" transport in its
 * simplest, stateless form: each POST carries one JSON-RPC message and the
 * response is returned as a single JSON object. No sessions, no SSE — a
 * tools-only server needs neither, which keeps this layer dependency-free.
 */

/** Protocol versions this server understands. Newest first. */
export const SUPPORTED_PROTOCOL_VERSIONS = [
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
];

export const DEFAULT_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];

export const SERVER_INFO = {
  name: "back-bar",
  title: "The Back Bar",
  version: "0.1.0",
};

export const SERVER_INSTRUCTIONS =
  "Back Bar is the internal operations system for Myatt's Fields Cocktails. " +
  "Use the read tools to look up drinks/SKUs, wholesale and RRP pricing, the " +
  "ingredient master, recipes, and revenue. Use the write tools to update " +
  "prices: every write is committed to git and is fully auditable.";

/** A JSON-RPC request or notification (notification = no `id`). */
export interface JsonRpcMessage {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: unknown;
}

/** Standard JSON-RPC error codes used by this server. */
export const RPC = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

export function rpcResult(id: string | number | null, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

export function rpcError(
  id: string | number | null,
  code: number,
  message: string,
) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

/** Negotiate a protocol version against what the client asked for. */
export function negotiateProtocolVersion(requested: unknown): string {
  if (
    typeof requested === "string" &&
    SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
  ) {
    return requested;
  }
  return DEFAULT_PROTOCOL_VERSION;
}
