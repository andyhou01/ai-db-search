import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Date formatting utilities for charts
export function isDateLike(value: any): boolean {
  if (typeof value === "string") {
    // Check for date patterns like YYYY-MM-DD, timestamps, or other date formats
    const datePatterns = [
      /^\d{4}-\d{2}-\d{2}/, // YYYY-MM-DD
      /^\d{13}$/, // 13-digit timestamp (milliseconds)
      /^\d{10}$/, // 10-digit timestamp (seconds)
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, // ISO format
      /^\d{1,2}\/\d{1,2}\/\d{4}/, // MM/DD/YYYY or M/D/YYYY
      /^\d{4}\/\d{1,2}\/\d{1,2}/, // YYYY/MM/DD or YYYY/M/D
    ];
    return datePatterns.some((pattern) => pattern.test(value));
  }
  if (typeof value === "number") {
    // Check if it's a reasonable timestamp
    // Expanded range: 1970 (0) to 2050 (2524608000000)
    // Also check for very large numbers that could be millisecond timestamps
    return (
      (value >= 0 && value <= 2524608000000) ||
      (value >= 1000000000 && value <= 2524608000) // seconds timestamp range
    );
  }
  return false;
}

export function formatDateForChart(value: any): string {
  try {
    if (typeof value === "string") {
      // Handle various string formats
      if (/^\d{13}$/.test(value)) {
        // 13-digit timestamp (milliseconds)
        const date = new Date(parseInt(value));
        return isValidDate(date) ? date.toLocaleDateString() : value;
      } else if (/^\d{10}$/.test(value)) {
        // 10-digit timestamp (seconds)
        const date = new Date(parseInt(value) * 1000);
        return isValidDate(date) ? date.toLocaleDateString() : value;
      } else if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
        // Date string (YYYY-MM-DD format)
        const date = new Date(value);
        return isValidDate(date) ? date.toLocaleDateString() : value;
      } else if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(value)) {
        // MM/DD/YYYY format
        const date = new Date(value);
        return isValidDate(date) ? date.toLocaleDateString() : value;
      }
    }
    if (typeof value === "number") {
      // Handle numeric timestamps with broader range
      if (value >= 1000000000000 && value <= 2524608000000) {
        // Looks like milliseconds timestamp
        const date = new Date(value);
        return isValidDate(date) ? date.toLocaleDateString() : String(value);
      } else if (value >= 1000000000 && value <= 2524608000) {
        // Looks like seconds timestamp
        const date = new Date(value * 1000);
        return isValidDate(date) ? date.toLocaleDateString() : String(value);
      } else if (value >= 0 && value <= 999999999) {
        // Could be a smaller timestamp (days since epoch or similar)
        // Try interpreting as seconds
        const date = new Date(value * 1000);
        if (
          isValidDate(date) &&
          date.getFullYear() >= 1970 &&
          date.getFullYear() <= 2050
        ) {
          return date.toLocaleDateString();
        }
      }
    }
  } catch (error) {
    console.warn("Error formatting date:", error);
  }
  return String(value);
}

// Helper function to check if a date is valid
function isValidDate(date: Date): boolean {
  return date instanceof Date && !isNaN(date.getTime());
}
