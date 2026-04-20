import "./globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";

import { AuthSessionBootstrap } from "@/components/auth/auth-session-bootstrap";
import { normalizeServerLocalStorage } from "@/lib/server-local-storage-shim";

normalizeServerLocalStorage();

export const metadata: Metadata = {
  title: "CloudDoc",
  description: "Structured cloud document workspace",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <AuthSessionBootstrap />
        {children}
      </body>
    </html>
  );
}
