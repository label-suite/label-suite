/**
 * pre-commit: format only the files staged in this commit.
 * Run by scripts/git-hooks/pre-commit; .prettierignore still applies, and
 * --ignore-unknown skips anything Prettier has no parser for.
 */
export default {
  "*.{json,md,yml,yaml,css,js,mjs}": "prettier --write --ignore-unknown",
};
