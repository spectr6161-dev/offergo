export const dashboardNavigation = [
  { href: "/dashboard", label: "Главная" },
  { href: "/resumes", label: "Resumes" },
  { href: "/billing", label: "Billing" },
  { href: "/settings", label: "Settings" },
] as const;

export const adminNavigation = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/employers", label: "Employers" },
  { href: "/admin/vacancies", label: "Vacancies" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/entitlements", label: "Entitlements" },
  { href: "/admin/jobs", label: "Jobs" },
] as const;
