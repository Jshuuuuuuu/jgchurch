"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarDays, HeartHandshake, LayoutDashboard, MessageSquareText, QrCode, Settings, Trash2, Users } from "lucide-react";
const links = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/arc", label: "ARC Inbox", icon: MessageSquareText, roles: ["super_admin", "ministry_leader"] },
  { href: "/admin/prayers", label: "Prayer Care", icon: HeartHandshake, roles: ["super_admin"] },
  { href: "/admin/members", label: "Members", icon: Users, roles: ["super_admin", "membership_admin"] },
  { href: "/admin/attendance", label: "Sunday Attendance", icon: CalendarDays, roles: ["super_admin", "membership_admin"] },
  { href: "/admin/events", label: "Events", icon: CalendarDays, roles: ["super_admin", "ministry_leader"] },
  { href: "/admin/qr", label: "QR Codes", icon: QrCode, roles: ["super_admin", "ministry_leader"] },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/trash", label: "Trash", icon: Trash2, roles: ["super_admin"] },
  { href: "/admin/settings", label: "Settings", icon: Settings, roles: ["super_admin"] },
];
export function AdminNavigation({ role }: { role: string }) {
  const pathname = usePathname();
  return <nav aria-label="Administration" className="flex gap-1 overflow-x-auto px-4 pb-4 lg:block lg:space-y-1 lg:px-3">
    {links.filter(link => !link.roles || link.roles.includes(role)).map(({ href, label, icon: Icon }) => {
      const active = pathname === href || pathname.startsWith(href + "/");
      return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-[background-color,color,transform] duration-150 active:scale-[.98] motion-reduce:transform-none motion-reduce:transition-none ${active ? "bg-primary/10 font-semibold text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}><Icon aria-hidden="true" className="size-4" />{label}</Link>;
    })}
  </nav>;
}
