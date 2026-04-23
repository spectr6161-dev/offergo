"use client";

import Link from "next/link";
import { AppDataGrid } from "@offergo/ui";
import type { GridColDef } from "@mui/x-data-grid";

const columns: GridColDef[] = [
  { field: "queue", headerName: "Queue", flex: 1 },
  { field: "status", headerName: "Status", flex: 1 },
  { field: "attempts", headerName: "Attempts", flex: 1 },
  {
    field: "id",
    headerName: "Open",
    width: 120,
    renderCell: (params) => <Link href={`/admin/jobs/${params.value}`}>Details</Link>,
  },
];

export function JobsGrid({ rows }: { rows: Array<{ id: string; queue: string; status: string; attempts: number }> }) {
  return <AppDataGrid rows={rows} columns={columns} />;
}
