import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Joins class names (clsx) and resolves conflicting Tailwind classes so the
 * later one wins (tailwind-merge). The shadcn/ui convention (design D9).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
