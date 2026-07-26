# AstraVoxel Ark / 星野方舟

A polished landscape-first voxel sandbox app built with **Vite + TypeScript + Three.js**, packaged for web, Android, Ubuntu Linux and Windows

玩家可以在梦幻体素浮岛中探索、挖方块、放方块、切换不同材质，并体验柔和日夜循环、雾效、水面、浮云、星光粒子与发光方块

## Play Online

**Play now:** https://lunora-gather.github.io/astra-voxel-ark/

![AstraVoxel Ark preview](docs/assets/preview.png)

## Features

- Procedural voxel island terrain
- Frame-rate-stable first-person movement with pointer lock on desktop and normalized touch controls on mobile
- Hold-to-mine block breaking with material hardness, tool-speed upgrades and aim cancellation, plus player-safe placement checks
- Three named local expedition slots with independent reproducible seeds, active-slot autosave, last-good backup recovery, and name-aware JSON export/import
- Persistent save activity feedback for unsaved, pending, successful and failed local writes
- v8 saves resume the player position, view direction, world seed and paused-safe world time
- Mobile virtual joystick, swipe-to-look camera, jump/break/place buttons and tappable hotbar
- Landscape-first phone experience with a rotate-device prompt in portrait mode
- Android shell via Capacitor
- Ubuntu Linux and Windows desktop shells via Electron Builder
- Two-page nine-slot hotbar plus a complete 18-material backpack and direct selection
- Beacon Trail exploration loop: follow named biome landmarks, collect their shards, repair visible Ark Core modules and strengthen night survival
- Single-player progression with tool tiers, exact recipe material availability, safe max-batch crafting, reward previews and bulk objective claiming
- Focused Journey, Backpack and Workshop expedition views that avoid long scrolling on short or low-resolution displays
- Four building patterns—single block, pillar, wall and platform—with atomic inventory checks, collision-safe batch placement and a single-draw preview
- Save-aware contextual onboarding for movement, mining, placement, backpack, crafting and landmark shards, with touch-specific compact help
- Four deterministic biomes with layered copper, gold, crystal and obsidian resources
- Budgeted biome and block-coordinate HUD with click-to-copy location sharing
- Worker-planned terrain, resident chunk eviction, and four-tier low-end device scaling
- Allocation-free packed integer block indexing at runtime with legacy string conversion only at the save boundary
- Hysteresis-based runtime performance guard that temporarily trims world work, lights and cosmetics during sustained frame pressure
- Persistent 30/60 FPS frame cap plus sound volume and mute controls
- Optional compact performance HUD with frame, world, draw-call and GPU resource diagnostics
- Health, cold-night damage and Ark recovery
- Dreamy day-night cycle
- Soft fog, shadows, stars, clouds, sparkles, animated water, swaying grass and emissive blocks
- Procedural pixel textures for every block type
- Small code modules for block definitions, procedural textures and terrain math
- Polished glassmorphism HUD and landing panel
- GitHub Pages friendly Vite setup

## Controls

| Action | Key |
|---|---|
| Move | WASD / mobile joystick |
| Look | Mouse / drag right side on mobile |
| Jump | Space / Jump button |
| Sprint | Left Shift |
| Break block | Left click |
| Place block | Right click |
| Switch building pattern | B / Game Menu → Expedition |
| Select material | 1-9 / mouse wheel / tap hotbar slot |
| Switch material palette | Tab / Palette button |
| Open backpack | E / Game Menu → Expedition |
| Rename / Save / Load / Recover / Export / Import / Reset | Game Menu → World |
| Open game menu / unlock mouse | Esc / II button |

## Development

Requires Node.js `^20.19.0` or `>=22.12.0`.

```bash
npm install
npm run dev
npm run verify
```

Set `ASTRA_SMOKE_ARTIFACT_DIR=artifacts/hud-smoke` before `npm run verify` to save HUD smoke screenshots and layout JSON.

## App packaging

```bash
# Ubuntu Linux AppImage + .deb
npm run dist:linux

# Windows installer for x64 and arm64
npm run dist:windows

# Single Windows architecture builds
npm run dist:windows:x64
npm run dist:windows:arm64

# Android debug APK
npm run android:build
```

GitHub `v*` tags publish release assets for Windows x64/arm64, Linux and Android APK. Desktop builds include a Check for Updates menu backed by GitHub Releases. See `PACKAGING.md` for platform-specific notes and output paths.

## Deployment

This repo includes GitHub Actions workflows for GitHub Pages and app package artifacts

1. Push to `main`
2. Open repo Settings → Pages
3. Set Source to **GitHub Actions** if it is not already enabled
4. The site deploys from `dist/`

## Project docs

- `GAME_DESIGN.md` — full design direction
- `PACKAGING.md` — platform packaging notes
- `docs/SINGLEPLAYER_ARCHITECTURE.md` — gameplay boundaries and the reserved multiplayer seam
- `docs/PERFORMANCE_ARCHITECTURE.md` — device tiers, Worker terrain, residency and frame budgets

## Roadmap

- Better chunk meshing for performance
- Richer crafting stations and larger structure templates
- Decorative plants and ruins
- Audio and ambient particles
- More polished screenshots and trailer GIF

## License

MIT
