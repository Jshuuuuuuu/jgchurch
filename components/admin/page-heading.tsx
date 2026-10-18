export function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return <div className="page-banner"><div className="min-w-0 max-w-2xl">
    {eyebrow && <p className="eyebrow mb-3 flex items-center gap-2"><span aria-hidden="true" className="h-px w-6 bg-primary/50" />{eyebrow}</p>}
    <h1 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
    {description && <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>}
  </div>{action && <div className="shrink-0">{action}</div>}</div>;
}
