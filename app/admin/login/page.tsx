import { redirect } from "next/navigation";
import { Sprout } from "lucide-react";
import { LoginForm } from "@/components/admin/login-form";
import { getAdmin } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/supabase/config";
export const dynamic = "force-dynamic";
export default async function LoginPage() { if (hasSupabaseEnv() && await getAdmin()) redirect("/admin/dashboard"); return <main className="grid min-h-screen lg:grid-cols-2"><section className="hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between"><div className="flex items-center gap-3"><Sprout /><strong className="tracking-[.2em]">ARC</strong></div><div><p className="font-serif text-5xl font-semibold leading-tight">Listen well.<br />Care faithfully.</p><p className="mt-5 max-w-md text-primary-foreground/75">Secure administration for church feedback, prayer care, and membership.</p></div><p className="text-xs text-primary-foreground/60">Authorized personnel only</p></section><section className="grid place-items-center p-6"><div className="w-full max-w-md"><p className="eyebrow">Administration</p><h1 className="mt-3 font-serif text-4xl font-semibold">Welcome back</h1><p className="mt-2 text-muted-foreground">Sign in with your authorized church administrator account.</p><LoginForm configured={hasSupabaseEnv()} /></div></section></main>; }
