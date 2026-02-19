"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    const pw = localStorage.getItem("dashboard_password");
    if (!pw) {
      router.replace("/login");
    }
  }, [router]);

  return <>{children}</>;
}
