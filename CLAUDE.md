# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm build        # compile src/index.ts → dist/ (CJS + ESM + .d.ts)
pnpm tsc --noEmit # type-check without emitting
```

There are no tests and no lint script configured.

## Architecture

This is a single-file Mongoose plugin (`src/index.ts`). It exports one function, `FindByReferenceInMongoose(schema)`, intended to be passed to `schema.plugin()`.

**How it works:**

The plugin attaches a `pre` hook to `find`, `findOne`, `distinct`, and `countDocuments`. Before each query executes, it rewrites `_conditions` by walking the query filter tree and resolving any cross-reference field paths:

1. `transPath2RefPath` — converts a dot-notation path like `owner.name.en-US` into a reference-aware path by detecting when a path segment crosses a `ref: 'ModelName'` boundary in the schema and recursing into that model's schema.
2. `flatten` — converts a nested object into dot-notation keys (skipping keys that start with `$`).
3. `lookup` — recursively walks the filter conditions. When it encounters a filter on a field that lives in a referenced model, it queries that model with the sub-conditions, collects the matching `_id` values, and replaces the original filter with `{ $in: [...ids] }`.

**Build:** `tsup` builds dual CJS (`dist/index.js`) and ESM (`dist/index.mjs`) outputs with TypeScript declarations. The `dist/` directory is what gets published to npm via the `"files"` field in `package.json`.

**Peer dependency:** `mongoose ^9.3.0` must be installed by consumers; it is a `devDependency` here only for type checking.
