export const dashboardNavigation = [
  { href: "/dashboard", label: "Overview" },
  { href: "/resume", label: "Resume" },
  { href: "/questions", label: "Questions" },
  { href: "/trainer", label: "Trainer" },
  { href: "/billing", label: "Billing" },
  { href: "/settings", label: "Settings" },
] as const;

export const adminNavigation = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/entitlements", label: "Entitlements" },
  { href: "/admin/jobs", label: "Jobs" },
] as const;
