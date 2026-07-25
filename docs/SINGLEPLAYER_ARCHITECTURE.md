# Single-player architecture

The live game remains in `src/main.ts`, but new gameplay rules must not be implemented as renderer state.

## Boundaries

- `src/singleplayer/` owns deterministic local gameplay rules: progression, recipes, objectives, tool tiers, health, death and recovery.
- `src/world/` owns deterministic world data and biome selection.
- `src/session/` is the boundary between a game world and how it is hosted.
- `src/main.ts` adapts browser input, Three.js objects, HUD elements and the legacy block map to those systems.

The single-player rules do not import Three.js, DOM APIs, local storage or a transport library. This keeps them testable and lets a future authoritative multiplayer host reuse or replace rules without coupling networking to rendering.

## Session contract

`SessionGateway` deliberately exposes only lifecycle and session metadata. `LocalSessionGateway` is active. `ReservedMultiplayerGateway` keeps the product and code entry visible but always reports unavailable.

When multiplayer work begins, add a separate gateway implementation and explicit world-command/event contracts. Do not add sockets directly to `main.ts`, `ProgressionSystem` or `ChunkManager`.

## Save compatibility

World save version 6 stores deterministic terrain as generated chunk coordinates plus player
deltas (placed and removed blocks). The version 5 snapshot loader and older compatibility defaults
remain available:

- missing progression starts at hand tools with empty statistics;
- missing vitals starts at full health;
- existing blocks, inventory, survival charge and shard progress retain their old behavior.

## Next extraction targets

1. Move the legacy inventory map behind a standalone inventory service.
2. Move `serializeWorld` and validation into the typed save module.
3. Replace the legacy block map with `ChunkManager`.
4. Extract player movement into `PlayerController`.
5. Add entity simulation through commands/events rather than direct scene mutation.
