import { Mail } from "lucide-react";
import { useId, type SubmitEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { guardLink } from "./guard-link";
import { PasswordInput } from "./password-input";
import { RESET_REQUEST_PATH, REGISTER_PATH } from "./paths";
import type { LoginController } from "./use-login-controller";

/** Props of {@link LoginForm}. */
export interface LoginFormProps {
  /** The page's state and actions. */
  controller: LoginController;
  /** Whether the deployment offers self-registration (shows the bottom row). */
  showRegister: boolean;
}

const LINK_CLASS =
  "rounded-(--radius-sm) text-(length:--text-caption) font-medium text-primary outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50";

/**
 * The Email-and-password form (spec 01-01 §用 Email 與密碼登入). The browser's
 * own validation is off; only the two required checks run, each message tied
 * to its field. While a request is in flight every control is disabled and
 * the links do nothing (U1).
 */
export function LoginForm({ controller, showRegister }: LoginFormProps) {
  const { t } = useTranslation("auth");
  const frozen = controller.busy !== null;
  const submitting = controller.busy === "password";

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    controller.submit();
  };

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-(--space-md)">
      <EmailField controller={controller} frozen={frozen} />
      <PasswordField controller={controller} frozen={frozen} />
      <Button
        type="submit"
        variant="cta"
        data-testid="login-btn"
        loading={submitting}
        className="mt-(--space-xs) w-full rounded-(--radius-md) text-(length:--text-body) focus-visible:ring-cta/50"
      >
        {submitting ? <span className="sr-only">{t("loading")}</span> : t("login.submit")}
      </Button>
      {showRegister ? (
        <p className="text-center text-(length:--text-caption) text-muted-foreground">
          <span>{t("login.registerPrompt")}</span>{" "}
          <Link
            to={REGISTER_PATH}
            data-testid="register-link"
            className={LINK_CLASS}
            {...guardLink(frozen)}
          >
            {t("login.register")}
          </Link>
        </p>
      ) : null}
    </form>
  );
}

/** Props of the two field components. */
interface FieldProps {
  /** The page's state and actions. */
  controller: LoginController;
  /** A request is in flight: the field is disabled. */
  frozen: boolean;
}

/** The Email field: label, leading mail icon, input and its required message. */
function EmailField({ controller, frozen }: FieldProps) {
  const { t } = useTranslation("auth");
  const id = useId();
  const errorId = `${id}-error`;
  const invalid = controller.missing.email;

  return (
    <div className="flex flex-col gap-(--space-sm)">
      <Label htmlFor={id}>{t("login.email")}</Label>
      <div className="relative">
        <Mail
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id={id}
          type="email"
          autoComplete="email"
          data-testid="email-input"
          placeholder={t("login.emailPlaceholder")}
          value={controller.values.email}
          disabled={frozen}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={invalid ? errorId : undefined}
          onChange={(event) => {
            controller.change("email", event.target.value);
          }}
          className="pl-10"
        />
      </div>
      <FieldError id={errorId} testId="email-error" show={invalid}>
        {t("login.emailRequired")}
      </FieldError>
    </div>
  );
}

/** The password field: label row with "forgot password?", the input with its toggle, and its required message. */
function PasswordField({ controller, frozen }: FieldProps) {
  const { t } = useTranslation("auth");
  const id = useId();
  const errorId = `${id}-error`;
  const invalid = controller.missing.password;

  return (
    <div className="flex flex-col gap-(--space-sm)">
      <div className="flex items-center justify-between gap-(--space-sm)">
        <Label htmlFor={id}>{t("login.password")}</Label>
        <Link
          to={RESET_REQUEST_PATH}
          data-testid="forgot-password-link"
          className={LINK_CLASS}
          {...guardLink(frozen)}
        >
          {t("login.forgot")}
        </Link>
      </div>
      <PasswordInput
        id={id}
        autoComplete="current-password"
        data-testid="password-input"
        placeholder={t("login.passwordPlaceholder")}
        value={controller.values.password}
        disabled={frozen}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={invalid ? errorId : undefined}
        onChange={(event) => {
          controller.change("password", event.target.value);
        }}
      />
      <FieldError id={errorId} testId="password-error" show={invalid}>
        {t("login.passwordRequired")}
      </FieldError>
    </div>
  );
}

/** Props of {@link FieldError}. */
interface FieldErrorProps {
  /** The id the field's aria-describedby points at. */
  id: string;
  /** The prototype's data-testid for this message. */
  testId: string;
  /** Whether the message is shown. */
  show: boolean;
  /** The message. */
  children: string;
}

/** A field's "required" message, below the field in the error colour (design/system Input `.field-error`). */
function FieldError({ id, testId, show, children }: FieldErrorProps) {
  if (!show) {
    return null;
  }
  return (
    <span id={id} data-testid={testId} className="text-(length:--text-label) text-error">
      {children}
    </span>
  );
}
