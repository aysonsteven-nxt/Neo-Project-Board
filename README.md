# Neo Project Board

Version **0.4.0**

Neo Project Board is the local React/Vite project-management UI for a Neo OrchestraX Project Hub.

It is intentionally a separate project from Neo OrchestraX. The application lives under:

```text
<project>-docs/neo-project-board/
```

and operates on the canonical Project Hub filesystem data in the parent `<project>-docs` directory.

## v0.2.0

Core project-management release:

- Sprint board
- Backlog
- Epic create/edit/delete
- User Story create/edit/delete
- Epic → User Story relationship management
- User Story → Subtask relationship management
- Subtask create/update/delete
- Acceptance criteria
- Status and priority management
- Sprint create/start/complete/delete
- Assign a User Story to a Sprint
- Persistent discussions/comments on User Stories
- Installed Project Hub packs
- Filesystem JSON remains the source of truth

## Run

From `neo-project-board`:

```bash
npm install
npm run dev
```

The local API is provided by the Vite development server and reads/writes the parent Project Hub.

If the board is not located directly under `<project>-docs/neo-project-board`, set:

```powershell
$env:NEO_PROJECT_HUB="C:\path\to\project-docs"
npm run dev
```

## Project Hub relationship

```text
<project>-docs/
├── hub.json
├── packs/
├── board/
│   ├── board.json
│   ├── epics/
│   ├── stories/
│   ├── subtasks/
│   └── sprints/
├── discussions/
└── neo-project-board/
    └── React application
```

The React application is not the database and does not replace the Project Hub. It is a local UI over the filesystem source of truth.

## v0.3.0

- Drag-and-drop Sprint Board status changes
- Board sprint filtering and search
- Backlog search, priority filtering, and Epic collapse/expand
- Richer Story details with Sprint assignment and acceptance criteria
- Epic detail navigation
- Sprint progress and Open Board workflow
- Story deletion now cleans up sprint relationships


## v0.4.0 — OrchestraX Integration Readiness

This release prepares the separate Neo Project Board application to be provisioned by Neo OrchestraX.

- Project Hub identity is discovered from the parent `hub.json`
- Project Board validates the expected local Project Hub relationship
- `/api/health` exposes local integration readiness
- `/api/metadata` exposes Board version, Project Hub contract, and project identity
- `neo-project-board.json` declares the Board application contract
- Project page shows Project Hub identity, contract, packs, and integration status
- No cloud backend, account system, or database is introduced

The intended provisioned layout remains:

```text
<project>-docs/
├── hub.json
├── packs/
├── board/
├── discussions/
└── neo-project-board/
    ├── neo-project-board.json
    └── React application
```

Neo OrchestraX v0.17 can pull/clone this separate repository into `neo-project-board/` without making the React application part of the OrchestraX repository.
