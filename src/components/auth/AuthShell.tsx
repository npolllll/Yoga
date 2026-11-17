export function AuthShell({ title, text, children }: { title: string; text?: string; children: React.ReactNode }) {
  return (
    <div className="glow-surface min-h-[70vh] px-4 py-14">
      <div className="mx-auto w-full max-w-md rounded-[var(--radius-lg)] border border-line bg-surface p-6 shadow-lift sm:p-8">
        <h1 className="text-3xl">{title}</h1>
        {text ? <p className="mt-2 text-sm text-muted">{text}</p> : null}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="skeleton h-12" />
      <div className="skeleton h-12" />
      <div className="skeleton h-12 rounded-full" />
    </div>
  );
}
