import { NextRequest } from "next/server";

/**
 * Verify the dashboard password from a request header or JSON body.
 * Returns true if authorized.
 */
export function verifyDashboardAuth(request: NextRequest): boolean {
  const dashboardPassword = process.env.DASHBOARD_PASSWORD;
  if (!dashboardPassword) return false;

  const header = request.headers.get("x-dashboard-password");
  return header === dashboardPassword;
}

/**
 * Verify the Vercel cron secret to prevent unauthorised pipeline triggers.
 */
export function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const header = request.headers.get("x-vercel-cron-signature") ??
    request.headers.get("authorization")?.replace("Bearer ", "");
  return header === cronSecret;
}
