import Link from "next/link";
import { redirect } from "next/navigation";

import { RegisterForm } from "@/components/auth/auth-actions";
import { fetchCurrentUser } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const { data: currentUser } = await fetchCurrentUser({ bootstrap: false });
  if (currentUser) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-sand px-4">
      <div className="w-full max-w-md border border-slate-200 bg-white px-6 py-5 shadow-panel">
        <div className="text-sm font-medium text-accent">CloudDoc Auth</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">注册</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          创建账号后会自动生成个人空间和默认团队空间。
        </p>
        <div className="mt-4">
          <RegisterForm />
        </div>
        <div className="mt-4 text-sm text-slate-500">
          已有账号？{" "}
          <Link href="/login" className="font-medium text-accent">
            去登录
          </Link>
        </div>
      </div>
    </div>
  );
}
