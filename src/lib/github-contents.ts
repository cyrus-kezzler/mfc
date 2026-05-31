/**
 * Shared GitHub Contents API helpers for git-persisted JSON data files.
 *
 * The Back Bar persists editor overrides (pricing, RRP, Amazon, notes) as JSON
 * files committed to the repo, so every device sees the same numbers and the
 * site redeploys from the change. These helpers are the read/write primitives
 * behind the various server actions. Plain async functions — NOT a "use server"
 * module — so they can be imported and composed freely.
 */

const OWNER = "cyrusgilbertrolfe";
const REPO = "back-bar";
const BRANCH = "main";

function ghHeaders(): Record<string, string> {
  const pat = process.env.GITHUB_PAT;
  if (!pat) throw new Error("GITHUB_PAT is not set.");
  return {
    Authorization: `Bearer ${pat}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

/** Read a file's content + blob sha from the repo. */
export async function ghGet(filePath: string): Promise<{ content: string; sha: string }> {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}?ref=${BRANCH}`,
    { headers: ghHeaders(), cache: "no-store" },
  );
  if (!res.ok) throw new Error(`GitHub GET ${filePath} failed (${res.status})`);
  const data = await res.json();
  return { content: Buffer.from(data.content, "base64").toString("utf8"), sha: data.sha };
}

/** Commit new content for a file. */
export async function ghPut(
  filePath: string,
  content: string,
  sha: string,
  message: string,
): Promise<void> {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`,
    {
      method: "PUT",
      headers: ghHeaders(),
      body: JSON.stringify({
        message,
        content: Buffer.from(content, "utf8").toString("base64"),
        sha,
        branch: BRANCH,
      }),
    },
  );
  if (!res.ok) throw new Error(`GitHub PUT ${filePath} failed (${res.status})`);
}

/** Read a JSON record file; returns {} if the file is empty. */
export async function ghGetRecord(filePath: string): Promise<{ data: Record<string, unknown>; sha: string }> {
  const { content, sha } = await ghGet(filePath);
  const trimmed = content.trim();
  return { data: trimmed ? JSON.parse(trimmed) : {}, sha };
}
