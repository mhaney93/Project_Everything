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

When a user map loads from the backend, migrations are applied to loaded nodes before rendering. If any migration changes the map, the app automatically saves the migrated nodes back to the backend so the fix is permanent.

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

Structural migrations live in `src/mapMigrations.js` (`STRUCTURAL_MIGRATIONS_BY_VERSION`) and run on every load after the label migrations, before stale built-in children are pruned. Each entry names a built-in label and the `homePath` of labels it belongs under: a copy already there is kept (otherwise the richest stored copy moves there), and every other copy is merged into it (notes, summaries, custom children and deeper subtrees are carried over) and then removed. If only the start of `homePath` is stored, the missing levels are first created from `TOPIC_SUBDIVISIONS` (an unexpanded parent gets its full built-in child set), and the prune never deletes a built-in copy of a migrated label, so a copy whose home level the owner deleted stays where it is. An entry with `dropBareCopies` instead deletes outright any copy outside the home whose subtree holds nothing the owner wrote (no custom node, note or stored summary). Remove the label from its old parents in `TOPIC_SUBDIVISIONS` and add it under the new one in the same change. Migrations must be idempotent.

### Fix a built-in summary

When a built-in summary in `src/App.jsx` changes, add an entry to `SUMMARY_MIGRATIONS_BY_VERSION` in `src/mapMigrations.js` so stored copies of the old text are rewritten on load. A stored summary that no longer matches the old text exactly is left alone.

### Rename, add, move or remove one built-in node

To change a single place in the tree rather than every copy of a label, give a `STRUCTURAL_MIGRATIONS_BY_VERSION` entry a path: a chain of labels ending at the built-in node itself (the first label can sit at any depth). `rename` relabels the node (a stored summary is dropped only when it is listed in `dropSummaries`); `add` creates a built-in child under a node whose built-in children are already stored, since expanding never adds more; `move` reparents the node and its subtree under `into`, creating that node if only its parent is stored; `remove` merges the node into its namesake under `mergeInto`, or, with no namesake, keeps a node holding anything the owner wrote as a custom node and deletes a bare one. Global label renames belong in `LABEL_MIGRATIONS_BY_VERSION` instead. Update `TOPIC_SUBDIVISIONS` and the built-in summaries in the same change.
