---
paths:
  - "**/*.test.ts"
  - "**/*.spec.ts"
  - "tests/**/*.ts"
---

# Test Rules

Every test states or references the requirement/invariant it verifies. Use recorded deterministic seeds. Add a regression test for each bug. Never update a golden fixture without explaining the semantic change and affected requirement or ADR.
