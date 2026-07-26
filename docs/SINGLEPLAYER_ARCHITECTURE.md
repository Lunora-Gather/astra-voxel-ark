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

`src/player/PlayerMotionController.ts` owns frame-rate-aware walking, sprinting, acceleration,
stopping, jumping and gravity in local player space. Keyboard and normalized touch input feed the
same allocation-free controller; `main.ts` only rotates its reused displacement through
`PointerLockControls` and passes the result to `PlayerCollisionResolver`. Delta time is capped at
50 ms so a stalled low-end frame cannot create a tunneling-sized movement step. Pause, focus loss,
orientation changes, world loading and respawn explicitly reset the relevant motion state.
`PlayerMotionController.land()` returns the downward impact speed before clearing velocity.
`SurvivalVitals.getFallDamage` owns the safe landing threshold and deterministic damage curve, while
`applyDamage` records a fatal transition only once. The browser adapter supplies sound, haptics,
health HUD feedback and the existing Ark respawn without adding renderer state to either rule module.
The same motion controller accepts an optional water state. It applies swim-speed horizontal
movement, exponential vertical drag, capped sinking and airborne upward input without a second
touch-specific controller. `main.ts` derives that state from two packed-key torso/feet lookups and
updates the Jump/Swim label only when the medium changes. Landing while immersed suppresses fall
damage but still resets vertical velocity.

`ArkRestSystem` shares the live `0.055` day-phase rate and derives rest eligibility plus the next
rising-dawn time from world time and Ark distance. It has no DOM, Three.js or persistence dependency.
The Journey adapter permits rest only at night within 12 metres of the core, applies bounded
`SurvivalVitals.heal`, raises power to a minimum of 65 and reuses the existing v8 world-time, vitals
and survival fields. Desktop `R` and the Journey button invoke the same adapter.

`src/world/WorldCoordinates.ts` owns Minecraft-style block coordinate rounding and display/clipboard
formats. The roomy and compact desktop HUD exposes a copyable biome/location card; minimal HUDs omit
that card to preserve touch space, while the World menu always includes the current position.

`src/singleplayer/TutorialGuide.ts` owns the ordered, deterministic onboarding state without DOM or
renderer dependencies. Actual movement, mining, placement, backpack, crafting and shard events
advance it through narrow adapters in `main.ts`. Its optional compact snapshot is stored per world;
older saves infer already-finished steps from progression statistics. Roomy HUDs show the current
step directly, while constrained touch layouts mirror it into the existing help panel.

`src/singleplayer/MiningSystem.ts` owns block hardness, tool-tier duration scaling and the transient
mining session. Desktop mouse, the touch Break button and touch-canvas holds all enter the same
session adapter. Progress uses absolute frame time and a reused result object; changing the aimed
block cancels the session, and completion passes the locked block key back to the world mutation
adapter. A short touch-canvas tap remains a placement gesture, including against a tool-gated
target. Mining state is intentionally not persisted.

`ProgressionSystem.getRecipeAvailability` is the canonical recipe readiness calculation. It returns
exact available and missing counts so the expedition UI never reimplements crafting rules.
`getMaxCraftableCount` derives a bounded quantity from the limiting ingredient, while `craftMany`
removes all ingredient totals before granting the combined reward and restores prior removals if an
inventory adapter unexpectedly rejects a later debit. One-time tools remain capped at one.
`claimCompletedObjectives` grants every currently completed, unclaimed reward in one synchronous
operation and records each claim before the next UI refresh; repeated calls cannot duplicate rewards.
The existing progression snapshot remains the persistence boundary.

`src/singleplayer/BuildPatternSystem.ts` owns renderer-independent plans for single-block, pillar,
wall, directional two-wide stairs and platform placement. Its planner reuses one fixed nine-position result buffer. `main.ts`
validates the whole plan against inventory, height, occupied voxels and player collision before
applying one block batch, so a pattern either succeeds completely or leaves the world unchanged.
Pattern choice is transient interface state; placed blocks remain ordinary player deltas in the v8
save format, preserving existing worlds and the future session boundary.
`BuildHistorySystem` snapshots at most nine changes per placement and retains only the latest 32
actions. Undo reverses matching player deltas in one world batch, restores replaced water and refunds
only blocks actually removed. History clears on every world lifecycle change and is intentionally
absent from saves; historical progression statistics are not decremented.

Mining targets and all live player/world delta membership checks use `PackedBlockKey` numeric
identity. `serializeWorld` converts packed removed, placed and collected-shard sets back to the
unchanged `"x,y,z"` arrays expected by v8 saves; `applySavedWorld` performs the inverse conversion
after structural validation. This is a runtime-only migration, not a save migration.

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
- missing tutorial state derives completed actions from existing progression statistics;
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

`src/game/SaveActivityTracker.ts` exposes the current local persistence state independently from
the save codec. The title HUD and pause header share its `Not saved`, `Saving`, relative `Saved`
and failure feedback. Only one idle autosave may be pending; manual save, load, import, recovery,
world switching and reset cancel that callback before changing active world state.

## Next extraction targets

1. Move renderer-state serialization and apply adapters behind a typed world snapshot boundary.
2. Replace the legacy block map with `ChunkManager`.
3. Extract camera look policy and browser input bindings from `main.ts`.
4. Add entity simulation through commands/events rather than direct scene mutation.
