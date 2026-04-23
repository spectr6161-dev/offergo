import { redirect } from "next/navigation";
import { getCurrentSession } from "@offergo/auth/server";

export default async function Home() {
  const session = await getCurrentSession();
  redirect(session ? "/dashboard" : "/login");
}
