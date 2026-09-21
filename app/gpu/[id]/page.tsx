import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductDetailView } from "@/components/products/product-detail-view";
import { CATEGORY_DEFINITIONS } from "@/lib/categories";
import { buildProductMetadata, getProductDetailCached, parseProductId } from "@/lib/product-page";

export const dynamic = "force-dynamic";

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { id } = await params;
  const productId = parseProductId(id);
  if (productId === null) return { title: "Product not found" };

  return buildProductMetadata(await getProductDetailCached(productId));
}

export default async function GpuProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const productId = parseProductId(id);
  if (productId === null) notFound();

  const detail = await getProductDetailCached(productId);
  if (!detail) notFound();

  return <ProductDetailView detail={detail} definition={CATEGORY_DEFINITIONS.gpu} />;
}
