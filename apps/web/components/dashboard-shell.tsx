"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavigationItem = {
  href: string;
  label: string;
};

export function DashboardShell({
  title,
  subtitle,
  items,
  children,
}: {
  title: string;
  subtitle: string;
  items: NavigationItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-shell__sidebar">
        <div className="dashboard-shell__brand">
          <div className="dashboard-shell__brand-mark">O</div>
          <div className="dashboard-shell__brand-copy">
            <h1>offerGO</h1>
            <p>{title}</p>
          </div>
        </div>

        <nav className="dashboard-shell__nav">
          {items.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`dashboard-shell__nav-link${
                  isActive ? " dashboard-shell__nav-link--active" : ""
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <p className="dashboard-shell__subtitle" style={{ marginTop: "1.5rem" }}>
          {subtitle}
        </p>
      </aside>

      <section className="dashboard-shell__main">
        <header className="dashboard-shell__topbar">
          <h2>{title}</h2>
        </header>
        <div className="dashboard-shell__content">{children}</div>
      </section>
    </div>
  );
}
