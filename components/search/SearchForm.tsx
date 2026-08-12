type SearchFormProps = {
  defaultQuery?: string;
  compact?: boolean;
  autoFocus?: boolean;
};

export function SearchForm({
  defaultQuery = "",
  compact = false,
  autoFocus = false,
}: SearchFormProps) {
  return (
    <form
      action="/verify"
      method="get"
      className={
        compact
          ? "flex w-full flex-col gap-2 sm:flex-row"
          : "flex w-full flex-col gap-3 sm:flex-row sm:items-stretch"
      }
    >
      <label className="sr-only" htmlFor="q">
        Search by license number or contractor name
      </label>
      <input
        id="q"
        name="q"
        type="search"
        required
        minLength={2}
        defaultValue={defaultQuery}
        autoFocus={autoFocus}
        placeholder="License number (e.g. CBC015082) or company name"
        className="min-h-12 flex-1 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 text-[var(--text)] placeholder:text-[var(--muted)] outline-none ring-[var(--accent)] focus:ring-2"
      />
      <button
        type="submit"
        className="min-h-12 rounded-xl bg-[var(--accent)] px-6 text-sm font-semibold text-[var(--navy)] transition hover:brightness-105"
      >
        Verify
      </button>
    </form>
  );
}
