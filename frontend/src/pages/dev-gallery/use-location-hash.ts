import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => {
    window.removeEventListener("hashchange", onChange);
  };
}

function readHash(): string {
  return window.location.hash;
}

/** The URL's current `#anchor` (empty without one), updated on every hashchange. */
export function useLocationHash(): string {
  return useSyncExternalStore(subscribe, readHash);
}
