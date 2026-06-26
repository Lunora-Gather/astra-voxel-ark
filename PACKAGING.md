# AstraVoxel Ark packaging notes

AstraVoxel Ark is now structured as a landscape-first game app with one shared Vite/Three.js codebase and platform shells for:

- Web / GitHub Pages
- Android via Capacitor
- Ubuntu Linux via Electron Builder (`AppImage` and `.deb`)
- Windows via Electron Builder (`NSIS` installer and portable `.exe`)

## Orientation

The game is designed for landscape play. Phones show a rotate-device overlay in portrait mode. Android is configured for landscape orientation in `android/app/src/main/AndroidManifest.xml` after the Android project is generated.

## Local commands

```bash
npm install
npm run typecheck
npm run build
npm run verify

# Desktop app, local smoke test
npm run electron:dev

# Ubuntu Linux packages
npm run dist:linux

# Windows packages, best run on a Windows GitHub Actions runner or Windows machine.
# Linux cross-builds require Wine for NSIS/portable exe generation.
npm run dist:windows

# Android project sync/build. Requires a full JDK with javac, not only a JRE.
npm run android:sync
npm run android:build
```

## Output folders

- Web build: `dist/`
- Desktop installers/packages: `release/`
- Android debug APK after build: `android/app/build/outputs/apk/debug/app-debug.apk`

Generated outputs are ignored by git. GitHub Actions can build and upload them as workflow artifacts.

## GitHub Actions

- `Verify` runs typecheck, build and HUD smoke testing for pull requests and optimization branches.
- `Deploy to GitHub Pages` builds and publishes the web app from `main`.
- `Package Apps` can be run manually or from `v*` tags to produce Linux, Windows and Android artifacts.

Recommended release flow:

1. Merge a verified pull request into `main`.
2. Confirm GitHub Pages deploy succeeds.
3. Create a version tag such as `v1.4.1` when desktop/mobile artifacts are needed.
4. Run or inspect the `Package Apps` workflow artifacts before publishing them externally.
