/**
 * Site-wide route addresses (frontend-agent-rules F1: what several features
 * share moves down to lib/). Paths and the shape of their query strings only;
 * no business rule decides here who may follow them.
 */

/** The dashboard, the signed-in landing page (07-shared X1). */
export const DASHBOARD_HREF = "/dashboard/dashboard";

/** The task list (07-shared X2). */
export const TASK_LIST_HREF = "/task-management/task-list";

/** The annotation module's entry page, without a query string. */
export const ANNOTATION_LIST_PATH = "/annotation/annotation-list";

/** The task role an entry into the annotation list may name. */
export type AnnotationEntryRole = "annotator" | "reviewer";

/**
 * The link into the annotation list (spec 04-01 §路由上下文與回退): the entry
 * mark, plus the role when the caller names one. It never names a task, a
 * task type or an output type (Hard Rule 5).
 *
 * @param role The task role the entry is for; omitted for a plain entry.
 * @returns `/annotation/annotation-list?entry=nav`, with `&role=<role>` when given.
 */
export function annotationEntryHref(role?: AnnotationEntryRole): string {
  const query = new URLSearchParams({ entry: "nav" });
  if (role !== undefined) {
    query.set("role", role);
  }
  return `${ANNOTATION_LIST_PATH}?${query.toString()}`;
}
