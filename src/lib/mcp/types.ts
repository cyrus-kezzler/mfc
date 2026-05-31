/**
 * Back Bar MCP connector — shared types.
 *
 * The connector is a permanent part of the Back Bar app: a Model Context
 * Protocol server exposed as a Next.js route handler at /api/mcp. It lets
 * trusted AI agents query and update Back Bar's business data.
 *
 * Tools are grouped into domain modules and registered against a single
 * registry. ERP (Speed Rail) tools backed by Postgres can be added later as
 * further modules without changing the transport or auth layers.
 */

/**
 * Access tiers. A `read` token may only see and call read tools; a `write`
 * token may see and call everything. This maps onto the Back Bar
 * Owner / Operator role model (Owner = write, Operator = read).
 */
export type AccessLevel = "read" | "write";

/** Arguments passed to a tool handler — always a plain object from the caller. */
export type ToolArgs = Record<string, unknown>;

/**
 * A single MCP tool. `handler` returns any JSON-serialisable value; the
 * transport layer wraps it into an MCP tool result. Throwing from a handler
 * is reported back to the caller as a tool error (not a transport error).
 */
export interface ToolDefinition {
  /** Unique tool name, snake_case, stable — agents call tools by this. */
  name: string;
  /** Short human-friendly label. */
  title: string;
  /** What the tool does and when to use it. Shown to the calling agent. */
  description: string;
  /** `read` tools never mutate; `write` tools commit changes to Back Bar. */
  access: AccessLevel;
  /** JSON Schema for the tool's arguments. */
  inputSchema: Record<string, unknown>;
  /** Executes the tool. */
  handler: (args: ToolArgs) => Promise<unknown>;
}

/** A domain grouping of tools (pricing, ingredients, revenue, …). */
export interface ToolModule {
  /** Domain identifier, e.g. "pricing". */
  domain: string;
  tools: ToolDefinition[];
}
