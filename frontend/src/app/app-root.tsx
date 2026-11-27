import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { SessionCheckContext, createSessionCheckMark } from "./session-check";

/**
 * The root layout around every route, the developer pages and `*` included
 * (sidebar-nav design D6). It has no path and draws only its child route. It
 * does not unmount when pages change, so its ref outlives the shell's
 * unmounts and holds the shell's last session check until a full page load.
 *
 * It marks `leftSince` whenever the router is on a pathname other than the
 * one the shell last checked. It compares with that recorded pathname, not
 * with the pathname it saw itself last time: child effects run first, so on
 * the commit where the shell records an arrival, this effect sees the same
 * pathname and leaves the shell's `leftSince = false` alone.
 */
export function AppRoot() {
  const mark = useRef(createSessionCheckMark());
  const { pathname } = useLocation();

  useEffect(() => {
    if (pathname !== mark.current.checkedPathname) {
      mark.current.leftSince = true;
    }
  }, [pathname]);

  return (
    <SessionCheckContext value={mark}>
      <Outlet />
    </SessionCheckContext>
  );
}
