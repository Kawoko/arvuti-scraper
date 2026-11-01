/**
 * Composite key for a tracked product.
 *
 * A product id alone is not enough: the same retailer id can exist under more
 * than one group. Kept in its own module so client components can import it
 * without pulling in server-only Supabase code.
 */
export function trackedKey(category: string, productId: number): string {
  return `${category}:${productId}`;
}
