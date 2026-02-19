"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/Nav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const pw = localStorage.getItem("dashboard_password");
    if (!pw) router.replace("/login");
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <Nav />
      <main className="mx-auto w-full max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
