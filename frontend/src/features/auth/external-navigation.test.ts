import { afterEach, describe, expect, it } from "vitest";

import { goToExternalUrl } from "./external-navigation";

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

describe("goToExternalUrl", () => {
  it("navigates the whole page to the URL", () => {
    // jsdom implements only same-document navigation, so a hash URL stands in for Google.
    goToExternalUrl(`${window.location.origin}/#authorize`);

    expect(window.location.hash).toBe("#authorize");
  });
});
