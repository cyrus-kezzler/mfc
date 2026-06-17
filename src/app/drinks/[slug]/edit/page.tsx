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
import { saveRecipeEdit } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditRecipePage({
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

  const clientRow = (await listAllClients()).find((c) => c.slug === clientSlug);
  const recipe = await getRecipeLines(slug, clientSlug);
  if (!clientRow || !recipe) notFound(); // editing requires an existing recipe

  const components = await listIngredientComponents();
  const action = saveRecipeEdit.bind(null, slug, clientSlug);

  return (
    <div style={{ background: COLOR.paper, color: COLOR.ink, minHeight: "100vh" }}>
      <Nav />
      <main style={{ maxWidth: 640, margin: "0 auto", padding: "32px 24px 96px" }}>
        <Link href={`/drinks/${slug}?client=${clientSlug}`} style={{ fontSize: 11, color: COLOR.muted, textDecoration: "none", ...smallCaps }}>
          ← {drink.name}
        </Link>
        <div style={{ marginTop: 18 }}>
          <RecipeEditor
            action={action}
            components={components}
            initialLines={recipe.lines}
            initialMethod={recipe.method}
            heading={`Edit ${clientRow.name} recipe — ${drink.name}`}
            submitLabel="Save new version"
            cancelHref={`/drinks/${slug}?client=${clientSlug}`}
          />
        </div>
        <p style={{ marginTop: 20, fontSize: 12, color: COLOR.muted, fontStyle: "italic" }}>
          Saving creates a new version. Past versions stay intact so historical batches re-price correctly.
        </p>
      </main>
    </div>
  );
}
