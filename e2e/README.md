# End-To-End Scaffolding

This directory holds deterministic smoke manifests for repo-level verification.

Current scope:

- command-to-scenario coverage for the frozen baseline command surface
- fixture-corpus integrity checks
- golden-output expectation coverage for lookup, validation, and export-pack behavior

Out of scope for now:

- executing the CLI against a live vault
- pretending the CLI binary ran successfully when the local toolchain is unavailable
