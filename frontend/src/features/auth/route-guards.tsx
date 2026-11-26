/**
 * The page guards (ui-design §元件樹 › 守門; spec auth-guard). They only decide
 * whether a page may be shown and where to go otherwise: steps 1 and 2 of the
 * four authorisation steps (sa-11). What a role may see is the backend's call.
 *
 * All three read the same "current session" query. Until it answers, only the
 * page background is drawn, so no page flashes before a redirect.
 */
import { Navigate, Outlet } from "react-router-dom";

import { LANDING_PATH, LOGIN_PATH } from "./paths";
import { useSessionState } from "./session-query";

/** The page background alone: what the guards and the Google callback show while waiting. */
export function PageBackdrop() {
  return <div className="min-h-screen bg-background" />;
}

/** Shows its child routes to signed-in people; sends everyone else to sign-in. */
export function RequireAuthRoute() {
  const session = useSessionState();
  if (session.data === undefined) {
    return <PageBackdrop />;
  }
  if (session.data.kind === "signedOut") {
    return <Navigate replace to={LOGIN_PATH} />;
  }
  return <Outlet />;
}

/** Shows its child routes to signed-out visitors; sends signed-in people to the landing page. */
export function PublicOnlyRoute() {
  const session = useSessionState();
  if (session.data === undefined) {
    return <PageBackdrop />;
  }
  if (session.data.kind === "signedIn") {
    return <Navigate replace to={LANDING_PATH} />;
  }
  return <Outlet />;
}

/** `/`: shows nothing and sends the visitor on by session. */
export function RootRedirect() {
  const session = useSessionState();
  if (session.data === undefined) {
    return <PageBackdrop />;
  }
  return <Navigate replace to={session.data.kind === "signedIn" ? LANDING_PATH : LOGIN_PATH} />;
}
