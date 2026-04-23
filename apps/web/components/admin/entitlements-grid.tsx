"use client";

import Link from "next/link";
import { AppDataGrid } from "@offergo/ui";
import type { GridColDef } from "@mui/x-data-grid";

const columns: GridColDef[] = [
  { field: "plan", headerName: "Plan", flex: 1 },
  { field: "status", headerName: "Status", flex: 1 },
  { field: "window", headerName: "Window", flex: 1.4 },
  {
    field: "id",
    headerName: "Open",
    width: 120,
    renderCell: (params) => <Link href={`/admin/entitlements/${params.value}`}>Details</Link>,
  },
];

export function EntitlementsGrid({ rows }: { rows: Array<{ id: string; plan: string; status: string; window: string }> }) {
  return <AppDataGrid rows={rows} columns={columns} />;
}
