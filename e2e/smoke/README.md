# Smoke Scenarios

Each scenario manifest maps one documented baseline command to:

- a vault fixture
- any prerequisite input files
- a golden-output directory documenting the current expected smoke behavior

`verify-fixtures.mjs` is the executable smoke gate for this scaffold.
