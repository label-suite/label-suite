/** The application root (design D6): the app-wide providers around the router. */
import type { QueryClient } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";

import { AppProviders } from "./providers";
import type { AppRouter } from "./router";

/** Props of App. */
export interface AppProps {
  /** The router to render, built once by createAppRouter. */
  router: AppRouter;
  /** The cache to use instead of the page load's one; tests pass a fresh one. */
  queryClient?: QueryClient;
}

/** Renders the router inside the QueryClient and i18n providers. */
export function App({ router, queryClient }: AppProps) {
  return (
    <AppProviders client={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
