"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function AuthSessionBootstrap() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/login" || pathname === "/register") {
      return;
    }
    void fetch("/api/auth/me", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    }).catch(() => undefined);
  }, [pathname]);

  return null;
}
