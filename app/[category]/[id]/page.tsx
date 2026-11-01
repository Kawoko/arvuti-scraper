import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ProductDetailView } from "@/components/products/product-detail-view";
import { CATEGORY_DEFINITIONS, isComponentCategory } from "@/lib/categories";
import { buildProductMetadata, getProductDetailCached, parseProductId } from "@/lib/product-page";
import { findProductCategories } from "@/lib/queries/product-detail";
import { getTrackingContext } from "@/lib/queries/tracked";
import { trackedKey } from "@/lib/tracking";

export const dynamic = "force-dynamic";

interface ProductPageProps {
  params: Promise<{ category: string; id: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { category, id } = await params;
  if (!isComponentCategory(category)) return { title: "Product not found" };

  const productId = parseProductId(id);
  if (productId === null) return { title: "Product not found" };

  return buildProductMetadata(await getProductDetailCached(productId, category));
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { category, id } = await params;
  if (!isComponentCategory(category)) notFound();

  const productId = parseProductId(id);
  if (productId === null) notFound();

  const detail = await getProductDetailCached(productId, category);
  if (!detail) {
    // The product may exist under a different group, because an old or edited
    // link kept the wrong group path. When exactly one group matches, send the
    // visitor there so bookmarks keep working; otherwise it is genuinely gone.
    const groups = await findProductCategories(productId);
    if (groups.length === 1 && groups[0] !== category) {
      const definition = CATEGORY_DEFINITIONS[groups[0]];
      redirect(`${definition.detailBasePath}/${productId}`);
    }
    notFound();
  }

  const { user, trackedKeys } = await getTrackingContext();
  const loginNext = `${CATEGORY_DEFINITIONS[category].detailBasePath}/${productId}`;

  return (
    <ProductDetailView
      detail={detail}
      definition={CATEGORY_DEFINITIONS[category]}
      tracked={trackedKeys.has(trackedKey(category, productId))}
      authenticated={user !== null}
      loginNext={loginNext}
    />
  );
}
