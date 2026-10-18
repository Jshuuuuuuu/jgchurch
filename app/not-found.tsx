import Link from "next/link";
import { Compass } from "lucide-react";
import { PublicHeader } from "@/components/public/public-header";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return <><PublicHeader /><main className="page-shell grid min-h-[70vh] place-items-center py-12">
    <section className="status-panel max-w-lg text-center">
      <Compass aria-hidden="true" className="mx-auto size-16 rounded-2xl bg-secondary p-4 text-primary" />
      <p className="eyebrow mt-6">Page not found</p>
      <h1 className="mt-3 font-serif text-4xl font-semibold">Let’s find your way back.</h1>
      <p className="mt-4 leading-7 text-muted-foreground">This page may have moved or is no longer available. For an event, ask the organizer for a current QR link.</p>
      <Link href="/" className={`${buttonVariants()} mt-7`}>Return home</Link>
    </section>
  </main></>;
}
