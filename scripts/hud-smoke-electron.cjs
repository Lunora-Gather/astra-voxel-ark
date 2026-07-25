const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const smokeUrl = process.env.ASTRA_SMOKE_URL
const artifactDir = process.env.ASTRA_SMOKE_ARTIFACT_DIR ? path.resolve(process.env.ASTRA_SMOKE_ARTIFACT_DIR) : ''

if (!smokeUrl) {
  console.error('ASTRA_SMOKE_URL is required')
  process.exit(1)
}

const scenarios = [
  { label: 'desktop', width: 1366, height: 768 },
  { label: 'short-landscape', width: 667, height: 375 },
  { label: 'touch-landscape', width: 844, height: 390, touch: true },
  { label: 'touch-portrait', width: 390, height: 844, touch: true, portraitOnly: true },
]

const settingsKey = 'astra-voxel-ark-settings-v1'
const saveKey = 'astra-voxel-ark-world-v1'
const backupSaveKey = `${saveKey}-backup-v1`
const activeWorldSlotKey = 'astra-voxel-ark-active-world-slot-v1'
const secondSaveKey = `${saveKey}-slot-2`
const consoleIssues = []
const smokeArtifacts = []
const hardTimeout = setTimeout(() => {
  console.error('HUD smoke timed out inside Electron')
  writeArtifactSummary({ ok: false, error: 'HUD smoke timed out inside Electron', artifacts: smokeArtifacts })
  app.exit(1)
}, 75000)

if (artifactDir) fs.mkdirSync(artifactDir, { recursive: true })

function writeArtifactSummary(payload) {
  if (!artifactDir) return
  fs.mkdirSync(artifactDir, { recursive: true })
  fs.writeFileSync(path.join(artifactDir, 'summary.json'), JSON.stringify(payload, null, 2))
}

app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-background-timer-throttling')

function fail(message, details = {}) {
  const error = new Error(message)
  error.details = details
  throw error
}

function attachDiagnostics(win) {
  win.webContents.on('console-message', (_event, levelOrDetails, message, line, sourceId) => {
    const details = typeof levelOrDetails === 'object'
      ? levelOrDetails
      : { level: levelOrDetails, message, line, sourceId }
    const level = typeof details.level === 'number' ? details.level : 0
    const text = String(details.message || '')
    if (level >= 3 || /\b(uncaught|exception|error)\b/i.test(text)) {
      consoleIssues.push({
        level,
        message: text,
        line: details.line,
        sourceId: details.sourceId,
      })
    }
  })
  win.webContents.on('render-process-gone', (_event, details) => {
    consoleIssues.push({
      level: 3,
      message: `render-process-gone: ${details.reason}`,
      exitCode: details.exitCode,
    })
  })
  win.webContents.on('unresponsive', () => {
    consoleIssues.push({
      level: 3,
      message: 'renderer became unresponsive',
    })
  })
}

async function waitForLoad(win, url, timeoutMs = 45000) {
  const startedAt = Date.now()
  let loadError = null
  win.loadURL(url).catch((error) => {
    loadError = error
  })
  while (Date.now() - startedAt < timeoutMs) {
    if (win.isDestroyed() || win.webContents.isDestroyed()) {
      throw new Error(`Window was destroyed while loading ${url}`)
    }
    try {
      const pageState = await win.webContents.executeJavaScript(`
        ({
          readyState: document.readyState,
          appReady: !!document.querySelector('#app .hud'),
          href: location.href
        })
      `, true)
      if (pageState.href === url && (pageState.readyState === 'interactive' || pageState.readyState === 'complete') && pageState.appReady) {
        await new Promise((resolve) => setTimeout(resolve, 250))
        return
      }
    } catch {
      if (loadError) throw loadError
    }
    if (loadError && Date.now() - startedAt > 2000) throw loadError
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out loading ${url}`)
}

async function setViewport(win, scenario) {
  win.setBounds({ x: 0, y: 0, width: scenario.width, height: scenario.height })
  win.webContents.setZoomFactor(1)
  await new Promise((resolve) => setTimeout(resolve, 120))
}

function scenarioUrl(scenario, suffix) {
  const params = new URLSearchParams()
  params.set('smoke', scenario.label)
  params.set(suffix, String(Date.now()))
  if (scenario.touch) params.set('touch', '1')
  else params.set('touch', '0')
  const marker = params.toString()
  return smokeUrl.startsWith('file:') ? `${smokeUrl}#${marker}` : `${smokeUrl}?${marker}`
}

async function resetScenario(win, scenario) {
  await setViewport(win, scenario)
  await win.webContents.session.clearStorageData({ storages: ['localstorage'] })
  await waitForLoad(win, scenarioUrl(scenario, 't'))
  await win.webContents.executeJavaScript(`localStorage.removeItem(${JSON.stringify(settingsKey)})`)
  await waitForLoad(win, scenarioUrl(scenario, 'clean'))
}

async function click(win, selector) {
  await win.webContents.executeJavaScript(`
    (() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) throw new Error('Missing selector: ${selector}');
      element.click();
    })()
  `)
  await new Promise((resolve) => setTimeout(resolve, 180))
}

async function setRange(win, selector, value) {
  await win.webContents.executeJavaScript(`
    (() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) throw new Error('Missing selector: ${selector}');
      element.value = ${JSON.stringify(String(value))};
      element.dispatchEvent(new Event('input', { bubbles: true }));
    })()
  `)
}

async function setSelect(win, selector, value) {
  await win.webContents.executeJavaScript(`
    (() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) throw new Error('Missing selector: ${selector}');
      element.value = ${JSON.stringify(String(value))};
      element.dispatchEvent(new Event('change', { bubbles: true }));
    })()
  `)
}

async function setCheckbox(win, selector, checked) {
  await win.webContents.executeJavaScript(`
    (() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) throw new Error('Missing selector: ${selector}');
      element.checked = ${checked ? 'true' : 'false'};
      element.dispatchEvent(new Event('change', { bubbles: true }));
    })()
  `)
}

async function readSavedWorld(win) {
  return win.webContents.executeJavaScript(`
    (() => {
      const raw = localStorage.getItem(${JSON.stringify(saveKey)});
      if (!raw) return null;
      return JSON.parse(raw);
    })()
  `)
}

async function writeSavedWorld(win, payload) {
  await win.webContents.executeJavaScript(`
    localStorage.setItem(${JSON.stringify(saveKey)}, ${JSON.stringify(JSON.stringify(payload))})
  `)
}

async function readState(win, label) {
  return win.webContents.executeJavaScript(`
    (() => {
      const visible = (selector) => {
        const el = document.querySelector(selector);
        if (!el) return false;
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || '1') > 0.01 && rect.width > 0 && rect.height > 0;
      };
      const rectOf = (selector) => {
        const el = document.querySelector(selector);
        if (!el || !visible(selector)) return null;
        const rect = el.getBoundingClientRect();
        return { selector, left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
      };
      const viewport = { width: innerWidth, height: innerHeight };
      const fullyVisible = (rect) => !!rect && rect.left >= -1 && rect.top >= -1 && rect.right <= viewport.width + 1 && rect.bottom <= viewport.height + 1;
      const intersects = (a, b, gap = 4) => !(a.right + gap <= b.left || b.right + gap <= a.left || a.bottom + gap <= b.top || b.bottom + gap <= a.top);
      const visibleCount = (selector) => [...document.querySelectorAll(selector)].filter((el) => {
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || '1') > 0.01 && rect.width > 0 && rect.height > 0;
      }).length;
      const rects = ['.hud-left-stack', '.hud-right-stack', '.hotbar', '.menu-toggle-btn', '.block-info', '.joystick', '.touch-actions']
        .map(rectOf)
        .filter(Boolean);
      const overlaps = [];
      for (let i = 0; i < rects.length; i += 1) {
        for (let j = i + 1; j < rects.length; j += 1) {
          if (intersects(rects[i], rects[j])) overlaps.push([rects[i].selector, rects[j].selector]);
        }
      }
      return {
        label: ${JSON.stringify(label)},
        viewport,
        bodyClasses: document.body.className,
        density: document.body.dataset.hudDensity || null,
        startVisible: visible('.start'),
        rotatePromptVisible: visible('.rotate-prompt'),
        rotatePromptFullyVisible: fullyVisible(rectOf('.rotate-prompt > div')),
        menuOpen: !document.querySelector('.pause-menu')?.classList.contains('hidden'),
        activeMenuTab: document.querySelector('.menu-tab.active')?.dataset.menuTab || null,
        menuTabsVisible: visibleCount('.menu-tab'),
        expeditionVisible: visible('.expedition-panel'),
        settingsVisible: visible('.settings-grid'),
        pointerLocked: document.pointerLockElement === document.querySelector('canvas'),
        leftStackVisible: visible('.hud-left-stack'),
        rightStackVisible: visible('.hud-right-stack'),
        menuButtonVisible: visible('.menu-toggle-btn'),
        saveToolsVisible: visible('.save-tools'),
        saveToolButtons: document.querySelectorAll('.pause-menu .save-tools button').length,
        saveToolsFullyVisible: [...document.querySelectorAll('.pause-menu .save-tools button')].every((button) => fullyVisible(rectOf('.' + button.className.split(' ').join('.')))),
        recoverDisabled: document.querySelector('.recover-btn')?.disabled ?? true,
        toastText: document.querySelector('.toast')?.textContent?.trim() || '',
        worldSlotsVisible: visibleCount('.world-slot'),
        activeWorldSlots: document.querySelectorAll('.world-slot.active').length,
        worldSlotsFullyVisible: [...document.querySelectorAll('.world-slot')].every((button) => fullyVisible(rectOf('.world-slot[data-world-slot="' + button.dataset.worldSlot + '"]'))),
        activeWorldSlot: document.querySelector('.world-slot.active')?.dataset.worldSlot || null,
        perfVisible: visible('.perf-badge'),
        perfRect: rectOf('.perf-badge'),
        perfFullyVisible: !visible('.perf-badge') || fullyVisible(rectOf('.perf-badge')),
        perfRows: document.querySelectorAll('.perf-badge .perf-row').length,
        perfFps: Number(document.querySelector('.perf-fps')?.textContent) || 0,
        perfRender: {
          calls: document.querySelector('.perf-calls')?.textContent?.trim() || '',
          triangles: document.querySelector('.perf-triangles')?.textContent?.trim() || '',
          geometries: document.querySelector('.perf-geometries')?.textContent?.trim() || '',
          textures: document.querySelector('.perf-textures')?.textContent?.trim() || '',
        },
        hotbarVisible: visible('.hotbar'),
        hotbarSlots: document.querySelectorAll('.slot').length,
        activeSlots: document.querySelectorAll('.slot.active').length,
        hotbarPageButtons: document.querySelectorAll('.hotbar-page').length,
        hotbarPage: document.querySelector('.hotbar')?.dataset.page || null,
        inventoryCards: document.querySelectorAll('.inventory-card').length,
        activeInventoryCards: document.querySelectorAll('.inventory-card.active').length,
        mobileControlsVisible: visible('.mobile-controls'),
        joystickVisible: visible('.joystick'),
        touchActionsVisible: visible('.touch-actions'),
        touchButtonsVisible: visibleCount('.touch-btn'),
        joystickRect: rectOf('.joystick'),
        touchButtonRects: [...document.querySelectorAll('.touch-btn')].map((button) => {
          const rect = button.getBoundingClientRect();
          const style = getComputedStyle(button);
          return {
            text: button.textContent.trim(),
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
            visible: style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || '1') > 0.01,
          };
        }),
        pressedTouchButtons: document.querySelectorAll('.touch-btn.pressed').length,
        mineProgressVisible: visible('.mine-progress'),
        panelFullyVisible: fullyVisible(rectOf('.pause-panel')),
        saveButtonFullyVisible: fullyVisible(rectOf('.pause-menu .save-tools button')),
        worldSeedFullyVisible: fullyVisible(rectOf('.world-seed')),
        worldSeedLabel: document.querySelector('.world-seed strong')?.textContent?.trim() || null,
        outside: rects.filter((rect) => !fullyVisible(rect)),
        settings: {
          sensitivity: document.querySelector('.sensitivity-input')?.value,
          fov: document.querySelector('.fov-input')?.value,
          viewDistance: document.querySelector('.view-distance-select')?.value,
          quality: document.querySelector('.quality-btn.active')?.dataset.quality,
          perf: document.querySelector('.perf-toggle')?.checked,
          frameRate: document.querySelector('.frame-rate-select')?.value,
          frameRateApplied: document.body.dataset.frameRate,
          volume: document.querySelector('.volume-input')?.value,
          soundEnabled: document.querySelector('.sound-toggle')?.checked,
        },
        overlaps,
      };
    })()
  `)
}

function assertGameplayState(state) {
  if (state.hotbarSlots !== 9) fail('Hotbar should expose one focused nine-slot palette', state)
  if (state.activeSlots !== 1) fail('Hotbar should have exactly one active slot', state)
  if (state.hotbarPageButtons !== 1) fail('Hotbar should expose one palette switch control', state)
  if (state.overlaps.length) fail('HUD elements overlap in gameplay', state)
  if (state.outside.length) fail('HUD elements should stay inside the viewport', state)
  if (state.saveToolsVisible) fail('Save tools should be hidden during gameplay', state)
  if (state.perfVisible) fail('Performance HUD should be hidden by default', state)
  if (state.pressedTouchButtons) fail('Touch buttons should not remain pressed after input reset', state)
  if (state.mineProgressVisible) fail('Mining progress should not remain visible after input reset', state)
}

function assertMenuState(state) {
  if (!state.menuOpen) fail('Pause menu should be open', state)
  if (!state.panelFullyVisible) fail('Pause panel should fit in the viewport', state)
  if (state.menuTabsVisible !== 3) fail('Pause menu should expose three navigation tabs', state)
  if (state.overlaps.length) fail('HUD elements overlap while menu is open', state)
  if (state.pointerLocked) fail('Pointer lock should be released while the pause menu is open', state)
}

async function reloadAtUrl(win, url, timeoutMs = 45000) {
  await win.loadURL(url)
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error(`Timed out reloading ${url}`))
    }, timeoutMs)
    const cleanup = () => {
      clearTimeout(timer)
      win.webContents.removeListener('did-finish-load', onFinish)
      win.webContents.removeListener('did-fail-load', onFail)
    }
    const onFinish = () => {
      cleanup()
      resolve()
    }
    const onFail = (_event, code, description) => {
      cleanup()
      reject(new Error(`Failed to reload ${url}: ${code} ${description}`))
    }
    win.webContents.once('did-finish-load', onFinish)
    win.webContents.once('did-fail-load', onFail)
    win.webContents.reloadIgnoringCache()
  })
  await waitForLoad(win, url, timeoutMs)
}

async function pressKey(win, code, key = '') {
  await win.webContents.executeJavaScript(`
    document.dispatchEvent(new KeyboardEvent('keydown', { code: ${JSON.stringify(code)}, key: ${JSON.stringify(key)}, bubbles: true, cancelable: true }))
  `)
  await new Promise((resolve) => setTimeout(resolve, 180))
}

async function readStorageJson(win, key) {
  return win.webContents.executeJavaScript(`
    (() => {
      const raw = localStorage.getItem(${JSON.stringify(key)});
      return raw ? JSON.parse(raw) : null;
    })()
  `)
}

function assertWorldMenuState(state) {
  assertMenuState(state)
  if (state.activeMenuTab !== 'world') fail('World tab should be active', state)
  if (!state.saveToolsVisible) fail('Save tools should be visible on the World tab', state)
  if (!state.saveButtonFullyVisible) fail('Save buttons should fit on the World tab', state)
  if (state.saveToolButtons !== 6 || !state.saveToolsFullyVisible) fail('All six world save controls should fit in the viewport', state)
  if (state.worldSlotsVisible !== 3 || state.activeWorldSlots !== 1) fail('World tab should expose three slots with one active slot', state)
  if (!state.worldSlotsFullyVisible) fail('World slot controls should fit in the viewport', state)
  if (!state.worldSeedFullyVisible || !/^[0-9A-F]{8}$/.test(state.worldSeedLabel || '')) fail('World seed control should be visible and formatted', state)
}

function assertTouchLandscapeState(state) {
  if (!state.bodyClasses.includes('touch-layout') || !state.bodyClasses.includes('landscape-layout')) {
    fail('Touch landscape should use touch and landscape layout classes', state)
  }
  if (state.density !== 'minimal') fail('Touch landscape should use minimal HUD density', state)
  if (!state.mobileControlsVisible || !state.joystickVisible || !state.touchActionsVisible || state.touchButtonsVisible !== 3) {
    fail('Touch landscape controls should be visible and complete', state)
  }
  if (!state.joystickRect || state.joystickRect.width < 88 || state.joystickRect.height < 88) {
    fail('Touch joystick should keep a comfortable control area', state)
  }
  const smallButtons = state.touchButtonRects.filter((rect) => rect.visible && (rect.width < 48 || rect.height < 48))
  if (smallButtons.length) fail('Touch action buttons should keep comfortable tap targets', { smallButtons, state })
}

function assertTouchPortraitState(state) {
  if (!state.bodyClasses.includes('portrait-touch')) fail('Touch portrait should use the portrait prompt layout', state)
  if (!state.rotatePromptVisible || !state.rotatePromptFullyVisible) fail('Rotate prompt should be visible and fit in portrait touch layout', state)
  if (state.hotbarVisible || state.joystickVisible || state.touchActionsVisible || state.menuButtonVisible) {
    fail('Gameplay HUD controls should stay hidden behind the portrait rotate prompt', state)
  }
  if (state.leftStackVisible || state.rightStackVisible) fail('HUD stacks should be hidden in portrait touch layout', state)
}

async function captureArtifact(win, scenario, phase, state) {
  if (!artifactDir) return null
  const baseName = `${scenario.label}-${phase}`.replace(/[^a-z0-9._-]+/gi, '-')
  const screenshot = path.join(artifactDir, `${baseName}.png`)
  const stateJson = path.join(artifactDir, `${baseName}.json`)
  await win.webContents.executeJavaScript(`
    new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  `)
  const image = await win.webContents.capturePage()
  fs.writeFileSync(screenshot, image.toPNG())
  fs.writeFileSync(stateJson, JSON.stringify({ scenario: scenario.label, phase, state }, null, 2))
  const artifact = {
    scenario: scenario.label,
    phase,
    screenshot: path.relative(artifactDir, screenshot),
    state: path.relative(artifactDir, stateJson),
  }
  smokeArtifacts.push(artifact)
  return artifact
}

function assertSavedWorld(payload, label) {
  if (!payload || typeof payload !== 'object') fail(`${label}: saved world should exist`, { payload })
  if (!Array.isArray(payload.blocks)) fail(`${label}: saved world should include a player block delta array`, payload)
  if (!Array.isArray(payload.terrainChunks) || payload.terrainChunks.length === 0) fail(`${label}: saved world should include explored terrain chunks`, payload)
  if (!payload.inventory || typeof payload.inventory !== 'object') fail(`${label}: saved world should include inventory counts`, payload)
  if (!payload.survival || typeof payload.survival.crystalPower !== 'number') fail(`${label}: saved world should include survival state`, payload)
  if (!payload.exploration || typeof payload.exploration.glowShards !== 'number') fail(`${label}: saved world should include exploration state`, payload)
  if (!payload.player || !Array.isArray(payload.player.position) || payload.player.position.length !== 3) fail(`${label}: saved world should include player position`, payload)
  if (!Array.isArray(payload.player.rotation) || payload.player.rotation.length !== 2) fail(`${label}: saved world should include player rotation`, payload)
  if (typeof payload.worldTime !== 'number') fail(`${label}: saved world should include simulation time`, payload)
  if (typeof payload.selectedBlock !== 'string') fail(`${label}: saved world should include selected material`, payload)
  if (typeof payload.worldSeed !== 'number') fail(`${label}: saved world should include a numeric world seed`, payload)
}

async function smokeSaveLoad(win, scenario) {
  if (scenario.label !== 'desktop') return
  await click(win, '.save-btn')
  const saved = await readSavedWorld(win)
  assertSavedWorld(saved, `${scenario.label}:save`)
  if (saved.worldSeed === 0) fail('A newly created world should receive a non-legacy seed', { saved })
  await click(win, '.save-btn')
  const backup = await readStorageJson(win, backupSaveKey)
  assertSavedWorld(backup, `${scenario.label}:backup`)
  await win.webContents.executeJavaScript(`localStorage.setItem(${JSON.stringify(saveKey)}, '{broken')`)
  await click(win, '.recover-btn')
  const recovered = await readSavedWorld(win)
  assertSavedWorld(recovered, `${scenario.label}:recovered`)
  await win.webContents.executeJavaScript(`
    window.__astraOriginalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === ${JSON.stringify(saveKey)}) throw new DOMException('Quota exceeded', 'QuotaExceededError');
      return window.__astraOriginalSetItem.call(this, key, value);
    };
    void 0;
  `)
  await click(win, '.save-btn')
  await win.webContents.executeJavaScript(`
    Storage.prototype.setItem = window.__astraOriginalSetItem;
    delete window.__astraOriginalSetItem;
    void 0;
  `)
  const failedSaveState = await readState(win, `${scenario.label}:failed-save`)
  if (!failedSaveState.toastText.includes('Save failed')) fail('Storage write failures should produce recoverable UI feedback', failedSaveState)
  await click(win, '.reset-btn')
  await click(win, '.reset-btn')
  const cleared = await readSavedWorld(win)
  if (cleared) fail('Reset should remove the local saved world', { cleared })
  const clearedBackup = await readStorageJson(win, backupSaveKey)
  if (clearedBackup) fail('New World should remove the previous slot backup', { clearedBackup })
  const rerolledWorld = await readState(win, `${scenario.label}:rerolled-world`)
  const previousSeedLabel = saved.worldSeed.toString(16).toUpperCase().padStart(8, '0')
  if (rerolledWorld.worldSeedLabel === previousSeedLabel) fail('New World should reroll the active world seed', { previousSeedLabel, rerolledWorld })
  const resumeState = {
    ...saved,
    player: { position: [2, 15, 12], rotation: [0.2, 0.4] },
    worldTime: 42,
  }
  delete resumeState.worldSeed
  await writeSavedWorld(win, resumeState)
  await click(win, '.load-btn')
  await new Promise((resolve) => setTimeout(resolve, 220))
  await click(win, '.save-btn')
  const loaded = await readSavedWorld(win)
  assertSavedWorld(loaded, `${scenario.label}:load`)
  if (loaded.blocks.length !== saved.blocks.length) fail('Loaded world should preserve saved block count', { saved: saved.blocks.length, loaded: loaded.blocks.length })
  if (loaded.player.position.some((value, index) => Math.abs(value - resumeState.player.position[index]) > 0.001)) {
    fail('Loaded world should restore the player position', { expected: resumeState.player.position, actual: loaded.player.position })
  }
  if (loaded.player.rotation.some((value, index) => Math.abs(value - resumeState.player.rotation[index]) > 0.001)) {
    fail('Loaded world should restore the player rotation', { expected: resumeState.player.rotation, actual: loaded.player.rotation })
  }
  if (loaded.worldTime !== resumeState.worldTime) {
    fail('Paused world should not advance simulation time', { expected: resumeState.worldTime, actual: loaded.worldTime })
  }
  if (loaded.worldSeed !== 0) fail('Pre-v8 saves without a seed should retain legacy terrain seed 0', { loaded })
  await waitForLoad(win, scenarioUrl(scenario, 'saved-boot'))
  const booted = await readSavedWorld(win)
  assertSavedWorld(booted, `${scenario.label}:saved-boot`)
  const bootState = await readState(win, `${scenario.label}:saved-boot-state`)
  if (bootState.hotbarPage !== '2') fail('Saved material selection should restore its hotbar palette', bootState)
  await click(win, '.start button')
  await click(win, '.menu-toggle-btn')
  await click(win, '.menu-tab[data-menu-tab="world"]')
  await click(win, '.world-slot[data-world-slot="2"]')
  const activeSecondSlot = await win.webContents.executeJavaScript(`localStorage.getItem(${JSON.stringify(activeWorldSlotKey)})`)
  if (activeSecondSlot !== '2') fail('Selecting a world slot should persist the active slot', { activeSecondSlot })
  const emptySecondSlot = await readStorageJson(win, secondSaveKey)
  if (emptySecondSlot) fail('Selecting an empty slot should create a fresh unsaved world', { emptySecondSlot })
  await click(win, '.save-btn')
  const savedSecondSlot = await readStorageJson(win, secondSaveKey)
  assertSavedWorld(savedSecondSlot, `${scenario.label}:slot-2-save`)
  if (savedSecondSlot.worldSeed === 0 || savedSecondSlot.worldSeed === loaded.worldSeed) {
    fail('A fresh second slot should own an independent non-legacy world seed', { first: loaded.worldSeed, second: savedSecondSlot.worldSeed })
  }
  await click(win, '.world-slot[data-world-slot="1"]')
  const restoredFirstSlot = await readSavedWorld(win)
  assertSavedWorld(restoredFirstSlot, `${scenario.label}:slot-1-return`)
  const activeFirstSlot = await win.webContents.executeJavaScript(`localStorage.getItem(${JSON.stringify(activeWorldSlotKey)})`)
  if (activeFirstSlot !== '1') fail('Returning to slot 1 should persist the legacy-compatible slot', { activeFirstSlot })
}

async function runScenario(win, scenario) {
  consoleIssues.length = 0
  await resetScenario(win, scenario)
  const initial = await readState(win, `${scenario.label}:initial`)
  if (!initial.startVisible && !initial.rotatePromptVisible) fail('Start or rotate prompt should be visible before play', initial)
  if (scenario.portraitOnly) {
    assertTouchPortraitState(initial)
    const artifact = await captureArtifact(win, scenario, 'portrait', initial)
    if (consoleIssues.length) fail('Console or renderer issues detected', { scenario: scenario.label, consoleIssues })
    return { scenario: scenario.label, density: initial.density, classes: initial.bodyClasses, artifacts: artifact ? [artifact] : [] }
  }
  await click(win, '.start button')
  const gameplay = await readState(win, `${scenario.label}:gameplay`)
  assertGameplayState(gameplay)
  if (scenario.touch) assertTouchLandscapeState(gameplay)
  await click(win, '.hotbar-page')
  const secondPalette = await readState(win, `${scenario.label}:palette-2`)
  if (secondPalette.hotbarPage !== '2' || secondPalette.activeSlots !== 1) fail('Palette control should switch to the second nine-slot page', secondPalette)
  await click(win, '.hotbar-page')
  if (scenario.label === 'desktop') {
    await pressKey(win, 'Tab', 'Tab')
    const keyboardPalette = await readState(win, `${scenario.label}:keyboard-palette`)
    if (keyboardPalette.hotbarPage !== '2') fail('Tab should switch the active material palette', keyboardPalette)
    await pressKey(win, 'Tab', 'Tab')
  }
  const artifacts = []
  const gameplayArtifact = await captureArtifact(win, scenario, 'gameplay', gameplay)
  if (gameplayArtifact) artifacts.push(gameplayArtifact)
  await click(win, '.menu-toggle-btn')
  const menu = await readState(win, `${scenario.label}:menu`)
  assertMenuState(menu)
  if (menu.activeMenuTab !== 'settings' || !menu.settingsVisible || menu.saveToolsVisible) {
    fail('Pause menu should open on the focused Settings tab', menu)
  }
  if (scenario.touch) assertTouchLandscapeState(menu)
  const menuArtifact = await captureArtifact(win, scenario, 'menu', menu)
  if (menuArtifact) artifacts.push(menuArtifact)
  await click(win, '.menu-tab[data-menu-tab="expedition"]')
  const expeditionMenu = await readState(win, `${scenario.label}:expedition-menu`)
  if (expeditionMenu.activeMenuTab !== 'expedition' || !expeditionMenu.expeditionVisible) {
    fail('Expedition tab should expose progression content', expeditionMenu)
  }
  if (expeditionMenu.inventoryCards !== 18 || expeditionMenu.activeInventoryCards !== 1) {
    fail('Expedition tab should expose the complete backpack with one selected material', expeditionMenu)
  }
  await click(win, '.inventory-card[data-inventory-block="gold"]')
  const backpackSelection = await readState(win, `${scenario.label}:backpack-selection`)
  if (backpackSelection.hotbarPage !== '2' || backpackSelection.activeInventoryCards !== 1) {
    fail('Backpack selection should activate the matching hotbar palette', backpackSelection)
  }
  await click(win, '.menu-tab[data-menu-tab="world"]')
  const worldMenu = await readState(win, `${scenario.label}:world-menu`)
  assertWorldMenuState(worldMenu)
  await smokeSaveLoad(win, scenario)
  await click(win, '.menu-tab[data-menu-tab="settings"]')
  await setRange(win, '.sensitivity-input', 95)
  await setRange(win, '.fov-input', 80)
  const tunedViewDistance = await win.webContents.executeJavaScript(`
    [...document.querySelectorAll('.view-distance-select option')].filter((option) => !option.disabled).at(-1)?.value || '1'
  `)
  await setSelect(win, '.view-distance-select', tunedViewDistance)
  const tunedFrameRate = '30'
  await setSelect(win, '.frame-rate-select', tunedFrameRate)
  await setRange(win, '.volume-input', 25)
  await click(win, '.quality-btn[data-quality="low"]')
  await setCheckbox(win, '.perf-toggle', true)
  await setCheckbox(win, '.sound-toggle', false)
  const tuned = await readState(win, `${scenario.label}:settings-tuned`)
  if (!tuned.perfVisible) fail('Performance HUD toggle should show the perf badge', tuned)
  if (!tuned.perfFullyVisible || tuned.perfRows !== 3) fail('Three-row performance diagnostics should fit inside the viewport', tuned)
  if (tuned.perfFps <= 0) fail('Performance HUD should show the latest FPS sample immediately when enabled', tuned)
  if (!Object.values(tuned.perfRender).every((value) => /^\d+(?:\.\d+)?[km]?$/.test(value))) {
    fail('Performance diagnostics should expose formatted draw, triangle, geometry and texture metrics', tuned)
  }
  if (tuned.perfRender.calls === '0' || tuned.perfRender.geometries === '0') {
    fail('Performance diagnostics should report the latest rendered frame and allocated geometries', tuned)
  }
  if (tuned.settings.sensitivity !== '95' || tuned.settings.fov !== '80' || tuned.settings.viewDistance !== tunedViewDistance || tuned.settings.quality !== 'low' || tuned.settings.frameRate !== tunedFrameRate || tuned.settings.frameRateApplied !== tunedFrameRate || tuned.settings.volume !== '25' || tuned.settings.soundEnabled !== false) {
    fail('Settings controls should apply immediately', tuned)
  }
  const persistedSettings = await readStorageJson(win, settingsKey)
  if (String(persistedSettings?.frameRate) !== tunedFrameRate || persistedSettings?.volume !== 25 || persistedSettings?.soundEnabled !== false) {
    fail('Frame-rate and audio settings should persist locally', { persistedSettings, tunedFrameRate })
  }
  if (scenario.label === 'desktop') {
    await win.webContents.executeJavaScript(`
      window.__astraOriginalSettingsSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        if (key === ${JSON.stringify(settingsKey)}) throw new DOMException('Quota exceeded', 'QuotaExceededError');
        return window.__astraOriginalSettingsSetItem.call(this, key, value);
      };
      void 0;
    `)
    await setRange(win, '.volume-input', 26)
    await win.webContents.executeJavaScript(`
      Storage.prototype.setItem = window.__astraOriginalSettingsSetItem;
      delete window.__astraOriginalSettingsSetItem;
      void 0;
    `)
    const failedSettingsState = await readState(win, `${scenario.label}:failed-settings-write`)
    const settingsAfterFailedWrite = await readStorageJson(win, settingsKey)
    if (failedSettingsState.settings.volume !== '26' || !failedSettingsState.toastText.includes('could not save locally')) {
      fail('Settings should still apply with clear feedback when local persistence fails', failedSettingsState)
    }
    if (settingsAfterFailedWrite?.volume !== 25) {
      fail('A failed settings write should preserve the previous stored configuration', settingsAfterFailedWrite)
    }
  }
  await setRange(win, '.sensitivity-input', 72)
  await setRange(win, '.fov-input', 72)
  await setSelect(win, '.view-distance-select', 1)
  await setSelect(win, '.frame-rate-select', gameplay.settings.frameRate)
  await setRange(win, '.volume-input', 70)
  await click(win, '.quality-btn[data-quality="balanced"]')
  await setCheckbox(win, '.perf-toggle', false)
  await setCheckbox(win, '.sound-toggle', true)
  await click(win, '.resume-btn')
  const closed = await readState(win, `${scenario.label}:closed`)
  if (closed.menuOpen) fail('Pause menu should close on Resume', closed)
  assertGameplayState(closed)
  if (scenario.touch) assertTouchLandscapeState(closed)
  if (scenario.label === 'desktop') {
    await pressKey(win, 'KeyE', 'e')
    const keyboardBackpack = await readState(win, `${scenario.label}:keyboard-backpack`)
    if (!keyboardBackpack.menuOpen || keyboardBackpack.activeMenuTab !== 'expedition') fail('E should open the backpack directly', keyboardBackpack)
    await pressKey(win, 'KeyE', 'e')
    const keyboardBackpackClosed = await readState(win, `${scenario.label}:keyboard-backpack-closed`)
    if (keyboardBackpackClosed.menuOpen) fail('E should close the focused backpack', keyboardBackpackClosed)

    await win.webContents.executeJavaScript(`localStorage.setItem(${JSON.stringify(settingsKey)}, JSON.stringify({ mouseLookSpeed: 0.95, fov: 80, viewDistance: 999, qualityPreset: 'low', showPerformanceHud: true, frameRate: 30, volume: 25, soundEnabled: false }))`)
    await reloadAtUrl(win, scenarioUrl(scenario, 'legacy-settings'))
    const migratedSettings = await readState(win, `${scenario.label}:legacy-settings`)
    if (migratedSettings.settings.sensitivity !== '95' || migratedSettings.settings.fov !== '80' || migratedSettings.settings.viewDistance !== tunedViewDistance || migratedSettings.settings.quality !== 'low' || migratedSettings.settings.frameRate !== '30' || migratedSettings.settings.volume !== '25' || migratedSettings.settings.soundEnabled !== false) {
      fail('Legacy settings should migrate and clamp to the active device limits', migratedSettings)
    }

    await win.webContents.executeJavaScript(`localStorage.setItem(${JSON.stringify(settingsKey)}, '{broken')`)
    await reloadAtUrl(win, scenarioUrl(scenario, 'broken-settings'))
    const recoveredSettings = await readState(win, `${scenario.label}:broken-settings`)
    if (recoveredSettings.settings.sensitivity !== '72' || recoveredSettings.settings.fov !== '72' || recoveredSettings.settings.viewDistance !== '1' || recoveredSettings.settings.quality !== 'balanced' || recoveredSettings.settings.volume !== '70' || recoveredSettings.settings.soundEnabled !== true) {
      fail('Damaged settings should recover to safe runtime defaults', recoveredSettings)
    }
  }
  if (consoleIssues.length) fail('Console or renderer issues detected', { scenario: scenario.label, consoleIssues })
  return { scenario: scenario.label, density: closed.density, classes: closed.bodyClasses, artifacts }
}

app.whenReady().then(async () => {
  try {
    const results = []
    for (const scenario of scenarios) {
      const win = new BrowserWindow({
        show: false,
        width: scenario.width,
        height: scenario.height,
        paintWhenInitiallyHidden: true,
        webPreferences: {
          contextIsolation: true,
          sandbox: false,
        },
      })
      attachDiagnostics(win)
      results.push(await runScenario(win, scenario))
      if (!win.isDestroyed()) win.destroy()
    }
    const summary = { ok: true, results, artifacts: smokeArtifacts }
    writeArtifactSummary(summary)
    console.log(JSON.stringify(summary, null, 2))
    clearTimeout(hardTimeout)
    app.exit(0)
  } catch (error) {
    console.error(error.message)
    if (error.details) console.error(JSON.stringify(error.details, null, 2))
    writeArtifactSummary({
      ok: false,
      error: error.message,
      details: error.details ?? null,
      consoleIssues,
      artifacts: smokeArtifacts,
    })
    clearTimeout(hardTimeout)
    app.exit(1)
  }
})

app.on('window-all-closed', () => {
  // Keep the smoke runner alive while it iterates through multiple viewport scenarios.
})
