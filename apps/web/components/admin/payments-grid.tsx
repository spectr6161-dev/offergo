"use client";

import Link from "next/link";
import { AppDataGrid, type AppDataColumn } from "@offergo/ui";

type PaymentRow = {
  id: string;
  provider: string;
  status: string;
  amountRub: number;
};

const columns: AppDataColumn<PaymentRow>[] = [
  { key: "provider", header: "Provider" },
  { key: "status", header: "Status" },
  { key: "amountRub", header: "Amount (RUB)", align: "right" },
  {
    key: "id",
    header: "Open",
    render: (row) => (
      <Link href={`/admin/payments/${row.id}`} className="ui-link">
        Details
      </Link>
    ),
  },
];

export function PaymentsGrid({ rows }: { rows: PaymentRow[] }) {
  return <AppDataGrid rows={rows} columns={columns} />;
}
