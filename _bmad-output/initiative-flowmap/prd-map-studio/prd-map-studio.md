---
title: Map Studio for Ignition Perspective - PRD
status: draft
created: 2026-10-25
updated: 2026-10-25
---

# PRD: Map Studio for Ignition Perspective

Draft. Sections are filled in on the coaching path.

## 2. Target User

### 2.1 Roles

- **Map editor** - an admin or an integrator. Builds a map for a new field, builds a map for an existing field that has no map yet, and changes an existing map. An integrator who supports a project is a map editor too.
- **Integrator** - everything a map editor does, plus mass provisioning by CSV import.
- **Operator** - on a phone in the field. [ASSUMPTION: scope of phone editing to be confirmed; see the conflict with the brief]

### 2.3 Key User Journeys

- **UJ-1. Sam lays out a field that has no map.**
  - **Persona + context:** Sam is a map editor bringing a field onto the map: a new field, or an existing one that runs in Ignition but has no map. Before starting, Sam has researched every item to bring online, with its properties and its latitude and longitude, often already in a spreadsheet laid out like the import template.
  - **Entry state:** signed in on a laptop, on the map page, which is empty or nearly empty.
  - **Path:**
    1. Sam picks what to add, in any order: a pipeline, a pad, a compressor station.
    2. A form asks for the name and properties of that kind of item.
    3. Sam sets its location either by typing latitude and longitude or by picking the point on the map, the way you set a stop in map directions.
    4. Sam repeats until the field is laid out, or imports the spreadsheet instead (UJ-3).
  - **Climax:** [OPEN: how Sam knows the field is right. So far: other people review it, possibly against an overlay of another map]
  - **Resolution:** [OPEN: what Sam does to hand it over, for example send it for review in the template]
  - **Edge case:** [OPEN]
