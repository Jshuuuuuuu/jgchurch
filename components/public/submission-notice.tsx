import { PublicHeader } from "@/components/public/public-header";

export function SubmissionNotice({ message }: { message: string }) {
  return <><PublicHeader /><main className="page-shell max-w-2xl py-14">
    <h1 className="font-serif text-3xl font-semibold">Church submissions</h1>
    <p role="status" className="mt-5 rounded-xl border bg-card p-5 leading-7">{message}</p>
  </main></>;
}
