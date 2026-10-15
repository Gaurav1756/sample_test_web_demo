"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function HelpSearch({ initial }: { initial: string }) {
  const router = useRouter();
  const [value, setValue] = React.useState(initial);

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    const q = new URLSearchParams();
    if (value.trim()) q.set("search", value.trim().slice(0, 100));
    router.push(`/help?${q.toString()}`);
  };

  return (
    <form onSubmit={apply} className="flex gap-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search help articles"
        aria-label="Search help articles"
      />
      <Button type="submit">Search</Button>
    </form>
  );
}
