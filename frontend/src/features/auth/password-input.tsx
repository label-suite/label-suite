import { Eye, EyeOff, Lock } from "lucide-react";
import { useState, type ComponentProps } from "react";
import { useTranslation } from "react-i18next";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Props of {@link PasswordInput}; every native input attribute but `type` is passed through. */
export interface PasswordInputProps extends Omit<ComponentProps<"input">, "type"> {
  /** Disables the field and its show/hide toggle together. */
  disabled?: boolean;
}

/**
 * A password field with a leading lock and a show/hide toggle (design/system
 * Password Eye Toggle). Hidden by default; the toggle's name follows its
 * state and the interface language, and switching the language keeps the
 * state (spec 01-01 §用 Email 與密碼登入 第 17–20 條).
 */
export function PasswordInput({ className, disabled = false, ...props }: PasswordInputProps) {
  const { t } = useTranslation("auth");
  const [visible, setVisible] = useState(false);
  const ToggleIcon = visible ? Eye : EyeOff;

  return (
    <div className="relative">
      <Lock
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type={visible ? "text" : "password"}
        disabled={disabled}
        className={cn("pr-10 pl-10", className)}
        {...props}
      />
      <button
        type="button"
        disabled={disabled}
        aria-label={visible ? t("login.hidePassword") : t("login.showPassword")}
        onClick={() => {
          setVisible((current) => !current);
        }}
        className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-(--radius-sm) text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed"
      >
        <ToggleIcon aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
