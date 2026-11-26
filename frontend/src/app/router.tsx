/**
 * The app router (frontend-skeleton design D6; login-auth-guard ui-design
 * §頁面與路由, §元件樹 › 守門).
 *
 * The sign-in page, the Google callback, the temporary landing page and `/`
 * exist in every build and go through the page guards; any other path is
 * replaced by `/`, which redirects by session (U7, until 07-03's not-found
 * page). The two developer pages are added only when `import.meta.env.DEV` is
 * true and are not guarded. A production build replaces that flag with
 * `false`, so Vite drops the branch, the lazy page chunks and the page
 * namespaces they register.
 */
import { createBrowserRouter, Navigate, type RouteObject } from "react-router-dom";

import {
  GOOGLE_CALLBACK_PATH,
  LANDING_PATH,
  LOGIN_PATH,
  PublicOnlyRoute,
  RequireAuthRoute,
  RootRedirect,
} from "@/features/auth";
import { LoginPage } from "@/pages/account-login";
import { DashboardPlaceholderPage } from "@/pages/dashboard-placeholder";
import { GoogleCallbackPage } from "@/pages/google-callback";

/** The router the app renders; RouterProvider takes it as is. */
export type AppRouter = ReturnType<typeof createBrowserRouter>;

/** The developer-only routes: two lazy pages, outside the guards. */
function devRoutes(): RouteObject[] {
  return [
    {
      path: "/dev/health",
      lazy: async () => {
        const { DevHealthPage } = await import("@/pages/dev-health");
        return { Component: DevHealthPage };
      },
    },
    {
      path: "/dev/gallery",
      lazy: async () => {
        const { DevGalleryPage } = await import("@/pages/dev-gallery");
        return { Component: DevGalleryPage };
      },
    },
  ];
}

/** The routes of every build. */
const appRoutes: RouteObject[] = [
  {
    element: <PublicOnlyRoute />,
    children: [
      { path: LOGIN_PATH, element: <LoginPage /> },
      { path: GOOGLE_CALLBACK_PATH, element: <GoogleCallbackPage /> },
    ],
  },
  {
    element: <RequireAuthRoute />,
    children: [{ path: LANDING_PATH, element: <DashboardPlaceholderPage /> }],
  },
  { path: "/", element: <RootRedirect /> },
  { path: "*", element: <Navigate replace to="/" /> },
];

/** Builds the browser router; development mode adds the two developer pages. */
export function createAppRouter(): AppRouter {
  if (import.meta.env.DEV) {
    return createBrowserRouter([...devRoutes(), ...appRoutes]);
  }
  return createBrowserRouter(appRoutes);
}
