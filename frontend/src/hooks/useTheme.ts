import { useEffect } from "react";
export function useTheme() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const preference = localStorage.getItem("wbs:theme") || "light";
      document.documentElement.dataset.theme =
        preference === "system"
          ? media.matches
            ? "dark"
            : "light"
          : preference;
    };
    apply();
    window.addEventListener("wbs:theme", apply);
    media.addEventListener("change", apply);
    return () => {
      window.removeEventListener("wbs:theme", apply);
      media.removeEventListener("change", apply);
    };
  }, []);
}
