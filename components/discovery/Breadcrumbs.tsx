import Link from "next/link";

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-[var(--muted)]">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="inline-flex items-center gap-1.5">
              {i > 0 && <span aria-hidden className="text-[var(--border)]">/</span>}
              {item.href && !last ? (
                <Link href={item.href} className="text-[var(--muted)] no-underline hover:text-[var(--text)]">
                  {item.label}
                </Link>
              ) : (
                <span className={last ? "text-[var(--text)]" : undefined}>{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
