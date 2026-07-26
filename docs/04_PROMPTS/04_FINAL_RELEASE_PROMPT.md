# Prompt — Final Release

Prepare Evolution Engine for release without changing architecture.

1. Run the complete Final Release Audit.
2. Run all repository quality scripts.
3. Execute deterministic tests in fresh processes and supported environment matrix.
4. Verify clean save/load and checkpoint replay.
5. Review dependency/security findings.
6. Review performance baselines while confirming output hashes.
7. Validate documentation and traceability.
8. Produce a release report with exact command results.

Do not suppress or downgrade failures. A release is blocked by any determinism mismatch, invalid migration, architecture boundary violation, incomplete requirement evidence, failing test, or corrupted/partial publication path.
