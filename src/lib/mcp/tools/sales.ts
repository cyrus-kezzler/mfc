/**
 * MCP tools — the Wholesale Outreach tracker (accounts + touchpoints).
 *
 * These close the gap named in the 05 Jul 2026 change order: the tracker was
 * live in the app but unreachable by tools, so seat work happened through
 * browser clicks and, in practice, did not happen at all. On 29 Jul 2026 the
 * tracker held 8 accounts, all "Researching", with zero touchpoints, against
 * 13 sample boxes actually posted. The campaign was being run out of markdown.
 *
 * Everything here wraps the existing server actions in @/app/actions/sales,
 * so persistence is unchanged: each write commits the relevant JSON file to
 * GitHub via the Contents API and the git history IS the audit log. Writes
 * need GITHUB_PAT set; without it the underlying action returns a clear error.
 *
 * Scope note: the change order asked for a general CRM. There isn't one. The
 * app's Sales section lists CRM, Wholesale Accounts, Caterers and Amazon as
 * planned; Wholesale Outreach is the only live thing. These tools are scoped
 * to what exists.
 */

import {
  createAccount,
  updateAccount,
  addTouchpoint,
} from "@/app/actions/sales";
import {
  getAccounts,
  getTouchpoints,
  CATEGORIES,
  STATUSES,
  TIERS,
  TOUCHPOINT_TYPES,
  type Account,
  type Category,
  type Status,
  type Tier,
  type Touchpoint,
  type TouchpointType,
} from "@/lib/sales-data";
import type { ToolArgs, ToolDefinition } from "../types";

// ─── Argument helpers ────────────────────────────────────────────────────────

function str(args: ToolArgs, key: string): string | null {
  const v = args[key];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function optInt(args: ToolArgs, key: string): number | null {
  const v = args[key];
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) throw new Error(`"${key}" must be a number.`);
  return n;
}

/** Case-insensitive match against a closed list, so agents need not match case. */
function pick<T extends string>(
  raw: string,
  allowed: readonly T[],
  label: string,
): T {
  const hit = allowed.find((a) => a.toLowerCase() === raw.toLowerCase());
  if (!hit) {
    throw new Error(`Invalid ${label} "${raw}". One of: ${allowed.join(", ")}.`);
  }
  return hit;
}

/**
 * Resolve an account by id or by name. Name matching is case-insensitive and
 * falls back to a unique substring match, so "cartwright" finds
 * "Cartwright & Butler". An ambiguous substring is an error, never a guess.
 */
async function resolveAccount(args: ToolArgs): Promise<Account> {
  const accounts = await getAccounts();
  const id = str(args, "account_id");
  if (id) {
    const byId = accounts.find((a) => a.id === id);
    if (!byId) throw new Error(`No account with id "${id}".`);
    return byId;
  }
  const name = str(args, "name") ?? str(args, "account_name");
  if (!name) throw new Error("Provide account_id or name.");
  const exact = accounts.filter(
    (a) => a.name.toLowerCase() === name.toLowerCase(),
  );
  if (exact.length === 1) return exact[0];
  const partial = accounts.filter((a) =>
    a.name.toLowerCase().includes(name.toLowerCase()),
  );
  if (partial.length === 1) return partial[0];
  if (partial.length === 0) throw new Error(`No account matching "${name}".`);
  throw new Error(
    `"${name}" matches ${partial.length} accounts: ${partial
      .map((a) => a.name)
      .join(", ")}. Use account_id.`,
  );
}

function summarise(account: Account, touchpoints: Touchpoint[]) {
  const mine = touchpoints
    .filter((t) => t.account_id === account.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  return {
    id: account.id,
    name: account.name,
    category: account.category,
    tier: account.tier,
    city: account.city || null,
    buyer: account.buyer_name || null,
    buyer_title: account.buyer_title || null,
    status: account.status,
    touchpoints: mine.length,
    last_touch: mine[0]?.date ?? null,
  };
}

// ─── Tools ───────────────────────────────────────────────────────────────────

export const salesTools: ToolDefinition[] = [
  {
    name: "list_accounts",
    title: "List outreach accounts",
    description:
      "List every account in the Wholesale Outreach tracker with its tier, " +
      "status, buyer, touchpoint count and last touch date. Optionally filter " +
      "by status, tier, category, or a case-insensitive substring of the name. " +
      "This is the sample-box campaign, not a general customer list.",
    access: "read",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", description: `One of: ${STATUSES.join(", ")}.` },
        tier: { type: "number", description: "1, 2 or 3." },
        category: { type: "string", description: `One of: ${CATEGORIES.join(", ")}.` },
        name: { type: "string", description: "Case-insensitive substring of the account name." },
      },
      additionalProperties: false,
    },
    handler: async (args) => {
      const [accounts, touchpoints] = await Promise.all([
        getAccounts(),
        getTouchpoints(),
      ]);
      const status = str(args, "status");
      const category = str(args, "category");
      const name = str(args, "name");
      const tier = optInt(args, "tier");

      let rows = accounts;
      if (status) {
        const s = pick(status, STATUSES, "status");
        rows = rows.filter((a) => a.status === s);
      }
      if (category) {
        const c = pick(category, CATEGORIES, "category");
        rows = rows.filter((a) => a.category === c);
      }
      if (tier !== null) {
        if (!TIERS.includes(tier as Tier)) throw new Error("tier must be 1, 2 or 3.");
        rows = rows.filter((a) => a.tier === tier);
      }
      if (name) {
        rows = rows.filter((a) =>
          a.name.toLowerCase().includes(name.toLowerCase()),
        );
      }

      const listed = rows
        .map((a) => summarise(a, touchpoints))
        .sort((a, b) => a.name.localeCompare(b.name));

      return {
        count: listed.length,
        totalAccounts: accounts.length,
        byStatus: STATUSES.reduce<Record<string, number>>((acc, s) => {
          const n = accounts.filter((a) => a.status === s).length;
          if (n) acc[s] = n;
          return acc;
        }, {}),
        accounts: listed,
      };
    },
  },

  {
    name: "get_account",
    title: "Get one outreach account",
    description:
      "Return one account in full, with its complete touchpoint history newest " +
      "first. Look it up by account_id, or by name (case-insensitive, and a " +
      "unique substring works). An ambiguous name is an error listing the " +
      "candidates rather than a guess.",
    access: "read",
    inputSchema: {
      type: "object",
      properties: {
        account_id: { type: "string", description: "The account's id." },
        name: { type: "string", description: "Account name or a unique substring of it." },
      },
      additionalProperties: false,
    },
    handler: async (args) => {
      const account = await resolveAccount(args);
      const touchpoints = await getTouchpoints();
      return {
        account,
        touchpoints: touchpoints
          .filter((t) => t.account_id === account.id)
          .sort((a, b) => b.date.localeCompare(a.date)),
      };
    },
  },

  {
    name: "create_account",
    title: "Create an outreach account",
    description:
      "Add a prospect to the Wholesale Outreach tracker. Only name is " +
      "required; everything else defaults (category Other, tier 1, status " +
      "Researching). Committed to git. Check list_accounts first: this tool " +
      "does not deduplicate, and a second record for the same company splits " +
      "its touchpoint history.",
    access: "write",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Company name. Required." },
        category: { type: "string", description: `One of: ${CATEGORIES.join(", ")}. Defaults to Other.` },
        tier: { type: "number", description: "1, 2 or 3. Defaults to 1." },
        city: { type: "string" },
        buyer_name: { type: "string" },
        buyer_title: { type: "string" },
        buyer_email: { type: "string" },
        buyer_phone: { type: "string" },
        status: { type: "string", description: `One of: ${STATUSES.join(", ")}. Defaults to Researching.` },
        notes: { type: "string" },
      },
      required: ["name"],
      additionalProperties: false,
    },
    handler: async (args) => {
      const name = str(args, "name");
      if (!name) throw new Error("name is required.");
      const category = str(args, "category");
      const status = str(args, "status");
      const tier = optInt(args, "tier");

      const result = await createAccount({
        name,
        category: category ? pick(category, CATEGORIES, "category") : ("Other" as Category),
        tier: (tier ?? 1) as Tier,
        city: str(args, "city") ?? "",
        buyer_name: str(args, "buyer_name") ?? "",
        buyer_title: str(args, "buyer_title") ?? "",
        buyer_email: str(args, "buyer_email") ?? "",
        buyer_phone: str(args, "buyer_phone") ?? "",
        status: status ? pick(status, STATUSES, "status") : ("Researching" as Status),
        notes: str(args, "notes") ?? "",
      });
      if (!result.ok) throw new Error(result.error);
      return { ok: true, id: result.id, name };
    },
  },

  {
    name: "update_account",
    title: "Update an outreach account",
    description:
      "Change any field on an existing account: status, tier, category, buyer " +
      "details, city or notes. This is a partial update, so pass only what " +
      "changes and the rest is preserved. Identify the account by account_id " +
      "or name. Committed to git. Use log_touchpoint as well when the change " +
      "reflects something that actually happened, so the history records it.",
    access: "write",
    inputSchema: {
      type: "object",
      properties: {
        account_id: { type: "string" },
        name: { type: "string", description: "Account name or unique substring, used to find the account." },
        new_name: { type: "string", description: "Rename the company." },
        category: { type: "string", description: `One of: ${CATEGORIES.join(", ")}.` },
        tier: { type: "number", description: "1, 2 or 3." },
        city: { type: "string" },
        buyer_name: { type: "string" },
        buyer_title: { type: "string" },
        buyer_email: { type: "string" },
        buyer_phone: { type: "string" },
        status: { type: "string", description: `One of: ${STATUSES.join(", ")}.` },
        notes: { type: "string", description: "Replaces the existing notes." },
      },
      additionalProperties: false,
    },
    handler: async (args) => {
      const current = await resolveAccount(args);
      const category = str(args, "category");
      const status = str(args, "status");
      const tier = optInt(args, "tier");
      if (tier !== null && !TIERS.includes(tier as Tier)) {
        throw new Error("tier must be 1, 2 or 3.");
      }

      const next = {
        id: current.id,
        name: str(args, "new_name") ?? current.name,
        category: category ? pick(category, CATEGORIES, "category") : current.category,
        tier: (tier ?? current.tier) as Tier,
        city: str(args, "city") ?? current.city,
        buyer_name: str(args, "buyer_name") ?? current.buyer_name,
        buyer_title: str(args, "buyer_title") ?? current.buyer_title,
        buyer_email: str(args, "buyer_email") ?? current.buyer_email,
        buyer_phone: str(args, "buyer_phone") ?? current.buyer_phone,
        status: status ? pick(status, STATUSES, "status") : current.status,
        notes: str(args, "notes") ?? current.notes,
      };

      const result = await updateAccount(next);
      if (!result.ok) throw new Error(result.error);
      return { ok: true, id: current.id, name: next.name, changed: next };
    },
  },

  {
    name: "log_touchpoint",
    title: "Log a touchpoint",
    description:
      "Record something that happened with an account: a box sent, a call, an " +
      "email, a letter, a reply, a meeting. Identify the account by " +
      "account_id or name. Date is YYYY-MM-DD and must be given explicitly, " +
      "so backfilling a past send is normal and does not silently become " +
      "today. Committed to git. This is the follow-up rail: the 23 Jul 2026 " +
      "ruling makes logged follow-ups, not postage, the constraint on how " +
      "fast new boxes go out.",
    access: "write",
    inputSchema: {
      type: "object",
      properties: {
        account_id: { type: "string" },
        name: { type: "string", description: "Account name or unique substring." },
        date: { type: "string", description: "YYYY-MM-DD. Required." },
        type: { type: "string", description: `One of: ${TOUCHPOINT_TYPES.join(", ")}.` },
        summary: { type: "string", description: "What happened. Required." },
        set_status: {
          type: "string",
          description:
            `Optionally move the account's status in the same call. One of: ${STATUSES.join(", ")}.`,
        },
      },
      required: ["date", "type", "summary"],
      additionalProperties: false,
    },
    handler: async (args) => {
      const account = await resolveAccount(args);
      const date = str(args, "date");
      if (!date) throw new Error("date is required (YYYY-MM-DD).");
      const rawType = str(args, "type");
      if (!rawType) throw new Error("type is required.");
      const summary = str(args, "summary");
      if (!summary) throw new Error("summary is required.");

      const result = await addTouchpoint({
        account_id: account.id,
        date,
        type: pick(rawType, TOUCHPOINT_TYPES, "type") as TouchpointType,
        summary,
      });
      if (!result.ok) throw new Error(result.error);

      const setStatus = str(args, "set_status");
      let statusChangedTo: Status | null = null;
      if (setStatus) {
        const s = pick(setStatus, STATUSES, "status");
        const upd = await updateAccount({
          id: account.id,
          name: account.name,
          category: account.category,
          tier: account.tier,
          city: account.city,
          buyer_name: account.buyer_name,
          buyer_title: account.buyer_title,
          buyer_email: account.buyer_email,
          buyer_phone: account.buyer_phone,
          status: s,
          notes: account.notes,
        });
        if (!upd.ok) {
          throw new Error(
            `Touchpoint logged (${result.id}) but the status change failed: ${upd.error}`,
          );
        }
        statusChangedTo = s;
      }

      return {
        ok: true,
        id: result.id,
        account: account.name,
        date,
        statusChangedTo,
      };
    },
  },
];
