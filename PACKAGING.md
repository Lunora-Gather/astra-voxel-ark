# AstraVoxel Ark packaging notes

AstraVoxel Ark is now structured as a landscape-first game app with one shared Vite/Three.js codebase and platform shells for:

- Web / GitHub Pages
- Android via Capacitor
- Ubuntu Linux via Electron Builder (`AppImage` and `.deb`)
- Windows via Electron Builder (`NSIS` installer) for x64 and arm64

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

# Windows packages for x64 and arm64, best run on a Windows GitHub Actions runner or Windows machine.
# Linux cross-builds require Wine for NSIS exe generation.
npm run dist:windows

# Windows single-architecture builds
npm run dist:windows:x64
npm run dist:windows:arm64

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
- Tag builds publish a GitHub Release containing Windows x64/arm64 installers, update metadata, Linux packages and Android APK.

## Updates

### Windows desktop

The packaged Electron app includes an **AstraVoxel Ark → Check for Updates** menu item. Installed Windows builds use `electron-updater` against GitHub Releases:

- publish a new `v*` tag;
- let the `Package Apps` workflow finish;
- keep the generated Windows `.exe`, `.blockmap` and `latest.yml` assets on the release.

The NSIS installer is the update-capable Windows package. Users can also use **Open Releases** from the app menu to download a newer build manually.

### Android

Android uses a separate Capacitor APK flow. The GitHub Release includes an `AstraVoxel-Ark-<tag>-android-debug.apk` asset for sideloading. Store distribution can use the same Capacitor Android project later, but store signing and Play/AppGallery update channels should be configured outside this repository's debug APK flow.

Recommended release flow:

1. Merge a verified pull request into `main`.
2. Confirm GitHub Pages deploy succeeds.
3. Bump `package.json` version and the visible `GAME_VERSION_LABEL` in `src/main.ts`.
4. Create and push a version tag such as `v1.4.1` when desktop/mobile artifacts are needed.
5. Inspect the published GitHub Release assets before announcing them externally.
