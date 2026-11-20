/** The application root (design D6): the app-wide providers around the router. */
import { RouterProvider } from "react-router-dom";

import { AppProviders } from "./providers";
import type { AppRouter } from "./router";

/** Props of App. */
export interface AppProps {
  /** The router to render, built once by createAppRouter. */
  router: AppRouter;
}

/** Renders the router inside the QueryClient and i18n providers. */
export function App({ router }: AppProps) {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
