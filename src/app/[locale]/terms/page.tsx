import type { Metadata } from "next";
import { ContentPage, contentMetadata } from "@/components/layout/ContentPage";

export async function generateMetadata({ params }: PageProps<"/[locale]/terms">): Promise<Metadata> {
  return contentMetadata("terms", (await params).locale);
}

export default async function Page({ params }: PageProps<"/[locale]/terms">) {
  return <ContentPage slug="terms" locale={(await params).locale} />;
}
