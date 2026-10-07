import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format paise (integer) as Indian currency string.
 * e.g. 12500000 → "₹1,25,000.00"
 */
export function formatIndianCurrency(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}

/**
 * Format ISO date string as "DD MMM YYYY".
 */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Returns true if the given ISO date is in the past (before today).
 */
export function isOverdue(iso: string): boolean {
  const due = new Date(iso);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return due < now;
}
