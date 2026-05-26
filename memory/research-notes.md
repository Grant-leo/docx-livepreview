# Memory Research Notes

Last updated: 2026-05-26 Asia/Shanghai

The local memory design for this repository borrows patterns from current AI memory projects and adapts them to a small VS Code extension repository.

## Patterns Adopted

- Multi-level state: keep user preferences, project state, release state, and test evidence separate.
- Additive updates: append high-signal facts instead of constantly rewriting old context.
- Hybrid retrieval readiness: Markdown files work with keyword search today and can later be indexed by embeddings or a graph tool.
- Local-first storage: repository files are the durable source of truth.
- Evidence-backed memory: important claims link to test artifacts or exact files.

## References

- Mem0: universal memory layer; useful pattern is multi-level user/session/agent memory and additive extraction.
  - https://github.com/mem0ai/mem0
- Zep: useful distinction between short-term raw messages and long-term memory context.
  - https://help.getzep.com/v2/memory
- Letta: useful pattern of explicit memory blocks plus archival memory.
  - https://docs.letta.com/guides/get-started/for-agents/
- IWE: local-first Markdown files and hierarchical knowledge graph.
  - https://iwe.md/
- Dory: local-first memory daemon shared by multiple agents over a Markdown corpus.
  - https://dory.deeflect.com/
- Basic Memory: local-first Markdown knowledge graph for AI conversations.
  - https://pypi.org/project/basic-memory/0.0.0/

