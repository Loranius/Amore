# AI Execution Requirements

## 1. Authority

These requirements govern Claude Code and every delegated agent implementing Evolution Engine.

## 2. Primary Objective

Produce a production-grade deterministic engine that conforms to Volumes I–VII. Optimize for correctness, reproducibility, testability, maintainability, and explicit contracts before speed or visual output.

## 3. Mandatory Workflow

For each task, Claude Code SHALL:

1. inspect the repository, lockfile, build scripts, current tests, and git status;
2. identify applicable requirement IDs;
3. read the target volume and all direct upstream contracts;
4. state assumptions and detected conflicts;
5. create a bounded implementation plan;
6. implement code and tests together;
7. run applicable quality gates;
8. update traceability and status documentation;
9. provide an implementation report.

## 4. Architecture Fidelity

Claude Code MUST NOT redesign, merge, split, or bypass volume responsibilities. A necessary architecture change requires an ADR and explicit approval by the project owner.

## 5. No Pretend Completion

Claude Code MUST NOT:

- claim tests passed without running them;
- leave fake implementations presented as complete;
- hide unsupported behavior behind silent defaults;
- replace deterministic logic with random or time-based behavior;
- create production code that only satisfies visible tests;
- skip serialization or replay tests because the feature appears to work interactively.

## 6. Decision Order

When choosing an implementation approach:

1. preserve normative behavior;
2. preserve determinism;
3. preserve module boundaries;
4. prefer existing repository conventions when compatible;
5. minimize dependencies and hidden state;
6. optimize only after correctness is measured.

## 7. Conflict Handling

On a documentation conflict, Claude Code SHALL:

- stop the conflicting implementation branch;
- identify both requirements precisely;
- recommend the smallest resolution;
- record the outcome as an ADR if architecture changes;
- continue all unrelated safe work.

It SHALL NOT silently choose one requirement.

## 8. Incremental Delivery

Implementation SHALL progress one accepted volume at a time. A downstream volume MAY use only published upstream contracts, not unfinished internals.

## 9. Required Evidence

Every completed task SHALL report:

- requirement IDs satisfied;
- files created or changed;
- public contracts added or changed;
- tests added;
- commands executed and exit status;
- deterministic fixtures or hashes updated;
- migrations added;
- unresolved risks;
- next permissible task.

## 10. Tool Discipline

Use tools when they reduce uncertainty or provide direct evidence. Do not invoke every available plugin.

- GitHub: repository inspection, issues, branches, PRs, CI.
- Supabase: schema and persistence adapter work only.
- Qodo: focused review and test-gap analysis after implementation.
- Figma and web artifact tools: inspector/debug UI only.
- Tavily or web research: primary documentation for unfamiliar libraries or standards.
- Qdrant: optional semantic catalog/search outside authoritative simulation state.
- Cloudinary: optional generated-asset delivery outside core state.
- Auth0: application authentication, never simulation logic.
- Zapier and Val Town: optional workflow automation, never core execution.
- MCP Builder: only for a clearly specified external tool interface.

## 11. Completion

A volume is accepted only when its checklist, contract tests, determinism tests, serialization round trips, and upstream/downstream boundary checks pass.
