import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";

import { useGetAuthOptions } from "@/api/generated/label-suite";

import { AuthCard } from "./auth-card";
import { AuthLayout } from "./auth-layout";
import { FormErrorBanner } from "./form-error-banner";
import { GoogleSignIn } from "./google-sign-in-button";
import { LoginForm } from "./login-form";
import { readNoticeState, type LoginNotice } from "./notice";
import { clearSessionNotice, useSessionState } from "./session-query";
import { useLoginController } from "./use-login-controller";

/**
 * The sentence the page opens with: one carried in the navigation state
 * (Google E2, no response from the callback) wins over the guard's own
 * session check (a passive sign-out, no response). Read once, then consumed.
 */
function useInitialNotice(): LoginNotice | null {
  const location = useLocation();
  const queryClient = useQueryClient();
  const session = useSessionState();
  const fromGuard = session.data?.kind === "signedOut" ? session.data.notice : null;
  const [initial] = useState(() => readNoticeState(location.state) ?? fromGuard);

  useEffect(() => {
    clearSessionNotice(queryClient);
  }, [queryClient]);

  return initial;
}

/**
 * The sign-in page's content (ui-design §元件樹 › 登入頁): the shared shell and
 * the sign-in card. The deployment's options decide whether Google, the "or"
 * divider and the register row appear; until they arrive, or if they fail,
 * none of the three is drawn and no banner is shown.
 */
export function LoginView() {
  const { t } = useTranslation("auth");
  const location = useLocation();
  const navigate = useNavigate();
  const controller = useLoginController(useInitialNotice());
  const options = useGetAuthOptions({ query: { staleTime: Number.POSITIVE_INFINITY } });
  const googleEnabled = options.data?.data.googleEnabled === true;
  const registerEnabled = options.data?.data.selfRegistrationEnabled === true;
  const frozen = controller.busy !== null;

  // The carried sentence is shown once: drop it from the history entry, so a
  // reload or a return to this entry does not show it again.
  const hasCarriedState = location.state !== null && location.state !== undefined;
  useEffect(() => {
    if (hasCarriedState) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [hasCarriedState, location.pathname, navigate]);

  const documentTitle = t("documentTitle", { ns: "common", page: t("login.pageName") });
  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);

  return (
    <AuthLayout frozen={frozen} onLanguageChange={controller.languageChanged}>
      <AuthCard label={t("login.region")} title={t("login.title")} subtitle={t("login.subtitle")}>
        <FormErrorBanner notice={controller.notice} />
        {googleEnabled ? <GoogleSignIn disabled={frozen} onStart={controller.startGoogle} /> : null}
        <LoginForm controller={controller} showRegister={registerEnabled} />
      </AuthCard>
    </AuthLayout>
  );
}
