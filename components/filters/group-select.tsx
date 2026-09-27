"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface GroupSelectOption {
  value: string;
  label: string;
}

interface GroupSelectProps {
  value: string;
  options: ReadonlyArray<GroupSelectOption>;
  /** Query parameter to write. Defaults to `group`. */
  paramName?: string;
  ariaLabel: string;
}

/**
 * URL-driven group selector.
 *
 * Used on the deals page so each component group can be viewed on its own rather
 * than everything being mixed into one list. Keeps the other query parameters
 * (the deal tab) intact.
 */
export function GroupSelect({ value, options, paramName = "group", ariaLabel }: GroupSelectProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  return (
    <Select
      value={value}
      onValueChange={(next) => {
        const params = new URLSearchParams(searchParams.toString());
        if (next === "all") {
          params.delete(paramName);
        } else {
          params.set(paramName, next);
        }

        const query = params.toString();
        startTransition(() => {
          router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
        });
      }}
    >
      <SelectTrigger aria-label={ariaLabel} className="sm:w-56" data-pending={isPending}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
