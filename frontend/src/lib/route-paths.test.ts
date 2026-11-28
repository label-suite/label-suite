/**
 * The site-wide route addresses (dashboard-shell design D4): the sidebar and
 * the dashboard's action cards build their links from these, so the paths and
 * the entry mark exist once. The annotation entry never names a task, a task
 * type or an output type (Hard Rule 5; spec 04-01 §路由上下文與回退).
 */
import { describe, expect, it } from "vitest";

import {
  ANNOTATION_LIST_PATH,
  DASHBOARD_HREF,
  TASK_LIST_HREF,
  annotationEntryHref,
} from "./route-paths";

const TASK_PARAMETERS = ["task", "task_id", "taskId", "task_type", "output_type", "view"];

/** The query parameter names of an in-app href. */
function parameterNames(href: string): string[] {
  return [...new URL(href, "https://app.invalid").searchParams.keys()];
}

describe("route paths", () => {
  it("names the dashboard, the task list and the annotation list", () => {
    expect(DASHBOARD_HREF).toBe("/dashboard/dashboard");
    expect(TASK_LIST_HREF).toBe("/task-management/task-list");
    expect(ANNOTATION_LIST_PATH).toBe("/annotation/annotation-list");
  });
});

describe("annotationEntryHref", () => {
  it("carries only the entry mark without a role", () => {
    expect(annotationEntryHref()).toBe("/annotation/annotation-list?entry=nav");
  });

  it.each([
    ["annotator", "/annotation/annotation-list?entry=nav&role=annotator"],
    ["reviewer", "/annotation/annotation-list?entry=nav&role=reviewer"],
  ] as const)("adds role=%s after the entry mark", (role, expected) => {
    expect(annotationEntryHref(role)).toBe(expected);
  });

  it.each([undefined, "annotator", "reviewer"] as const)(
    "names no task or task type (role %s)",
    (role) => {
      const names = parameterNames(annotationEntryHref(role));

      for (const name of TASK_PARAMETERS) {
        expect(names).not.toContain(name);
      }
    },
  );
});
