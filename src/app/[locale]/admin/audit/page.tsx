import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { AdminGate } from "@/components/admin/AdminGate";
import { adminClient } from "@/lib/admin/data";

export default async function AuditPage({ params }: PageProps<"/[locale]/admin/audit">) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  return (
    <AdminGate locale={locale} need="editor">
      {async () => {
        const db = await adminClient();
        const { data } = await db.from("audit_log").select("*").order("id", { ascending: false }).limit(300);
        return (
          <div data-testid="admin-audit">
            <h1 className="text-3xl">{dict.admin.audit}</h1>
            <div className="mt-6 overflow-x-auto rounded-[var(--radius-md)] border border-line bg-surface">
              <table className="w-full text-xs">
                <tbody>
                  {(data ?? []).map((e) => (
                    <tr key={e.id} className="border-b border-line last:border-0">
                      <td className="whitespace-nowrap p-2 text-muted">{new Date(e.created_at).toLocaleString(locale)}</td>
                      <td className="p-2 font-semibold">{e.action}</td>
                      <td className="p-2">{e.entity_type}</td>
                      <td className="p-2 font-mono">{JSON.stringify(e.meta)}</td>
                      <td className="p-2 font-mono text-muted">{e.actor?.slice(0, 8)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      }}
    </AdminGate>
  );
}
