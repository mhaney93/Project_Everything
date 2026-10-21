# Mind Map App

This is a Vite + React mind map app with a lightweight, auto-layout tree. You can add ideas, rename the focused node, and delete entire branches.

## Features

- Add child nodes from the header or inspector
- Click any node to focus it
- Rename the focused node
- Delete a branch (removes all descendants)

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Test

```bash
npm test
```

## Data Migrations

Node label migrations are handled in `src/App.jsx` through a versioned map:

- `LABEL_MIGRATIONS_BY_VERSION`
- `applyLabelMigrations(...)`

When a user map loads from the backend, migrations are applied to loaded nodes before rendering. If any labels change, the app automatically saves the migrated nodes back to the backend so the fix is permanent.

### Add a new label rename

1. Open `src/App.jsx`.
2. Add a new numeric version entry in `LABEL_MIGRATIONS_BY_VERSION`.
3. Put `oldLabel: 'New Label'` pairs in that version map.
4. Keep existing versions unchanged.

Example:

```js
const LABEL_MIGRATIONS_BY_VERSION = {
	1: {
		Art: 'Arts',
	},
	2: {
		'Natural Science': 'Sciences',
	},
}
```

### Move or merge a built-in node

Structural migrations live in `src/mapMigrations.js` (`STRUCTURAL_MIGRATIONS_BY_VERSION`) and run on every load after the label migrations, before stale built-in children are pruned. Each entry names a built-in label and the `homePath` of labels it belongs under: the richest stored copy moves there, and every other copy is merged into it (notes, summaries and custom children are kept) and removed with all its descendants. Remove the label from its old parents in `TOPIC_SUBDIVISIONS` and add it under the new one in the same change. Migrations must be idempotent.
