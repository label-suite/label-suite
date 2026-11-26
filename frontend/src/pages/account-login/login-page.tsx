import { LoginView } from "@/features/auth";

/**
 * /account/login (spec 01-01; ui-design §頁面與路由). Only signed-out visitors
 * reach it: the router wraps it in PublicOnlyRoute.
 */
export function LoginPage() {
  return <LoginView />;
}
