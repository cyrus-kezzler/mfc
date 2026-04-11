import HubPage, { HubModule } from "@/components/HubPage";

const MODULES: HubModule[] = [
  {
    href: "/recipes",
    label: "Recipes",
    sublabel: "Cocktail specifications",
    description:
      "Browse and manage cocktail recipes, ingredient ratios, and production notes.",
    status: "live",
  },
  {
    href: "/drinks/range",
    label: "The Range",
    sublabel: "Active SKUs",
    description:
      "Every drink we currently sell — format, price, channel availability, and status.",
    status: "soon",
  },
  {
    href: "/drinks/nd",
    label: "New Product Development",
    sublabel: "What we are building",
    description:
      "Drinks in R&D, tasting notes, costings, and the path from idea to launch.",
    status: "soon",
  },
  {
    href: "/drinks/assets",
    label: "Photo & Video Assets",
    sublabel: "Creative library",
    description:
      "Every photograph and video pour, tagged by drink and ready for Amazon, Shopify, and press.",
    status: "soon",
  },
  {
    href: "/drinks/content-plan",
    label: "Content Plan",
    sublabel: "Marketing calendar",
    description:
      "Launches, drops, press moments, and social content — a single calendar for the year.",
    status: "soon",
  },
  {
    href: "/drinks/press",
    label: "Press",
    sublabel: "Release & coverage",
    description:
      "Press releases, coverage tracking, and the assets journalists need.",
    status: "soon",
  },
];

export default function DrinksPage() {
  return (
    <HubPage
      eyebrow="Drinks"
      title="Range & content"
      intro="The drinks themselves — what we sell, what we are developing, and how we tell the story."
      modules={MODULES}
    />
  );
}
