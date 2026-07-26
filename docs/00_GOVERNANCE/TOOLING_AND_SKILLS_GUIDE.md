# Claude Code Tooling and Skills Guide

## Principle

Use the smallest tool set that provides direct evidence for the task. Tools support the architecture; they do not decide it.

## Claude Code Native Features

### `CLAUDE.md`

Use for concise, persistent project facts and non-negotiable conventions. Keep it specific and compact.

### Project Skills

This archive includes:

- `/evolution-engine-implement` — implement one bounded volume task;
- `/evolution-engine-audit` — inspect architecture, determinism, and test gaps;
- `/evolution-engine-release` — execute final release evidence collection.

Use a Skill for repeatable procedures that should load only when invoked.

### Subagents

Use specialized subagents to keep codebase exploration and audits out of the main context:

- `architecture-auditor` — read-only boundary and dependency review;
- `determinism-auditor` — read-only nondeterminism and replay review;
- `volume-implementer` — bounded implementation work;
- `test-engineer` — test design and gap closure.

Architecture and determinism auditors SHOULD be independent from the agent that wrote the code.

### Hooks

Use hooks for mechanical checks that must run at fixed lifecycle points, such as formatting or blocking forbidden commands. Do not encode broad architectural judgment in shell hooks.

## Installed Skills and Services

### Highest Value for Evolution Engine

- `/mcp-builder`: build a project-specific MCP only after stable engine APIs exist; suitable for engine inspection, state validation, or controlled administrative tools.
- `/doc-coauthoring`: maintain SAS, ADRs, migration notes, and release reports.
- `/skill-creator`: refine the project-specific Skills included in this archive.
- Qodo Skills: independent code review, test-gap analysis, and mutation/test-quality support.
- GitHub connector/plugin: repository inspection, issue-to-requirement mapping, PRs, CI status, and protected reviews.
- Supabase connector/plugin: persistence schema, migrations, RLS, Edge Functions, and storage adapter verification.

### Useful for Product and Developer Experience

- `/web-artifacts-builder`: build an inspector, replay viewer, state explorer, or diagnostics dashboard after core contracts stabilize.
- `/canvas-design`: architecture diagrams and static technical visuals.
- `/theme-factory`: consistent inspector/demo styling.
- Figma: inspect product UI designs and translate only presentation-layer requirements.
- Cloudinary: generated preview and asset distribution adapter.

### Conditional or Peripheral

- Prisma: use only if the repository has chosen Prisma as the server persistence layer. Do not maintain two competing data-access abstractions for the same tables without an ADR.
- Auth0: application authentication and authorization, outside deterministic core.
- Qdrant: semantic species/component catalog or documentation search, never authoritative state.
- Tavily: research primary technical documentation; do not use search results as an undocumented architecture source.
- Zapier: project notifications and noncritical workflows.
- Val Town: isolated prototypes or lightweight integrations, not authoritative engine execution.
- `/learn`: library and concept study before implementation.
- `/brand-guidelines`, `/internal-comms`, `/morning`, `/slack-gif-creator`, `/algorithmic-art`: not required for core engine implementation.

## Recommended Workflow by Phase

- Audit: GitHub + architecture-auditor + `/evolution-engine-audit`.
- Contracts and core: local code tools + determinism-auditor + Qodo review.
- Persistence adapter: Supabase connector; Prisma only when already authoritative.
- Geometry visualization: Three.js/R3F local stack; Figma only for UI; web-artifacts-builder for inspector.
- Release: GitHub CI + `/evolution-engine-release` + independent auditors.

## Tool Safety

- Keep destructive database actions behind explicit approval.
- Do not place secrets in prompts, files, fixtures, or logs.
- Do not grant broad MCP write access to read-only audit agents.
- Pin tool and dependency versions used in reproducibility-sensitive workflows.
