- source_plan: `_bmad-output/initiative-flowmap/tickets/epic-module-foundation/tickets/story-tracer-a-maplibre-map-on-a-perspective-view-with-one-round-t-plan.md`
  summary: Remove the 15,704 `web/node_modules` files from the branch history by squashing the story 1 work-in-progress commits before the branch becomes a pull request.
  evidence: An early WIP commit (13f7a34) swept `web/node_modules` in before it was ignored; `git ls-files` shows none now, but history carries them. Needs the owner's approval for a force-push on the session branch.
  resolved: 2026-10-26 owner approved; the eleven WIP commits were squashed into one and force-pushed; no commit on the branch contains web/node_modules.
