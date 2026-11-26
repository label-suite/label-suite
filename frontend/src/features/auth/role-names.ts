import type { SessionUserDataRole } from "@/api/generated/label-suite.schemas";

/** The `auth` key of each system role's name (PRD §角色清單; prototype's English names). */
export const ROLE_NAME_KEYS: Record<SessionUserDataRole, `dashboard.role.${SessionUserDataRole}`> =
  {
    user: "dashboard.role.user",
    super_admin: "dashboard.role.super_admin",
  };
