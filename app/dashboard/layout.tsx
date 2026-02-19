"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/Nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    const pw = localStorage.getItem("dashboard_password");
    if (!pw) router.replace("/login");
  }, [router]);

  return (
    <div className="flex min-h-screen">
      <Nav />
      <div className="flex-1 min-w-0 overflow-auto">
        <main className="mx-auto max-w-4xl px-8 py-10">{children}</main>
      </div>
    </div>
  );
}
