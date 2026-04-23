"use client";

import Link from "next/link";
import { AppDataGrid } from "@offergo/ui";
import type { GridColDef } from "@mui/x-data-grid";

const columns: GridColDef[] = [
  { field: "name", headerName: "Name", flex: 1 },
  { field: "email", headerName: "Email", flex: 1.2 },
  { field: "roles", headerName: "Roles", flex: 1 },
  {
    field: "id",
    headerName: "Open",
    width: 120,
    renderCell: (params) => <Link href={`/admin/users/${params.value}`}>Details</Link>,
  },
];

export function UsersGrid({ rows }: { rows: Array<{ id: string; name: string; email: string; roles: string }> }) {
  return <AppDataGrid rows={rows} columns={columns} />;
}
