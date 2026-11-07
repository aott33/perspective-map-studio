---
id: 35
type: story
title: "Open-source release readiness: contributing, security, outside pull requests and the Exchange listing"
parent: none
covers: []
after: []
refined: false
hitl: true
risk: medium
---

# Open-source release readiness: contributing, security, outside pull requests and the Exchange listing

## Description

Raised by the owner on 2026-11-07: Map Studio is to be a free, open-source module ("Feels good to be developing a module that will be free. It will set a good reputation for AO Industrial and the capabilities"). The initiative keeps the public release out of the first version: the module is proven in `ign-scada-template` first (initiative Boundaries). What is in place already: the Apache-2.0 licence decided on 2026-10-26 (initiative Notes, MIT possible until the first outside contribution), the module declared free (`isFreeModule`, no activation or trial), NOTICE crediting every library and dataset as it arrives, and signed `.modl` releases from GitHub pinned by SHA-256 in the host's module lock.

This story gathers what a public release still needs, mostly packaging:

- `LICENSE` and the source file headers the licence asks for, and NOTICE checked complete.
- A contributing guide (how to build, test and propose a change, the no-em-dash and documentation rules) and a code of conduct.
- A security policy: how to report a vulnerability privately, and which versions get fixes.
- Issue and pull request templates.
- CI that runs for pull requests from forks without exposing the signing key or any secret.
- Whether outside contributors sign anything (a contributor licence agreement, or the Developer Certificate of Origin's sign-off), decided before the first outside contribution.
- The public user documentation and its PDF (backlog story 27) and the demo fields (backlog stories on the oil and gas, solar and water demos).
- An Ignition Exchange listing, and the repository's public face: the README's showcase, the release notes and the version support table.

## Requirements

- Verify: when it is scheduled, a developer outside AO Industrial clones the repository, builds and tests it from the contributing guide alone, opens a pull request from a fork that CI checks without any secret, and installs a signed release on a test Gateway from the public docs; the security policy names a private reporting route; every bundled third party is in NOTICE.

## References

- initiative - _bmad-output/initiative-flowmap/initiative-flowmap.md, Boundaries (the open-source release out of the first version) and the 2026-10-26 licence decision
- backlog - story-user-documentation-shipped-with-the-module-or-hosted.md (27), story-demo-oil-and-gas-field.md, story-demo-solar-farm.md, story-demo-water-utility.md
- release - RELEASING.md, the signed release and the module lock

## Notes

- Note: 2026-11-07 Owner ("Yes add that"): backlog, not scheduled; it waits until the template runs on Map Studio (epic-template-cutover).
- Open question (owner): a contributor licence agreement or the Developer Certificate of Origin's sign-off; the licence decision of 2026-10-26 notes that a switch from Apache-2.0 needs every contributor's consent once outside contributions arrive.
- Open question (owner): the Exchange listing's timing, with 0.x releases or from 1.0.
- Note: 2026-11-07 Owner (asked how to track the backlog after the first version): at the public release the ticket store switches to GitHub Issues (the Product Owner skill's GitHub starter: labels for type, status, risk and hitl, sub-issues for the hierarchy, blocked-by for prerequisites, milestones for releases), so users and contributors file bugs and requests there; the initiative, epic and plan files stay in the repository as the spec, mirrored to issues.
