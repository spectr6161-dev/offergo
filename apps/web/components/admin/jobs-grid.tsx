"use client";

import Link from "next/link";
import { AppDataGrid, type AppDataColumn } from "@offergo/ui";

type JobRow = {
  id: string;
  queue: string;
  status: string;
  attempts: number;
};

const columns: AppDataColumn<JobRow>[] = [
  { key: "queue", header: "Queue" },
  { key: "status", header: "Status" },
  { key: "attempts", header: "Attempts", align: "right" },
  {
    key: "id",
    header: "Open",
    render: (row) => (
      <Link href={`/admin/jobs/${row.id}`} className="ui-link">
        Details
      </Link>
    ),
  },
];

export function JobsGrid({ rows }: { rows: JobRow[] }) {
  return <AppDataGrid rows={rows} columns={columns} />;
}
