"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { login, logout, register } from "@/lib/api";

export function UserMenu({
  name,
  email,
  organizationName,
}: {
  name: string;
  email: string;
  organizationName?: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  return (
    <div className="mt-auto border-t border-slate-200 pt-3">
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
        <div className="text-sm font-medium text-slate-900">{name}</div>
        <div className="mt-0.5 truncate text-xs text-slate-500">{email}</div>
        {organizationName ? (
          <div className="mt-1 truncate text-xs text-slate-400">{organizationName}</div>
        ) : null}
      </div>
      {error ? <div className="mt-2 text-xs text-rose-500">{error}</div> : null}
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            try {
              setError("");
              await logout();
              router.push("/login");
              router.refresh();
            } catch {
              setError("退出失败，请稍后重试");
            }
          })
        }
        className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        {isPending ? "退出中..." : "退出登录"}
      </button>
    </div>
  );
}

export function GuestAuthLinks() {
  return (
    <div className="mt-auto space-y-2 border-t border-slate-200 pt-3">
      <Link
        href="/login"
        className="block rounded-lg border border-slate-200 px-3 py-2 text-center text-sm text-slate-700 hover:bg-slate-50"
      >
        登录
      </Link>
      <Link
        href="/register"
        className="block rounded-lg bg-accent px-3 py-2 text-center text-sm font-medium text-white"
      >
        注册
      </Link>
    </div>
  );
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("demo@clouddoc.local");
  const [password, setPassword] = useState("demo123456");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          try {
            setError("");
            await login({ email, password });
            router.push("/");
            router.refresh();
          } catch {
            setError("登录失败，请检查邮箱和密码");
          }
        });
      }}
    >
      <div>
        <div className="mb-1 text-sm font-medium text-slate-700">邮箱</div>
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none"
          autoComplete="email"
        />
      </div>
      <div>
        <div className="mb-1 text-sm font-medium text-slate-700">密码</div>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none"
          autoComplete="current-password"
        />
      </div>
      {error ? <div className="text-sm text-rose-500">{error}</div> : null}
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {isPending ? "登录中..." : "登录"}
      </button>
    </form>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          try {
            setError("");
            await register({ name, email, password, organizationName });
            router.push("/");
            router.refresh();
          } catch {
            setError("注册失败，请检查输入信息");
          }
        });
      }}
    >
      <div>
        <div className="mb-1 text-sm font-medium text-slate-700">姓名</div>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none"
          autoComplete="name"
        />
      </div>
      <div>
        <div className="mb-1 text-sm font-medium text-slate-700">邮箱</div>
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none"
          autoComplete="email"
        />
      </div>
      <div>
        <div className="mb-1 text-sm font-medium text-slate-700">密码</div>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none"
          autoComplete="new-password"
        />
      </div>
      <div>
        <div className="mb-1 text-sm font-medium text-slate-700">组织名称</div>
        <input
          value={organizationName}
          onChange={(event) => setOrganizationName(event.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none"
          placeholder="可留空，默认自动生成"
        />
      </div>
      {error ? <div className="text-sm text-rose-500">{error}</div> : null}
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {isPending ? "注册中..." : "注册"}
      </button>
    </form>
  );
}
