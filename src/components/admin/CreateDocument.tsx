"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createDocument } from "@/app/actions/admin";
import { useToast } from "@/components/ui/Toast";
import type { DocType } from "@/lib/content/schema";

export function CreateDocument({ locale, type, labels }: { locale: string; type: DocType; labels: { create: string; slug: string } }) {
  const [slug, setSlug] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await createDocument(type, slug.trim());
          if (r.ok) router.push(`/${locale}/admin/edit/${r.id}`);
          else toast(r.error, "error");
        });
      }}
    >
      <input
        className="h-10 w-48 rounded-full border border-line-strong bg-surface px-4 font-mono text-sm"
        placeholder={labels.slug}
        value={slug}
        pattern="[a-z0-9]+(-[a-z0-9]+)*"
        onChange={(e) => setSlug(e.target.value.toLowerCase())}
        required
        data-testid="create-slug"
      />
      <button className="h-10 rounded-full bg-brand px-5 font-semibold text-white disabled:opacity-50" disabled={pending} data-testid="create-document">
        {labels.create}
      </button>
    </form>
  );
}
