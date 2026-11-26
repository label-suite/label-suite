/** The routes the guards send people to (ui-design §頁面與路由). */
export const LOGIN_PATH = "/account/login";
/** The temporary landing page; 02-01 replaces its page component, not its path. */
export const LANDING_PATH = "/dashboard/dashboard";
/** Google's redirect target, registered with Google (api-contract). */
export const GOOGLE_CALLBACK_PATH = "/account/google/callback";
/** "Forgot password?", the reset request page registered by 01-03. */
export const RESET_REQUEST_PATH = "/account/forgot-password";
/** Registration, registered by 01-02. */
export const REGISTER_PATH = "/account/register";
