import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { AdminGate } from "@/components/admin/AdminGate";
import { CacheRefresh, SettingsForm, TaxonomyEditor } from "@/components/admin/AdminForms";
import { adminClient } from "@/lib/admin/data";

type Loc = { ru: string; en: string };

export default async function SettingsPage({ params }: PageProps<"/[locale]/admin/settings">) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const labels = { ...(dict.admin as unknown as Record<string, string>), save: dict.common.save };
  return (
    <AdminGate locale={locale} need="editor">
      {async (user) => {
        const db = await adminClient();
        const [settings, levels, categories, skills] = await Promise.all([
          db.from("site_settings").select("data, allow_unreviewed_publish").eq("id", 1).single(),
          db.from("levels").select("key, label, description").order("position"),
          db.from("categories").select("key, name, description").order("position"),
          db.from("skills").select("key, name").order("position"),
        ]);
        const data = (settings.data?.data ?? {}) as { levelLabelOverrides?: Record<string, Loc>; contact?: { email: string | null; socials: { label: string; url: string }[] } };
        return (
          <div className="space-y-8" data-testid="admin-settings">
            <h1 className="text-3xl">{dict.admin.settings}</h1>
            <SettingsForm
              isOwner={user.roles.includes("owner")}
              labels={labels}
              levels={(levels.data ?? []).map((l) => ({ key: l.key, label: l.label as Loc }))}
              initial={{
                levelLabelOverrides: data.levelLabelOverrides ?? {},
                contact: { email: data.contact?.email ?? null, socials: data.contact?.socials ?? [] },
                allowUnreviewedPublish: settings.data?.allow_unreviewed_publish ?? false,
              }}
            />
            {user.roles.includes("owner") ? <CacheRefresh labels={labels} /> : null}
            <section>
              <h2 className="text-2xl">{dict.admin.taxonomy}</h2>
              <div className="mt-4 grid gap-6 lg:grid-cols-3">
                <div>
                  <h3 className="mb-2 font-sans font-bold">{dict.admin.level}</h3>
                  <TaxonomyEditor kind="levels" labels={labels} items={(levels.data ?? []).map((l) => ({ key: l.key, name: l.label as Loc, description: l.description as Loc }))} />
                </div>
                <div>
                  <h3 className="mb-2 font-sans font-bold">{dict.admin.category}</h3>
                  <TaxonomyEditor kind="categories" labels={labels} items={(categories.data ?? []).map((c) => ({ key: c.key, name: c.name as Loc, description: c.description as Loc }))} />
                </div>
                <div>
                  <h3 className="mb-2 font-sans font-bold">{dict.admin.skills}</h3>
                  <TaxonomyEditor kind="skills" labels={labels} items={(skills.data ?? []).map((s) => ({ key: s.key, name: s.name as Loc }))} />
                </div>
              </div>
            </section>
          </div>
        );
      }}
    </AdminGate>
  );
}
