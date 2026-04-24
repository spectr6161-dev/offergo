"use client";

import Link from "next/link";
import { AppDataGrid, type AppDataColumn } from "@offergo/ui";

type EntitlementRow = {
  id: string;
  plan: string;
  status: string;
  window: string;
};

const columns: AppDataColumn<EntitlementRow>[] = [
  { key: "plan", header: "Plan" },
  { key: "status", header: "Status" },
  { key: "window", header: "Window" },
  {
    key: "id",
    header: "Open",
    render: (row) => (
      <Link href={`/admin/entitlements/${row.id}`} className="ui-link">
        Details
      </Link>
    ),
  },
];

export function EntitlementsGrid({ rows }: { rows: EntitlementRow[] }) {
  return <AppDataGrid rows={rows} columns={columns} />;
}
