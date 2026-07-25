import Link from "next/link";
import { COLOR, FONT, smallCaps } from "@/lib/design";

/**
 * "This module is currently disabled" state, rendered INSIDE the Back Bar shell.
 *
 * Slice 1.1 fix #5: when a flag-gated module (e.g. Speed Rail / ERP) is off, we
 * used to throw notFound() from the layout — which terminates the whole segment
 * and drops the user onto the bare Next 404, outside the shell, with no nav.
 * This renders in-shell instead: full Back Bar nav stays, and the copy says
 * "disabled" (intentional) rather than "404" (broken).
 *
 * Generic on purpose — any future flag-disabled route can reuse it by passing a
 * different title / message / back link.
 */
export function ModuleDisabled({
  eyebrow = "Module unavailable",
  title,
  message,
  backHref = "/",
  backLabel = "Back to Back Bar home",
}: {
  eyebrow?: string;
  title: string;
  message: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "80px 40px 96px" }}>
      <p style={{ fontSize: 10, color: COLOR.accent, marginBottom: 16, ...smallCaps }}>{eyebrow}</p>
      <h1
        style={{
          fontFamily: FONT.serif,
          fontSize: 32,
          fontWeight: 500,
          letterSpacing: "-0.02em",
          lineHeight: 1.15,
          marginBottom: 16,
        }}
      >
        {title}
      </h1>
      <p style={{ fontSize: 15, color: COLOR.muted, lineHeight: 1.6, marginBottom: 32 }}>{message}</p>
      <Link
        href={backHref}
        style={{
          fontSize: 13,
          color: COLOR.accent,
          textDecoration: "none",
          borderBottom: `1px solid ${COLOR.rule}`,
          paddingBottom: 2,
        }}
      >
        ← {backLabel}
      </Link>
    </main>
  );
}
