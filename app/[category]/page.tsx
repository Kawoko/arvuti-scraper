import { notFound } from "next/navigation";

import { CategoryListing } from "@/components/category-listing";
import { CATEGORY_DEFINITIONS, isComponentCategory } from "@/lib/categories";

export const dynamic = "force-dynamic";

interface CategoryPageProps {
  params: Promise<{ category: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Listing for any tracked group: `/gpu`, `/cpu`, `/hdd`, `/ssd`, `/custom`.
 *
 * RAM has its own static route at `/`, which takes precedence over this dynamic
 * segment, so this file needs no special case for it.
 */
export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { category } = await params;
  if (!isComponentCategory(category)) notFound();

  return (
    <CategoryListing
      definition={CATEGORY_DEFINITIONS[category]}
      searchParams={await searchParams}
    />
  );
}
