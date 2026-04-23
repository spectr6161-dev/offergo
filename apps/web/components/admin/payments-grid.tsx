"use client";

import Link from "next/link";
import { AppDataGrid } from "@offergo/ui";
import type { GridColDef } from "@mui/x-data-grid";

const columns: GridColDef[] = [
  { field: "provider", headerName: "Provider", flex: 1 },
  { field: "status", headerName: "Status", flex: 1 },
  { field: "amountRub", headerName: "Amount (RUB)", flex: 1 },
  {
    field: "id",
    headerName: "Open",
    width: 120,
    renderCell: (params) => <Link href={`/admin/payments/${params.value}`}>Details</Link>,
  },
];

export function PaymentsGrid({ rows }: { rows: Array<{ id: string; provider: string; status: string; amountRub: number }> }) {
  return <AppDataGrid rows={rows} columns={columns} />;
}
