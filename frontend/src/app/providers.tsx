/**
 * App-wide providers (design D6): server-data cache and i18n. One QueryClient
 * is created per page load; tests build their own with createQueryClient.
 */
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { I18nextProvider } from "react-i18next";

import { i18n } from "@/lib/i18n";

import { createQueryClient } from "./query-client";

/** The page load's cache, used unless a caller (a test) passes its own. */
const queryClient = createQueryClient();

/** Props of AppProviders. */
export interface AppProvidersProps {
  /** The application tree that needs the query client and translations. */
  children: ReactNode;
  /** The cache to use instead of the page load's one; tests pass a fresh one. */
  client?: QueryClient;
}

/** Wraps the app in the QueryClient and i18next providers. */
export function AppProviders({ children, client = queryClient }: AppProvidersProps) {
  return (
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </QueryClientProvider>
  );
}
