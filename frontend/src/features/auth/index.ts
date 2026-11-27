/**
 * The auth feature's public boundary (frontend-agent-rules F1): pages and the
 * app use only what is exported here.
 */
export { AuthLayout } from "./auth-layout";
export { GoogleCallbackHandler } from "./google-callback-handler";
export { LoginView } from "./login-view";
export { GOOGLE_CALLBACK_PATH, LANDING_PATH, LOGIN_PATH } from "./paths";
export { PublicOnlyRoute, RequireAuthRoute, RootRedirect } from "./route-guards";
export { useSessionState, type SessionState } from "./session-query";
export { SignedInCard } from "./signed-in-card";
export { useSignOut, type SignOut } from "./use-sign-out";
