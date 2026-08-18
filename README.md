# AppSheet Architect

A skill for AI coding agents (Claude Code / Anthropic-style skills) that designs,
audits, refactors, and reviews **Google AppSheet** apps for **fast sync, low
operating cost, and enterprise scale**. It encodes how AppSheet actually behaves
under load so an agent makes changes that move the needle instead of guessing.

## What's here

| Path | Purpose |
|---|---|
| [`SKILL.md`](./SKILL.md) | Entry point — the mental model, mode router, and hard constraints. **Start here.** |
| [`references/diagnostics.md`](./references/diagnostics.md) | Shared knowledge base: the sync/cost model, ~40 ranked anti-patterns with fixes, hard limits. |
| [`references/expressions.md`](./references/expressions.md) | Comprehensive catalog of all AppSheet functions & formulas (syntax, return types, bilingual En/Vi explanations, realistic examples, and performance guidance). |
| [`references/design.md`](./references/design.md) | Designing a new app/table/feature from requirements. |
| [`references/audit-refactor.md`](./references/audit-refactor.md) | Auditing / optimizing / refactoring an existing app. |
| [`references/data-and-backend.md`](./references/data-and-backend.md) | Data-source choice, Apps Script / bot offload. |
| [`references/extension-changeset.md`](./references/extension-changeset.md) | Full JSON **changeset** spec for the [AppSheet Copilot](https://github.com/t4nk3rchu/appsheet-assistant) browser extension — how to emit changes an agent can apply into the editor. |
| [`scripts/parse_appdoc.py`](./scripts/parse_appdoc.py) | Turns an AppSheet **Documentation export** into normalized per-section files + aggregate signals (virtual-column leaderboard, write-contention grouping, view-type mix) for auditing large apps. |

## Using it

As a skill: install/point your agent at this directory; it triggers on AppSheet
architecture/performance work (slow sync, virtual columns, security filters,
data-model design, cost reduction, expression review). The agent reads `SKILL.md`,
picks a mode, and reads the mode file **plus** `diagnostics.md`.

The parser (for audits):

```bash
python scripts/parse_appdoc.py <appdoc.txt> --out <outdir>
```

## Applying changes

AppSheet has no official API to edit app **structure** — normally the output is a
plan/spec you execute in the editor. If you use the **AppSheet Copilot** extension,
the skill can instead emit a strict-JSON changeset the extension replays into the
editor (you still click Save). The changeset format is fully specified in
[`references/extension-changeset.md`](./references/extension-changeset.md) — no need
to re-explain it to the agent.

## License

See the repository owner. Reuses no proprietary AppSheet material; all guidance is
original analysis.
