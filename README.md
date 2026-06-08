# AstraVoxel Ark / 星野方舟

A polished landscape-first voxel sandbox app built with **Vite + TypeScript + Three.js**, packaged for web, Android, Ubuntu Linux and Windows

玩家可以在梦幻体素浮岛中探索、挖方块、放方块、切换不同材质，并体验柔和日夜循环、雾效、水面、浮云、星光粒子与发光方块

## Play Online

**Play now:** https://wangjiehu.github.io/astra-voxel-ark/

![AstraVoxel Ark preview](docs/assets/preview.png)

## Features

- Procedural voxel island terrain
- First-person movement with pointer lock on desktop and touch controls on mobile
- Block breaking and placing via raycasting, with player-safe placement checks
- Local browser save/load/reset plus JSON export/import for changed worlds
- Mobile virtual joystick, swipe-to-look camera, jump/break/place buttons and tappable hotbar
- Landscape-first phone experience with a rotate-device prompt in portrait mode
- Android shell via Capacitor
- Ubuntu Linux and Windows desktop shells via Electron Builder
- 18-block hotbar with terrain, wood, water, crystal, glow, clay, metal and rare blocks
- Beacon Trail exploration loop: collect landmark shards, repair visible Ark Core modules and strengthen night survival
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
| Select block | 1-18 / mouse wheel / tap hotbar slot |
| Save / Load / Export / Import / Reset | Game Menu |
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

# Windows installer + portable exe
npm run dist:windows

# Android debug APK
npm run android:build
```

See `PACKAGING.md` for platform-specific notes and output paths

## Deployment

This repo includes GitHub Actions workflows for GitHub Pages and app package artifacts

1. Push to `main`
2. Open repo Settings → Pages
3. Set Source to **GitHub Actions** if it is not already enabled
4. The site deploys from `dist/`

## Project docs

- `GAME_DESIGN.md` — full design direction
- `PACKAGING.md` — platform packaging notes

## Roadmap

- Better chunk meshing for performance
- Named save slots
- Inventory and crafting
- Decorative plants and ruins
- Audio and ambient particles
- More polished screenshots and trailer GIF

## License

MIT
