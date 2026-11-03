---
id: 15
type: story
title: "Faster CI: the e2e suite in parallel shards, run when a pull request is ready and on main"
parent: none
covers: []
after: []
refined: false
hitl: false
risk: low
---

# Faster CI

## Description

PR #33's Playwright job hit its 30-minute limit (118 tests, 30.4 min; raised to 45 minutes to land release 0.3.0). The owner chose (2026-11-03) two changes, after the 0.3.0 tag:

- A. Split the e2e suite across 2 (or 3) parallel jobs, each with its own dev Gateway (Playwright `--shard`, the unsigned module artifact shared), so its wall time drops to about 15 to 20 minutes.
- B. Build, unit tests, the signing check and the contract checks on every push (about 2 minutes); the e2e shards only when a pull request is marked ready for review (`pull_request` types `ready_for_review` and `synchronize` on non-draft PRs, or a label), on pushes to `main`, and on demand (`workflow_dispatch`). Agents keep running the whole suite on a fresh stack before every pull request.

## Requirements

- Verify: when it is scheduled, a push to a draft pull request runs only the fast jobs; marking it ready runs the shards and each finishes well inside its limit; a push to `main` runs everything; the uploaded e2e output merges the shards' screenshots, measures and report.

## References

- .github/workflows/ci.yml; e2e/playwright.config.mjs (workers 1, shared Gateway state); RELEASING.md "Checks by release type" (says what every pull request runs; update it)

## Notes

- Decision: 2026-11-03 Owner ("agree with A and B, do it after the tag").
- Note: the repository is public, so GitHub-hosted runner minutes are free; the change is for wall time and feedback speed.
