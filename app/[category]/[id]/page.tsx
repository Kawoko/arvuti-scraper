import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductDetailView } from "@/components/products/product-detail-view";
import { CATEGORY_DEFINITIONS, isComponentCategory } from "@/lib/categories";
import { buildProductMetadata, getProductDetailCached, parseProductId } from "@/lib/product-page";

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
  if (!detail) notFound();

  return <ProductDetailView detail={detail} definition={CATEGORY_DEFINITIONS[category]} />;
}
