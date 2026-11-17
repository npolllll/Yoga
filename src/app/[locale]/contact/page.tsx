import type { Metadata } from "next";
import { ContentPage, contentMetadata } from "@/components/layout/ContentPage";

export async function generateMetadata({ params }: PageProps<"/[locale]/contact">): Promise<Metadata> {
  return contentMetadata("contact", (await params).locale);
}

export default async function Page({ params }: PageProps<"/[locale]/contact">) {
  return <ContentPage slug="contact" locale={(await params).locale} />;
}
