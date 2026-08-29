import { redirect } from "next/navigation";
import { Nav } from "@/components/nav";
import { boot } from "@/lib/boot";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await boot();
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <div className="min-h-screen">
      <Nav name={session.name} />
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
