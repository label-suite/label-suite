/**
 * Full-page navigation to another site (Google's authorisation page). Kept in
 * its own module so tests can replace it; jsdom cannot leave the page.
 *
 * @param url An absolute http(s) URL the backend returned.
 */
export function goToExternalUrl(url: string): void {
  window.location.assign(url);
}
