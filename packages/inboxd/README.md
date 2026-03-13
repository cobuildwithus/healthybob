# `@healthybob/inboxd`

Source-agnostic inbox ingestion for Healthy Bob.

This package keeps canonical inbox evidence in the vault and uses a local SQLite
runtime database for cursors, dedupe, and search indexes.

## Core model

- every inbound source normalizes into a single `InboundCapture` envelope
- raw source evidence is persisted under `raw/inbox/<source>/...`
- append-only vault events and audits record the canonical import trail
- SQLite runtime state lives under `<vault>/.runtime/inboxd.sqlite`

## Current scope

- connector contracts for polling and webhook sources
- iMessage-first poll connector over an injected driver boundary
- capture pipeline with raw persistence, event/audit append, dedupe, and FTS
- runtime list, show, and search helpers for future CLI/agent surfaces
