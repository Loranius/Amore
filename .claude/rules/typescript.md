---
paths:
  - "packages/**/*.ts"
  - "packages/**/*.tsx"
---

# TypeScript Engine Rules

Use strict readonly public contracts. Keep deterministic domain functions free of I/O, wall clock, React, Three.js objects, Supabase clients, and hidden mutable state. Validate untrusted input at boundaries and return structured errors.
