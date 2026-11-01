/** Only allow same-site relative redirects after sign-in. */
export function safeNextPath(value: FormDataEntryValue | string | null | undefined): string {
  if (typeof value !== "string") return "/tracked";
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return "/tracked";
  return trimmed.slice(0, 500);
}
