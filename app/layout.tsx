import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: { default: "ARC Church", template: "%s | ARC Church" }, description: "Affirmation, Recommendation, Correction and prayer care for our church community." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en" suppressHydrationWarning><body className="min-h-screen font-sans">{children}</body></html>; }
