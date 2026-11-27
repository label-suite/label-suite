import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

import { SignOutButton } from "./sign-out-button";
import type { ShellUser } from "./types";
import { avatarInitials, shownName } from "./user-display";

/** Props of {@link UserSummary}. */
export interface UserSummaryProps {
  /** The signed-in person: name, email for an empty name, and the role label key. */
  user: ShellUser;
  /** Where the profile link goes. */
  profileHref: string;
  /** The sidebar is collapsed: only the sign-out button stays. */
  collapsed: boolean;
  /** The sign-out request is in flight. */
  signingOut: boolean;
  /** Starts signing out. */
  onSignOut: () => void;
}

/**
 * The desktop sidebar's user area (design/system App Shell 「使用者區」): a
 * profile link with the initials avatar (hidden from assistive technology),
 * the name and the role label, and the sign-out button. It shows nothing else
 * about the person: no email unless the name is empty, never the system role
 * (ui-design §畫面狀態 欄位被遮蔽).
 */
export function UserSummary({
  user,
  profileHref,
  collapsed,
  signingOut,
  onSignOut,
}: UserSummaryProps) {
  const { t } = useTranslation("appShell");
  const name = shownName(user);

  return (
    <div
      className={cn(
        "flex w-full min-w-0 items-center",
        collapsed ? "justify-center py-(--space-sm)" : "gap-2.5 p-3",
      )}
    >
      {collapsed ? null : (
        <Link
          to={profileHref}
          aria-label={t("landmarks.profileLink")}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-(--radius-md) outline-none transition-opacity duration-(--dur-fast) ease-(--ease-standard) hover:opacity-75 focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none"
        >
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-ring/15 bg-card text-(length:--text-caption) font-bold text-primary"
          >
            {avatarInitials(name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-(length:--text-label) leading-tight font-semibold text-foreground">
              {name}
            </span>
            <span
              data-testid="role-indicator"
              className="block text-(length:--text-label) leading-snug text-muted-foreground"
            >
              {t(user.roleLabelKey)}
            </span>
          </span>
        </Link>
      )}
      <SignOutButton
        placement={collapsed ? "collapsed" : "summary"}
        signingOut={signingOut}
        onSignOut={onSignOut}
      />
    </div>
  );
}
