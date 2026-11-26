import { CircleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Alert, AlertDescription } from "@/components/ui/alert";

import { noticeKey, type LoginNotice } from "./notice";

/** Props of {@link FormErrorBanner}. */
export interface FormErrorBannerProps {
  /** The sentence to show; nothing is rendered without one. */
  notice: LoginNotice | null;
}

/**
 * The sign-in page's error banner (design/system Alert Banner): an icon and
 * one sentence from the `auth` namespace, announced when it appears. Never
 * shows the backend's message, the typed Email or any account detail.
 */
export function FormErrorBanner({ notice }: FormErrorBannerProps) {
  const { t } = useTranslation("auth");
  if (notice === null) {
    return null;
  }
  return (
    <Alert variant="error" aria-live="assertive" className="rounded-(--radius-md)">
      <CircleAlert aria-hidden="true" />
      <AlertDescription>{t(noticeKey(notice))}</AlertDescription>
    </Alert>
  );
}
