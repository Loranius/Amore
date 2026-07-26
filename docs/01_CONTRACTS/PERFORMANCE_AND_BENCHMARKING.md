# Performance and Benchmarking

## Principle

Performance optimization SHALL not weaken correctness, determinism, validation, or clarity of ownership.

## Benchmarks

Maintain representative benchmarks for:

- event queue operations;
- replay;
- trait and morphology resolution;
- growth step and collision queries;
- composition mapping;
- geometry generation and validation;
- material graph evaluation;
- complete pipeline;
- save/load.

## Baselines

Record:

- fixture identifier and hash;
- runtime and platform;
- worker count;
- engine and dependency versions;
- median and percentile timing;
- memory usage where practical;
- output hash.

## Regression Policy

A statistically credible regression greater than the repository's accepted threshold requires investigation. If no threshold exists, use 10% as an initial warning threshold, not an automatic architecture change.

## Determinism

Benchmark instrumentation and adaptive scheduling MUST NOT alter canonical results. Compare output hashes during benchmark runs.
