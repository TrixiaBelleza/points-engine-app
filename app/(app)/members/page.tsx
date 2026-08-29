import { MembersList } from "./members-list";
import { listMembers } from "@/lib/members";

export default async function MembersPage() {
  const members = await listMembers();
  return (
    <div>
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-ink">Members</h1>
          <p className="mt-1 text-[14px] text-muted">Search by name. Open a member to see points.</p>
        </div>
      </div>
      <MembersList initialMembers={members} />
    </div>
  );
}
