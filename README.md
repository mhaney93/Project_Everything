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
