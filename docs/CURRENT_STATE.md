<!-- genesis-memory-bridge:v2 -->

# Canonical project state

This repository stores no temporal project state. The sole mutable authority is
`arthurportodev/genesis-platform-api`, branch `main`, at
`docs/memory/project-state.v2.json`.

Resolve the static
[`docs/memory/project-state.pointer.v2.json`](memory/project-state.pointer.v2.json)
in this order:

1. an explicit API checkout or authority URL;
2. a sibling `genesis-platform-api` checkout;
3. the public read-only authority on API `main`.

The resolver enforces the accepted schema major and fails closed with
`AUTHORITY_UNAVAILABLE`. When task context supplies an expected API authority
SHA, a different or unverifiable source fails with
`EXPECTED_AUTHORITY_SHA_MISMATCH`; it never falls through to a stale source.

The pointer is static. It contains no phase, task, receipt, state revision,
deployment, live binding, timestamp, or authority commit. Exact authority pins
belong to transient task evidence or explicit validation arguments.
