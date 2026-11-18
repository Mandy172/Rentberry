export function isMockStripe() {
  return !process.env["STRIPE_SECRET_KEY"];
}

async function stripeRequest<T>(method: "GET" | "POST", path: string, params?: Record<string, string>) {
  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${process.env["STRIPE_SECRET_KEY"]}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  };
  if (method === "POST") init.body = new URLSearchParams(params ?? {});
  const res = await fetch(`https://api.stripe.com/v1/${path}`, init);
  if (!res.ok) {
    const body = await res.text();
    console.error(`[stripe] ${path} failed`, res.status, body);
    throw new Error(`Stripe ${path} failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

/**
 * Starts Stripe Connect (Express) onboarding. In mock mode there is no redirect:
 * the account is marked connected immediately so payouts can be exercised.
 */
export async function startConnectOnboarding(opts: { existingAccountId: string | null; returnUrl: string }) {
  if (isMockStripe()) {
    return {
      accountId: opts.existingAccountId ?? `acct_mock_${crypto.randomUUID().slice(0, 8)}`,
      url: null as string | null,
      connected: true,
    };
  }
  if (opts.existingAccountId) {
    const acct = await stripeRequest<{ details_submitted: boolean }>("GET", `accounts/${opts.existingAccountId}`);
    if (acct.details_submitted) return { accountId: opts.existingAccountId, url: null, connected: true };
  }
  const accountId =
    opts.existingAccountId ?? (await stripeRequest<{ id: string }>("POST", "accounts", { type: "express" })).id;
  const link = await stripeRequest<{ url: string }>("POST", "account_links", {
    account: accountId,
    refresh_url: opts.returnUrl,
    return_url: opts.returnUrl,
    type: "account_onboarding",
  });
  return { accountId, url: link.url as string | null, connected: false };
}
