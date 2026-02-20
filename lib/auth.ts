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
 * If CRON_SECRET is not configured the check is skipped so that deployments
 * work out-of-the-box before the secret is added to Vercel project settings.
 */
export function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  // No secret configured → allow all cron requests (set CRON_SECRET in
  // Vercel project settings to lock this down in production)
  if (!cronSecret) return true;

  // Vercel sends:  Authorization: Bearer <CRON_SECRET>
  const bearer = request.headers.get("authorization")?.replace("Bearer ", "");
  return bearer === cronSecret;
}
