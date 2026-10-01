import { AdminSidebar } from "@/components/admin/sidebar";
import { requireAdmin } from "@/lib/auth";
export const dynamic = "force-dynamic";
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) { const admin = await requireAdmin(); return <div className="min-h-screen bg-muted/35 lg:grid lg:grid-cols-[250px_1fr]"><AdminSidebar name={admin.profile.display_name ?? admin.user.email ?? "Administrator"} role={admin.role ?? "administrator"} /><main className="min-w-0 p-4 sm:p-6 lg:p-8">{children}</main></div>; }
