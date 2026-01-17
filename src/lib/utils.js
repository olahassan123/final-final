import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * פונקציה המשלבת שמות של מחלקות Tailwind בצורה חכמה.
 * היא מונעת כפילויות ופותרת קונפליקטים בין מחלקות.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}