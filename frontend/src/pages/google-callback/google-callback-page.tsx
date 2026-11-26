import { GoogleCallbackHandler } from "@/features/auth";

/**
 * /account/google/callback, Google's redirect target (ui-design §頁面與路由).
 * No screen of its own: only the page background until it moves on.
 */
export function GoogleCallbackPage() {
  return <GoogleCallbackHandler />;
}
