import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { AdminGate } from "@/components/admin/AdminGate";
import { RoleForm } from "@/components/admin/AdminForms";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function UsersPage({ params }: PageProps<"/[locale]/admin/users">) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  return (
    <AdminGate locale={locale} need="owner">
      {async () => {
        // Owner-only screen (checked by AdminGate); lists staff accounts and their roles.
        const admin = createAdminClient();
        const [{ data: roles }, { data: users }] = await Promise.all([
          admin.from("user_roles").select("user_id, role, granted_at"),
          admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
        ]);
        const byUser = new Map<string, string[]>();
        for (const r of roles ?? []) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r.role]);
        const staff = (users?.users ?? []).filter((u) => byUser.has(u.id));
        return (
          <div className="space-y-6" data-testid="admin-users">
            <h1 className="text-3xl">{dict.admin.users}</h1>
            <RoleForm labels={dict.admin as unknown as Record<string, string>} />
            <table className="w-full rounded-[var(--radius-md)] border border-line bg-surface text-sm">
              <tbody>
                {staff.map((u) => (
                  <tr key={u.id} className="border-b border-line last:border-0">
                    <td className="p-3">{u.email}</td>
                    <td className="p-3">{(byUser.get(u.id) ?? []).join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-sm text-muted">{(users?.users ?? []).length} accounts</p>
          </div>
        );
      }}
    </AdminGate>
  );
}
