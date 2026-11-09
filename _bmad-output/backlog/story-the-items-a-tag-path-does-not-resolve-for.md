---
id: 39
type: story
title: "The items a tag path does not resolve for, listed under the path in Kinds"
parent: none
covers: []
after: []
refined: false
hitl: false
risk: low
---

# The items a tag path does not resolve for, listed under the path in Kinds

## Description

Raised while planning epic 4 entry 12a (2026-11-09; the owner agreed): EXPERIENCE.md's surface state "Path does not resolve" says each path reads "Resolves for N of M items", listing the items it fails for. `tags.resolve.reply` carries `n` and `m` only, and the browser never sees tags, so it cannot work the list out itself. Entry 12a shows N of M in the warning token when fewer than all resolve.

Add the failing items (their ids, capped, with a count of the rest) to `tags.resolve.reply` in `common/` and `docs/contract.md`, a contract change, and show them under the path in the kind's setup, each opening its item.
