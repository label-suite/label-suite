import { DASHBOARD_HREF } from "@/lib/route-paths";

/** The routes the guards send people to (ui-design §頁面與路由). */
export const LOGIN_PATH = "/account/login";
/** Where a signed-in visitor lands: the dashboard (spec 02-01). */
export const LANDING_PATH = DASHBOARD_HREF;
/** Google's redirect target, registered with Google (api-contract). */
export const GOOGLE_CALLBACK_PATH = "/account/google/callback";
/** "Forgot password?", the reset request page registered by 01-03. */
export const RESET_REQUEST_PATH = "/account/forgot-password";
/** Registration, registered by 01-02. */
export const REGISTER_PATH = "/account/register";
