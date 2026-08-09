import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a number the Vietnamese way — dot thousands separators, no decimals
 * (e.g. 18100 → "18.100"). Rounds the input.
 *
 * We intentionally do NOT use `toLocaleString('vi-VN')`: some runtimes ship
 * without the vi-VN ICU dataset and silently fall back to en-US, producing
 * commas ("18,100"). Grouping in en-US (always available) then swapping "," → "."
 * guarantees dots everywhere. VND has no minor units, so integers only.
 */
export function formatNumber(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return "0"
  return Math.round(Number(n)).toLocaleString("en-US").replace(/,/g, ".")
}
