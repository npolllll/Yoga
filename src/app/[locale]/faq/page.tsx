import type { Metadata } from "next";
import { ContentPage, contentMetadata } from "@/components/layout/ContentPage";

export async function generateMetadata({ params }: PageProps<"/[locale]/faq">): Promise<Metadata> {
  return contentMetadata("faq", (await params).locale);
}

export default async function Page({ params }: PageProps<"/[locale]/faq">) {
  return <ContentPage slug="faq" locale={(await params).locale} />;
}
