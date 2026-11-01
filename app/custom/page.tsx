import { redirect } from "next/navigation";

/** The old hard-coded "Custom" group is now the per-user tracked page. */
export default function CustomGroupPage() {
  redirect("/tracked");
}
