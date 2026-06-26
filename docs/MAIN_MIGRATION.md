# Main.ts migration guide

`src/main.ts` is intentionally still the active game entry point. This guide lists the safest order for wiring the new optimization modules into the live game without replacing the entire file at once.

## Rule of thumb

- Keep each migration step small.
- After each step, run `npm run typecheck` and `npm run verify`.
- Avoid changing rendering, save format, and input handling in the same commit.
- Keep old save data readable.

## Step 1: Audio adapter

Current target: replace the local `playSound(...)` implementation with `playGameSound(...)` from `src/systems/soundEffects.ts`.

Suggested changes:

```ts
import { playGameSound, unlockGameAudio } from './systems/soundEffects'
```

Then replace calls like:

```ts
playSound('break', 0.12)
```

with:

```ts
playGameSound('break', 0.12)
```

## Step 2: Settings adapter

Use `loadLegacySettings()` and `saveLegacySettings()` from `src/game/legacySettings.ts` first. This preserves the current UI-facing shape while routing persistence through the typed settings module.

## Step 3: Save system

Use `SaveSystem` only around the existing serialize/apply functions first:

- keep `serializeWorld()` as the source of truth;
- replace raw `localStorage.setItem(...)` with `saveSystem.save(...)`;
- replace raw `localStorage.getItem(...)` with `saveSystem.load()`;
- keep import/export behavior unchanged until after verify passes.

## Step 4: Particle pool

Replace the break/shard burst mesh creation with `MeshParticlePool` only after the current particle animation loop is isolated. Do not change particle visuals and collision/placement logic in the same commit.

## Step 5: Light budget

Wire `applyPointLightBudget(...)` after glow/crystal lights are registered. Start with a conservative desktop cap of 24 and low-power cap of 0 or 8.

## Step 6: Chunk manager

Start by mirroring writes into `ChunkManager` while still reading from the old `Map`. After verify passes, switch read paths to `ChunkManager`. Finally, remove the old map.

## Step 7: Terrain worker

Start with an opt-in path:

- generate one chunk through `TerrainWorkerClient`;
- validate it matches the synchronous generator shape;
- then move the terrain queue over to worker generation.

## Step 8: Visible faces and greedy meshing

Migration order:

1. Use `collectVisibleFaces(...)` for diagnostics only.
2. Compare face counts with current visible block counts.
3. Use `buildGreedyQuads(...)` to estimate draw-call and vertex reduction.
4. Only then build Three.js buffer geometry from quads.

## Merge checklist

- `npm run typecheck`
- `npm run verify`
- Desktop smoke: start, move, jump, break, place, save, load, export, import, reset.
- Mobile smoke: joystick, look drag, place, hold-break, portrait prompt, landscape HUD.
