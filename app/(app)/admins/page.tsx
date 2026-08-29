import { AdminsClient } from "./admins-client";
import { listAdmins } from "@/lib/admins";
import { requireSession } from "@/lib/session";

export default async function AdminsPage() {
  const session = await requireSession();
  const admins = await listAdmins();
  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-4xl">Admins</h1>
        <p className="mt-1 text-[14px] text-muted">
          Accounts are created here. Superadmin passwords are only changed in Settings.
        </p>
      </div>
      <AdminsClient admins={admins} actorId={session.adminId} actorRole={session.role} />
    </div>
  );
}
