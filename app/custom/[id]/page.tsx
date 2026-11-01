import { redirect } from "next/navigation";

/** Old pinned-product detail links land on the tracked page. */
export default function CustomProductPage() {
  redirect("/tracked");
}
