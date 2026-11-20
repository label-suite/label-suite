/**
 * The /dev/health result card (ui-design.md §元件樹 /dev/health, §畫面狀態,
 * §無障礙). Shows one of four states: loading, ok, backend error (any error
 * envelope) and unreachable. All interface text comes from the systemHealth
 * namespace; the backend's message, codes, traceIds and error types are shown
 * verbatim.
 */
import { Check, CircleAlert, LoaderCircle, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Trans, useTranslation } from "react-i18next";

import { useGetHealth } from "@/api/generated/label-suite";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDevCheckTime } from "@/lib/date";

import {
  isRecheckDisabled,
  toHealthViewState,
  type HealthBackendErrorState,
  type HealthOkState,
  type HealthUnreachableState,
  type HealthViewState,
} from "./to-health-view-state";

const NAMESPACE = "systemHealth";

/** One label/value row of a description list. */
interface DetailRow {
  /** The translated label. */
  label: string;
  /** The value, shown as is. */
  value: string;
  /** Codes, identifiers and times use the monospace font. */
  mono: boolean;
}

/** Props of {@link DetailList}. */
interface DetailListProps {
  /** The rows to show, in order. */
  rows: DetailRow[];
}

/** Labels in the muted colour on the left, values on the right. */
function DetailList({ rows }: DetailListProps) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-(--space-md) gap-y-(--space-sm) text-(length:--text-caption)">
      {rows.map((row) => (
        <div key={row.label} className="contents">
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd className={row.mono ? "font-mono break-all text-foreground" : "text-foreground"}>
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function LoadingView() {
  const { t } = useTranslation(NAMESPACE);
  return (
    <div className="flex flex-col gap-(--space-md)">
      <div
        role="status"
        className="flex items-center gap-(--space-sm) text-(length:--text-body) text-foreground"
      >
        <LoaderCircle aria-hidden="true" className="size-5 animate-spin text-primary" />
        {t("panel.loading")}
      </div>
      <div className="flex flex-col gap-(--space-sm)">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}

/** Props of {@link OkView}. */
interface OkViewProps {
  /** The ok state to show. */
  state: HealthOkState;
}

function OkView({ state }: OkViewProps) {
  const { t } = useTranslation(NAMESPACE);
  return (
    <div className="flex flex-col gap-(--space-md)">
      <div className="flex items-center gap-(--space-sm) text-(length:--text-body) text-foreground">
        <Badge variant="success">
          <Check aria-hidden="true" />
          {t("panel.okBadge")}
        </Badge>
        <span>{t("panel.okSummary")}</span>
      </div>
      <DetailList
        rows={[
          { label: t("panel.service"), value: state.service, mono: true },
          { label: t("panel.database"), value: state.database, mono: true },
          {
            label: t("panel.checkedAt"),
            value: formatDevCheckTime(state.checkedAt),
            mono: true,
          },
          { label: t("panel.traceId"), value: state.traceId, mono: true },
        ]}
      />
    </div>
  );
}

/** Props of {@link BackendErrorView}. */
interface BackendErrorViewProps {
  /** The backend error state to show. */
  state: HealthBackendErrorState;
}

function BackendErrorView({ state }: BackendErrorViewProps) {
  const { t } = useTranslation(NAMESPACE);
  return (
    <div className="flex flex-col gap-(--space-md)">
      <Alert variant="error">
        <CircleAlert aria-hidden="true" />
        <AlertTitle>{t(`panel.${state.titleKey}`)}</AlertTitle>
        <AlertDescription>{state.message}</AlertDescription>
      </Alert>
      <DetailList
        rows={[
          { label: t("panel.errorCode"), value: state.code ?? "", mono: true },
          { label: t("panel.traceId"), value: state.traceId ?? t("panel.noTraceId"), mono: true },
        ]}
      />
    </div>
  );
}

/** Props of {@link UnreachableView}. */
interface UnreachableViewProps {
  /** The unreachable state to show. */
  state: HealthUnreachableState;
}

function UnreachableView({ state }: UnreachableViewProps) {
  const { t } = useTranslation(NAMESPACE);
  return (
    <div className="flex flex-col gap-(--space-md)">
      <Alert variant="warning">
        <TriangleAlert aria-hidden="true" />
        <AlertTitle>{t("panel.unreachableTitle")}</AlertTitle>
        <AlertDescription>
          <p>
            <Trans
              t={t}
              i18nKey="panel.unreachableHint"
              components={{ code: <code className="font-mono" /> }}
            />
          </p>
        </AlertDescription>
      </Alert>
      <DetailList
        rows={[
          { label: t("panel.errorType"), value: state.errorType, mono: true },
          { label: t("panel.traceId"), value: t("panel.noTraceId"), mono: false },
        ]}
      />
    </div>
  );
}

/** Renders the body of one screen state. */
function renderState(state: HealthViewState): ReactNode {
  switch (state.kind) {
    case "loading":
      return <LoadingView />;
    case "ok":
      return <OkView state={state} />;
    case "backendError":
      return <BackendErrorView state={state} />;
    case "unreachable":
      return <UnreachableView state={state} />;
  }
}

const INITIAL_STATE: HealthViewState = { kind: "loading" };

/**
 * Calls the health check through the generated hook and shows the result.
 * The recheck button uses aria-disabled rather than `disabled` while any
 * request is in flight, so focus stays on it and refetch() is never called
 * mid-flight (its default cancelRefetch would abort the running request).
 */
export function HealthStatusPanel() {
  const { t } = useTranslation(NAMESPACE);
  const query = useGetHealth();
  const [userRefetching, setUserRefetching] = useState(false);
  const lastState = useRef<HealthViewState>(INITIAL_STATE);

  const { isFetching, refetch } = query;
  useEffect(() => {
    if (!isFetching) {
      setUserRefetching(false);
    }
  }, [isFetching]);

  // null means the request was aborted: keep what was shown last.
  const state = toHealthViewState(query, userRefetching) ?? lastState.current;
  useEffect(() => {
    lastState.current = state;
  });

  const disabled = isRecheckDisabled(query);
  const isError = state.kind === "backendError" || state.kind === "unreachable";

  const handleRecheck = () => {
    setUserRefetching(true);
    void refetch();
  };

  return (
    <Card>
      <CardContent aria-live="polite" aria-busy={state.kind === "loading" ? true : undefined}>
        {renderState(state)}
      </CardContent>
      <CardFooter>
        <Button
          variant={isError ? "default" : "outline"}
          size="sm"
          aria-disabled={disabled ? true : undefined}
          onClick={handleRecheck}
        >
          {t("panel.recheck")}
        </Button>
      </CardFooter>
    </Card>
  );
}
