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
      if ((pageState.readyState === 'interactive' || pageState.readyState === 'complete') && pageState.appReady) {
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
        pointerLocked: document.pointerLockElement === document.querySelector('canvas'),
        leftStackVisible: visible('.hud-left-stack'),
        rightStackVisible: visible('.hud-right-stack'),
        menuButtonVisible: visible('.menu-toggle-btn'),
        saveToolsVisible: visible('.save-tools'),
        perfVisible: visible('.perf-badge'),
        hotbarVisible: visible('.hotbar'),
        hotbarSlots: document.querySelectorAll('.slot').length,
        activeSlots: document.querySelectorAll('.slot.active').length,
        mobileControlsVisible: visible('.mobile-controls'),
        joystickVisible: visible('.joystick'),
        touchActionsVisible: visible('.touch-actions'),
        touchButtonsVisible: visibleCount('.touch-btn'),
        pressedTouchButtons: document.querySelectorAll('.touch-btn.pressed').length,
        mineProgressVisible: visible('.mine-progress'),
        panelFullyVisible: fullyVisible(rectOf('.pause-panel')),
        saveButtonFullyVisible: fullyVisible(rectOf('.pause-menu .save-tools button')),
        outside: rects.filter((rect) => !fullyVisible(rect)),
        settings: {
          sensitivity: document.querySelector('.sensitivity-input')?.value,
          fov: document.querySelector('.fov-input')?.value,
          viewDistance: document.querySelector('.view-distance-select')?.value,
          quality: document.querySelector('.quality-btn.active')?.dataset.quality,
          perf: document.querySelector('.perf-toggle')?.checked,
        },
        overlaps,
      };
    })()
  `)
}

function assertGameplayState(state) {
  if (state.hotbarSlots !== 18) fail('Hotbar should expose all 18 block slots', state)
  if (state.activeSlots !== 1) fail('Hotbar should have exactly one active slot', state)
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
  if (!state.saveToolsVisible) fail('Save tools should be visible in the pause menu', state)
  if (!state.saveButtonFullyVisible) fail('Save buttons should fit in the pause menu', state)
  if (state.overlaps.length) fail('HUD elements overlap while menu is open', state)
  if (state.pointerLocked) fail('Pointer lock should be released while the pause menu is open', state)
}

function assertTouchLandscapeState(state) {
  if (!state.bodyClasses.includes('touch-layout') || !state.bodyClasses.includes('landscape-layout')) {
    fail('Touch landscape should use touch and landscape layout classes', state)
  }
  if (state.density !== 'minimal') fail('Touch landscape should use minimal HUD density', state)
  if (!state.mobileControlsVisible || !state.joystickVisible || !state.touchActionsVisible || state.touchButtonsVisible !== 3) {
    fail('Touch landscape controls should be visible and complete', state)
  }
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
  if (!Array.isArray(payload.blocks) || payload.blocks.length === 0) fail(`${label}: saved world should include blocks`, payload)
  if (!payload.inventory || typeof payload.inventory !== 'object') fail(`${label}: saved world should include inventory counts`, payload)
  if (!payload.survival || typeof payload.survival.crystalPower !== 'number') fail(`${label}: saved world should include survival state`, payload)
  if (!payload.exploration || typeof payload.exploration.glowShards !== 'number') fail(`${label}: saved world should include exploration state`, payload)
}

async function smokeSaveLoad(win, scenario) {
  if (scenario.label !== 'desktop') return
  await click(win, '.save-btn')
  const saved = await readSavedWorld(win)
  assertSavedWorld(saved, `${scenario.label}:save`)
  await click(win, '.reset-btn')
  await click(win, '.reset-btn')
  const cleared = await readSavedWorld(win)
  if (cleared) fail('Reset should remove the local saved world', { cleared })
  await writeSavedWorld(win, saved)
  await click(win, '.load-btn')
  const loaded = await readSavedWorld(win)
  assertSavedWorld(loaded, `${scenario.label}:load`)
  if (loaded.blocks.length !== saved.blocks.length) fail('Loaded world should preserve saved block count', { saved: saved.blocks.length, loaded: loaded.blocks.length })
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
  const artifacts = []
  const gameplayArtifact = await captureArtifact(win, scenario, 'gameplay', gameplay)
  if (gameplayArtifact) artifacts.push(gameplayArtifact)
  await click(win, '.menu-toggle-btn')
  const menu = await readState(win, `${scenario.label}:menu`)
  assertMenuState(menu)
  if (scenario.touch) assertTouchLandscapeState(menu)
  const menuArtifact = await captureArtifact(win, scenario, 'menu', menu)
  if (menuArtifact) artifacts.push(menuArtifact)
  await smokeSaveLoad(win, scenario)
  await setRange(win, '.sensitivity-input', 95)
  await setRange(win, '.fov-input', 80)
  await setSelect(win, '.view-distance-select', 2)
  await click(win, '.quality-btn[data-quality="low"]')
  await setCheckbox(win, '.perf-toggle', true)
  const tuned = await readState(win, `${scenario.label}:settings-tuned`)
  if (!tuned.perfVisible) fail('Performance HUD toggle should show the perf badge', tuned)
  if (tuned.settings.sensitivity !== '95' || tuned.settings.fov !== '80' || tuned.settings.viewDistance !== '2' || tuned.settings.quality !== 'low') {
    fail('Settings controls should apply immediately', tuned)
  }
  await setRange(win, '.sensitivity-input', 72)
  await setRange(win, '.fov-input', 72)
  await setSelect(win, '.view-distance-select', 1)
  await click(win, '.quality-btn[data-quality="balanced"]')
  await setCheckbox(win, '.perf-toggle', false)
  await click(win, '.resume-btn')
  const closed = await readState(win, `${scenario.label}:closed`)
  if (closed.menuOpen) fail('Pause menu should close on Resume', closed)
  assertGameplayState(closed)
  if (scenario.touch) assertTouchLandscapeState(closed)
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
