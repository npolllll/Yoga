import type { Metadata } from "next";
import { ContentPage, contentMetadata } from "@/components/layout/ContentPage";

export async function generateMetadata({ params }: PageProps<"/[locale]/privacy">): Promise<Metadata> {
  return contentMetadata("privacy", (await params).locale);
}

export default async function Page({ params }: PageProps<"/[locale]/privacy">) {
  return <ContentPage slug="privacy" locale={(await params).locale} />;
}
