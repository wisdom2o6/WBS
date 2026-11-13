import { API_BASE_URL as API_ORIGIN } from "../config/env";

export const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ||
  "http://localhost:8080";