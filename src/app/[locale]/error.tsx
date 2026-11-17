"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/Button";

const TEXT = {
  ru: { title: "Не удалось загрузить страницу", text: "Проверьте соединение и попробуйте ещё раз.", retry: "Повторить" },
  en: { title: "The page could not be loaded", text: "Check your connection and try again.", retry: "Try again" },
};

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const params = useParams<{ locale: string }>();
  const t = params.locale === "en" ? TEXT.en : TEXT.ru;
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <section role="alert" className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <h1 className="text-3xl">{t.title}</h1>
      <p className="mt-3 text-muted">{t.text}</p>
      <Button className="mt-8" variant="dark" onClick={reset}>
        {t.retry}
      </Button>
    </section>
  );
}
