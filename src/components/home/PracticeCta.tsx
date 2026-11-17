"use client";

import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";
import { useMember } from "@/components/member/MemberState";

export function PracticeCta({ locale, memberLabel, guestLabel }: { locale: string; memberLabel: string; guestLabel: string }) {
  const { status } = useMember();
  const member = status === "member";
  return (
    <Link href={member ? `/${locale}/my-practice` : `/${locale}/sign-up`} className={buttonClass("dark", "lg")}>
      {member ? memberLabel : guestLabel}
    </Link>
  );
}
