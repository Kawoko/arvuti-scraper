import { LogOut } from "lucide-react";

import { signOut } from "@/app/login/actions";
import { Button } from "@/components/ui/button";

export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={signOut}>
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        className={className}
        title="Sign out"
        aria-label="Sign out"
      >
        <LogOut />
      </Button>
    </form>
  );
}
