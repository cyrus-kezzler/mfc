import { notFound } from "next/navigation";
import Link from "next/link";
import Nav from "@/components/Nav";
import { COLOR, smallCaps } from "@/lib/design";
import {
  dbConfigured,
  getDrinkDetail,
  getRecipeLines,
  listAllClients,
  listIngredientComponents,
} from "@/lib/drinks-db";
import { RecipeEditor } from "../_RecipeEditor";
import { createRecipeForClient } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewRecipePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ client?: string }>;
}) {
  const { slug } = await params;
  const { client: clientSlug } = await searchParams;
  if (!dbConfigured() || !clientSlug) notFound();

  const drink = await getDrinkDetail(slug);
  if (!drink) notFound();

  const clients = await listAllClients();
  const clientRow = clients.find((c) => c.slug === clientSlug);
  if (!clientRow) notFound();

  // Block if this client already has a recipe for the drink.
  const existing = await getRecipeLines(slug, clientSlug);
  if (existing) notFound();

  // Pre-fill from the MFC default recipe (brief §6). Empty if MFC has none.
  const defaultClient = clients.find((c) => c.isDefault);
  const prefill = defaultClient ? (await getRecipeLines(slug, defaultClient.slug)) ?? [] : [];

  const components = await listIngredientComponents();
  const action = createRecipeForClient.bind(null, slug, clientSlug);

  return (
    <div style={{ background: COLOR.paper, color: COLOR.ink, minHeight: "100vh" }}>
      <Nav />
      <main style={{ maxWidth: 640, margin: "0 auto", padding: "32px 24px 96px" }}>
        <Link href={`/drinks/${slug}`} style={{ fontSize: 11, color: COLOR.muted, textDecoration: "none", ...smallCaps }}>
          ← {drink.name}
        </Link>
        <div style={{ marginTop: 18 }}>
          <RecipeEditor
            action={action}
            components={components}
            initialLines={prefill}
            heading={`Add ${clientRow.name} recipe — ${drink.name}`}
            submitLabel={`Create ${clientRow.name} recipe`}
            cancelHref={`/drinks/${slug}`}
          />
        </div>
        <p style={{ marginTop: 20, fontSize: 12, color: COLOR.muted, fontStyle: "italic" }}>
          {prefill.length
            ? `Pre-filled from the ${defaultClient?.name} recipe — adjust as needed.`
            : "Starting from a blank recipe."}
        </p>
      </main>
    </div>
  );
}
