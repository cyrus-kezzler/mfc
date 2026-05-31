/**
 * Back Bar MCP connector — tool registry.
 *
 * Flattens the domain modules into a single lookup and enforces the access
 * tier: a `read` caller only sees and can call read tools; a `write` caller
 * sees and can call everything.
 */

import type { AccessLevel, ToolDefinition } from "./types";
import { TOOL_MODULES } from "./tools";

/** Every registered tool, with duplicate names rejected at module load. */
const ALL_TOOLS: ToolDefinition[] = (() => {
  const seen = new Map<string, ToolDefinition>();
  for (const mod of TOOL_MODULES) {
    for (const tool of mod.tools) {
      if (seen.has(tool.name)) {
        throw new Error(`Duplicate MCP tool name: "${tool.name}"`);
      }
      seen.set(tool.name, tool);
    }
  }
  return [...seen.values()];
})();

/** True when the access tier is allowed to use the tool. */
function permits(access: AccessLevel, tool: ToolDefinition): boolean {
  return access === "write" || tool.access === "read";
}

/** Tools visible to the given access tier, sorted by name. */
export function listTools(access: AccessLevel): ToolDefinition[] {
  return ALL_TOOLS.filter((t) => permits(access, t)).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

/** Look up a tool by name regardless of access tier. */
export function getTool(name: string): ToolDefinition | undefined {
  return ALL_TOOLS.find((t) => t.name === name);
}

/** Whether the access tier may call the named tool. */
export function canCall(access: AccessLevel, tool: ToolDefinition): boolean {
  return permits(access, tool);
}
