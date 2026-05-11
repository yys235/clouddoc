import { NextResponse, type NextRequest } from "next/server";

const BACKEND_ORIGIN = process.env.CLOUDDOC_BACKEND_ORIGIN ?? "http://127.0.0.1:8000";

const PUBLIC_PREFIXES = [
  "/setup",
  "/login",
  "/register",
  "/share",
  "/api",
  "/_next",
  "/favicon.ico",
  "/icon.svg",
  "/uploads",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return NextResponse.next();
  }

  try {
    const response = await fetch(`${BACKEND_ORIGIN}/api/system/bootstrap/status`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return NextResponse.next();
    }
    const status = (await response.json()) as { needs_setup?: boolean };
    if (status.needs_setup) {
      const url = request.nextUrl.clone();
      url.pathname = "/setup";
      url.searchParams.set("from", pathname);
      return NextResponse.redirect(url);
    }
  } catch {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
