import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a number with comma thousands separators, no decimals
 * (e.g. 18100 → "18,100"). Rounds the input.
 *
 * Uses the en-US grouping (always available in every runtime), so the separator
 * is a comma everywhere and never varies with the host's locale data. VND has no
 * minor units, so integers only.
 */
export function formatNumber(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return "0"
  return Math.round(Number(n)).toLocaleString("en-US")
}
