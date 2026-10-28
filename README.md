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

Node label migrations live in `src/mapMigrations.js`:

- `LABEL_MIGRATIONS_BY_VERSION`
- `applyLabelMigrations(...)`

When a user map loads from the backend, migrations are applied to loaded nodes before rendering. If any migration changes the map, the app automatically saves the migrated nodes back to the backend so the fix is permanent.

Label renames run once per map: the map's root records the last version applied (`labelMigrationVersion`), so only newer versions run on later loads, and a label the owner sets afterwards is kept. A built-in node is renamed only where its parent's built-in children in `TOPIC_SUBDIVISIONS` list the new label (or under the parent named in `LABEL_MIGRATION_PARENTS`), so a namesake elsewhere in the map is left alone. A renamed node keeps its place, id, notes and children, even beside a sibling that already has the new label. Personal nodes are never renamed, and custom nodes only where their `LABEL_MIGRATION_PARENTS` entry sets `custom`.

### Add a new label rename

1. Open `src/mapMigrations.js`.
2. Add a new numeric version entry in `LABEL_MIGRATIONS_BY_VERSION`.
3. Put `oldLabel: 'New Label'` pairs in that version map.
4. Keep existing versions unchanged.
5. If the new label is not listed under its parent in `TOPIC_SUBDIVISIONS`, add a `LABEL_MIGRATION_PARENTS` entry naming the parent.

Example:

```js
export const LABEL_MIGRATIONS_BY_VERSION = {
	1: {
		Art: 'Arts',
	},
	2: {
		'Natural Science': 'Sciences',
	},
}
```

### Move or merge a built-in node

Structural migrations live in `src/mapMigrations.js` (`STRUCTURAL_MIGRATIONS_BY_VERSION`) and run on every load after the label migrations, before stale built-in children are pruned. Each entry names a built-in label and the `homePath` of labels it belongs under: a copy already there is kept (otherwise the richest stored copy moves there), and every other copy is merged into it (notes, custom children and deeper subtrees are carried over; the kept copy keeps its summary, and a different summary shown on the merged copy is added as a note starting `Merged from <old path>:`) and then removed. If only the start of `homePath` is stored, the missing levels are first created from `TOPIC_SUBDIVISIONS` (an unexpanded parent gets its full built-in child set), and the prune never deletes a built-in copy of a migrated label, so a copy whose home level the owner deleted stays where it is. An entry with `dropBareCopies` instead deletes outright any copy outside the home whose subtree holds nothing the owner wrote (no custom node, note or stored summary). Remove the label from its old parents in `TOPIC_SUBDIVISIONS` and add it under the new one in the same change. Migrations must be idempotent.

### Fix a built-in summary

When a built-in summary in `src/App.jsx` changes, add an entry to `SUMMARY_MIGRATIONS_BY_VERSION` in `src/mapMigrations.js` so stored copies of the old text are rewritten on load. A stored summary that no longer matches the old text exactly is left alone.

### Fix one custom node

Custom nodes have no built-in text to correct, so give a `NODE_EDITS_BY_VERSION` entry in `src/mapMigrations.js` the node's `id`, its current `label` and `summary` (`''` for none), and the new label and/or summary under `set`. The edit applies only to a custom node (`isCustom: true`) that still has exactly that label and summary, so a node the owner edited since, or a built-in node that shares the id on another map, is left alone. A `swap` entry names two such nodes and exchanges their labels and sibling order, so each keeps its summary and subtree. A `mergeInto` entry (the `id` and `label` of the node to keep) merges a duplicate custom node into that node the way a structural `remove` does; its children take its place among the kept node's children when all of them are ordered, and with `takeSummary` the kept node shows the duplicate's summary and keeps its own as a note starting `Earlier summary:`.

### Rename, add, move or remove one built-in node

To change a single place in the tree rather than every copy of a label, give a `STRUCTURAL_MIGRATIONS_BY_VERSION` entry a path: a chain of labels ending at the built-in node itself (the first label can sit at any depth). `rename` relabels the node (a stored summary is dropped only when it is listed in `dropSummaries`); `add` creates a built-in child under a node whose built-in children are already stored, since expanding never adds more (with `everyCopy`, also under any non-personal copy, custom or not, with nothing stored under it yet; see `addBuiltInNode`); `move` reparents the node and its subtree under `into`, creating that node if only its parent is stored (with `id`, it moves the node with that id at the path, custom or not) (a renamed or moved node that lands next to a namesake is merged into it the same way); `remove` merges the node into its namesake under `mergeInto` (with `as`, into the node labelled `as` there instead, creating the missing levels of that path from `TOPIC_SUBDIVISIONS`, and with `summary` standing in for the removed node's retired built-in summary), or, with no target, keeps a node holding anything the owner wrote as a custom node and deletes a bare one (a stored copy of `summary` on the node itself does not count as the owner's). With `exclude`, the removed label is also added to the parent's `excludedChildLabels`, for a parent label whose built-in children other copies of it still need. `refile` lists several such paths and moves every built-in node stored at them under `into`, creating that home and its missing levels from `TOPIC_SUBDIVISIONS`; a home that held no built-in children also gets the rest of its built-in set, less any label the owner deleted from the home or from a parent a refile path names (see `refileBuiltInNodes` for the exact rules). Renames of a label wherever its built-in parent lists the new one belong in `LABEL_MIGRATIONS_BY_VERSION` instead. Update `TOPIC_SUBDIVISIONS` and the built-in summaries in the same change.

### Reattach orphaned nodes

An entry with `rehomeOrphans: true` reattaches nodes whose parent no longer exists: each merges into its one reachable built-in namesake or moves under the one node whose built-in children list it, a duplicate or bare one is deleted, and one with no home that holds anything the owner wrote is left untouched. `dropArchived` lists labels whose unreachable copies are deleted first when they hold nothing beyond the built-in or given archived summary. See `rehomeOrphans` in `src/mapMigrations.js` for the exact rules. Stale built-in children are always dropped with their whole subtree (on load and on expand), except that one whose subtree holds anything the owner wrote becomes a custom node instead, so no new orphans are left behind.
