import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/auth-actions";
import { fetchCurrentUser } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const { data: currentUser } = await fetchCurrentUser({ bootstrap: false });
  if (currentUser) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-sand px-4">
      <div className="w-full max-w-md border border-slate-200 bg-white px-6 py-5 shadow-panel">
        <div className="text-sm font-medium text-accent">CloudDoc Auth</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">登录</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          使用邮箱和密码登录。开发环境默认演示账号：demo@clouddoc.local / demo123456
        </p>
        <div className="mt-4">
          <LoginForm />
        </div>
        <div className="mt-4 text-sm text-slate-500">
          还没有账号？{" "}
          <Link href="/register" className="font-medium text-accent">
            去注册
          </Link>
        </div>
      </div>
    </div>
  );
}
