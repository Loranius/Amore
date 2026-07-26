# Requirements Traceability

## Rule

Every normative requirement ID SHALL map to:

- owning package;
- implementation symbol or file;
- one or more tests;
- current status;
- evidence or fixture where applicable.

## Status Values

- `NOT_STARTED`
- `IN_PROGRESS`
- `IMPLEMENTED`
- `VERIFIED`
- `BLOCKED`
- `DEFERRED_BY_SCOPE`

Only `VERIFIED` satisfies a release gate. Work explicitly excluded by the current owner-approved scope may be `DEFERRED_BY_SCOPE`, but it does not satisfy a future release gate that includes that work.

When the Crystal Attachment Integrity Profile is enabled, every `CAI-REQ-*` record SHALL map to the owning Volume III–VI implementation and tests.

## Required Traceability Record

```text
Requirement ID:
Volume:
Summary:
Owning package:
Implementation files/symbols:
Test files/cases:
Fixture/hash:
Status:
Evidence command:
Notes:
```

## Change Rule

A code change affecting a requirement SHALL update its traceability record in the same change. A test without a requirement link and a requirement without a test link are audit findings.
