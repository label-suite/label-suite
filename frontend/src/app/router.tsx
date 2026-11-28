/**
 * The app router (frontend-skeleton design D6; login-auth-guard ui-design
 * §頁面與路由, §元件樹 › 守門).
 *
 * The sign-in page, the Google callback, the dashboard and `/`
 * exist in every build and go through the page guards; the signed-in pages
 * are drawn inside the app shell (sidebar-nav D1, D4); any other path is
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
import { DashboardPage } from "@/pages/dashboard";
import { GoogleCallbackPage } from "@/pages/google-callback";

import { AppRoot } from "./app-root";
import { AppShellLayout } from "./app-shell-layout";

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
    children: [
      {
        // Every signed-in route lives in the shell and declares its sidebar item (design D4).
        element: <AppShellLayout />,
        children: [
          {
            path: LANDING_PATH,
            element: <DashboardPage />,
            handle: { navKey: "dashboard" },
          },
        ],
      },
    ],
  },
  { path: "/", element: <RootRedirect /> },
  { path: "*", element: <Navigate replace to="/" /> },
];

/**
 * Builds the browser router; development mode adds the two developer pages.
 * AppRoot wraps every route, so its session-check mark outlives the shell
 * (design D6).
 */
export function createAppRouter(): AppRouter {
  const routes = import.meta.env.DEV ? [...devRoutes(), ...appRoutes] : appRoutes;
  return createBrowserRouter([{ element: <AppRoot />, children: routes }]);
}
