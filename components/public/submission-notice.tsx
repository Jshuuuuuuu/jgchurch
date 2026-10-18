import { PublicHeader } from "@/components/public/public-header";

export function SubmissionNotice({ message }: { message: string }) {
  return <><PublicHeader /><main className="page-shell max-w-2xl py-14">
    <p className="eyebrow mb-3">A space for our community</p><h1 className="font-serif text-3xl font-semibold">Church submissions</h1>
    <p role="status" className="church-card mt-5 border-l-4 border-l-primary p-6 leading-7">{message}</p>
  </main></>;
}
