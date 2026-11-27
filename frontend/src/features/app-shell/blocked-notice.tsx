import { Info } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";

import { Alert, AlertDescription } from "@/components/ui/alert";

import { readBlockedNoticeKind, type BlockedNoticeKind } from "./blocked-notice-state";

/** One blocked arrival: which history entry brought it, and which explanation. */
interface Arrival {
  /** The `location.key` of the arrival that carried the state. */
  key: string;
  /** Which item was blocked. */
  kind: BlockedNoticeKind;
}

/**
 * The explanation at the top of a landing page after a blocked sidebar click
 * (sidebar-nav design D5, clarification Q4; design/system Alert Banner, info).
 *
 * 1. Each arrival whose router state carries a known kind (told apart by
 *    `location.key`) is kept in component state.
 * 2. Only then is the router state cleared with a `replace` to the same URL;
 *    the stateless location that produces does not clear what was kept. The
 *    replace is sent once per arrival, also when StrictMode re-runs effects.
 * 3. The text is read from `appShell` on every render, so it follows the
 *    language; it never includes task data. Unknown kinds draw nothing.
 * 4. It stays until the page is left; a reload, Back or Forward reach a
 *    history entry without state, so it does not come back.
 * 5. Arriving blocked again while on the page stores the new arrival, and the
 *    Alert, keyed by it, remounts so `role="alert"` is announced again.
 */
export function BlockedNotice() {
  const { t } = useTranslation("appShell");
  const location = useLocation();
  const navigate = useNavigate();
  const arrivingKind = readBlockedNoticeKind(location.state);
  const [arrival, setArrival] = useState<Arrival | null>(null);
  const clearedKey = useRef<string | null>(null);

  // Step 1, during render: idempotent, so StrictMode's second render stores nothing new.
  if (arrivingKind !== null && arrival?.key !== location.key) {
    setArrival({ key: location.key, kind: arrivingKind });
  }

  // Step 2: clear the router state once the arrival is kept.
  useEffect(() => {
    if (arrivingKind === null || arrival?.key !== location.key) {
      return;
    }
    if (clearedKey.current === location.key) {
      return;
    }
    clearedKey.current = location.key;
    navigate(
      { pathname: location.pathname, search: location.search, hash: location.hash },
      { replace: true, state: null },
    );
  }, [arrivingKind, arrival, location, navigate]);

  if (arrival === null) {
    return null;
  }

  return (
    <Alert key={arrival.key} variant="info">
      <Info aria-hidden="true" />
      <AlertDescription>{t(`blocked.${arrival.kind}`)}</AlertDescription>
    </Alert>
  );
}
