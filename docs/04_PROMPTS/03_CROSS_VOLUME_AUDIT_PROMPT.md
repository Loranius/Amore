# Prompt — Cross-Volume Audit

Perform an independent read-only audit of the implemented Evolution Engine.

Check:

- dependency direction and private deep imports;
- exact Volume output names and schemas;
- immutable publication;
- deterministic ordering, IDs, PRNG, numeric handling, and hash scope;
- serialization/version migration behavior;
- error and validation consistency;
- adapter isolation;
- test and traceability gaps;
- failure atomicity across the complete pipeline.

Use the architecture-auditor and determinism-auditor subagents when available. Return findings ordered by severity with requirement IDs, file paths, evidence, likely consequence, and the smallest compliant correction. Do not edit code.
