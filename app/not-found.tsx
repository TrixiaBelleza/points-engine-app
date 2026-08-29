import Link from "next/link";

export default function NotFound() {
  return (
    <div className="px-6 py-20 text-center">
      <h1 className="font-display text-3xl">Not found</h1>
      <p className="mt-2 text-muted">That page or member does not exist.</p>
      <Link href="/members" className="mt-6 inline-block text-pine">
        Back to Members
      </Link>
    </div>
  );
}
