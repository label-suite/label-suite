#!/usr/bin/env node
// check-coverage.mjs — compare measured coverage with coverage-baseline.json (system-design D12, design D6).
//
//   node scripts/check-coverage.mjs \
//     --backend backend/coverage.json \
//     --frontend frontend/coverage/coverage-summary.json \
//     --baseline coverage-baseline.json \
//     [--base-baseline <base branch's coverage-baseline.json>] \
//     [--allow-lower] \
//     --suggested-out <path for the suggested baseline>
//
// Three steps, in order:
//   1. Base baseline: when --base-baseline is absent or the file does not exist,
//      print a notice and skip step 2 (only the PR that creates the file hits this).
//   2. The PR baseline must not go below base: any metric lower, or a larger
//      tolerance, fails unless --allow-lower (the coverage-baseline-lower label).
//   3. Measured must not drop: any metric below "PR baseline - tolerance" fails.
//
// A rise beyond the tolerance never fails: the full suggested baseline (raised
// metrics replaced by the measured value) is printed and written to
// --suggested-out. A missing PR baseline, or one missing a field, fails, and the
// suggested baseline is still written so there is a file to commit. This script
// only ever writes --suggested-out; it never writes the baseline it reads, and CI
// is the only source of the numbers.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** The tolerance ruled in clarification Q7, used only to fill a suggested baseline that has none. */
const DEFAULT_TOLERANCE = 0.1;

/** Float slack so 95.0 - 0.1 does not misjudge a value sitting exactly on the line. */
const EPSILON = 1e-9;

/** Every metric in the baseline: layer, metric, and where the measured value comes from. */
const METRICS = [
  {
    layer: "backend",
    metric: "percentCovered",
    measured: (m) => m.backend?.totals?.percent_covered,
  },
  { layer: "frontend", metric: "statements", measured: (m) => m.frontend?.total?.statements?.pct },
  { layer: "frontend", metric: "branches", measured: (m) => m.frontend?.total?.branches?.pct },
];

const pct = (value) => value.toFixed(1);
const isNumber = (value) => typeof value === "number" && Number.isFinite(value);

const OPTIONS_WITH_VALUE = [
  "--backend",
  "--frontend",
  "--baseline",
  "--base-baseline",
  "--suggested-out",
];
const REQUIRED = ["--backend", "--frontend", "--baseline", "--suggested-out"];

/** Parse argv into an options object; throw on unknown or incomplete options. */
export function parseArgs(argv) {
  const options = { allowLower: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--allow-lower") {
      options.allowLower = true;
    } else if (OPTIONS_WITH_VALUE.includes(arg)) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) throw new Error(`${arg} needs a value`);
      options[arg] = value;
      i += 1;
    } else {
      throw new Error(`unknown option ${arg}`);
    }
  }
  const missing = REQUIRED.filter((name) => options[name] === undefined);
  if (missing.length > 0) throw new Error(`missing ${missing.join(", ")}`);
  return options;
}

function readJson(path, label) {
  if (!existsSync(path)) throw new Error(`${label} not found: ${path}`);
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${path}: ${error.message}`);
  }
}

/** The fields of a baseline object that are missing or not numbers, as `layer.metric` paths. */
export function missingFields(baseline) {
  const missing = METRICS.filter(({ layer, metric }) => !isNumber(baseline?.[layer]?.[metric])).map(
    ({ layer, metric }) => `${layer}.${metric}`,
  );
  if (!isNumber(baseline?.tolerance)) missing.push("tolerance");
  return missing;
}

/**
 * Compare measured coverage with the PR baseline and the base branch's baseline.
 *
 * @param {object} input
 * @param {{backend: object, frontend: object}} input.measured parsed coverage.json and coverage-summary.json
 * @param {object | null} input.baseline parsed PR baseline, or null when the file is missing
 * @param {object | null} input.baseBaseline parsed base-branch baseline, or null when there is none
 * @param {boolean} input.allowLower skip step 2
 * @returns {{errors: string[], notices: string[], info: string[], suggested: object | null}}
 *   suggested is null when nothing rose and the PR baseline is complete
 */
export function compareCoverage({ measured, baseline, baseBaseline, allowLower }) {
  const errors = [];
  const notices = [];
  const info = [];

  const values = {};
  for (const { layer, metric, measured: read } of METRICS) {
    const value = read(measured);
    if (!isNumber(value))
      errors.push(`measured ${layer} ${metric} is missing from the coverage report`);
    else values[`${layer}.${metric}`] = value;
  }

  const missing = baseline === null ? [] : missingFields(baseline);
  if (baseline !== null && missing.length > 0) {
    errors.push(`coverage-baseline.json is missing ${missing.join(", ")}`);
  }

  // Step 1 and 2: the PR baseline against the base branch's.
  if (baseBaseline === null) {
    notices.push(
      "The base branch has no coverage-baseline.json; skipped the check that the baseline was not lowered.",
    );
  } else if (allowLower) {
    info.push(
      "--allow-lower (coverage-baseline-lower label): skipped the check that the baseline was not lowered.",
    );
  } else if (baseline !== null) {
    const baseMissing = missingFields(baseBaseline);
    if (baseMissing.length > 0) {
      errors.push(`the base branch's coverage-baseline.json is missing ${baseMissing.join(", ")}`);
    }
    const lowered = [];
    for (const { layer, metric } of METRICS) {
      const base = baseBaseline?.[layer]?.[metric];
      const pr = baseline[layer]?.[metric];
      if (isNumber(base) && isNumber(pr) && pr < base - EPSILON) {
        lowered.push(`${layer} ${metric} was lowered: base ${pct(base)}, PR baseline ${pct(pr)}`);
      }
    }
    if (isNumber(baseBaseline.tolerance) && isNumber(baseline.tolerance)) {
      if (baseline.tolerance > baseBaseline.tolerance + EPSILON) {
        lowered.push(
          `tolerance was loosened: base ${pct(baseBaseline.tolerance)}, PR baseline ${pct(baseline.tolerance)}`,
        );
      }
    }
    for (const message of lowered) {
      errors.push(
        `${message}; lowering the baseline needs the coverage-baseline-lower label, added by a maintainer`,
      );
    }
  }

  // Step 3: measured against "PR baseline - tolerance"; collect rises for the suggestion.
  const tolerance = isNumber(baseline?.tolerance) ? baseline.tolerance : null;
  let rose = false;
  for (const { layer, metric } of METRICS) {
    const value = values[`${layer}.${metric}`];
    const base = baseline?.[layer]?.[metric];
    if (!isNumber(value) || !isNumber(base) || tolerance === null) continue;
    info.push(`${layer} ${metric}: baseline ${pct(base)}, measured ${pct(value)}`);
    if (value < base - tolerance - EPSILON) {
      errors.push(
        `${layer} ${metric} is below the baseline: baseline ${pct(base)}, measured ${pct(value)}`,
      );
    } else if (value > base + tolerance + EPSILON) {
      rose = true;
    }
  }

  let suggested = null;
  if (baseline === null || missing.length > 0 || rose) {
    const fallbackTolerance = isNumber(baseBaseline?.tolerance)
      ? baseBaseline.tolerance
      : DEFAULT_TOLERANCE;
    suggested = {};
    for (const { layer, metric } of METRICS) {
      const value = values[`${layer}.${metric}`];
      const base = baseline?.[layer]?.[metric];
      let next = base;
      if (
        !isNumber(base) ||
        (isNumber(value) && tolerance !== null && value > base + tolerance + EPSILON)
      ) {
        next = value;
      }
      suggested[layer] = { ...suggested[layer], [metric]: next };
    }
    suggested.tolerance = tolerance ?? fallbackTolerance;
  }

  return { errors, notices, info, suggested };
}

/** Run the CLI; return the exit code. */
export function main(argv, { stdout = process.stdout, stderr = process.stderr } = {}) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    stderr.write(`check-coverage: ${error.message}\n`);
    return 2;
  }

  const errors = [];
  const measured = {};
  for (const [key, flag] of [
    ["backend", "--backend"],
    ["frontend", "--frontend"],
  ]) {
    try {
      measured[key] = readJson(options[flag], `${key} coverage report`);
    } catch (error) {
      errors.push(error.message);
    }
  }

  let baseline = null;
  try {
    baseline = readJson(options["--baseline"], "coverage-baseline.json");
  } catch (error) {
    errors.push(error.message);
  }

  let baseBaseline = null;
  const basePath = options["--base-baseline"];
  if (basePath !== undefined && existsSync(basePath)) {
    try {
      baseBaseline = readJson(basePath, "the base branch's coverage-baseline.json");
    } catch (error) {
      errors.push(error.message);
    }
  }

  const result = compareCoverage({
    measured,
    baseline,
    baseBaseline,
    allowLower: options.allowLower,
  });
  errors.push(...result.errors);

  for (const line of result.info) stdout.write(`${line}\n`);
  for (const notice of result.notices) stdout.write(`::notice::${notice}\n`);

  if (result.suggested !== null) {
    const text = `${JSON.stringify(result.suggested, null, 2)}\n`;
    writeFileSync(options["--suggested-out"], text);
    stdout.write(
      `Suggested coverage-baseline.json (written to ${options["--suggested-out"]}):\n${text}`,
    );
  }

  if (errors.length > 0) {
    for (const error of errors) stderr.write(`ERROR ${error}\n`);
    stderr.write(`check-coverage: ${errors.length} problem(s)\n`);
    return 1;
  }
  stdout.write("check-coverage: OK\n");
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
