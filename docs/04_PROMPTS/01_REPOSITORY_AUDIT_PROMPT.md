# Prompt — Repository Audit

Audit this repository against the Evolution Engine SAS before changing code.

Read `CLAUDE.md`, `INDEX.md`, governance documents, cross-volume contracts, and all seven volume specifications. Inspect the repository, package manager, lockfile, TypeScript configs, package graph, tests, CI, database adapters, and current git status.

For the existing Amore repository, do not infer that reference package names require new packages. Identify reusable owners before recommending any new module. Read `docs/01_CONTRACTS/CRYSTAL_ATTACHMENT_INTEGRITY_PROFILE.md` when auditing crystal code.

Return:

1. repository inventory;
2. existing architecture mapped to Volumes I–VII;
3. package dependency violations;
4. determinism risks;
5. missing contracts and tests;
6. persistence/UI/framework leaks into core;
7. reusable existing code;
8. required migrations;
9. implementation phases with exit gates;
10. exact first vertical slice;
11. current live reaction wiring that must remain unchanged;
12. crystal placement, junction, cap, hidden-face, material, renderer, and validation owners.

Do not edit files during this audit. Cite file paths and symbols for every finding. Distinguish confirmed facts from inference. Do not propose a new architecture; map the repository to the fixed SAS.
