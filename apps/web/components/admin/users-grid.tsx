"use client";

import Link from "next/link";
import { AppDataGrid, type AppDataColumn } from "@offergo/ui";

type UserRow = {
  id: string;
  name: string;
  email: string;
  roles: string;
};

const columns: AppDataColumn<UserRow>[] = [
  { key: "name", header: "Name" },
  { key: "email", header: "Email" },
  { key: "roles", header: "Roles" },
  {
    key: "id",
    header: "Open",
    render: (row) => (
      <Link href={`/admin/users/${row.id}`} className="ui-link">
        Details
      </Link>
    ),
  },
];

export function UsersGrid({ rows }: { rows: UserRow[] }) {
  return <AppDataGrid rows={rows} columns={columns} />;
}
