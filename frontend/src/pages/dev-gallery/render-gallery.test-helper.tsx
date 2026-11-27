/**
 * Test helper: renders the component gallery inside a router, since the
 * blocked-screen samples' way back is a React Router link (design D8). Only
 * the gallery's tests import this file; it never reaches the bundle.
 */
import { render, type RenderResult } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { DevGalleryPage } from "./index";

/** Renders the whole gallery, with its devGallery namespace registered by the entry. */
export function renderGallery(): RenderResult {
  return render(
    <MemoryRouter>
      <DevGalleryPage />
    </MemoryRouter>,
  );
}
