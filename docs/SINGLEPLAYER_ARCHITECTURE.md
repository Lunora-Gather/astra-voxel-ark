# Single-player architecture

The live game remains in `src/main.ts`, but new gameplay rules must not be implemented as renderer state.

## Boundaries

- `src/singleplayer/` owns deterministic local gameplay rules: progression, recipes, objectives, tool tiers, health, death and recovery.
- `src/world/` owns deterministic world data and biome selection.
- `src/session/` is the boundary between a game world and how it is hosted.
- `src/main.ts` adapts browser input, Three.js objects, HUD elements and the legacy block map to those systems.

The single-player rules do not import Three.js, DOM APIs, local storage or a transport library. This keeps them testable and lets a future authoritative multiplayer host reuse or replace rules without coupling networking to rendering.

`src/world/LandmarkTemplates.ts` is the single deterministic source for Moss Shrine, Crystal Bloom
and Waystone layouts. It preserves the legacy hash thresholds and coordinates used by existing
worlds, while attaching biome-specific landmark names for the compass. Both Worker terrain creation
and save restoration consume the same planner. Resident-chunk eviction removes corresponding shard
and name entries so constrained devices never retain navigation targets for unloaded terrain.

## Session contract

`SessionGateway` deliberately exposes only lifecycle and session metadata. `LocalSessionGateway` is active. `ReservedMultiplayerGateway` keeps the product and code entry visible but always reports unavailable.

When multiplayer work begins, add a separate gateway implementation and explicit world-command/event contracts. Do not add sockets directly to `main.ts`, `ProgressionSystem` or `ChunkManager`.

## Save compatibility

World save version 8 stores deterministic terrain as generated chunk coordinates plus player
deltas (placed and removed blocks), the player's position and view direction, selected backpack
material, world seed, and paused-safe world time. The version 7 and 6 delta loaders, version 5 snapshot loader and older compatibility defaults remain
available:

- missing player state resumes at the Ark spawn;
- missing world seed uses legacy seed `00000000`, preserving pre-v8 terrain exactly;
- missing progression starts at hand tools with empty statistics;
- missing vitals starts at full health;
- existing blocks, inventory, survival charge and shard progress retain their old behavior.

Three local expedition slots share the same v8 schema. Slot 1 intentionally keeps the original
`astra-voxel-ark-world-v1` storage key, so an existing installation opens its previous world without
a migration copy. Slots 2 and 3 use isolated keys, while the active slot is stored separately.

Player-defined slot names are lightweight metadata under `astra-voxel-ark-world-slot-names-v1`.
They do not rewrite or enlarge world saves, and renaming never changes a slot's identity. The name
store sanitizes control characters, collapses whitespace, caps names at 32 Unicode characters and
falls back to `Expedition 1/2/3` if metadata is missing, damaged or unavailable. The active name is
used consistently in slot cards, session labels, the start action, save details and safe export
filenames.

`src/world/SaveSystem.ts` owns the v8 storage schema, structural validation, import/export codec and
browser-storage error boundary. Before replacing a valid primary save, each slot records that primary
as its own last-good backup. A corrupt primary can therefore be restored from the World menu without
touching another slot. Failed or quota-limited writes keep the existing primary intact and surface an
error instead of reporting a successful save. Starting a new world intentionally clears both the
primary and recovery backup for only the active slot.

## Next extraction targets

1. Move renderer-state serialization and apply adapters behind a typed world snapshot boundary.
2. Replace the legacy block map with `ChunkManager`.
3. Extract player movement into `PlayerController`.
4. Add entity simulation through commands/events rather than direct scene mutation.
