import Link from "next/link";

const legalLinks = [
  { href: "/legal", label: "Правовая документация" },
  { href: "/legal/privacy-policy", label: "Политика ПДн" },
  { href: "/legal/offer", label: "Оферта" },
  { href: "/legal/cookie-policy", label: "Cookie" },
  { href: "/legal/requisites", label: "Реквизиты" },
];

export function LegalFooter() {
  return (
    <footer className="print:hidden border-t bg-background/95 px-5 py-4 text-xs text-muted-foreground">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span>© 2026 offerGO</span>
        <nav
          aria-label="Правовая информация"
          className="flex flex-wrap items-center gap-x-4 gap-y-2"
        >
          {legalLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
