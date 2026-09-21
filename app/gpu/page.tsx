import { CategoryListing } from "@/components/category-listing";
import { CATEGORY_DEFINITIONS } from "@/lib/categories";

export const dynamic = "force-dynamic";

interface GpuPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function GpuPage({ searchParams }: GpuPageProps) {
  return (
    <CategoryListing
      definition={CATEGORY_DEFINITIONS.gpu}
      searchParams={await searchParams}
    />
  );
}
