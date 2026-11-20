/**
 * The app router (design D6, clarification Q1, Q14).
 *
 * The two developer pages are added only when `import.meta.env.DEV` is true.
 * A production build replaces that flag with `false`, so Vite drops the branch,
 * the lazy page chunks and the page namespaces they register (design D7); the
 * build is an empty shell. The home and not-found pages belong to 01-01.
 */
import { createBrowserRouter, Navigate, type RouteObject } from "react-router-dom";

/** The router the app renders; RouterProvider takes it as is. */
export type AppRouter = ReturnType<typeof createBrowserRouter>;

const HEALTH_PATH = "/dev/health";

/** The developer-only routes: two lazy pages, and `/` plus unknown paths redirect to health. */
function devRoutes(): RouteObject[] {
  return [
    {
      path: HEALTH_PATH,
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
    { path: "/", element: <Navigate replace to={HEALTH_PATH} /> },
    { path: "*", element: <Navigate replace to={HEALTH_PATH} /> },
  ];
}

/** Production has no pages yet: every path renders nothing. */
const shellRoutes: RouteObject[] = [{ path: "*", element: null }];

/** Builds the browser router; development mode adds the two developer pages. */
export function createAppRouter(): AppRouter {
  if (import.meta.env.DEV) {
    return createBrowserRouter(devRoutes());
  }
  return createBrowserRouter(shellRoutes);
}
