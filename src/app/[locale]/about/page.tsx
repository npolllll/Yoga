import type { Metadata } from "next";
import { ContentPage, contentMetadata } from "@/components/layout/ContentPage";

export async function generateMetadata({ params }: PageProps<"/[locale]/about">): Promise<Metadata> {
  return contentMetadata("about", (await params).locale);
}

export default async function Page({ params }: PageProps<"/[locale]/about">) {
  return <ContentPage slug="about" locale={(await params).locale} />;
}
