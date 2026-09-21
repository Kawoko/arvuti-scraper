import { redirect } from "next/navigation";

/** `/ram` is an alias for the main RAM listing at `/`. */
export default function RamIndexPage() {
  redirect("/");
}
