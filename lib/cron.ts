/** Vercel Cron stuurt "Authorization: Bearer $CRON_SECRET" automatisch mee. */
export function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`
}
