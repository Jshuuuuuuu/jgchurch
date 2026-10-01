import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
export function formatDate(value: string | Date) { return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(value)); }
export function csvEscape(value: unknown) { const text = value == null ? "" : String(value); return `"${text.replaceAll('"', '""')}"`; }
