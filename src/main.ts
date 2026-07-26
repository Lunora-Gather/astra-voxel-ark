import './style.css'
import * as THREE from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import { BLOCKS, type BlockId } from './blocks'
import { animateBlockMaterials, createBlockMaterials } from './textures'
import {
  BUILD_PATTERNS,
  BuildPatternPlanner,
  InventorySystem,
  MiningSession,
  ProgressionSystem,
  RECIPES,
  SurvivalVitals,
  TutorialGuide,
  getBuildPatternDefinition,
  isBuildPatternId,
  type BuildPatternId,
  type TutorialStepId,
} from './singleplayer'
import { LocalSessionGateway, ReservedMultiplayerGateway } from './session'
import { PlayerCollisionResolver, PlayerMotionController, sanitizePlayerState, VoxelBlockPicker, type PlayerStateSnapshot } from './player'
import { getBiomeAt } from './world/Biomes'
import { ChunkManager } from './world/ChunkManager'
import { buildChunkMeshData } from './render/ChunkMeshBuilder'
import { ChunkMeshRenderer } from './render/ChunkMeshRenderer'
import { isGreedyMeshEligible } from './render/BlockRenderLayers'
import { applyPointLightBudget } from './render/lightBudget'
import { ParticleEffectsPipeline } from './app/ParticleEffectsPipeline'
import { detectRuntimeDeviceProfile, isConstrainedTier, type RuntimeTier } from './performance/DeviceProfile'
import { FrameRateLimiter } from './performance/FrameRateLimiter'
import { RuntimePerformanceGuard } from './performance/RuntimePerformanceGuard'
import {
  ACTIVE_WORLD_SLOT_KEY,
  WORLD_SLOT_IDS,
  buildLandmarkPlan,
  buildProceduralChunkPlan,
  createWorldSeed,
  formatWorldSeed,
  formatWorldCoordinates,
  formatWorldCoordinatesForClipboard,
  proceduralTerrainHeightAt,
  getWorldExportSlug,
  getWorldSlotSaveKey,
  normalizeWorldSeed,
  ProceduralTerrainWorkerClient,
  SaveSystem,
  sanitizeWorldSlotId,
  WorldSlotNameStore,
  selectChunksForEviction,
  isBlockId as isValidBlockId,
  isSavedBlock as isValidSavedBlock,
  isSavedBlockKey as isValidBlockKey,
  isSavedTerrainChunkKey,
  packBlockKey,
  parseStringBlockKey,
  stringifyBlockKey,
  unpackBlockKeyInto,
  type PackedBlockKey,
  type ProceduralChunkPlan,
  type SavedBlock,
  type SavedWorldState as SavedWorld,
  type WorldSlotId,
} from './world'
import { IdleTaskQueue } from './platform/IdleTaskQueue'
import { audioSystem, playGameSound, playShardCollectSound, unlockGameAudio } from './systems'
import { SaveActivityTracker, SettingsStore, type GameSettings, type QualityPreset } from './game'

const app = document.querySelector<HTMLDivElement>('#app')!
const GAME_VERSION_LABEL = 'v1.5.0 Wayfinder Progression'
const smokeParams = new URLSearchParams(window.location.hash.slice(1))
const isSmokeTest = smokeParams.has('smoke')
const smokeTouchParam = isSmokeTest ? smokeParams.get('touch') : null
const smokeTouchMode = smokeTouchParam === '1'
const smokeDesktopMode = smokeTouchParam === '0'
const isSmallScreen = Math.min(window.innerWidth, window.innerHeight) <= 760
const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches
const isMobileUserAgent = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
const hasTouchCapability = hasCoarsePointer || navigator.maxTouchPoints > 0
const isTouchPrimaryDevice = hasCoarsePointer && (isSmallScreen || isMobileUserAgent)
const isTouchDevice = smokeTouchMode || (!smokeDesktopMode && isTouchPrimaryDevice)
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const requestedRuntimeTier = smokeParams.get('device-tier')
const forcedRuntimeTier: RuntimeTier | null = isSmokeTest && (
  requestedRuntimeTier === 'ultra-low' || requestedRuntimeTier === 'low' ||
  requestedRuntimeTier === 'standard' || requestedRuntimeTier === 'high'
) ? requestedRuntimeTier : null
const runtimeProfile = detectRuntimeDeviceProfile({
  touchPrimary: isTouchDevice || hasTouchCapability,
  reducedMotion: prefersReducedMotion,
  forcedTier: forcedRuntimeTier,
})
const runtimeLimits = runtimeProfile.limits
const lowPowerMode = isConstrainedTier(runtimeProfile.tier)
let frameRateLimit: 30 | 60 = runtimeLimits.targetFps === 30 ? 30 : 60
const gameplayFrameLimiter = new FrameRateLimiter(frameRateLimit)
const performanceGuard = new RuntimePerformanceGuard(frameRateLimit)
let currentFps = 0
let currentAverageFrameMs = 0
document.body.dataset.runtimeTier = runtimeProfile.tier
document.body.classList.toggle('constrained-runtime', lowPowerMode)

app.innerHTML = `
  <div class="hud">
    <div class="hud-stack hud-left-stack">
      <div class="title"><span class="eyebrow">VOXEL SANDBOX</span><div class="title-heading"><h1>ASTRAVOXEL ARK</h1><span class="save-status hud-save-status" data-save-state="unsaved" role="status" aria-live="polite">Not saved</span></div><p>${GAME_VERSION_LABEL}</p></div>
      <div class="survival-badge">
        <div class="survival-title">SURVIVAL DIAGNOSTICS</div>
        <div class="survival-status">
          <div class="survival-metric">
            <span class="metric-label">
              <svg class="metric-icon crystal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
              Crystal Power
            </span>
            <div class="charge-bar-container">
              <div class="charge-bar"></div>
            </div>
            <span class="metric-value crystal-val">--</span>
          </div>
          <div class="survival-metric">
            <span class="metric-label">
              <svg class="metric-icon threat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              Threat Level
            </span>
            <span class="metric-value threat-val">--</span>
          </div>
          <div class="survival-metric health-metric">
            <span class="metric-label">Hull Integrity</span>
            <div class="charge-bar-container"><div class="health-bar"></div></div>
            <span class="metric-value health-val">100%</span>
          </div>
        </div>
      </div>
      <div class="tutorial" data-tutorial-step="move" role="status" aria-live="polite">
        <span class="tutorial-progress">1/6</span>
        <p><strong class="tutorial-title">First Steps</strong><span class="tutorial-prompt">Use WASD to move</span></p>
      </div>
      <div class="compass-badge" aria-live="polite">
        <span class="compass-arrow">↑</span>
        <span class="compass-distance">Beacon scanning</span>
      </div>
      <div class="wayfinder-badge">
        <span class="wayfinder-label">Expedition</span>
        <span class="wayfinder-value">Scanning</span>
      </div>
    </div>

    <div class="hud-stack hud-right-stack">
      <div class="help"><strong>Controls</strong><br/><span class="desktop-help">WASD move · Space jump<br/>Hold left mine · Right place · B pattern<br/>1–9 select · Tab palette · E backpack<br/>Goal: repair Ark Core with 6 landmark shards</span><span class="mobile-help">Left joystick: move · Drag right: look<br/>Hold Break to mine · Tap Place to build<br/>Patterns are in Menu · Expedition</span><div class="help-guide"><strong class="help-guide-title">Guide 1/6</strong><span class="help-guide-prompt">Use WASD to move</span></div></div>
      <div class="perf-badge" role="group" aria-label="Live performance diagnostics">
        <div class="perf-row perf-frame-row">
          <div class="perf-metric"><span class="perf-label">FPS</span><span class="perf-fps">--</span></div>
          <div class="perf-divider"></div>
          <div class="perf-metric"><span class="perf-label">Frame</span><span><span class="perf-ms">--</span><span class="perf-unit">ms</span></span></div>
          <div class="perf-divider"></div>
          <div class="perf-metric"><span class="perf-label">Mode</span><span class="perf-mode">${runtimeProfile.tier}</span></div>
        </div>
        <div class="perf-row perf-world-row">
          <div class="perf-metric"><span class="perf-label">Chunks</span><span class="perf-chunks">0</span></div>
          <div class="perf-metric"><span class="perf-label">Terrain</span><span class="perf-terrain-chunks">0</span></div>
          <div class="perf-metric"><span class="perf-label">Blocks</span><span class="perf-blocks">0</span></div>
          <div class="perf-metric"><span class="perf-label">Queue</span><span class="perf-dirty">0</span></div>
        </div>
        <div class="perf-row perf-render-row">
          <div class="perf-metric"><span class="perf-label">Calls</span><span class="perf-calls">0</span></div>
          <div class="perf-metric"><span class="perf-label">Tris</span><span class="perf-triangles">0</span></div>
          <div class="perf-metric"><span class="perf-label">Geo</span><span class="perf-geometries">0</span></div>
          <div class="perf-metric"><span class="perf-label">Tex</span><span class="perf-textures">0</span></div>
        </div>
      </div>
      <button class="world-badge" type="button" title="Copy current coordinates" aria-label="Copy current coordinates"><span class="badge-pulse"></span><span class="world-biome">Star Meadow · Hand Tools</span><span class="world-coordinates">X 0 · Y 12 · Z 18</span></button>
    </div>

    <button class="help-toggle-btn" aria-label="Toggle Help">?</button>
    <button class="menu-toggle-btn" aria-label="Open Menu">II</button>
    <div class="toast" aria-live="polite"></div>
    <div class="cold-vignette"></div>
    <div class="mine-progress"><div class="mine-ring"></div><span>Hold</span></div>
    <div class="crosshair"></div>
    <div class="hotbar"></div>
    <div class="block-info"><div class="block-name"></div><div class="block-count">0</div></div>
    <div class="mobile-controls">
      <div class="joystick"><div class="stick"></div></div>
      <div class="touch-actions">
        <button class="touch-btn jump-btn">Jump</button>
        <button class="touch-btn break-btn">Break</button>
        <button class="touch-btn place-btn">Place</button>
      </div>
    </div>
    <div class="rotate-prompt"><div><span>↻</span><strong>请横屏游玩</strong><small>Rotate your phone to landscape</small></div></div>
    <div class="pause-menu hidden" role="dialog" aria-modal="true" aria-label="Game Menu">
      <div class="pause-panel">
        <div class="pause-header">
          <div><span>Game Menu</span><small><span class="pause-session-label">Expedition 1 · Offline</span><span aria-hidden="true"> · </span><span class="pause-save-status" data-save-state="unsaved">Not saved</span></small></div>
          <button class="resume-btn">Resume</button>
        </div>
        <div class="menu-tabs" role="tablist" aria-label="Game menu sections">
          <button class="menu-tab active" role="tab" aria-selected="true" aria-controls="menu-settings" data-menu-tab="settings">Settings</button>
          <button class="menu-tab" role="tab" aria-selected="false" aria-controls="menu-expedition" data-menu-tab="expedition">Expedition</button>
          <button class="menu-tab" role="tab" aria-selected="false" aria-controls="menu-world" data-menu-tab="world">World</button>
        </div>
        <section class="menu-page active" id="menu-settings" role="tabpanel" data-menu-page="settings">
          <div class="menu-page-heading"><strong>Experience</strong><small>Changes apply immediately and stay on this device.</small></div>
          <div class="settings-grid">
          <label class="setting-row">
            <span>Mouse Sensitivity</span>
            <output class="sensitivity-value">72%</output>
            <input class="sensitivity-input" type="range" min="35" max="150" value="72" />
          </label>
          <label class="setting-row">
            <span>Field of View</span>
            <output class="fov-value">72</output>
            <input class="fov-input" type="range" min="60" max="90" value="72" />
          </label>
          <label class="setting-row">
            <span>View Distance</span>
            <select class="view-distance-select">
              <option value="1">Near</option>
              <option value="2">Normal</option>
              <option value="3">Far</option>
            </select>
          </label>
          <label class="setting-row">
            <span>Frame Rate</span>
            <select class="frame-rate-select">
              <option value="30">30 FPS · Battery</option>
              <option value="60">60 FPS · Smooth</option>
            </select>
          </label>
          <label class="setting-row">
            <span>Sound Volume</span>
            <output class="volume-value">70%</output>
            <input class="volume-input" type="range" min="0" max="100" value="70" />
          </label>
          <div class="setting-row setting-row-buttons">
            <span>Graphics</span>
            <div class="quality-options" role="group" aria-label="Graphics quality">
              <button class="quality-btn" data-quality="low">Low</button>
              <button class="quality-btn active" data-quality="balanced">Balanced</button>
              <button class="quality-btn" data-quality="high">High</button>
            </div>
          </div>
          <label class="setting-check">
            <input class="perf-toggle" type="checkbox" />
            <span>Show performance HUD</span>
          </label>
          <label class="setting-check">
            <input class="sound-toggle" type="checkbox" checked />
            <span>Enable sound effects</span>
          </label>
          </div>
        </section>
        <section class="menu-page" id="menu-expedition" role="tabpanel" data-menu-page="expedition" hidden>
          <section class="expedition-panel" aria-label="Single-player expedition">
          <div class="expedition-heading">
            <div><span class="eyebrow">SINGLE PLAYER</span><strong>Wayfinder Progression</strong></div>
            <span class="tool-tier-value">Hand Tools</span>
          </div>
          <div class="expedition-nav" role="tablist" aria-label="Expedition sections">
            <button class="expedition-nav-btn active" type="button" role="tab" data-expedition-view="journey" aria-selected="true">Journey</button>
            <button class="expedition-nav-btn" type="button" role="tab" data-expedition-view="backpack" aria-selected="false">Backpack</button>
            <button class="expedition-nav-btn" type="button" role="tab" data-expedition-view="workshop" aria-selected="false">Workshop</button>
          </div>
          <div class="expedition-view active" role="tabpanel" data-expedition-page="journey">
            <div class="expedition-section-heading objective-heading"><strong>Objectives</strong><button class="claim-all-objectives" type="button" disabled>No rewards ready</button></div>
            <div class="objective-list"></div>
          </div>
          <div class="expedition-view" role="tabpanel" data-expedition-page="backpack" hidden>
            <div class="expedition-section-heading objective-heading"><strong>Backpack</strong><small>Select any material for the active nine-slot palette.</small></div>
            <div class="inventory-grid"></div>
            <div class="expedition-section-heading"><strong>Build Pattern</strong><small>Uses the selected material · B cycles on desktop.</small></div>
            <div class="build-pattern-options" role="group" aria-label="Build pattern">
              ${BUILD_PATTERNS.map(({ id, name, blockCount }) => `<button type="button" class="build-pattern-btn ${id === 'single' ? 'active' : ''}" data-build-pattern="${id}" aria-pressed="${id === 'single'}"><strong>${name}</strong><small>×${blockCount}</small></button>`).join('')}
            </div>
          </div>
          <div class="expedition-view" role="tabpanel" data-expedition-page="workshop" hidden>
            <div class="expedition-section-heading objective-heading"><strong>Workshop</strong><small>Craft one item or safely process up to 99 complete sets.</small></div>
            <div class="recipe-list"></div>
          </div>
          </section>
        </section>
        <section class="menu-page" id="menu-world" role="tabpanel" data-menu-page="world" hidden>
          <div class="menu-page-heading"><strong>World & Saves</strong><small>Your deterministic world is stored locally as compact player changes.</small></div>
          <button class="world-seed" type="button" title="Copy world seed"><span>World seed</span><strong>--------</strong><small>Tap to copy</small></button>
          <section class="session-panel" aria-label="Play sessions">
          <button class="session-option active" data-session="singleplayer"><strong>Local Expedition</strong><small class="session-current">Expedition 1 · offline</small></button>
          <button class="session-option multiplayer-entry" data-session="multiplayer" disabled><strong>Multiplayer</strong><small>Coming later</small></button>
          </section>
          <div class="world-slots" role="group" aria-label="Local expedition slots">
            ${WORLD_SLOT_IDS.map((slot) => `<button class="world-slot" data-world-slot="${slot}"><span>Slot ${slot}</span><strong>Expedition ${slot}</strong><small>Empty world</small></button>`).join('')}
          </div>
          <form class="world-name-editor">
            <label for="world-name-input">World name</label>
            <input id="world-name-input" class="world-name-input" type="text" maxlength="32" autocomplete="off" spellcheck="false" aria-describedby="world-name-hint" />
            <button class="world-name-save" type="submit">Rename</button>
            <small id="world-name-hint">Blank restores the default name.</small>
          </form>
          <div class="save-tools">
          <button class="save-btn">Save</button>
          <button class="load-btn">Load</button>
          <button class="recover-btn">Recover</button>
          <button class="export-btn">Export</button>
          <button class="import-btn">Import</button>
          <button class="reset-btn">New World</button>
          <input class="import-input" type="file" accept="application/json,.json" />
          </div>
          <button class="save-meta" type="button" title="Copy current coordinates" aria-label="World save details. Copy current coordinates." aria-live="polite">Checking local save…</button>
        </section>
      </div>
    </div>
    <div class="start"><div class="panel"><span class="crest">✦</span><h2>星野方舟 v1.5</h2><p>Gather, craft, upgrade your tools and restore the Ark Core</p><div class="start-features"><span>Offline world</span><span>Autosave</span><span>Adaptive performance</span></div><button>Start Local Expedition</button><button class="start-multiplayer" disabled>Multiplayer · Coming later</button></div></div>
  </div>
`

const scene = new THREE.Scene()
const nightSkyColor = new THREE.Color(0x17213d)
const daySkyColor = new THREE.Color(0xaedcff)
const skyColor = new THREE.Color(0xaedcff)
const sceneFog = new THREE.FogExp2(
  skyColor,
  runtimeProfile.tier === 'ultra-low' ? 0.04 : lowPowerMode ? 0.03 : 0.018,
)
scene.background = skyColor
scene.fog = sceneFog

const PLAYER_SPAWN = { x: 0, y: 12, z: 18 } as const
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 600)
camera.position.set(PLAYER_SPAWN.x, PLAYER_SPAWN.y, PLAYER_SPAWN.z)
camera.rotation.order = 'YXZ'

const renderer = new THREE.WebGLRenderer({
  antialias: runtimeProfile.tier === 'standard' || runtimeProfile.tier === 'high',
  powerPreference: lowPowerMode ? 'low-power' : 'high-performance',
  precision: runtimeProfile.tier === 'ultra-low' ? 'mediump' : 'highp',
})
renderer.setSize(window.innerWidth, window.innerHeight)
let renderQuality = runtimeLimits.initialRenderScale
function applyRenderQuality() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio * renderQuality, runtimeLimits.maxPixelRatio))
}
applyRenderQuality()
renderer.shadowMap.enabled = !lowPowerMode
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.08
app.appendChild(renderer.domElement)

const controls = new PointerLockControls(camera, renderer.domElement)
scene.add(controls.object)
let mouseLookSpeed = 0.72
let touchLookSpeed = 0.00245
let qualityPreset: QualityPreset = 'balanced'
let showPerformanceHud = false
const MAX_LOOK_PITCH = THREE.MathUtils.degToRad(85)
const lookStabilizerEuler = new THREE.Euler(0, 0, 0, 'YXZ')
controls.pointerSpeed = mouseLookSpeed
controls.minPolarAngle = Math.PI / 2 - MAX_LOOK_PITCH
controls.maxPolarAngle = Math.PI / 2 + MAX_LOOK_PITCH

function clampLookPitch(value: number) {
  return Math.max(-MAX_LOOK_PITCH, Math.min(MAX_LOOK_PITCH, value))
}

function stabilizeFirstPersonLook() {
  lookStabilizerEuler.setFromQuaternion(camera.quaternion, 'YXZ')
  lookStabilizerEuler.x = clampLookPitch(lookStabilizerEuler.x)
  lookStabilizerEuler.z = 0
  camera.quaternion.setFromEuler(lookStabilizerEuler)
}
controls.addEventListener('change', stabilizeFirstPersonLook)

const hemi = new THREE.HemisphereLight(0xd9f2ff, 0x73604b, 1.9)
scene.add(hemi)

const sun = new THREE.DirectionalLight(0xfff3c4, 2.9)
sun.position.set(38, 55, 22)
sun.castShadow = !lowPowerMode
sun.shadow.mapSize.set(1024, 1024)
sun.shadow.camera.left = -56
sun.shadow.camera.right = 56
sun.shadow.camera.top = 56
sun.shadow.camera.bottom = -56
scene.add(sun)

const moon = new THREE.DirectionalLight(0x93baff, 0.25)
moon.position.set(-35, 42, -25)
scene.add(moon)

const cubeGeometry = new THREE.BoxGeometry(1, 1, 1)
const edgeGeometry = new THREE.EdgesGeometry(cubeGeometry)
const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.055 })
const materials = createBlockMaterials()
const waterMaterialRaw = materials.get('water')
const waterMaterial = (Array.isArray(waterMaterialRaw) ? waterMaterialRaw[0] : waterMaterialRaw) as THREE.MeshStandardMaterial
const waterTimeUniform = { value: 0 }
if (waterMaterial) {
  waterMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = waterTimeUniform
    shader.vertexShader = `
      uniform float uTime;
    ` + shader.vertexShader
    
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      #ifdef USE_INSTANCING
      vec3 instPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      float phase = uTime * 1.8 + (instPos.x + instPos.z) * 0.37;
      float waveY = sin(phase) * 0.035;
      float scaleY = 0.92 + sin(phase * 1.3) * 0.035;
      transformed.y = transformed.y * scaleY + waveY;
      #endif
      `
    )
  }
}

const world = new THREE.Group()
scene.add(world)
type InstancedBlockRef = {
  kind: 'instanced'
  id: BlockId
  mesh: THREE.InstancedMesh
  index: number
  x: number
  y: number
  z: number
}
type BlockVisual = THREE.Mesh | InstancedBlockRef | undefined
const blocks = new Map<PackedBlockKey, BlockVisual>()
const blockData = new Map<PackedBlockKey, BlockId>()
const INITIAL_INSTANCED_MESH_CAPACITY = 15000
const instancedBlockMeshes = new Map<BlockId, THREE.InstancedMesh>()
const instancedBlockKeys = new Map<BlockId, PackedBlockKey[]>()
const instancedBlockCapacities = new Map<BlockId, number>()
const instancedMatrix = new THREE.Matrix4()
const hiddenInstanceMatrix = new THREE.Matrix4().makeTranslation(0, -100000, 0)
const glowLights: THREE.PointLight[] = []
const glowLightsByBlock = new Map<PackedBlockKey, THREE.PointLight>()
let grassBladeMesh: THREE.InstancedMesh | null = null
const grassBladeKeys: PackedBlockKey[] = []
let needUpdateBounds = false
const INITIAL_GRASS_CAPACITY = 12000
let activeWorldSlot = sanitizeWorldSlotId(localStorage.getItem(ACTIVE_WORLD_SLOT_KEY))
localStorage.setItem(ACTIVE_WORLD_SLOT_KEY, activeWorldSlot)
const worldSlotNameStore = new WorldSlotNameStore()
let worldSlotNames = worldSlotNameStore.load()
const CHUNK_SIZE = 8
const optimizedChunks = new ChunkManager(CHUNK_SIZE)
const lowFidelityTerrainMaterial = lowPowerMode
  ? new THREE.MeshLambertMaterial({ vertexColors: true })
  : null
const chunkMeshRenderer = new ChunkMeshRenderer({
  scene: world,
  materials,
  mergedMaterial: lowFidelityTerrainMaterial,
  blockColors: new Map(BLOCKS.map(({ id, color }) => [id, color])),
  castShadow: !lowPowerMode,
  receiveShadow: !lowPowerMode,
})
const particleEffects = new ParticleEffectsPipeline({
  scene,
  flags: {
    diagnostics: false,
    chunkMeshDiagnostics: false,
    chunkMeshRenderer: true,
    terrainWorker: false,
    particlePool: true,
    lightBudget: true,
  },
  poolSize: runtimeLimits.particlePoolSize,
  lowPowerMode,
})
const INITIAL_TERRAIN_LOAD_RADIUS = 1
const TERRAIN_MAX_RADIUS = 6
const TERRAIN_CHUNKS_PER_FRAME = 1
const TERRAIN_SCAN_INTERVAL = 0.2
let terrainLoadRadius = 1
const RAYCAST_REACH = 8
const GRASS_ANIMATION_BUDGET = runtimeLimits.grassAnimationBudget
const MIN_RENDER_QUALITY = runtimeLimits.minRenderScale
const MAX_RENDER_QUALITY = runtimeLimits.maxRenderScale
const QUALITY_STEP = 0.06
const TOUCH_JOYSTICK_DEADZONE = 0.08
const TOUCH_JOYSTICK_EDGE = 0.42
const TOUCH_JOYSTICK_RESPONSE = 1.28
const TOUCH_LOOK_DEADZONE = 0.28
const TOUCH_LOOK_MAX_DELTA = 34
function adaptiveBudget(base: number, minimum: number) {
  const pressureScale = currentFps > 0 && currentFps < 36 ? 0.65 : 1
  const guardScale = performanceGuard.budget.cosmeticScale
  if (guardScale <= 0) return 0
  const guardedMinimum = Math.max(1, Math.round(minimum * guardScale))
  return Math.max(guardedMinimum, Math.round(base * (0.45 + renderQuality * 0.55) * pressureScale * guardScale))
}
type BlockSource = 'terrain' | 'player' | 'save'
type ChunkBucket = {
  id: BlockId
  material: THREE.Material | THREE.Material[]
  blockKeys: Set<PackedBlockKey>
}
type ChunkMeshBucketStats = {
  blockCount: number
  visibleBlockCount: number
  visibleFaceCount: number
}
type ChunkVisibleFaceSummary = {
  revision: number
  solidBlockCount: number
  visibleSolidBlockCount: number
  visibleFaceCount: number
  specialBlockCount: number
  buckets: Map<BlockId, ChunkMeshBucketStats>
}
type ChunkMetadata = {
  key: string
  x: number
  y: number
  z: number
  buckets: Map<BlockId, ChunkBucket>
  visibleFaceSummary: ChunkVisibleFaceSummary
}
const chunks = new Map<string, ChunkMetadata>()
const dirtyChunkKeys = new Set<string>()
const generatedTerrainChunks = new Set<string>()
const discoveredTerrainChunks = new Set<string>()
const queuedTerrainChunks = new Set<string>()
const terrainGenerationQueue: Array<{ cx: number; cz: number }> = []
const completedTerrainPlans: ProceduralChunkPlan[] = []
let terrainWorkerInFlight = 0
let terrainGenerationEpoch = 0
const terrainWorker = typeof Worker !== 'undefined' ? new ProceduralTerrainWorkerClient() : null
const idleTasks = new IdleTaskQueue()
const saveActivity = new SaveActivityTracker()
let lastTerrainEnsureScanKey = ''
let lastTerrainCenterKey = ''
let pendingTerrainEnsure: { x: number; z: number } | null = null
let lastTerrainEnsureAt = -Infinity
let lastTerrainEvictionAt = -Infinity
const removedTerrainBlocks = new Set<PackedBlockKey>()
const playerPlacedBlocks = new Set<PackedBlockKey>()
const landmarkShardBlocks = new Set<PackedBlockKey>()
const landmarkShardNames = new Map<PackedBlockKey, string>()
const collectedShardBlocks = new Set<PackedBlockKey>()
const progression = new ProgressionSystem()
const survivalVitals = new SurvivalVitals()
const tutorialGuide = new TutorialGuide()
const miningSession = new MiningSession()
const buildPatternPlanner = new BuildPatternPlanner()
let activeBuildPattern: BuildPatternId = 'single'
const localSession = new LocalSessionGateway()
const multiplayerSession = new ReservedMultiplayerGateway()
const keys = new Set<string>()
const playerMotion = new PlayerMotionController()
const saveStatusElements = [
  document.querySelector<HTMLElement>('.hud-save-status')!,
  document.querySelector<HTMLElement>('.pause-save-status')!,
]
let crystalPower = 68
let carriedCrystal = 0
let collectedGlowShards = 0
let lastSurvivalToastAt = 0
let simulationElapsedTime = 0
let lastAutoSaveAt = 0
let autoSavePending = false

function updateSaveActivityUi(now = Date.now()) {
  const label = saveActivity.label(now)
  saveStatusElements.forEach((element) => {
    element.textContent = label
    element.dataset.saveState = saveActivity.state
  })
}

function cancelPendingAutoSave() {
  if (!autoSavePending) return
  idleTasks.cancel()
  autoSavePending = false
}
let worldSeed = createWorldSeed()
const EXPLORATION_GOAL_SHARDS = 6
const SHARD_WARD_PROTECTION = 0.03
const ARK_MODULE_NAMES = ['Signal', 'Power', 'Shield', 'Chart', 'Lift', 'Core']
const PLAYER_RADIUS = 0.38
const PLAYER_EYE_HEIGHT = 1.85
const PLAYER_HEIGHT = 1.35
const PLAYER_HEAD_CLEARANCE = 0.12
const PLAYER_PLACEMENT_CLEARANCE = 0.08
const STEP_HEIGHT = 1
const grassBladeGeometry = new THREE.PlaneGeometry(0.42, 0.58)
const grassBladeMaterial = new THREE.MeshStandardMaterial({
  color: 0x91e66f,
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.82,
  roughness: 0.95,
})
const grassTimeUniform = { value: 0 }
grassBladeMaterial.onBeforeCompile = (shader) => {
  shader.uniforms.uTime = grassTimeUniform
  shader.vertexShader = `
    uniform float uTime;
  ` + shader.vertexShader
  
  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    `
    #include <begin_vertex>
    #ifdef USE_INSTANCING
    vec3 instPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
    float phase = uTime * 2.2 + (instPos.x + instPos.z) * 0.45;
    float swayFactor = transformed.y / 0.58;
    transformed.x += sin(phase) * 0.09 * swayFactor;
    transformed.z += cos(phase * 0.8) * 0.07 * swayFactor;
    #endif
    `
  )
}
const outlinedBlockIds = new Set<BlockId>(['wood', 'leaves', 'crystal', 'glow', 'brick', 'obsidian', 'copper', 'gold'])
const enableBlockOutlines = !lowPowerMode
const enableBlockShadows = !lowPowerMode
const MAX_GLOW_LIGHTS = Math.max(runtimeLimits.activePointLights * 3, runtimeLimits.activePointLights)
const MAX_ACTIVE_GLOW_LIGHTS = runtimeLimits.activePointLights

const grassBladeGeo = grassBladeGeometry.clone()
grassBladeGeo.translate(0, 0.29, 0)
grassBladeMesh = new THREE.InstancedMesh(grassBladeGeo, grassBladeMaterial, INITIAL_GRASS_CAPACITY)
grassBladeMesh.count = 0
grassBladeMesh.castShadow = false
grassBladeMesh.receiveShadow = enableBlockShadows
grassBladeMesh.frustumCulled = true
world.add(grassBladeMesh)
let blockMutationVersion = 0
let cloudAnimationCursor = 0
let sparkleAnimationCursor = 0
let cosmeticEffectsReduced = false
let terrainQueueFrameSkip = 0
const STARTER_INVENTORY: Partial<Record<BlockId, number>> = {
  grass: 8,
  dirt: 12,
  stone: 10,
  wood: 8,
  leaves: 6,
  water: 4,
  crystal: 2,
  glow: 2,
}
const inventory = new InventorySystem(BLOCKS.map(({ id }) => id), STARTER_INVENTORY)
const progressionInventory = inventory
const SOLID_NEIGHBOR_OFFSETS = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
] as const
const EMPTY_CHUNK_VISIBLE_FACE_SUMMARY = {
  revision: 0,
  solidBlockCount: 0,
  visibleSolidBlockCount: 0,
  visibleFaceCount: 0,
  specialBlockCount: 0,
  buckets: new Map<BlockId, ChunkMeshBucketStats>(),
} satisfies ChunkVisibleFaceSummary

function removeArrayItemAtUnordered<T>(array: T[], index: number) {
  const last = array.pop()
  if (index < array.length && last !== undefined) array[index] = last
}

function removeArrayItemUnordered<T>(array: T[], item: T) {
  const index = array.indexOf(item)
  if (index >= 0) removeArrayItemAtUnordered(array, index)
}

BLOCKS.forEach(({ id }) => {
  const instancedMesh = new THREE.InstancedMesh(cubeGeometry, materials.get(id)!, INITIAL_INSTANCED_MESH_CAPACITY)
  instancedMesh.count = 0
  instancedMesh.castShadow = enableBlockShadows && (id === 'wood' || id === 'leaves' || id === 'crystal' || id === 'glow')
  instancedMesh.receiveShadow = enableBlockShadows
  instancedMesh.frustumCulled = true
  instancedMesh.userData.block = true
  instancedMesh.userData.id = id
  instancedBlockMeshes.set(id, instancedMesh)
  instancedBlockKeys.set(id, [])
  instancedBlockCapacities.set(id, INITIAL_INSTANCED_MESH_CAPACITY)
  world.add(instancedMesh)
})

function isInstancedBlockRef(visual: BlockVisual | undefined): visual is InstancedBlockRef {
  return Boolean(visual && !(visual instanceof THREE.Mesh) && visual.kind === 'instanced')
}

const TRANSPARENT_BLOCK_IDS = new Set<BlockId>(['leaves', 'water', 'crystal', 'glow'])
function isOpaqueBlockId(id: BlockId | undefined): boolean {
  return Boolean(id) && !TRANSPARENT_BLOCK_IDS.has(id as BlockId)
}

function usesChunkMesh(id: BlockId) {
  return isGreedyMeshEligible(id) && !Array.isArray(materials.get(id))
}

function hasExposedFace(x: number, y: number, z: number, id: BlockId) {
  const isOpaque = isOpaqueBlockId(id)
  return SOLID_NEIGHBOR_OFFSETS.some(([dx, dy, dz]) => {
    const neighborId = blockData.get(packBlockKey(x + dx, y + dy, z + dz))
    if (!neighborId) return true
    if (isOpaque) {
      return !isOpaqueBlockId(neighborId)
    } else {
      return neighborId !== id && !isOpaqueBlockId(neighborId)
    }
  })
}

function countExposedFaces(x: number, y: number, z: number, id: BlockId) {
  const isOpaque = isOpaqueBlockId(id)
  let exposedFaces = 0
  SOLID_NEIGHBOR_OFFSETS.forEach(([dx, dy, dz]) => {
    const neighborId = blockData.get(packBlockKey(x + dx, y + dy, z + dz))
    if (!neighborId) {
      exposedFaces++
    } else if (isOpaque) {
      if (!isOpaqueBlockId(neighborId)) exposedFaces++
    } else {
      if (neighborId !== id && !isOpaqueBlockId(neighborId)) exposedFaces++
    }
  })
  return exposedFaces
}

function removeGlowLightAt(k: PackedBlockKey) {
  const light = glowLightsByBlock.get(k)
  if (!light) return
  scene.remove(light)
  removeArrayItemUnordered(glowLights, light)
  glowLightsByBlock.delete(k)
}

function ensureGlowLightAt(k: PackedBlockKey, x: number, y: number, z: number, id: BlockId) {
  if ((id !== 'glow' && id !== 'crystal') || glowLightsByBlock.has(k) || glowLights.length >= MAX_GLOW_LIGHTS) return
  const light = new THREE.PointLight(
    id === 'glow' ? 0xffcf7a : 0x9b86ff,
    lowPowerMode ? (id === 'glow' ? 0.55 : 0.35) : (id === 'glow' ? 1.2 : 0.75),
    lowPowerMode ? 5 : 8,
  )
  light.position.set(x, y + 0.2, z)
  light.userData.blockId = id
  scene.add(light)
  glowLightsByBlock.set(k, light)
  glowLights.push(light)
}

const decodedBlockPosition = { x: 0, y: 0, z: 0 }

function refreshBlockVisualAt(k: PackedBlockKey) {
  const id = blockData.get(k)
  if (!id) return
  const { x, y, z } = unpackBlockKeyInto(k, decodedBlockPosition)
  const visual = blocks.get(k)
  const shouldRender = hasExposedFace(x, y, z, id)

  if (usesChunkMesh(id)) {
    if (isInstancedBlockRef(visual)) removeInstancedBlockVisual(k, visual)
    blocks.set(k, undefined)
    if (shouldRender) ensureGlowLightAt(k, x, y, z, id)
    else removeGlowLightAt(k)
    return
  }

  if (shouldRender && !isInstancedBlockRef(visual)) {
    blocks.set(k, addInstancedBlockVisual(k, x, y, z, id))
    ensureGlowLightAt(k, x, y, z, id)
    return
  }

  if (!shouldRender && isInstancedBlockRef(visual)) {
    removeInstancedBlockVisual(k, visual)
    blocks.set(k, undefined)
    removeGlowLightAt(k)
  }
}

function refreshBlockAndNeighbors(x: number, y: number, z: number) {
  refreshBlockVisualAt(packBlockKey(x, y, z))
  SOLID_NEIGHBOR_OFFSETS.forEach(([dx, dy, dz]) => refreshBlockVisualAt(packBlockKey(x + dx, y + dy, z + dz)))
}

let blockBatchDepth = 0
const batchedVisualKeys = new Set<PackedBlockKey>()

function beginBlockBatch() {
  blockBatchDepth += 1
}

function endBlockBatch() {
  blockBatchDepth = Math.max(0, blockBatchDepth - 1)
  if (blockBatchDepth > 0) return
  for (const key of batchedVisualKeys) refreshBlockVisualAt(key)
  batchedVisualKeys.clear()
}

function markBatchedBlockAndNeighbors(x: number, y: number, z: number) {
  batchedVisualKeys.add(packBlockKey(x, y, z))
  SOLID_NEIGHBOR_OFFSETS.forEach(([dx, dy, dz]) => batchedVisualKeys.add(packBlockKey(x + dx, y + dy, z + dz)))
}

function withBlockBatch<T>(run: () => T) {
  beginBlockBatch()
  try {
    return run()
  } finally {
    endBlockBatch()
  }
}

function addInstancedBlockVisual(k: PackedBlockKey, x: number, y: number, z: number, id: BlockId) {
  let instancedMesh = instancedBlockMeshes.get(id)
  const keysForType = instancedBlockKeys.get(id)
  if (!instancedMesh || !keysForType) return undefined
  if (instancedMesh.count >= (instancedBlockCapacities.get(id) ?? INITIAL_INSTANCED_MESH_CAPACITY)) {
    instancedMesh = growInstancedBlockMesh(id, instancedMesh, keysForType)
  }

  const index = instancedMesh.count
  instancedMatrix.makeTranslation(x, y, z)
  instancedMesh.setMatrixAt(index, instancedMatrix)
  instancedMesh.count = index + 1
  instancedMesh.instanceMatrix.needsUpdate = true
  instancedMesh.boundingSphere = null
  needUpdateBounds = true
  keysForType[index] = k
  return { kind: 'instanced', id, mesh: instancedMesh, index, x, y, z } satisfies InstancedBlockRef
}

function growInstancedBlockMesh(id: BlockId, oldMesh: THREE.InstancedMesh, keysForType: PackedBlockKey[]) {
  const oldCapacity = instancedBlockCapacities.get(id) ?? INITIAL_INSTANCED_MESH_CAPACITY
  const newCapacity = oldCapacity * 2
  const newMesh = new THREE.InstancedMesh(cubeGeometry, oldMesh.material, newCapacity)
  newMesh.count = oldMesh.count
  newMesh.castShadow = oldMesh.castShadow
  newMesh.receiveShadow = oldMesh.receiveShadow
  newMesh.frustumCulled = true
  newMesh.userData.block = true
  newMesh.userData.id = id

  for (let index = 0; index < oldMesh.count; index++) {
    oldMesh.getMatrixAt(index, instancedMatrix)
    newMesh.setMatrixAt(index, instancedMatrix)
  }
  newMesh.instanceMatrix.needsUpdate = true

  world.remove(oldMesh)
  world.add(newMesh)
  instancedBlockMeshes.set(id, newMesh)
  instancedBlockCapacities.set(id, newCapacity)
  keysForType.forEach((key) => {
    const ref = blocks.get(key)
    if (isInstancedBlockRef(ref)) ref.mesh = newMesh
  })
  return newMesh
}

function removeInstancedBlockVisual(k: PackedBlockKey, ref: InstancedBlockRef) {
  const keysForType = instancedBlockKeys.get(ref.id)
  if (!keysForType) return

  const lastIndex = ref.mesh.count - 1
  const removedIndex = ref.index
  const movedKey = keysForType[lastIndex]
  if (removedIndex !== lastIndex && movedKey) {
    ref.mesh.getMatrixAt(lastIndex, instancedMatrix)
    ref.mesh.setMatrixAt(removedIndex, instancedMatrix)
    keysForType[removedIndex] = movedKey
    const movedRef = blocks.get(movedKey)
    if (isInstancedBlockRef(movedRef)) movedRef.index = removedIndex
  }

  ref.mesh.setMatrixAt(lastIndex, hiddenInstanceMatrix)
  ref.mesh.count = Math.max(0, lastIndex)
  keysForType.pop()
  ref.mesh.instanceMatrix.needsUpdate = true
  ref.mesh.boundingSphere = null
  needUpdateBounds = true
}

function getBlockPositionFromKey(key: PackedBlockKey, target: THREE.Vector3) {
  return unpackBlockKeyInto(key, target)
}

function chunkCoord(value: number) {
  return Math.floor(value / CHUNK_SIZE)
}

function chunkKey(cx: number, cy: number, cz: number) {
  return `${cx},${cy},${cz}`
}

function chunkKeyForBlock(x: number, y: number, z: number) {
  return chunkKey(chunkCoord(x), chunkCoord(y), chunkCoord(z))
}

function terrainChunkKey(cx: number, cz: number) {
  return `${cx},${cz}`
}

function terrainChunkKeyForBlock(x: number, z: number) {
  return terrainChunkKey(chunkCoord(x), chunkCoord(z))
}

function markChunkDirty(key: string) {
  dirtyChunkKeys.add(key)
}

function markBlockAndNeighborChunksDirty(x: number, y: number, z: number) {
  markChunkDirty(chunkKeyForBlock(x, y, z))
  SOLID_NEIGHBOR_OFFSETS.forEach(([dx, dy, dz]) => markChunkDirty(chunkKeyForBlock(x + dx, y + dy, z + dz)))
}

function getOrCreateChunk(x: number, y: number, z: number) {
  const cx = chunkCoord(x)
  const cy = chunkCoord(y)
  const cz = chunkCoord(z)
  const key = chunkKey(cx, cy, cz)
  let chunk = chunks.get(key)
  if (!chunk) {
    chunk = { key, x: cx, y: cy, z: cz, buckets: new Map(), visibleFaceSummary: { ...EMPTY_CHUNK_VISIBLE_FACE_SUMMARY, buckets: new Map() } }
    chunks.set(key, chunk)
  }
  return chunk
}

function registerBlockInChunk(x: number, y: number, z: number, id: BlockId, key: PackedBlockKey) {
  const chunk = getOrCreateChunk(x, y, z)
  let bucket = chunk.buckets.get(id)
  if (!bucket) {
    bucket = { id, material: materials.get(id)!, blockKeys: new Set() }
    chunk.buckets.set(id, bucket)
  }
  bucket.blockKeys.add(key)
  markBlockAndNeighborChunksDirty(x, y, z)
}

function unregisterBlockFromChunk(x: number, y: number, z: number, id: BlockId, key: PackedBlockKey) {
  const cKey = chunkKeyForBlock(x, y, z)
  const chunk = chunks.get(cKey)
  if (!chunk) {
    markChunkDirty(cKey)
    return
  }

  const bucket = chunk.buckets.get(id)
  if (bucket) {
    bucket.blockKeys.delete(key)
    if (bucket.blockKeys.size === 0) chunk.buckets.delete(id)
  }
  if (chunk.buckets.size === 0) chunks.delete(cKey)
  markBlockAndNeighborChunksDirty(x, y, z)
}

function rebuildChunkVisibleFaceSummary(chunk: ChunkMetadata) {
  const bucketStats = new Map<BlockId, ChunkMeshBucketStats>()
  let solidBlockCount = 0
  let visibleSolidBlockCount = 0
  let visibleFaceCount = 0
  let specialBlockCount = 0

  chunk.buckets.forEach((bucket, id) => {
    const stats: ChunkMeshBucketStats = {
      blockCount: bucket.blockKeys.size,
      visibleBlockCount: 0,
      visibleFaceCount: 0,
    }

    bucket.blockKeys.forEach((key) => {
      const { x, y, z } = unpackBlockKeyInto(key, decodedBlockPosition)
      const exposedFaces = countExposedFaces(x, y, z, id)
      solidBlockCount++
      if (exposedFaces > 0) {
        visibleSolidBlockCount++
        visibleFaceCount += exposedFaces
        stats.visibleBlockCount++
        stats.visibleFaceCount += exposedFaces
      }
    })
    bucketStats.set(id, stats)
  })

  chunk.visibleFaceSummary = {
    revision: blockMutationVersion,
    solidBlockCount,
    visibleSolidBlockCount,
    visibleFaceCount,
    specialBlockCount,
    buckets: bucketStats,
  }
}

function rebuildDirtyChunkVisibleFaceSummaries(limit = Number.POSITIVE_INFINITY) {
  let rebuilt = 0
  for (const key of dirtyChunkKeys) {
    const chunk = chunks.get(key)
    if (chunk) rebuildChunkVisibleFaceSummary(chunk)
    dirtyChunkKeys.delete(key)
    rebuilt++
    if (rebuilt >= limit) break
  }
}

const chunkMeshTriangles = new Map<string, number>()

function rebuildOptimizedChunkMeshes(limit: number, timeBudgetMs = Number.POSITIVE_INFINITY) {
  const dirtyChunks = optimizedChunks.getDirtyChunks().slice(0, Math.max(0, limit))
  const startedAt = performance.now()
  const lookupOpaqueBlock = (x: number, y: number, z: number) => {
    const block = optimizedChunks.getBlock(x, y, z)
    return block && isOpaqueBlockId(block.id) ? block.id : null
  }

  for (const chunk of dirtyChunks) {
    const meshBlocks = optimizedChunks.getChunkBlocks(chunk.cx, chunk.cz).filter((block) => usesChunkMesh(block.id))
    if (meshBlocks.length === 0) {
      chunkMeshRenderer.removeChunk(chunk.key)
      chunkMeshTriangles.delete(chunk.key)
    } else {
      const meshData = buildChunkMeshData(meshBlocks, lookupOpaqueBlock, { includeNonGreedyBlocks: true })
      chunkMeshRenderer.upsertChunk(chunk.key, meshData.geometryGroups)
      chunkMeshTriangles.set(chunk.key, meshData.stats.triangleCount)
    }
    optimizedChunks.clearDirtyChunk(chunk.key)
    if (performance.now() - startedAt >= timeBudgetMs) break
  }
}

function seededNoise(...values: number[]) {
  const legacySeed = values.reduce((seed, value) => seed * 31 + value, 17)
  return hashNoise(legacySeed + (worldSeed === 0 ? 0 : worldSeed * 0.61803398875))
}

const grassPos = new THREE.Vector3()
const grassRot = new THREE.Quaternion()
const grassScale = new THREE.Vector3()
const grassEuler = new THREE.Euler()
const grassMatrix = new THREE.Matrix4()

function growGrassBladeMesh() {
  if (!grassBladeMesh) return
  const oldMesh = grassBladeMesh
  const oldCapacity = oldMesh.instanceMatrix.array.length / 16
  const newCapacity = oldCapacity * 2
  const newMesh = new THREE.InstancedMesh(oldMesh.geometry, oldMesh.material, newCapacity)
  newMesh.count = oldMesh.count
  newMesh.castShadow = oldMesh.castShadow
  newMesh.receiveShadow = oldMesh.receiveShadow
  newMesh.frustumCulled = oldMesh.frustumCulled
  
  for (let i = 0; i < oldMesh.count; i++) {
    oldMesh.getMatrixAt(i, grassMatrix)
    newMesh.setMatrixAt(i, grassMatrix)
  }
  newMesh.instanceMatrix.needsUpdate = true
  world.remove(oldMesh)
  world.add(newMesh)
  grassBladeMesh = newMesh
}

function addGrassTuft(x: number, y: number, z: number) {
  if (!grassBladeMesh) return
  const anchorKey = packBlockKey(x, y, z)
  const baseX = x + (seededNoise(x, y, z, 1) - 0.5) * 0.35
  const baseY = y + 0.56
  const baseZ = z + (seededNoise(x, y, z, 2) - 0.5) * 0.35
  
  const capacity = grassBladeMesh.instanceMatrix.array.length / 16
  for (let i = 0; i < 3; i++) {
    let index = grassBladeMesh.count
    if (index >= capacity) {
      growGrassBladeMesh()
    }
    index = grassBladeMesh.count
    
    const rotY = (Math.PI / 3) * i + seededNoise(x, y, z, i, 4) * 0.22
    const scale = 0.72 + seededNoise(x, y, z, i, 5) * 0.35
    
    grassPos.set(baseX, baseY, baseZ)
    grassEuler.set(0, rotY, 0)
    grassRot.setFromEuler(grassEuler)
    grassScale.set(scale, scale, scale)
    grassMatrix.compose(grassPos, grassRot, grassScale)
    
    grassBladeMesh.setMatrixAt(index, grassMatrix)
    grassBladeMesh.count = index + 1
    grassBladeKeys[index] = anchorKey
  }
  grassBladeMesh.instanceMatrix.needsUpdate = true
  needUpdateBounds = true
}

function removeGrassTuftsAt(anchorKey: PackedBlockKey) {
  if (!grassBladeMesh) return
  for (let i = grassBladeMesh.count - 1; i >= 0; i--) {
    if (grassBladeKeys[i] === anchorKey) {
      const lastIndex = grassBladeMesh.count - 1
      if (i !== lastIndex) {
        grassBladeMesh.getMatrixAt(lastIndex, grassMatrix)
        grassBladeMesh.setMatrixAt(i, grassMatrix)
        grassBladeKeys[i] = grassBladeKeys[lastIndex]
      }
      grassBladeMesh.setMatrixAt(lastIndex, hiddenInstanceMatrix)
      grassBladeMesh.count = lastIndex
      grassBladeKeys.pop()
    }
  }
  grassBladeMesh.instanceMatrix.needsUpdate = true
  needUpdateBounds = true
}

function addBlock(x: number, y: number, z: number, id: BlockId, source: BlockSource = 'terrain') {
  const k = packBlockKey(x, y, z)
  if (source === 'terrain' && removedTerrainBlocks.has(k)) return
  if (blocks.has(k)) return
  if (source === 'player') {
    removedTerrainBlocks.delete(k)
    playerPlacedBlocks.add(k)
  }
  blocks.set(k, undefined)
  blockMutationVersion++
  blockData.set(k, id)
  optimizedChunks.setBlock({ x, y, z, id })
  registerBlockInChunk(x, y, z, id, k)
  if (blockBatchDepth > 0) {
    markBatchedBlockAndNeighbors(x, y, z)
    return
  }
  refreshBlockAndNeighbors(x, y, z)

  const visual = blocks.get(k)
  if (visual) ensureGlowLightAt(k, x, y, z, id)
}

function removeBlockAtKey(k: PackedBlockKey, source: 'player' | 'system' = 'system') {
  if (!blocks.has(k)) return
  const visual = blocks.get(k)
  const { x, y, z } = unpackBlockKeyInto(k, decodedBlockPosition)
  if (source === 'player') {
    if (playerPlacedBlocks.has(k)) playerPlacedBlocks.delete(k)
    else removedTerrainBlocks.add(k)
  }
  const id = blockData.get(k) ?? (isInstancedBlockRef(visual) ? visual.id : undefined)
  removeGlowLightAt(k)
  if (isInstancedBlockRef(visual)) {
    removeInstancedBlockVisual(k, visual)
  }
  removeGrassTuftsAt(k)
  blocks.delete(k)
  blockMutationVersion++
  blockData.delete(k)
  optimizedChunks.deleteBlock(x, y, z)
  if (id) unregisterBlockFromChunk(x, y, z, id, k)
  if (blockBatchDepth > 0) markBatchedBlockAndNeighbors(x, y, z)
  else refreshBlockAndNeighbors(x, y, z)
}

function setStarterInventory() {
  inventory.reset()
}

function addToInventory(id: BlockId, amount = 1) {
  inventory.add(id, amount)
}

function consumeInventory(id: BlockId, amount = 1) {
  return inventory.remove(id, amount)
}

function readSavedInventory(savedInventory: SavedWorld['inventory']) {
  inventory.restore(savedInventory)
}

function readSavedExploration(savedExploration: SavedWorld['exploration']) {
  collectedShardBlocks.clear()
  collectedGlowShards = 0
  if (!savedExploration || typeof savedExploration !== 'object') return

  if (typeof savedExploration.glowShards === 'number' && Number.isFinite(savedExploration.glowShards)) {
    collectedGlowShards = Math.max(0, Math.min(EXPLORATION_GOAL_SHARDS, Math.floor(savedExploration.glowShards)))
  }
  if (Array.isArray(savedExploration.collectedShardBlocks)) {
    savedExploration.collectedShardBlocks.filter(isValidBlockKey).forEach((key) => {
      const packed = parseStringBlockKey(key)
      if (packed !== null) collectedShardBlocks.add(packed)
    })
    if (collectedGlowShards === 0) collectedGlowShards = Math.min(EXPLORATION_GOAL_SHARDS, collectedShardBlocks.size)
  }
}

function clearWorldBlocks() {
  const keysToRemove = [...blockData.keys()]
  keysToRemove.forEach((key) => removeBlockAtKey(key))
  instancedBlockMeshes.forEach((mesh) => {
    mesh.count = 0
    mesh.instanceMatrix.needsUpdate = true
    mesh.boundingSphere = null
  })
  instancedBlockKeys.forEach((keysForType) => { keysForType.length = 0 })
  glowLightsByBlock.clear()
  chunks.clear()
  if (grassBladeMesh) {
    grassBladeMesh.count = 0
    grassBladeMesh.instanceMatrix.needsUpdate = true
    grassBladeMesh.boundingSphere = null
  }
  grassBladeKeys.length = 0
  terrainGenerationEpoch += 1
  completedTerrainPlans.length = 0
  terrainWorkerInFlight = 0
  generatedTerrainChunks.clear()
  discoveredTerrainChunks.clear()
  queuedTerrainChunks.clear()
  terrainGenerationQueue.length = 0
  lastTerrainEnsureScanKey = ''
  lastTerrainCenterKey = ''
  pendingTerrainEnsure = null
  removedTerrainBlocks.clear()
  playerPlacedBlocks.clear()
  landmarkShardBlocks.clear()
  landmarkShardNames.clear()
  optimizedChunks.clear()
  chunkMeshRenderer.clear()
}

function serializeWorld(): SavedWorld {
  const savedBlocks: SavedBlock[] = []
  playerPlacedBlocks.forEach((key) => {
    const id = blockData.get(key)
    if (id) {
      const { x, y, z } = unpackBlockKeyInto(key, decodedBlockPosition)
      savedBlocks.push([x, y, z, id])
    }
  })
  return {
    version: 8,
    savedAt: Date.now(),
    format: 'delta',
    blocks: savedBlocks,
    terrainChunks: [...discoveredTerrainChunks],
    removedBlocks: [...removedTerrainBlocks].map(stringifyBlockKey),
    playerPlacedBlocks: [...playerPlacedBlocks].map(stringifyBlockKey),
    inventory: inventory.snapshot(),
    selectedBlock: BLOCKS[selected]?.id ?? BLOCKS[0].id,
    worldSeed,
    player: {
      position: controls.object.position.toArray() as [number, number, number],
      rotation: [controls.object.rotation.x, controls.object.rotation.y],
    },
    worldTime: simulationElapsedTime,
    survival: {
      crystalPower,
      carriedCrystal,
    },
    exploration: {
      glowShards: collectedGlowShards,
      collectedShardBlocks: [...collectedShardBlocks].map(stringifyBlockKey),
    },
    progression: progression.snapshot(),
    vitals: survivalVitals.snapshot(),
    tutorial: tutorialGuide.snapshot(),
  }
}

function isValidTerrainChunkKey(key: unknown): key is string {
  if (!isSavedTerrainChunkKey(key)) return false
  const [cx, cz] = key.split(',').map(Number)
  return isTerrainChunkInBounds(cx, cz)
}

function rebuildLandmarkShardBlocks() {
  landmarkShardBlocks.clear()
  landmarkShardNames.clear()
  generatedTerrainChunks.forEach((key) => {
    const [cx, cz] = key.split(',').map(Number)
    if (!Number.isInteger(cx) || !Number.isInteger(cz)) return
    const landmark = buildLandmarkPlan(cx, cz, CHUNK_SIZE, worldSeed, terrainHeightAt)
    landmark?.shardKeys.forEach((savedShardKey) => {
      const shardKey = parseStringBlockKey(savedShardKey)
      if (shardKey === null) return
      const id = blockData.get(shardKey)
      if ((id === 'glow' || id === 'crystal') && !playerPlacedBlocks.has(shardKey) && !collectedShardBlocks.has(shardKey)) {
        landmarkShardBlocks.add(shardKey)
        landmarkShardNames.set(shardKey, landmark.name)
      }
    })
  })
}

function applySavedWorld(data: SavedWorld) {
  if (!Array.isArray(data.blocks)) throw new Error('Bad save')
  const savedBlocks = data.blocks.filter(isValidSavedBlock)
  const isDeltaSave = data.format === 'delta' || data.version >= 6
  worldSeed = normalizeWorldSeed(data.worldSeed, 0)
  const playerState = sanitizePlayerState(data.player, {
    position: [PLAYER_SPAWN.x, PLAYER_SPAWN.y, PLAYER_SPAWN.z],
    rotation: [0, 0],
  }, {
    maxHorizontal: (TERRAIN_MAX_RADIUS + 1) * CHUNK_SIZE,
  })
  clearWorldBlocks()
  readSavedInventory(data.inventory)
  readSavedExploration(data.exploration)
  const savedSelection = isValidBlockId(data.selectedBlock)
    ? BLOCKS.findIndex(({ id }) => id === data.selectedBlock)
    : -1
  selected = savedSelection >= 0 ? savedSelection : 0

  if (Array.isArray(data.removedBlocks)) {
    data.removedBlocks.filter(isValidBlockKey).forEach((key) => {
      const packed = parseStringBlockKey(key)
      if (packed !== null) removedTerrainBlocks.add(packed)
    })
  }

  if (isDeltaSave) {
    const terrainKeys = Array.isArray(data.terrainChunks)
      ? data.terrainChunks.filter(isValidTerrainChunkKey)
      : []
    if (terrainKeys.length > 0) {
      terrainKeys.forEach((key) => discoveredTerrainChunks.add(key))
      terrainKeys.forEach((key) => {
        const [cx, cz] = key.split(',').map(Number)
        const resumeCx = chunkCoord(playerState.position[0])
        const resumeCz = chunkCoord(playerState.position[2])
        if (Math.max(Math.abs(cx - resumeCx), Math.abs(cz - resumeCz)) <= INITIAL_TERRAIN_LOAD_RADIUS) {
          generateTerrainChunk(cx, cz)
        }
      })
    } else {
      generateWorld()
    }
    withBlockBatch(() => {
      savedBlocks.forEach(([x, y, z, id]) => {
        const key = packBlockKey(x, y, z)
        if (blocks.has(key)) removeBlockAtKey(key)
        addBlock(x, y, z, id, 'save')
      })
    })
  } else {
    withBlockBatch(() => {
      savedBlocks.forEach(([x, y, z, id]) => addBlock(x, y, z, id, 'save'))
    })
    if (Array.isArray(data.terrainChunks)) {
      data.terrainChunks.filter(isValidTerrainChunkKey).forEach((key) => {
        generatedTerrainChunks.add(key)
        discoveredTerrainChunks.add(key)
      })
    } else {
      savedBlocks.forEach(([x, , z]) => {
        const key = terrainChunkKeyForBlock(x, z)
        generatedTerrainChunks.add(key)
        discoveredTerrainChunks.add(key)
      })
    }
  }

  playerPlacedBlocks.clear()
  if (Array.isArray(data.playerPlacedBlocks)) {
    data.playerPlacedBlocks.filter(isValidBlockKey).forEach((key) => {
      const packed = parseStringBlockKey(key)
      if (packed !== null && blockData.has(packed)) playerPlacedBlocks.add(packed)
    })
  }
  progression.restore(data.progression)
  tutorialGuide.restore(data.tutorial)
  tutorialGuide.syncProgression(progression.snapshot().stats)
  survivalVitals.restore(data.vitals)
  progression.setShardCount(collectedGlowShards)
  rebuildLandmarkShardBlocks()
  crystalPower = typeof data.survival?.crystalPower === 'number' ? Math.max(0, Math.min(100, data.survival.crystalPower)) : 68
  carriedCrystal = typeof data.survival?.carriedCrystal === 'number' ? Math.max(0, Math.floor(data.survival.carriedCrystal)) : 0
  restorePlayerState(playerState)
  simulationElapsedTime = typeof data.worldTime === 'number' && Number.isFinite(data.worldTime)
    ? Math.max(0, data.worldTime)
    : 0
  lastAutoSaveAt = simulationElapsedTime
  playerMotion.reset()
  updateProgressionUi()
}

function getWorldSaveSystem(slot: WorldSlotId = activeWorldSlot) {
  return new SaveSystem({ key: getWorldSlotSaveKey(slot) })
}

function saveWorld(silent = false) {
  cancelPendingAutoSave()
  saveActivity.begin()
  updateSaveActivityUi()
  const snapshot = serializeWorld()
  const result = getWorldSaveSystem().save(snapshot)
  if (!result.ok) {
    saveActivity.fail()
    updateSaveActivityUi()
    updateSaveMeta('Save failed. Local storage may be full or unavailable.')
    if (!silent) showToast('Save failed · storage unavailable')
    return false
  }
  saveActivity.complete(snapshot.savedAt)
  lastAutoSaveAt = simulationElapsedTime
  updateSaveActivityUi()
  updateSaveMeta()
  updateWorldSlotUi()
  if (!silent) showToast('World saved')
  return true
}

function loadWorld() {
  cancelPendingAutoSave()
  const saves = getWorldSaveSystem()
  if (!saves.hasSave()) {
    saveActivity.reset()
    updateSaveActivityUi()
    updateSaveMeta('No local save yet. Autosave starts after you begin exploring.')
    showToast('No save yet')
    return false
  }
  const data = saves.load()
  if (!data) {
    saveActivity.fail()
    updateSaveActivityUi()
    updateSaveMeta('Primary save is damaged. Use Recover if a backup is available.')
    updateWorldSlotUi()
    showToast('Save is broken · recovery available')
    return false
  }
  try {
    applySavedWorld(data)
    saveActivity.hydrate(data.savedAt)
    updateSaveActivityUi()
    updateSaveMeta()
    updateWorldSlotUi()
    showToast('World loaded')
    return true
  } catch {
    saveActivity.fail()
    updateSaveActivityUi()
    showToast('Save is broken')
    return false
  }
}

function exportWorld() {
  const data = getWorldSaveSystem().exportText(serializeWorld())
  const blob = new Blob([data], { type: 'application/json' })
  const link = document.createElement('a')
  const date = new Date().toISOString().slice(0, 10)
  link.href = URL.createObjectURL(blob)
  link.download = `astravoxel-ark-${getWorldExportSlug(worldSlotNames[activeWorldSlot], activeWorldSlot)}-${date}.json`
  link.click()
  URL.revokeObjectURL(link.href)
  showToast('Save exported')
}

function importWorld(file: File) {
  cancelPendingAutoSave()
  saveActivity.begin()
  updateSaveActivityUi()
  const reader = new FileReader()
  reader.addEventListener('load', () => {
    try {
      const saves = getWorldSaveSystem()
      const data = saves.importText(String(reader.result))
      if (!data) throw new Error('Invalid save structure')
      applySavedWorld(data)
      const snapshot = serializeWorld()
      const result = saves.save(snapshot)
      if (!result.ok) throw result.error
      saveActivity.complete(snapshot.savedAt)
      lastAutoSaveAt = simulationElapsedTime
      updateSaveActivityUi()
      updateSaveMeta()
      updateWorldSlotUi()
      updateHotbar()
      showToast('Save imported')
    } catch {
      saveActivity.fail()
      updateSaveActivityUi()
      showToast('Import failed')
    }
  })
  reader.readAsText(file)
}

function resetWorld() {
  cancelPendingAutoSave()
  const cleared = getWorldSaveSystem().clear()
  if (!cleared.ok) {
    saveActivity.fail()
    updateSaveActivityUi()
    showToast('New World failed · storage unavailable')
    return false
  }
  clearWorldBlocks()
  setStarterInventory()
  worldSeed = createWorldSeed()
  updateSaveMeta()
  crystalPower = 68
  carriedCrystal = 0
  collectedGlowShards = 0
  collectedShardBlocks.clear()
  progression.reset()
  tutorialGuide.reset()
  survivalVitals.reset()
  simulationElapsedTime = 0
  lastAutoSaveAt = 0
  saveActivity.reset()
  updateSaveActivityUi()
  generateWorld()
  controls.object.position.set(PLAYER_SPAWN.x, PLAYER_SPAWN.y, PLAYER_SPAWN.z)
  playerMotion.reset()
  updateHotbar()
  updateProgressionUi()
  updateWorldSlotUi()
  showToast('New world')
  return true
}

function updateSaveMeta(message?: string) {
  const saveMeta = document.querySelector<HTMLButtonElement>('.save-meta')
  if (!saveMeta) return
  if (message) {
    saveMeta.textContent = message
    return
  }
  const saves = getWorldSaveSystem()
  const positionLabel = formatWorldCoordinates(
    controls.object.position.x,
    controls.object.position.y,
    controls.object.position.z,
  )
  if (!saves.hasSave()) {
    saveMeta.textContent = `${worldSlotNames[activeWorldSlot]} · Seed ${formatWorldSeed(worldSeed)} · ${positionLabel} · New world`
    return
  }
  const saved = saves.load()
  if (saved) {
    const savedAt = typeof saved.savedAt === 'number' ? new Date(saved.savedAt) : null
    const timeLabel = savedAt && !Number.isNaN(savedAt.getTime())
      ? savedAt.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : 'time unavailable'
    const exploredCount = Array.isArray(saved.terrainChunks) ? saved.terrainChunks.length : discoveredTerrainChunks.size
    const savedSeed = normalizeWorldSeed(saved.worldSeed, 0)
    saveMeta.textContent = `${worldSlotNames[activeWorldSlot]} · Seed ${formatWorldSeed(savedSeed)} · ${positionLabel} · Saved ${timeLabel} · ${exploredCount} chunks · v${saved.version ?? '?'}`
  } else {
    saveMeta.textContent = saves.hasBackup()
      ? 'Primary save needs attention · a recovery backup is available.'
      : 'Primary save needs attention · no valid recovery backup was found.'
  }
}

function recoverWorld() {
  cancelPendingAutoSave()
  saveActivity.begin()
  updateSaveActivityUi()
  const recovered = getWorldSaveSystem().recover()
  if (!recovered) {
    saveActivity.fail()
    updateSaveActivityUi()
    showToast('No recovery backup available')
    updateWorldSlotUi()
    return false
  }
  try {
    applySavedWorld(recovered)
    saveActivity.hydrate(recovered.savedAt)
    lastAutoSaveAt = simulationElapsedTime
    updateSaveActivityUi()
    updateHotbar()
    updateProgressionUi()
    updateSaveMeta()
    updateWorldSlotUi()
    showToast('World recovered from backup')
    return true
  } catch {
    saveActivity.fail()
    updateSaveActivityUi()
    showToast('Recovery backup is invalid')
    return false
  }
}

function isSolidBlockAt(x: number, y: number, z: number) {
  const id = blockData.get(packBlockKey(x, y, z))
  return !!id && id !== 'water'
}

const playerCollision = new PlayerCollisionResolver({
  lookup: isSolidBlockAt,
  collider: {
    radius: PLAYER_RADIUS,
    bodyHeightBelowEye: PLAYER_HEIGHT,
    headClearance: PLAYER_HEAD_CLEARANCE,
    eyeHeight: PLAYER_EYE_HEIGHT,
    stepHeight: STEP_HEIGHT,
  },
  floorMinY: -2,
  floorMaxY: 18,
})

if (isSmokeTest) {
  void import('./player/CollisionSmoke').then(({ assertCollisionSmoke }) => {
    assertCollisionSmoke()
  }).catch((error) => console.error(error))
  void import('./world/LandmarkTemplatesSmoke').then(({ assertLandmarkTemplatesSmoke }) => {
    assertLandmarkTemplatesSmoke()
  }).catch((error) => console.error(error))
  void import('./player/PlayerMotionControllerSmoke').then(({ assertPlayerMotionControllerSmoke }) => {
    assertPlayerMotionControllerSmoke()
  }).catch((error) => console.error(error))
  void import('./game/SaveActivityTrackerSmoke').then(({ assertSaveActivityTrackerSmoke }) => {
    assertSaveActivityTrackerSmoke()
  }).catch((error) => console.error(error))
  void import('./world/WorldCoordinatesSmoke').then(({ assertWorldCoordinatesSmoke }) => {
    assertWorldCoordinatesSmoke()
  }).catch((error) => console.error(error))
  void import('./world/BlockKeySmoke').then(({ assertBlockKeySmoke }) => {
    assertBlockKeySmoke()
  }).catch((error) => console.error(error))
  void import('./singleplayer/TutorialGuideSmoke').then(({ assertTutorialGuideSmoke }) => {
    assertTutorialGuideSmoke()
  }).catch((error) => console.error(error))
  void import('./performance/RuntimePerformanceGuardSmoke').then(({ assertRuntimePerformanceGuardSmoke }) => {
    assertRuntimePerformanceGuardSmoke()
  }).catch((error) => console.error(error))
  void import('./singleplayer/MiningSystemSmoke').then(({ assertMiningSystemSmoke }) => {
    assertMiningSystemSmoke()
  }).catch((error) => console.error(error))
  void import('./singleplayer/ProgressionSystemSmoke').then(({ assertProgressionSystemSmoke }) => {
    assertProgressionSystemSmoke()
  }).catch((error) => console.error(error))
  void import('./singleplayer/BuildPatternSystemSmoke').then(({ assertBuildPatternSystemSmoke }) => {
    assertBuildPatternSystemSmoke()
  }).catch((error) => console.error(error))
}

function restorePlayerState(state: PlayerStateSnapshot) {
  const [x, y, z] = state.position
  controls.object.position.set(x, y, z)
  controls.object.rotation.x = state.rotation[0]
  controls.object.rotation.y = state.rotation[1]
  controls.object.rotation.z = 0

  // Player edits or imported saves may leave the stored eye point inside a block.
  // Search upward before falling back to the Ark spawn so load never traps the player.
  for (let offset = 0; offset <= 12; offset++) {
    controls.object.position.y = y + offset
    if (!playerCollision.collidesAt(controls.object.position)) return
  }
  controls.object.position.set(PLAYER_SPAWN.x, PLAYER_SPAWN.y, PLAYER_SPAWN.z)
  controls.object.rotation.set(0, 0, 0)
}

function movePlayerHorizontal(delta: THREE.Vector3) {
  const pos = controls.object.position
  const result = playerCollision.moveHorizontal(pos, delta, playerMotion.isGrounded && playerMotion.verticalSpeed <= 0.01)
  if (result.stepped) playerMotion.cancelVertical()
}

function movePlayerVertical(deltaY: number) {
  const pos = controls.object.position
  const result = playerCollision.moveVertical(pos, deltaY)
  if (result.collided) playerMotion.cancelVertical()
  if (result.grounded) playerMotion.setGrounded(true)
}

// 放置预览 ghost box
const previewGeometry = new THREE.BoxGeometry(1, 1, 1)
const previewMaterial = new THREE.MeshStandardMaterial({
  color: 0x88ddff,
  metalness: 0.2,
  roughness: 0.8,
  transparent: true,
  opacity: 0.35,
  emissive: 0x4488ff,
  emissiveIntensity: 0.2,
})
previewMaterial.depthWrite = false
const patternPreviewMaterial = previewMaterial.clone()
patternPreviewMaterial.depthWrite = false
const previewOutlineGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.025, 1.025, 1.025))
const previewOutlineMaterial = new THREE.LineBasicMaterial({ color: 0xa8ffb9, transparent: true, opacity: 0.95, depthTest: false })
const targetOutlineGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.018, 1.018, 1.018))
const targetOutlineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.88, depthTest: false })
let previewMesh: THREE.Mesh | null = null
let previewOutlineMesh: THREE.LineSegments | null = null
let patternPreviewMesh: THREE.InstancedMesh | null = null
const patternPreviewMatrix = new THREE.Matrix4()
const targetOutlineMesh = new THREE.LineSegments(targetOutlineGeometry, targetOutlineMaterial)
targetOutlineMesh.renderOrder = 12
targetOutlineMesh.visible = false
scene.add(targetOutlineMesh)

function createBreakParticles(position: THREE.Vector3, blockId: BlockId) {
  particleEffects.createBreakBurst({
    position,
    blockId,
    count: cosmeticEffectsReduced ? 3 : 6,
  })
}

function createShardBurst(position: THREE.Vector3) {
  particleEffects.createShardBurst(position, cosmeticEffectsReduced ? 8 : 16)
}

let soundVolume = 0.7
let soundEnabled = true

function isTerrainChunkInBounds(cx: number, cz: number) {
  return Math.hypot(cx, cz) <= TERRAIN_MAX_RADIUS
}

function hashNoise(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function terrainHeightAt(x: number, z: number) {
  return proceduralTerrainHeightAt(x, z, worldSeed)
}

function generateTerrainChunk(cx: number, cz: number) {
  const key = terrainChunkKey(cx, cz)
  if (!isTerrainChunkInBounds(cx, cz)) {
    queuedTerrainChunks.delete(key)
    return false
  }
  if (generatedTerrainChunks.has(key)) return false
  return applyTerrainPlan(buildProceduralChunkPlan(cx, cz, CHUNK_SIZE, worldSeed))
}

function applyTerrainPlan(plan: ProceduralChunkPlan) {
  const key = terrainChunkKey(plan.cx, plan.cz)
  if (!isTerrainChunkInBounds(plan.cx, plan.cz) || generatedTerrainChunks.has(key)) {
    queuedTerrainChunks.delete(key)
    return false
  }
  queuedTerrainChunks.delete(key)
  withBlockBatch(() => {
    plan.blocks.forEach(({ x, y, z, id }) => addBlock(x, y, z, id))
    if (runtimeProfile.tier !== 'ultra-low') {
      plan.grassTufts.forEach(([x, y, z]) => {
        if (blockData.has(packBlockKey(x, y, z))) addGrassTuft(x, y, z)
      })
    }
  })
  plan.landmarkShardKeys.forEach((savedShardKey) => {
    const shardKey = parseStringBlockKey(savedShardKey)
    if (shardKey === null) return
    const id = blockData.get(shardKey)
    if ((id === 'glow' || id === 'crystal') && !collectedShardBlocks.has(shardKey)) {
      landmarkShardBlocks.add(shardKey)
      if (plan.landmark) landmarkShardNames.set(shardKey, plan.landmark.name)
    }
  })
  const firstDiscovery = !discoveredTerrainChunks.has(key)
  generatedTerrainChunks.add(key)
  discoveredTerrainChunks.add(key)
  if (firstDiscovery) progression.recordExploredChunk()
  return true
}

function queueTerrainChunk(cx: number, cz: number) {
  if (!isTerrainChunkInBounds(cx, cz)) return
  const key = terrainChunkKey(cx, cz)
  if (generatedTerrainChunks.has(key) || queuedTerrainChunks.has(key)) return
  queuedTerrainChunks.add(key)
  terrainGenerationQueue.push({ cx, cz })
}

function processTerrainQueue(limit = TERRAIN_CHUNKS_PER_FRAME) {
  let generated = 0
  while (generated < limit && completedTerrainPlans.length > 0) {
    const plan = completedTerrainPlans.shift()!
    if (!isTerrainChunkWithinActiveRadius(plan.cx, plan.cz)) {
      queuedTerrainChunks.delete(terrainChunkKey(plan.cx, plan.cz))
      continue
    }
    if (applyTerrainPlan(plan)) generated += 1
  }
  if (!terrainWorker) {
    while (generated < limit && terrainGenerationQueue.length > 0) {
      const next = terrainGenerationQueue.shift()!
      if (!isTerrainChunkWithinActiveRadius(next.cx, next.cz)) {
        queuedTerrainChunks.delete(terrainChunkKey(next.cx, next.cz))
        continue
      }
      if (generateTerrainChunk(next.cx, next.cz)) generated += 1
    }
    return
  }

  while (terrainWorkerInFlight < runtimeLimits.terrainWorkerConcurrency && terrainGenerationQueue.length > 0) {
    const next = terrainGenerationQueue.shift()!
    const key = terrainChunkKey(next.cx, next.cz)
    if (!isTerrainChunkWithinActiveRadius(next.cx, next.cz)) {
      queuedTerrainChunks.delete(key)
      continue
    }
    if (generatedTerrainChunks.has(key)) {
      queuedTerrainChunks.delete(key)
      continue
    }
    const requestEpoch = terrainGenerationEpoch
    terrainWorkerInFlight += 1
    void terrainWorker.build(next.cx, next.cz, CHUNK_SIZE, worldSeed).then((plan) => {
      if (requestEpoch !== terrainGenerationEpoch) return
      terrainWorkerInFlight = Math.max(0, terrainWorkerInFlight - 1)
      completedTerrainPlans.push(plan)
    }).catch(() => {
      if (requestEpoch !== terrainGenerationEpoch) return
      terrainWorkerInFlight = Math.max(0, terrainWorkerInFlight - 1)
      completedTerrainPlans.push(buildProceduralChunkPlan(next.cx, next.cz, CHUNK_SIZE, worldSeed))
    })
  }
}

function ensureTerrainChunksAround(x: number, z: number, radius = terrainLoadRadius) {
  const centerCx = chunkCoord(x)
  const centerCz = chunkCoord(z)
  const scanKey = `${centerCx},${centerCz},${radius}`
  if (scanKey === lastTerrainEnsureScanKey) return
  lastTerrainEnsureScanKey = scanKey
  const pending: Array<{ cx: number; cz: number; distance: number }> = []
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      pending.push({ cx: centerCx + dx, cz: centerCz + dz, distance: Math.hypot(dx, dz) })
    }
  }
  pending.sort((a, b) => a.distance - b.distance)
  pending.forEach(({ cx, cz }) => queueTerrainChunk(cx, cz))
}

function effectiveTerrainLoadRadius() {
  return Math.max(INITIAL_TERRAIN_LOAD_RADIUS, terrainLoadRadius - performanceGuard.budget.viewDistancePenalty)
}

function isTerrainChunkWithinActiveRadius(cx: number, cz: number) {
  const position = controls.object.position
  const radius = effectiveTerrainLoadRadius()
  const centerCx = chunkCoord(position.x)
  const centerCz = chunkCoord(position.z)
  return Math.abs(cx - centerCx) <= radius && Math.abs(cz - centerCz) <= radius
}

function evictTerrainChunk(cx: number, cz: number) {
  const key = terrainChunkKey(cx, cz)
  if (!generatedTerrainChunks.has(key)) return false
  const residentBlocks = optimizedChunks.getChunkBlocks(cx, cz)
  withBlockBatch(() => {
    residentBlocks.forEach(({ x, y, z }) => {
      const blockKeyValue = packBlockKey(x, y, z)
      if (!playerPlacedBlocks.has(blockKeyValue)) {
        landmarkShardBlocks.delete(blockKeyValue)
        landmarkShardNames.delete(blockKeyValue)
        removeBlockAtKey(blockKeyValue)
      }
    })
  })
  generatedTerrainChunks.delete(key)
  queuedTerrainChunks.delete(key)
  chunkMeshRenderer.removeChunk(key)
  chunkMeshTriangles.delete(key)
  return true
}

function evictDistantTerrainChunks(x: number, z: number) {
  const center = { cx: chunkCoord(x), cz: chunkCoord(z) }
  const keepRadius = effectiveTerrainLoadRadius() + runtimeLimits.residentChunkPadding
  const candidates = selectChunksForEviction(
    generatedTerrainChunks,
    center,
    keepRadius,
    runtimeLimits.evictionBatchSize,
  )
  candidates.forEach(({ cx, cz }) => evictTerrainChunk(cx, cz))
}

function generateWorld() {
  lastTerrainEnsureScanKey = ''
  ensureTerrainChunksAround(PLAYER_SPAWN.x, PLAYER_SPAWN.z, INITIAL_TERRAIN_LOAD_RADIUS)
  while (terrainGenerationQueue.length > 0) {
    const next = terrainGenerationQueue.shift()!
    generateTerrainChunk(next.cx, next.cz)
  }
  rebuildOptimizedChunkMeshes(Number.POSITIVE_INFINITY)
}

setStarterInventory()
generateWorld()

const toast = document.querySelector<HTMLDivElement>('.toast')!
let toastTimer = 0
let lastToastMessage = ''
let lastToastAt = -Infinity
function showToast(message: string) {
  const now = performance.now()
  if (message === lastToastMessage && now - lastToastAt < 900) return
  lastToastMessage = message
  lastToastAt = now
  toast.textContent = message
  toast.classList.add('visible')
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 1800)
}

const saveButton = document.querySelector<HTMLButtonElement>('.save-btn')!
const loadButton = document.querySelector<HTMLButtonElement>('.load-btn')!
const recoverButton = document.querySelector<HTMLButtonElement>('.recover-btn')!
const exportButton = document.querySelector<HTMLButtonElement>('.export-btn')!
const importButton = document.querySelector<HTMLButtonElement>('.import-btn')!
const resetButton = document.querySelector<HTMLButtonElement>('.reset-btn')!
const importInput = document.querySelector<HTMLInputElement>('.import-input')!
saveButton.addEventListener('click', () => saveWorld())
loadButton.addEventListener('click', () => {
  if (loadWorld()) updateHotbar()
})
recoverButton.addEventListener('click', recoverWorld)
exportButton.addEventListener('click', exportWorld)
importButton.addEventListener('click', () => importInput.click())
importInput.addEventListener('change', () => {
  const file = importInput.files?.[0]
  if (file) importWorld(file)
  importInput.value = ''
})
let resetConfirmUntil = 0
resetButton.addEventListener('click', () => {
  const now = performance.now()
  if (now > resetConfirmUntil) {
    resetConfirmUntil = now + 3000
    showToast('Tap New World again to confirm')
    return
  }
  resetConfirmUntil = 0
  resetWorld()
})
const platform = new THREE.Mesh(
  new THREE.CylinderGeometry(40, 48, 2, runtimeProfile.tier === 'ultra-low' ? 32 : lowPowerMode ? 48 : runtimeProfile.tier === 'standard' ? 64 : 96),
  new THREE.MeshStandardMaterial({ color: 0x55657b, roughness: 0.9 })
)
platform.position.y = -2
platform.receiveShadow = !lowPowerMode
scene.add(platform)

const maxStars = runtimeProfile.tier === 'ultra-low' ? 20 : lowPowerMode ? 40 : runtimeProfile.tier === 'standard' ? 160 : 260
const starPositions = new Float32Array(maxStars * 3)
for (let i = 0; i < maxStars; i++) {
  starPositions[i * 3] = (Math.random() - 0.5) * 180
  starPositions[i * 3 + 1] = 35 + Math.random() * 80
  starPositions[i * 3 + 2] = (Math.random() - 0.5) * 180
}
const starBufferGeo = new THREE.BufferGeometry()
starBufferGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
const starPointMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.28, sizeAttenuation: true })
const stars = new THREE.Points(starBufferGeo, starPointMat)
scene.add(stars)

const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, roughness: 1 })
const cloudGeo = new THREE.SphereGeometry(1, 16, 8)
const clouds = new THREE.Group()
const maxClouds = runtimeProfile.tier === 'ultra-low' ? 2 : lowPowerMode ? 3 : runtimeProfile.tier === 'standard' ? 12 : 18
for (let i = 0; i < maxClouds; i++) {
  const cloud = new THREE.Group()
  const x = (Math.random() - 0.5) * 95
  const z = (Math.random() - 0.5) * 95
  const y = 18 + Math.random() * 16
  cloud.position.set(x, y, z)
  for (let j = 0; j < 4; j++) {
    const puff = new THREE.Mesh(cloudGeo, cloudMat)
    puff.position.set((j - 1.5) * 1.3, Math.sin(j) * 0.35, (Math.random() - 0.5) * 1.2)
    puff.scale.set(2.5 + Math.random() * 2.2, 0.42 + Math.random() * 0.25, 1.0 + Math.random() * 0.9)
    cloud.add(puff)
  }
  clouds.add(cloud)
}
scene.add(clouds)

const sparkles = new THREE.Group()
const sparkleGeo = new THREE.IcosahedronGeometry(0.055, 0)
const sparkleMat = new THREE.MeshBasicMaterial({ color: 0xfff1b8, transparent: true, opacity: 0.82 })
const maxSparkles = runtimeProfile.tier === 'ultra-low' ? 0 : lowPowerMode ? 6 : runtimeProfile.tier === 'standard' ? 72 : 120
for (let i = 0; i < maxSparkles; i++) {
  const sparkle = new THREE.Mesh(sparkleGeo, sparkleMat)
  sparkle.position.set((Math.random() - 0.5) * 62, 5 + Math.random() * 18, (Math.random() - 0.5) * 62)
  sparkle.userData.seed = Math.random() * Math.PI * 2
  sparkles.add(sparkle)
}
scene.add(sparkles)

const shardBeacon = new THREE.Group()
const shardBeaconRing = new THREE.Mesh(
  new THREE.TorusGeometry(0.72, 0.035, 8, 48),
  new THREE.MeshBasicMaterial({ color: 0xfff3a8, transparent: true, opacity: 0.78 })
)
const shardBeaconHalo = new THREE.Mesh(
  new THREE.RingGeometry(0.25, 0.95, 48),
  new THREE.MeshBasicMaterial({ color: 0x9ee8ff, transparent: true, opacity: 0.28, side: THREE.DoubleSide })
)
const shardBeaconLight = new THREE.PointLight(0xfff3a8, lowPowerMode ? 0 : 0.9, 8)
shardBeaconRing.rotation.x = Math.PI / 2
shardBeaconHalo.rotation.x = -Math.PI / 2
shardBeacon.add(shardBeaconRing, shardBeaconHalo, shardBeaconLight)
shardBeacon.visible = false
scene.add(shardBeacon)

const arkCore = new THREE.Group()
const arkCoreBase = new THREE.Mesh(
  new THREE.CylinderGeometry(1.15, 1.35, 0.28, 6),
  new THREE.MeshStandardMaterial({ color: 0x22334c, roughness: 0.72, metalness: 0.18 })
)
const arkCoreRing = new THREE.Mesh(
  new THREE.TorusGeometry(1.32, 0.035, 8, 48),
  new THREE.MeshBasicMaterial({ color: 0x9ee8ff, transparent: true, opacity: 0.24 })
)
const arkCoreSpire = new THREE.Mesh(
  new THREE.OctahedronGeometry(0.42, 0),
  new THREE.MeshStandardMaterial({ color: 0x6a7cff, emissive: 0x2b3b9a, emissiveIntensity: 0.22, roughness: 0.34, metalness: 0.2 })
)
const arkCoreLight = new THREE.PointLight(0x9ee8ff, lowPowerMode ? 0 : 0.2, 9)
const arkCoreModuleMaterials: THREE.MeshStandardMaterial[] = []
const arkCoreModules: THREE.Mesh[] = []
arkCore.position.set(0, 7.6, 10)
arkCoreRing.rotation.x = Math.PI / 2
arkCoreSpire.position.y = 0.82
arkCoreLight.position.y = 0.9
arkCore.add(arkCoreBase, arkCoreRing, arkCoreSpire, arkCoreLight)
for (let i = 0; i < EXPLORATION_GOAL_SHARDS; i += 1) {
  const angle = (i / EXPLORATION_GOAL_SHARDS) * Math.PI * 2
  const material = new THREE.MeshStandardMaterial({
    color: 0x5f748e,
    emissive: 0x08111c,
    emissiveIntensity: 0.08,
    transparent: true,
    opacity: 0.72,
    roughness: 0.5,
    metalness: 0.16,
  })
  const module = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), material)
  module.position.set(Math.cos(angle) * 1.34, 0.35, Math.sin(angle) * 1.34)
  module.rotation.y = angle
  arkCoreModuleMaterials.push(material)
  arkCoreModules.push(module)
  arkCore.add(module)
}
scene.add(arkCore)

let selected = 0
const HOTBAR_PAGE_SIZE = 9
const HOTBAR_PAGE_COUNT = Math.ceil(BLOCKS.length / HOTBAR_PAGE_SIZE)
let hotbarPage = 0
const hotbar = document.querySelector<HTMLDivElement>('.hotbar')!
const blockInfo = document.querySelector<HTMLDivElement>('.block-info')!
const blockName = blockInfo.querySelector<HTMLDivElement>('.block-name')!
const blockCount = blockInfo.querySelector<HTMLDivElement>('.block-count')!
const hotbarSlots: HTMLButtonElement[] = []
const hotbarCounts: HTMLSpanElement[] = []
const wayfinderValue = document.querySelector<HTMLSpanElement>('.wayfinder-value')!
const compassBadge = document.querySelector<HTMLDivElement>('.compass-badge')!
const compassArrow = document.querySelector<HTMLSpanElement>('.compass-arrow')!
const compassDistance = document.querySelector<HTMLSpanElement>('.compass-distance')!

function countBlocksInInventory(blockId: BlockId): number {
  return inventory.count(blockId)
}

function updateBlockInfo() {
  const block = BLOCKS[selected]
  const pattern = getBuildPatternDefinition(activeBuildPattern)
  blockName.textContent = block.name
  blockCount.textContent = `${countBlocksInInventory(block.id)} · ${pattern.name}${pattern.blockCount > 1 ? ` ×${pattern.blockCount}` : ''}`
}

function updateHotbar() {
  const selectedPage = Math.floor(selected / HOTBAR_PAGE_SIZE)
  if (selectedPage !== hotbarPage) {
    hotbarPage = selectedPage
    renderHotbar()
    return
  }
  hotbarSlots.forEach((slot, visibleIndex) => {
    const blockIndex = Number(slot.dataset.slot)
    const count = countBlocksInInventory(BLOCKS[blockIndex].id)
    slot.classList.toggle('active', blockIndex === selected)
    slot.classList.toggle('empty', count <= 0)
    hotbarCounts[visibleIndex].textContent = String(count)
  })
  revealSelectedHotbarSlot()
  updateBlockInfo()
}

function revealSelectedHotbarSlot() {
  const slot = hotbarSlots.find((candidate) => Number(candidate.dataset.slot) === selected)
  if (!slot || hotbar.scrollWidth <= hotbar.clientWidth) return
  hotbar.scrollLeft = Math.max(0, slot.offsetLeft - hotbar.clientWidth / 2 + slot.clientWidth / 2)
}

function pulseSelectedSlot() {
  const slot = hotbarSlots.find((candidate) => Number(candidate.dataset.slot) === selected)
  if (!slot) return
  slot.classList.remove('selected-pulse')
  void slot.offsetWidth
  slot.classList.add('selected-pulse')
  window.setTimeout(() => slot.classList.remove('selected-pulse'), 180)
}

type HotbarSelectionSource = 'pointer' | 'wheel' | 'key' | 'page' | 'backpack' | 'auto'

function selectHotbarSlot(index: number, source: HotbarSelectionSource = 'pointer') {
  if (!Number.isInteger(index) || index < 0 || index >= BLOCKS.length) return
  const changed = selected !== index
  selected = index
  const nextPage = Math.floor(selected / HOTBAR_PAGE_SIZE)
  if (nextPage !== hotbarPage) {
    hotbarPage = nextPage
    renderHotbar()
  } else {
    updateHotbar()
  }
  if (source !== 'auto') {
    pulseSelectedSlot()
    if (changed || source === 'wheel') playGameSound('select', source === 'wheel' ? 0.08 : 0.06)
  }
}

function switchHotbarPage() {
  const nextPage = (hotbarPage + 1) % HOTBAR_PAGE_COUNT
  const localIndex = selected % HOTBAR_PAGE_SIZE
  selectHotbarSlot(Math.min(nextPage * HOTBAR_PAGE_SIZE + localIndex, BLOCKS.length - 1), 'page')
}

function directionLabel(dx: number, dz: number) {
  const angle = Math.atan2(dx, -dz)
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return directions[Math.round((angle / (Math.PI / 4) + 8) % 8)]
}

function findNearestShard() {
  let nearestKey: PackedBlockKey | null = null
  let nearestDistanceSq = Infinity
  const pos = controls.object.position
  landmarkShardBlocks.forEach((key) => {
    if (collectedShardBlocks.has(key)) return
    getBlockPositionFromKey(key, hitBlockPosition)
    const dx = hitBlockPosition.x - pos.x
    const dz = hitBlockPosition.z - pos.z
    const distanceSq = dx * dx + dz * dz
    if (distanceSq < nearestDistanceSq) {
      nearestDistanceSq = distanceSq
      nearestKey = key
    }
  })
  if (nearestKey === null) return null
  getBlockPositionFromKey(nearestKey, hitBlockPosition)
  return {
    key: nearestKey,
    x: hitBlockPosition.x,
    y: hitBlockPosition.y,
    z: hitBlockPosition.z,
    dx: hitBlockPosition.x - pos.x,
    dz: hitBlockPosition.z - pos.z,
    distance: Math.sqrt(nearestDistanceSq),
    landmarkName: landmarkShardNames.get(nearestKey) ?? 'Core Shard',
  }
}

function updateCompassUi(nearest: ReturnType<typeof findNearestShard>) {
  if (collectedGlowShards >= EXPLORATION_GOAL_SHARDS) {
    compassBadge.classList.add('complete')
    compassArrow.style.transform = 'rotate(0deg)'
    compassDistance.textContent = 'Ark core restored'
    shardBeacon.visible = false
    return
  }
  compassBadge.classList.remove('complete')
  if (!nearest) {
    compassArrow.style.transform = 'rotate(0deg)'
    compassDistance.textContent = 'Scan for core shards'
    shardBeacon.visible = false
    return
  }
  const yaw = controls.object.rotation.y
  const worldAngle = Math.atan2(nearest.dx, -nearest.dz)
  compassArrow.style.transform = `rotate(${worldAngle - yaw}rad)`
  compassDistance.textContent = `${nearest.landmarkName} · ${directionLabel(nearest.dx, nearest.dz)} ${Math.round(nearest.distance)}m`
  shardBeacon.position.set(nearest.x, nearest.y + 2.35, nearest.z)
  shardBeacon.visible = true
}

function updateShardSignal() {
  const nearest = findNearestShard()
  updateCompassUi(nearest)
  updateArkCoreVisual()
  if (collectedGlowShards >= EXPLORATION_GOAL_SHARDS) {
    wayfinderValue.textContent = 'Core Online'
    return
  }
  if (!nearest) {
    wayfinderValue.textContent = `Core ${collectedGlowShards}/${EXPLORATION_GOAL_SHARDS} · Explore`
    return
  }
  wayfinderValue.textContent = `Core ${collectedGlowShards}/${EXPLORATION_GOAL_SHARDS} · ${directionLabel(nearest.dx, nearest.dz)} ${Math.round(nearest.distance)}m`
}

function updateArkCoreVisual() {
  const progress = collectedGlowShards / EXPLORATION_GOAL_SHARDS
  arkCoreModuleMaterials.forEach((material, index) => {
    const active = index < collectedGlowShards
    material.color.setHex(active ? 0xfff3a8 : 0x5f748e)
    material.emissive.setHex(active ? 0x8d75ff : 0x08111c)
    material.emissiveIntensity = active ? 0.65 : 0.08
    material.opacity = active ? 0.96 : 0.72
  })
  ;(arkCoreRing.material as THREE.MeshBasicMaterial).opacity = 0.2 + progress * 0.44
  ;(arkCoreSpire.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.22 + progress * 0.52
  arkCoreLight.intensity = lowPowerMode ? 0 : 0.2 + progress * 0.75
}

function selectNextAvailableBlock() {
  if (countBlocksInInventory(BLOCKS[selected].id) > 0) return
  const nextIndex = BLOCKS.findIndex((block) => countBlocksInInventory(block.id) > 0)
  if (nextIndex >= 0 && nextIndex !== selected) selectHotbarSlot(nextIndex, 'auto')
}

function renderHotbar() {
  const startIndex = hotbarPage * HOTBAR_PAGE_SIZE
  const visibleBlocks = BLOCKS.slice(startIndex, startIndex + HOTBAR_PAGE_SIZE)
  hotbar.dataset.page = String(hotbarPage + 1)
  hotbar.innerHTML = `<button class="hotbar-page" aria-label="Switch material palette, page ${hotbarPage + 1} of ${HOTBAR_PAGE_COUNT}"><span>${hotbarPage + 1}/${HOTBAR_PAGE_COUNT}</span><small>Palette</small></button>` + visibleBlocks.map((b, localIndex) => {
    const i = startIndex + localIndex
    const count = countBlocksInInventory(b.id)
    return `<button class="slot ${i === selected ? 'active' : ''} ${count <= 0 ? 'empty' : ''}" data-slot="${i}" aria-label="Select ${b.name}"><span class="key">${localIndex + 1}</span><span class="swatch" style="background:#${b.color.toString(16).padStart(6, '0')}"></span><span class="count">${count}</span></button>`
  }).join('')
  hotbarSlots.length = 0
  hotbarCounts.length = 0
  hotbar.querySelectorAll<HTMLButtonElement>('.slot').forEach((slot) => {
    hotbarSlots.push(slot)
    hotbarCounts.push(slot.querySelector<HTMLSpanElement>('.count')!)
    slot.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      selectHotbarSlot(Number(slot.dataset.slot), 'pointer')
    })
  })
  hotbar.querySelector<HTMLButtonElement>('.hotbar-page')!.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    switchHotbarPage()
  })
  revealSelectedHotbarSlot()
  updateBlockInfo()
}
renderHotbar()

const start = document.querySelector<HTMLDivElement>('.start')!
let mobileActive = false

const helpToggleBtn = document.querySelector<HTMLButtonElement>('.help-toggle-btn')!
const helpPanel = document.querySelector<HTMLDivElement>('.help')!
const tutorialPanel = document.querySelector<HTMLDivElement>('.tutorial')!
const tutorialProgress = tutorialPanel.querySelector<HTMLSpanElement>('.tutorial-progress')!
const tutorialTitle = tutorialPanel.querySelector<HTMLElement>('.tutorial-title')!
const tutorialPrompt = tutorialPanel.querySelector<HTMLElement>('.tutorial-prompt')!
const helpGuideTitle = helpPanel.querySelector<HTMLElement>('.help-guide-title')!
const helpGuidePrompt = helpPanel.querySelector<HTMLElement>('.help-guide-prompt')!
const menuToggleBtn = document.querySelector<HTMLButtonElement>('.menu-toggle-btn')!
const pauseMenu = document.querySelector<HTMLDivElement>('.pause-menu')!
const resumeButton = document.querySelector<HTMLButtonElement>('.resume-btn')!
type PauseMenuTab = 'settings' | 'expedition' | 'world'
const pauseMenuTabs = [...document.querySelectorAll<HTMLButtonElement>('[data-menu-tab]')]
const pauseMenuPages = [...document.querySelectorAll<HTMLElement>('[data-menu-page]')]
let activePauseMenuTab: PauseMenuTab = 'settings'
let renderedTutorialStep = ''
let announcedTutorialStep = ''
const sensitivityInput = document.querySelector<HTMLInputElement>('.sensitivity-input')!
const sensitivityValue = document.querySelector<HTMLOutputElement>('.sensitivity-value')!
const fovInput = document.querySelector<HTMLInputElement>('.fov-input')!
const fovValue = document.querySelector<HTMLOutputElement>('.fov-value')!
const viewDistanceSelect = document.querySelector<HTMLSelectElement>('.view-distance-select')!
const frameRateSelect = document.querySelector<HTMLSelectElement>('.frame-rate-select')!
const volumeInput = document.querySelector<HTMLInputElement>('.volume-input')!
const volumeValue = document.querySelector<HTMLOutputElement>('.volume-value')!
const qualityButtons = [...document.querySelectorAll<HTMLButtonElement>('.quality-btn')]
viewDistanceSelect.querySelectorAll<HTMLOptionElement>('option').forEach((option) => {
  option.disabled = Number(option.value) > runtimeLimits.maxViewDistance
})
const perfToggle = document.querySelector<HTMLInputElement>('.perf-toggle')!
const soundToggle = document.querySelector<HTMLInputElement>('.sound-toggle')!
const toolTierValue = document.querySelector<HTMLSpanElement>('.tool-tier-value')!
const objectiveList = document.querySelector<HTMLDivElement>('.objective-list')!
const claimAllObjectivesButton = document.querySelector<HTMLButtonElement>('.claim-all-objectives')!
const inventoryGrid = document.querySelector<HTMLDivElement>('.inventory-grid')!
const recipeList = document.querySelector<HTMLDivElement>('.recipe-list')!
const buildPatternButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-build-pattern]')]
const expeditionNavButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-expedition-view]')]
const expeditionPages = [...document.querySelectorAll<HTMLElement>('[data-expedition-page]')]
const blockNames = new Map(BLOCKS.map(({ id, name }) => [id, name]))
const worldSlotButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-world-slot]')]
const worldNameEditor = document.querySelector<HTMLFormElement>('.world-name-editor')!
const worldNameInput = document.querySelector<HTMLInputElement>('.world-name-input')!
const worldSeedButton = document.querySelector<HTMLButtonElement>('.world-seed')!
const pauseSessionLabel = document.querySelector<HTMLElement>('.pause-session-label')!
const sessionCurrentLabel = document.querySelector<HTMLElement>('.session-current')!
const startPrimaryButton = start.querySelector<HTMLButtonElement>('.panel > button:not(.start-multiplayer)')!

function updateTutorialUi(announce = false) {
  const progressionSnapshot = progression.snapshot()
  tutorialGuide.syncProgression(progressionSnapshot.stats)
  const step = tutorialGuide.current()
  if (step.id !== renderedTutorialStep) {
    const progress = tutorialGuide.getProgress()
    tutorialPanel.dataset.tutorialStep = step.id
    tutorialProgress.textContent = `${progress.current}/${progress.total}`
    tutorialTitle.textContent = step.title
    tutorialPrompt.textContent = tutorialGuide.prompt(isTouchDevice)
    helpGuideTitle.textContent = `${step.title} · ${progress.current}/${progress.total}`
    helpGuidePrompt.textContent = tutorialGuide.prompt(isTouchDevice)
    renderedTutorialStep = step.id
  }
  if (announce && step.id !== announcedTutorialStep) {
    showToast(`Guide · ${tutorialGuide.prompt(isTouchDevice)}`)
    announcedTutorialStep = step.id
  }
}

function advanceTutorial(id: TutorialStepId, announce = true) {
  if (!tutorialGuide.complete(id)) return
  updateTutorialUi(announce)
}

function updateWorldSlotUi() {
  const activeLabel = worldSlotNames[activeWorldSlot]
  pauseSessionLabel.textContent = `${activeLabel} · Offline`
  sessionCurrentLabel.textContent = `${activeLabel} · offline`
  const activeSaves = getWorldSaveSystem()
  startPrimaryButton.textContent = activeSaves.hasSave()
    ? `Continue ${activeLabel}`
    : `Start ${activeLabel}`
  worldSeedButton.querySelector('strong')!.textContent = formatWorldSeed(worldSeed)
  recoverButton.disabled = !activeSaves.hasBackup()
  recoverButton.title = recoverButton.disabled ? 'No valid backup yet' : 'Restore the previous valid save'
  if (document.activeElement !== worldNameInput) worldNameInput.value = activeLabel

  worldSlotButtons.forEach((button) => {
    const slot = sanitizeWorldSlotId(button.dataset.worldSlot)
    const active = slot === activeWorldSlot
    const slotSaves = getWorldSaveSystem(slot)
    const hasSave = slotSaves.hasSave()
    const saved = slotSaves.load()
    button.classList.toggle('active', active)
    button.setAttribute('aria-pressed', String(active))
    button.querySelector('strong')!.textContent = worldSlotNames[slot]
    const status = button.querySelector('small')!
    if (!hasSave) {
      status.textContent = active ? 'Active · New world' : 'Empty world'
      return
    }
    if (saved) {
      const savedAt = typeof saved.savedAt === 'number' ? new Date(saved.savedAt) : null
      const dateLabel = savedAt && !Number.isNaN(savedAt.getTime())
        ? savedAt.toLocaleDateString([], { month: 'short', day: 'numeric' })
        : 'Saved'
      const explored = Array.isArray(saved.terrainChunks) ? saved.terrainChunks.length : 0
      status.textContent = `${active ? 'Active · ' : ''}${dateLabel} · ${explored} chunks`
    } else {
      status.textContent = `${active ? 'Active · ' : ''}${slotSaves.hasBackup() ? 'Recoverable' : 'Needs attention'}`
    }
  })
}

worldSeedButton.addEventListener('click', () => {
  const seedText = String(worldSeed)
  if (!navigator.clipboard?.writeText) {
    showToast(`Seed ${formatWorldSeed(worldSeed)}`)
    return
  }
  void navigator.clipboard.writeText(seedText).then(
    () => showToast('World seed copied'),
    () => showToast(`Seed ${formatWorldSeed(worldSeed)}`),
  )
})

worldNameEditor.addEventListener('submit', (event) => {
  event.preventDefault()
  const result = worldSlotNameStore.saveName(activeWorldSlot, worldNameInput.value)
  if (!result.ok) {
    worldNameInput.value = worldSlotNames[activeWorldSlot]
    showToast('Rename failed · storage unavailable')
    return
  }
  worldSlotNames = result.names
  worldNameInput.value = worldSlotNames[activeWorldSlot]
  updateWorldSlotUi()
  updateSaveMeta()
  showToast(`World renamed · ${worldSlotNames[activeWorldSlot]}`)
})

function switchWorldSlot(nextSlot: WorldSlotId) {
  if (nextSlot === activeWorldSlot) return
  const previousSlot = activeWorldSlot
  if (!saveWorld(true)) {
    showToast('Could not switch · current world was not saved')
    return
  }
  activeWorldSlot = nextSlot
  localStorage.setItem(ACTIVE_WORLD_SLOT_KEY, activeWorldSlot)
  const targetExists = getWorldSaveSystem().hasSave()
  if (!targetExists) {
    if (!resetWorld()) {
      activeWorldSlot = previousSlot
      localStorage.setItem(ACTIVE_WORLD_SLOT_KEY, activeWorldSlot)
      loadWorld()
      updateWorldSlotUi()
      return
    }
  } else if (!loadWorld()) {
    activeWorldSlot = previousSlot
    localStorage.setItem(ACTIVE_WORLD_SLOT_KEY, activeWorldSlot)
    loadWorld()
    updateWorldSlotUi()
    showToast(`${worldSlotNames[nextSlot]} could not be opened`)
    return
  }
  updateHotbar()
  updateProgressionUi()
  updateSaveMeta()
  updateWorldSlotUi()
  showToast(`${worldSlotNames[activeWorldSlot]} ready`)
}

worldSlotButtons.forEach((button) => {
  button.addEventListener('click', () => switchWorldSlot(sanitizeWorldSlotId(button.dataset.worldSlot)))
})

function setPauseMenuTab(tab: PauseMenuTab) {
  activePauseMenuTab = tab
  if (tab === 'expedition') advanceTutorial('backpack')
  pauseMenuTabs.forEach((button) => {
    const active = button.dataset.menuTab === tab
    button.classList.toggle('active', active)
    button.setAttribute('aria-selected', String(active))
    button.tabIndex = active ? 0 : -1
  })
  pauseMenuPages.forEach((page) => {
    const active = page.dataset.menuPage === tab
    page.classList.toggle('active', active)
    page.hidden = !active
    if (active) page.scrollTop = 0
  })
}

pauseMenuTabs.forEach((button) => {
  button.addEventListener('click', () => {
    const tab = button.dataset.menuTab
    if (tab === 'settings' || tab === 'expedition' || tab === 'world') setPauseMenuTab(tab)
  })
  button.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const currentIndex = pauseMenuTabs.indexOf(button)
    const direction = event.key === 'ArrowRight' ? 1 : -1
    const nextButton = pauseMenuTabs[(currentIndex + direction + pauseMenuTabs.length) % pauseMenuTabs.length]
    const nextTab = nextButton.dataset.menuTab
    if (nextTab === 'settings' || nextTab === 'expedition' || nextTab === 'world') {
      setPauseMenuTab(nextTab)
      nextButton.focus()
    }
  })
})
setPauseMenuTab(activePauseMenuTab)

type ExpeditionView = 'journey' | 'backpack' | 'workshop'
let activeExpeditionView: ExpeditionView = 'journey'

function setExpeditionView(view: ExpeditionView) {
  activeExpeditionView = view
  expeditionNavButtons.forEach((button) => {
    const active = button.dataset.expeditionView === view
    button.classList.toggle('active', active)
    button.setAttribute('aria-selected', String(active))
    button.tabIndex = active ? 0 : -1
  })
  expeditionPages.forEach((page) => {
    const active = page.dataset.expeditionPage === view
    page.classList.toggle('active', active)
    page.hidden = !active
  })
}

expeditionNavButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const view = button.dataset.expeditionView
    if (view === 'journey' || view === 'backpack' || view === 'workshop') setExpeditionView(view)
  })
  button.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const currentIndex = expeditionNavButtons.indexOf(button)
    const direction = event.key === 'ArrowRight' ? 1 : -1
    const nextButton = expeditionNavButtons[(currentIndex + direction + expeditionNavButtons.length) % expeditionNavButtons.length]
    const view = nextButton.dataset.expeditionView
    if (view === 'journey' || view === 'backpack' || view === 'workshop') {
      setExpeditionView(view)
      nextButton.focus()
    }
  })
})
setExpeditionView(activeExpeditionView)

function setBuildPattern(pattern: BuildPatternId, announce = true) {
  activeBuildPattern = pattern
  buildPatternButtons.forEach((button) => {
    const active = button.dataset.buildPattern === pattern
    button.classList.toggle('active', active)
    button.setAttribute('aria-pressed', String(active))
  })
  updateBlockInfo()
  if (announce) {
    const definition = getBuildPatternDefinition(pattern)
    showToast(`${definition.name} pattern · ${definition.blockCount} block${definition.blockCount === 1 ? '' : 's'}`)
  }
}

function cycleBuildPattern() {
  const index = BUILD_PATTERNS.findIndex(({ id }) => id === activeBuildPattern)
  setBuildPattern(BUILD_PATTERNS[(index + 1) % BUILD_PATTERNS.length].id)
}

buildPatternButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const pattern = button.dataset.buildPattern
    if (isBuildPatternId(pattern)) setBuildPattern(pattern)
  })
})

function formatReward(reward: Array<{ id: BlockId; amount: number }>) {
  return reward.map(({ id, amount }) => `${blockNames.get(id) ?? id} ×${amount}`).join(' · ')
}

function updateProgressionUi() {
  if (!toolTierValue || !objectiveList || !inventoryGrid || !recipeList) return
  updateTutorialUi()
  toolTierValue.textContent = progression.getToolName()
  const objectives = progression.getObjectives()
  const claimableCount = objectives.filter(({ complete, claimed }) => complete && !claimed).length
  claimAllObjectivesButton.disabled = claimableCount === 0
  claimAllObjectivesButton.textContent = claimableCount > 0 ? `Claim all · ${claimableCount}` : 'No rewards ready'
  objectiveList.innerHTML = objectives.map((objective) => `
    <article class="objective-card ${objective.complete ? 'complete' : ''} ${objective.claimed ? 'claimed' : ''}">
      <div><strong>${objective.name}</strong><small>${objective.description} · ${Math.min(objective.current, objective.target)}/${objective.target}</small><em>Reward · ${formatReward(objective.reward)}</em></div>
      <button data-claim-objective="${objective.id}" ${!objective.complete || objective.claimed ? 'disabled' : ''}>${objective.claimed ? 'Claimed' : 'Claim'}</button>
    </article>
  `).join('')
  inventoryGrid.innerHTML = BLOCKS.map((block, index) => {
    const count = countBlocksInInventory(block.id)
    return `
      <button class="inventory-card ${index === selected ? 'active' : ''} ${count <= 0 ? 'empty' : ''}" data-inventory-block="${block.id}" aria-label="Select ${block.name}, ${count} available">
        <span class="inventory-swatch" style="background:#${block.color.toString(16).padStart(6, '0')}"></span>
        <span><strong>${block.name}</strong><small>${count} available</small></span>
      </button>
    `
  }).join('')
  recipeList.innerHTML = RECIPES.map((recipe) => {
    const availability = progression.getRecipeAvailability(recipe, progressionInventory)
    const maxCraftable = progression.getMaxCraftableCount(recipe, progressionInventory)
    const completed = availability.completed
    const ingredients = availability.ingredients.map(({ id, amount, available, missing }) => `
      <span class="recipe-ingredient ${missing > 0 ? 'missing' : 'ready'}">
        ${blockNames.get(id) ?? id} <b>${available}/${amount}</b>
      </span>
    `).join('')
    return `
      <article class="recipe-card ${completed ? 'complete' : ''} ${availability.craftable ? 'craftable' : 'missing-materials'}">
        <div><strong>${recipe.name}</strong><small>${recipe.description}</small><em class="recipe-ingredients">${ingredients}</em></div>
        <div class="recipe-actions">
          <button data-craft-recipe="${recipe.id}" ${completed || !availability.craftable ? 'disabled' : ''}>${completed ? 'Built' : availability.craftable ? 'Craft 1' : 'Missing'}</button>
          ${recipe.once ? '' : `<button class="craft-max-btn" data-craft-max="${recipe.id}" ${maxCraftable <= 0 ? 'disabled' : ''}>Max ×${maxCraftable}</button>`}
        </div>
      </article>
    `
  }).join('')
}

inventoryGrid.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-inventory-block]')
  if (!button || !isValidBlockId(button.dataset.inventoryBlock)) return
  const index = BLOCKS.findIndex(({ id }) => id === button.dataset.inventoryBlock)
  if (index < 0) return
  selectHotbarSlot(index, 'backpack')
  updateProgressionUi()
  showToast(`${BLOCKS[index].name} selected`)
})

objectiveList.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-claim-objective]')
  if (!button) return
  const objective = progression.claimObjective(button.dataset.claimObjective ?? '', progressionInventory)
  if (!objective) return
  showToast(`${objective.name} reward claimed`)
  updateHotbar()
  updateProgressionUi()
})

claimAllObjectivesButton.addEventListener('click', () => {
  const claimed = progression.claimCompletedObjectives(progressionInventory)
  if (claimed.length === 0) return
  playGameSound('select', 0.24)
  showToast(`${claimed.length} objective reward${claimed.length === 1 ? '' : 's'} claimed`)
  updateHotbar()
  updateProgressionUi()
})

recipeList.addEventListener('click', (event) => {
  const maxButton = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-craft-max]')
  if (maxButton) {
    const result = progression.craftMany(maxButton.dataset.craftMax ?? '', progressionInventory)
    if (!result) {
      showToast('Missing crafting materials')
      return
    }
    advanceTutorial('craft', false)
    playGameSound('select', 0.32)
    showToast(`${result.recipe.name} ×${result.count} crafted`)
    updateHotbar()
    updateProgressionUi()
    return
  }
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-craft-recipe]')
  if (!button) return
  const recipe = progression.craft(button.dataset.craftRecipe ?? '', progressionInventory)
  if (!recipe) {
    showToast('Missing crafting materials')
    return
  }
  advanceTutorial('craft', false)
  playGameSound('select', 0.28)
  showToast(`${recipe.name} crafted`)
  updateHotbar()
  updateProgressionUi()
})

document.querySelector<HTMLButtonElement>('.session-option[data-session="singleplayer"]')!.querySelector('strong')!.textContent = localSession.session.label
document.querySelector<HTMLButtonElement>('.multiplayer-entry')!.title = multiplayerSession.session.label
if (getWorldSaveSystem().hasSave()) loadWorld()
else {
  saveActivity.reset()
  updateSaveActivityUi()
  updateSaveMeta()
}
updateHotbar()
updateProgressionUi()
updateWorldSlotUi()
type HudDensity = 'roomy' | 'compact' | 'minimal'
let hudLayoutFrame = 0
let hasStarted = false
let isPaused = false

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

const settingsStore = new SettingsStore({
  maxViewDistance: runtimeLimits.maxViewDistance,
  defaults: {
    sensitivity: Math.round(mouseLookSpeed * 100),
    fov: camera.fov,
    viewDistance: terrainLoadRadius,
    quality: qualityPreset,
    showPerf: showPerformanceHud,
    frameRate: frameRateLimit,
    volume: Math.round(soundVolume * 100),
    soundEnabled,
  },
})

function qualityBounds() {
  if (qualityPreset === 'low') {
    return {
      min: runtimeLimits.minRenderScale,
      max: Math.min(runtimeLimits.maxRenderScale, 0.72),
      start: Math.min(runtimeLimits.initialRenderScale, 0.68),
    }
  }
  if (qualityPreset === 'high') {
    return {
      min: Math.min(runtimeLimits.maxRenderScale, Math.max(runtimeLimits.minRenderScale, 0.76)),
      max: runtimeLimits.maxRenderScale,
      start: runtimeLimits.maxRenderScale,
    }
  }
  return { min: MIN_RENDER_QUALITY, max: MAX_RENDER_QUALITY, start: runtimeLimits.initialRenderScale }
}

function applyQualityPreset(nextPreset: QualityPreset, resetScale = false) {
  qualityPreset = nextPreset
  const bounds = qualityBounds()
  renderQuality = resetScale ? bounds.start : clampNumber(renderQuality, bounds.min, bounds.max)
  renderer.shadowMap.enabled = nextPreset !== 'low' && !lowPowerMode
  applyRenderQuality()
  qualityButtons.forEach((button) => button.classList.toggle('active', button.dataset.quality === nextPreset))
}

function setPerformanceHudVisible(visible: boolean) {
  showPerformanceHud = visible
  document.body.classList.toggle('show-perf-hud', visible)
  perfToggle.checked = visible
  if (visible) {
    const info = renderer.info
    const latestFps = currentFps > 0
      ? currentFps
      : currentAverageFrameMs > 0
        ? Math.max(1, Math.round(1000 / currentAverageFrameMs))
        : '--'
    const metrics = [
      ['.perf-fps', latestFps],
      ['.perf-ms', currentAverageFrameMs > 0 ? currentAverageFrameMs : '--'],
      ['.perf-calls', info.render.calls],
      ['.perf-triangles', info.render.triangles],
      ['.perf-geometries', info.memory.geometries],
      ['.perf-textures', info.memory.textures],
    ] as const
    metrics.forEach(([selector, value]) => {
      const element = document.querySelector<HTMLElement>(selector)
      if (element) element.textContent = typeof value === 'number' ? formatPerformanceNumber(value) : String(value)
    })
  }
}

function applySettings(settings: GameSettings, persist = false) {
  const nextSettings = settingsStore.sanitize(settings)
  const sensitivity = nextSettings.sensitivity
  mouseLookSpeed = sensitivity / 100
  touchLookSpeed = mouseLookSpeed * 0.0034
  controls.pointerSpeed = mouseLookSpeed
  sensitivityInput.value = String(Math.round(sensitivity))
  sensitivityValue.textContent = `${Math.round(sensitivity)}%`

  const fov = nextSettings.fov
  camera.fov = fov
  camera.updateProjectionMatrix()
  fovInput.value = String(Math.round(fov))
  fovValue.textContent = String(Math.round(fov))

  terrainLoadRadius = nextSettings.viewDistance
  viewDistanceSelect.value = String(terrainLoadRadius)
  lastTerrainEnsureScanKey = ''
  pendingTerrainEnsure = { x: controls.object.position.x, z: controls.object.position.z }

  applyQualityPreset(nextSettings.quality, persist)
  setPerformanceHudVisible(nextSettings.showPerf)
  frameRateLimit = nextSettings.frameRate
  gameplayFrameLimiter.setTargetFps(frameRateLimit)
  performanceGuard.setTargetFps(frameRateLimit)
  syncPerformanceGuardUi()
  frameRateSelect.value = String(frameRateLimit)
  document.body.dataset.frameRate = String(frameRateLimit)

  soundVolume = nextSettings.volume / 100
  audioSystem.setMasterVolume(soundVolume)
  volumeInput.value = String(Math.round(soundVolume * 100))
  volumeValue.textContent = `${Math.round(soundVolume * 100)}%`
  soundEnabled = nextSettings.soundEnabled
  audioSystem.setEnabled(soundEnabled)
  soundToggle.checked = soundEnabled
  if (persist) {
    const saved = settingsStore.save(nextSettings)
    if (!saved.ok) showSettingsPersistenceWarning()
  }
}

let lastSettingsPersistenceWarningAt = -Infinity
function showSettingsPersistenceWarning() {
  const now = performance.now()
  if (now - lastSettingsPersistenceWarningAt < 4000) return
  lastSettingsPersistenceWarningAt = now
  showToast('Settings applied · could not save locally')
}

applySettings(settingsStore.load())

function collectCurrentSettings(): GameSettings {
  return {
    sensitivity: Number(sensitivityInput.value),
    fov: Number(fovInput.value),
    viewDistance: Number(viewDistanceSelect.value),
    quality: qualityPreset,
    showPerf: perfToggle.checked,
    frameRate: frameRateSelect.value === '60' ? 60 : 30,
    volume: Number(volumeInput.value),
    soundEnabled: soundToggle.checked,
  }
}

function updateSettings(overrides: Partial<GameSettings> = {}) {
  applySettings({ ...collectCurrentSettings(), ...overrides }, true)
}

function resetInputState() {
  keys.clear()
  playerMotion.stopHorizontal()
  mobileMove.set(0, 0)
  joystickPointerId = null
  lookPointerId = null
  stick.style.transform = 'translate(-50%, -50%)'
  setJoystickActive(false)
  clearTouchButtonPresses()
  cancelMining()
}

function openPauseMenu() {
  if (!hasStarted) return
  isPaused = true
  updateProgressionUi()
  updateSaveMeta()
  updateSaveActivityUi()
  setPauseMenuTab(activePauseMenuTab)
  pauseMenu.classList.remove('hidden')
  document.body.classList.add('menu-open')
  resetInputState()
  if (controls.isLocked) controls.unlock()
}

function closePauseMenu(resumeGame = true) {
  isPaused = false
  pauseMenu.classList.add('hidden')
  document.body.classList.remove('menu-open')
  resetInputState()
  if (resumeGame && hasStarted && !mobileActive && !isSmokeTest) controls.lock()
}

menuToggleBtn.addEventListener('click', (event) => {
  event.preventDefault()
  event.stopPropagation()
  openPauseMenu()
})
resumeButton.addEventListener('click', () => closePauseMenu())
sensitivityInput.addEventListener('input', () => updateSettings())
fovInput.addEventListener('input', () => updateSettings())
viewDistanceSelect.addEventListener('change', () => updateSettings())
frameRateSelect.addEventListener('change', () => updateSettings())
volumeInput.addEventListener('input', () => updateSettings())
qualityButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const nextQuality = button.dataset.quality
    if (nextQuality !== 'low' && nextQuality !== 'balanced' && nextQuality !== 'high') return
    updateSettings({ quality: nextQuality })
  })
})
perfToggle.addEventListener('change', () => updateSettings())
soundToggle.addEventListener('change', () => updateSettings())

function setHudDensity(density: HudDensity) {
  document.body.dataset.hudDensity = density
}

function visibleElementRect(selector: string) {
  const el = document.querySelector<HTMLElement>(selector)
  if (!el) return null
  const style = window.getComputedStyle(el)
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return null
  const rect = el.getBoundingClientRect()
  if (rect.width <= 1 || rect.height <= 1) return null
  return rect
}

function rectsOverlap(a: DOMRect, b: DOMRect, gap = 8) {
  return a.left < b.right + gap && a.right + gap > b.left && a.top < b.bottom + gap && a.bottom + gap > b.top
}

function hudHasVisibleOverlap() {
  const selectors = ['.hud-left-stack', '.hud-right-stack', '.hotbar', '.block-info', '.joystick', '.touch-actions']
  const rects = selectors.map(visibleElementRect).filter((rect): rect is DOMRect => Boolean(rect))
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      if (rectsOverlap(rects[i], rects[j])) return true
    }
  }
  return false
}

function applyHudLayoutClass() {
  const width = window.innerWidth
  const height = window.innerHeight
  const landscape = width >= height
  let density: HudDensity = 'roomy'

  if (isTouchDevice || width < 1120 || height < 720) density = 'compact'
  if (width < 820 || height < 560 || (isTouchDevice && landscape)) density = 'minimal'

  document.documentElement.style.setProperty('--app-height', `${height}px`)
  document.body.classList.toggle('touch-layout', isTouchDevice)
  document.body.classList.toggle('landscape-layout', landscape)
  document.body.classList.toggle('short-layout', height < 560)
  setHudDensity(density)

  if (hudLayoutFrame) window.cancelAnimationFrame(hudLayoutFrame)
  hudLayoutFrame = window.requestAnimationFrame(() => {
    hudLayoutFrame = 0
    if (document.body.dataset.hudDensity !== 'minimal' && hudHasVisibleOverlap()) {
      setHudDensity(document.body.dataset.hudDensity === 'roomy' ? 'compact' : 'minimal')
    }
  })
}

helpToggleBtn.addEventListener('click', (e) => {
  e.preventDefault()
  e.stopPropagation()
  const isVisible = helpPanel.classList.toggle('visible-mobile')
  document.body.classList.toggle('help-open', isVisible)
  helpToggleBtn.textContent = isVisible ? '×' : '?'
  applyHudLayoutClass()
})

function updateOrientationClass() {
  applyHudLayoutClass()
  document.body.classList.toggle('portrait-touch', isTouchDevice && window.innerHeight > window.innerWidth)
  if (isTouchDevice && window.innerHeight > window.innerWidth) {
    helpPanel.classList.remove('visible-mobile')
    document.body.classList.remove('help-open')
    helpToggleBtn.textContent = '?'
    keys.clear()
    playerMotion.stopHorizontal()
    mobileMove.set(0, 0)
    joystickPointerId = null
    lookPointerId = null
    stick.style.transform = 'translate(-50%, -50%)'
    setJoystickActive(false)
    clearTouchButtonPresses()
    cancelMining()
  }
}

start.querySelector('button')!.addEventListener('click', () => {
  unlockGameAudio()
  hasStarted = true
  updateTutorialUi(true)
  closePauseMenu(false)
  if (isTouchDevice) {
    mobileActive = true
    start.classList.add('hidden')
    return
  }
  if (isSmokeTest) {
    start.classList.add('hidden')
    return
  }
  start.classList.add('hidden')
  controls.lock()
})
controls.addEventListener('lock', () => start.classList.add('hidden'))
controls.addEventListener('unlock', () => {
  if (!hasStarted) {
    start.classList.remove('hidden')
    return
  }
  if (!mobileActive && !isPaused) openPauseMenu()
})

document.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    e.preventDefault()
    if (isPaused) closePauseMenu()
    else openPauseMenu()
    return
  }
  if (e.code === 'KeyE') {
    e.preventDefault()
    if (isPaused && activePauseMenuTab === 'expedition') closePauseMenu()
    else {
      setExpeditionView('backpack')
      setPauseMenuTab('expedition')
      openPauseMenu()
    }
    return
  }
  if (isPaused) return
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyB', 'ShiftLeft', 'Space', 'Tab'].includes(e.code)) e.preventDefault()
  if (e.code === 'Tab') {
    switchHotbarPage()
    return
  }
  if (e.code === 'KeyB') {
    cycleBuildPattern()
    return
  }
  keys.add(e.code)
  const n = Number(e.key)
  if (n >= 1 && n <= HOTBAR_PAGE_SIZE) selectHotbarSlot(hotbarPage * HOTBAR_PAGE_SIZE + n - 1, 'key')
  if (e.code === 'Space') runJump()
})
renderer.domElement.addEventListener('wheel', (event) => {
  if (!controls.isLocked || isPaused) return
  event.preventDefault()
  const dir = event.deltaY > 0 ? 1 : -1
  let next = (selected + dir + BLOCKS.length) % BLOCKS.length
  for (let i = 0; i < BLOCKS.length - 1; i++) {
    if (countBlocksInInventory(BLOCKS[next].id) > 0) break
    next = (next + dir + BLOCKS.length) % BLOCKS.length
  }
  selectHotbarSlot(next, 'wheel')
}, { passive: false })
document.addEventListener('keyup', (e) => keys.delete(e.code))
window.addEventListener('blur', () => {
  keys.clear()
  playerMotion.stopHorizontal()
  mobileMove.set(0, 0)
  stick.style.transform = 'translate(-50%, -50%)'
  setJoystickActive(false)
  clearTouchButtonPresses()
  cancelMining()
})

const placeNormal = new THREE.Vector3()
const placePosition = new THREE.Vector3()
const buildFacing = new THREE.Vector3()
const buildCollisionPosition = new THREE.Vector3()
const hitBlockPosition = new THREE.Vector3()
const upNormal = new THREE.Vector3(0, 1, 0)
const blockPicker = new VoxelBlockPicker({ maxDistance: RAYCAST_REACH })

if (isSmokeTest) {
  void import('./player/BlockPickerSmoke').then(({ assertBlockPickerSmoke }) => {
    assertBlockPickerSmoke()
  }).catch((error) => console.error(error))
}

function lookupPickBlock(x: number, y: number, z: number) {
  return blockData.get(packBlockKey(x, y, z)) ?? null
}

function pickBlock() {
  return blockPicker.pickFromCamera(camera, lookupPickBlock, controls.object.position) ?? undefined
}

function breakTargetBlock(expectedKey?: PackedBlockKey) {
  const hit = pickBlock()
  if (!hit || hit.distance > RAYCAST_REACH) return false
  const minedKey = packBlockKey(hit.x, hit.y, hit.z)
  if (expectedKey !== undefined && minedKey !== expectedKey) return false
  const blockId = hit.id
  if (!progression.canMine(blockId)) {
    showToast(`${progression.requiredToolName(blockId)} required`)
    return false
  }
  hitBlockPosition.set(hit.x, hit.y, hit.z)
  if (hitBlockPosition.y > 0) {
    const canAbsorbCharge = !playerPlacedBlocks.has(minedKey)
    // 破坏粒子
    createBreakParticles(hitBlockPosition, blockId)
    playGameSound('break', 0.3)
    // Crosshair flash on break hit
    const crosshair = document.querySelector<HTMLDivElement>('.crosshair')!
    if (crosshair) {
      const originalFilter = crosshair.style.filter
      crosshair.style.filter = 'drop-shadow(0 0 20px rgba(255,255,255,1)) brightness(1.8)'
      setTimeout(() => {
        crosshair.style.filter = originalFilter
      }, 80)
    }
    removeBlockAtKey(minedKey, 'player')
    addToInventory(blockId)
    progression.recordMine()
    advanceTutorial('mine')
    const collectedShard = collectExplorationShard(minedKey, blockId)
    if (canAbsorbCharge) absorbCrystalPower(blockId, !collectedShard)
    updateHotbar()
    updateProgressionUi()
    return true
  }
  return false
}

function planBuildPattern(hit: NonNullable<ReturnType<typeof pickBlock>>) {
  hitBlockPosition.set(hit.x, hit.y, hit.z)
  const canReplaceWater = hit.id === 'water' && BLOCKS[selected].id !== 'water'
  if (canReplaceWater) {
    placePosition.copy(hitBlockPosition)
  } else {
    placeNormal.copy(hit.normal.lengthSq() > 0 ? hit.normal : upNormal)
    placePosition.copy(hitBlockPosition).add(placeNormal).round()
  }
  camera.getWorldDirection(buildFacing)
  return buildPatternPlanner.plan(activeBuildPattern, placePosition, buildFacing)
}

function validateBuildPlan(
  plan: ReturnType<BuildPatternPlanner['plan']>,
  selectedBlock: BlockId,
) {
  if (countBlocksInInventory(selectedBlock) < plan.count) {
    return `Need ${plan.count} ${blockNames.get(selectedBlock) ?? selectedBlock}`
  }
  for (let index = 0; index < plan.count; index++) {
    const position = plan.positions[index]
    if (position.y <= 0 || position.y > 128) return 'Pattern outside build height'
    const existing = blockData.get(packBlockKey(position.x, position.y, position.z))
    if (existing && !(existing === 'water' && selectedBlock !== 'water')) return 'Pattern blocked'
    buildCollisionPosition.set(position.x, position.y, position.z)
    if (wouldTrapPlayer(buildCollisionPosition)) return 'Pattern too close'
  }
  return ''
}

function placeTargetBlock() {
  const hit = pickBlock()
  if (!hit || hit.distance > RAYCAST_REACH) return
  const selectedBlock = BLOCKS[selected].id
  const plan = planBuildPattern(hit)
  const invalidReason = validateBuildPlan(plan, selectedBlock)
  if (invalidReason) {
    showToast(invalidReason)
    return
  }

  withBlockBatch(() => {
    for (let index = 0; index < plan.count; index++) {
      const position = plan.positions[index]
      const key = packBlockKey(position.x, position.y, position.z)
      if (blockData.get(key) === 'water' && selectedBlock !== 'water') removeBlockAtKey(key)
      addBlock(position.x, position.y, position.z, selectedBlock, 'player')
    }
  })
  playGameSound('place', 0.25)
  consumeInventory(selectedBlock, plan.count)
  progression.recordPlacement(plan.count)
  advanceTutorial('place')
  if (plan.count > 1) showToast(`${getBuildPatternDefinition(activeBuildPattern).name} built · ${plan.count} blocks`)
  selectNextAvailableBlock()
  updateHotbar()
  updateProgressionUi()
}

function collectExplorationShard(key: PackedBlockKey, blockId: BlockId) {
  if ((blockId !== 'crystal' && blockId !== 'glow') || !landmarkShardBlocks.has(key) || collectedShardBlocks.has(key)) {
    return false
  }

  getBlockPositionFromKey(key, hitBlockPosition)
  createShardBurst(hitBlockPosition)
  playShardCollectSound()
  compassBadge.classList.add('pulse')
  window.setTimeout(() => compassBadge.classList.remove('pulse'), 650)
  landmarkShardBlocks.delete(key)
  landmarkShardNames.delete(key)
  collectedShardBlocks.add(key)
  collectedGlowShards = Math.min(EXPLORATION_GOAL_SHARDS, collectedGlowShards + 1)
  progression.setShardCount(collectedGlowShards)
  advanceTutorial('shard', false)
  const moduleName = ARK_MODULE_NAMES[Math.max(0, collectedGlowShards - 1)] ?? 'Core'
  showToast(collectedGlowShards >= EXPLORATION_GOAL_SHARDS
    ? `Ark Core restored: ${EXPLORATION_GOAL_SHARDS}/${EXPLORATION_GOAL_SHARDS} shards`
    : `${moduleName} module online: ${collectedGlowShards}/${EXPLORATION_GOAL_SHARDS}`)
  return true
}

function absorbCrystalPower(blockId: BlockId, showFeedback = true) {
  if (blockId === 'crystal') {
    carriedCrystal += 1
    crystalPower = Math.min(100, crystalPower + 34)
    if (showFeedback) showToast('Crystal power restored')
  } else if (blockId === 'glow') {
    crystalPower = Math.min(100, crystalPower + 12)
    if (showFeedback) showToast('Glow charge absorbed')
  }
}

function wouldTrapPlayer(blockPosition: THREE.Vector3) {
  return playerCollision.overlapsBlockAt(
    controls.object.position,
    blockPosition.x,
    blockPosition.y,
    blockPosition.z,
    PLAYER_PLACEMENT_CLEARANCE,
  )
}

renderer.domElement.addEventListener('mousedown', (e) => {
  if (!controls.isLocked || isPaused) return
  if (e.button === 0) {
    beginMining('desktop')
  } else if (e.button === 2) {
    placeTargetBlock()
  } else if (e.button === 1) {
    e.preventDefault()
    const hit = pickBlock()
    if (hit && hit.distance <= RAYCAST_REACH) {
      const idx = BLOCKS.findIndex((b) => b.id === hit.id)
      if (idx >= 0) selectHotbarSlot(idx, 'pointer')
    }
  }
})
document.addEventListener('mouseup', (event) => {
  if (event.button === 0 && miningSource === 'desktop') cancelMining()
})
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault())

const mobileMove = new THREE.Vector2()
const joystick = document.querySelector<HTMLDivElement>('.joystick')!
const stick = document.querySelector<HTMLDivElement>('.stick')!
const jumpButton = document.querySelector<HTMLButtonElement>('.jump-btn')!
const breakButton = document.querySelector<HTMLButtonElement>('.break-btn')!
const placeButton = document.querySelector<HTMLButtonElement>('.place-btn')!
const mineProgress = document.querySelector<HTMLDivElement>('.mine-progress')!
const mineRing = document.querySelector<HTMLDivElement>('.mine-ring')!
let joystickPointerId: number | null = null
let lookPointerId: number | null = null
let previousLookX = 0
let previousLookY = 0
let lookStartX = 0
let lookStartY = 0
let lookMoved = false
type MiningInputSource = 'desktop' | 'touch-button' | 'touch-canvas'
let miningSource: MiningInputSource | null = null
let miningCompleted = false
let miningRevision = 0
let touchStartedOnRight = false
let touchGestureStartedAt = 0
const TOUCH_TAP_MAX_MOVE = isTouchDevice ? 30 : 24
const TOUCH_PLACE_TAP_MS = 320

function vibrateTouch(pattern: number | number[]) {
  if (!isTouchDevice || typeof navigator.vibrate !== 'function') return
  try {
    navigator.vibrate(pattern)
  } catch {
    // Vibration is a best-effort touch affordance and should never interrupt input.
  }
}

function applySoftDeadzone(value: number, deadzone: number) {
  const magnitude = Math.abs(value)
  if (magnitude <= deadzone) return 0
  return Math.sign(value) * (magnitude - deadzone)
}

function setJoystickActive(active: boolean) {
  joystick.classList.toggle('active', active)
}

function clearTouchButtonPresses() {
  jumpButton.classList.remove('pressed')
  breakButton.classList.remove('pressed')
  placeButton.classList.remove('pressed')
}

function stopUiTouch(event: Event) {
  event.preventDefault()
  event.stopPropagation()
}

function releaseButtonPress(button: HTMLButtonElement, pointerId: number) {
  button.classList.remove('pressed')
  if (button.hasPointerCapture(pointerId)) button.releasePointerCapture(pointerId)
}

function bindTouchButton(button: HTMLButtonElement, action: () => void) {
  button.addEventListener('contextmenu', stopUiTouch)
  button.addEventListener('pointerdown', (event) => {
    stopUiTouch(event)
    button.setPointerCapture(event.pointerId)
    button.classList.add('pressed')
    vibrateTouch(8)
    action()
  })
  button.addEventListener('pointerup', (event) => {
    stopUiTouch(event)
    releaseButtonPress(button, event.pointerId)
  })
  button.addEventListener('pointercancel', (event) => {
    stopUiTouch(event)
    releaseButtonPress(button, event.pointerId)
  })
}

function bindMiningButton(button: HTMLButtonElement) {
  button.addEventListener('contextmenu', stopUiTouch)
  button.addEventListener('pointerdown', (event) => {
    stopUiTouch(event)
    button.setPointerCapture(event.pointerId)
    button.classList.add('pressed')
    vibrateTouch(8)
    beginMining('touch-button')
  })
  const release = (event: PointerEvent) => {
    stopUiTouch(event)
    releaseButtonPress(button, event.pointerId)
    if (miningSource === 'touch-button') cancelMining()
  }
  button.addEventListener('pointerup', release)
  button.addEventListener('pointercancel', release)
}

function updateJoystick(event: PointerEvent) {
  const rect = joystick.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  const max = rect.width * TOUCH_JOYSTICK_EDGE
  const dx = event.clientX - centerX
  const dy = event.clientY - centerY
  const length = Math.hypot(dx, dy)
  const scale = length > max ? max / length : 1
  const x = dx * scale
  const y = dy * scale
  stick.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`
  const rawX = x / max
  const rawY = y / max
  const magnitude = Math.hypot(rawX, rawY)
  if (magnitude < TOUCH_JOYSTICK_DEADZONE) {
    mobileMove.set(0, 0)
    return
  }
  const adjustedMagnitude = Math.pow((magnitude - TOUCH_JOYSTICK_DEADZONE) / (1 - TOUCH_JOYSTICK_DEADZONE), TOUCH_JOYSTICK_RESPONSE)
  mobileMove.set(rawX / magnitude * adjustedMagnitude, rawY / magnitude * adjustedMagnitude)
}

joystick.addEventListener('pointerdown', (event) => {
  if (joystickPointerId !== null) return
  stopUiTouch(event)
  joystickPointerId = event.pointerId
  setJoystickActive(true)
  vibrateTouch(8)
  joystick.setPointerCapture(event.pointerId)
  updateJoystick(event)
})
joystick.addEventListener('pointermove', (event) => {
  if (event.pointerId !== joystickPointerId) return
  stopUiTouch(event)
  updateJoystick(event)
})
function releaseJoystick(event: PointerEvent) {
  if (event.pointerId !== joystickPointerId) return
  stopUiTouch(event)
  joystickPointerId = null
  mobileMove.set(0, 0)
  stick.style.transform = 'translate(-50%, -50%)'
  setJoystickActive(false)
}
joystick.addEventListener('pointerup', releaseJoystick)
joystick.addEventListener('pointercancel', releaseJoystick)

function runJump() {
  if (!playerMotion.jump()) return
  playGameSound('jump', 0.2)
}

bindTouchButton(jumpButton, runJump)
bindMiningButton(breakButton)
bindTouchButton(placeButton, placeTargetBlock)

const hudEl = document.querySelector<HTMLElement>('.hud')!

function isUiTouch(target: HTMLElement | null): boolean {
  if (!target || !hudEl.contains(target)) return false
  let el: HTMLElement | null = target
  while (el && el !== hudEl) {
    if (window.getComputedStyle(el).pointerEvents === 'auto') {
      return true
    }
    el = el.parentElement
  }
  return false
}

let mineProgressTimeoutId: number | null = null

function beginMining(source: MiningInputSource) {
  const hit = pickBlock()
  if (!hit || hit.distance > RAYCAST_REACH) return false
  if (!progression.canMine(hit.id)) {
    showToast(`${progression.requiredToolName(hit.id)} required`)
    return false
  }
  cancelMining()
  const started = miningSession.begin({
    key: packBlockKey(hit.x, hit.y, hit.z),
    id: hit.id,
    durationMs: progression.getMiningDuration(hit.id),
  }, performance.now())
  if (!started) return false
  miningSource = source
  miningCompleted = false
  mineRing.style.setProperty('--progress', '0deg')

  if (mineProgressTimeoutId) window.clearTimeout(mineProgressTimeoutId)
  mineProgressTimeoutId = window.setTimeout(() => {
    if (miningSession.active) {
      mineProgress.querySelector('span')!.textContent = `Mining ${BLOCKS.find(({ id }) => id === hit.id)?.name ?? 'block'}`
      mineProgress.classList.add('visible')
    }
  }, 120)
  return true
}

function cancelMining() {
  miningSession.cancel()
  miningSource = null
  miningCompleted = false
  miningRevision += 1
  if (mineProgressTimeoutId) {
    window.clearTimeout(mineProgressTimeoutId)
    mineProgressTimeoutId = null
  }
  mineProgress.classList.remove('visible')
  mineProgress.classList.remove('mining-complete')
  mineProgress.querySelector('span')!.textContent = 'Hold'
  mineRing.style.setProperty('--progress', '0deg')
}

function updateMining() {
  if (!miningSession.active) return
  const hit = pickBlock()
  const currentKey = hit && hit.distance <= RAYCAST_REACH ? packBlockKey(hit.x, hit.y, hit.z) : null
  const update = miningSession.update(performance.now(), currentKey)
  if (update.status === 'cancelled') {
    cancelMining()
    return
  }
  mineRing.style.setProperty('--progress', `${Math.round(update.progress * 360)}deg`)
  if (update.status !== 'complete' || miningCompleted) return
  miningCompleted = true
  mineProgress.classList.add('mining-complete')
  mineProgress.querySelector('span')!.textContent = 'Break'
  if (miningSource !== 'desktop') vibrateTouch([10, 22, 14])
  breakTargetBlock(update.key ?? undefined)
  const completionRevision = miningRevision
  window.setTimeout(() => {
    if (miningRevision === completionRevision && !miningSession.active && miningCompleted) cancelMining()
  }, 180)
}

function applyTouchLookDelta(dx: number, dy: number) {
  const lookDx = THREE.MathUtils.clamp(applySoftDeadzone(dx, TOUCH_LOOK_DEADZONE), -TOUCH_LOOK_MAX_DELTA, TOUCH_LOOK_MAX_DELTA)
  const lookDy = THREE.MathUtils.clamp(applySoftDeadzone(dy, TOUCH_LOOK_DEADZONE), -TOUCH_LOOK_MAX_DELTA, TOUCH_LOOK_MAX_DELTA)
  if (lookDx === 0 && lookDy === 0) return

  const object = controls.object
  object.rotation.y -= lookDx * touchLookSpeed
  camera.rotation.x = clampLookPitch(camera.rotation.x - lookDy * touchLookSpeed)
  stabilizeFirstPersonLook()
}

updateOrientationClass()
window.addEventListener('resize', updateOrientationClass)
window.addEventListener('orientationchange', updateOrientationClass)

// Prevent default touch gestures (pinch-to-zoom, double-tap zoom) on the canvas
renderer.domElement.addEventListener('touchstart', (event) => {
  if (event.touches.length > 1) {
    event.preventDefault()
  }
}, { passive: false })

renderer.domElement.addEventListener('touchmove', (event) => {
  if (event.touches.length > 1 || !isUiTouch(event.target as HTMLElement)) {
    event.preventDefault()
  }
}, { passive: false })

renderer.domElement.addEventListener('pointerdown', (event) => {
  if (!mobileActive || isUiTouch(event.target as HTMLElement)) return
  event.preventDefault()
  if (lookPointerId !== null) return
  lookPointerId = event.pointerId
  previousLookX = event.clientX
  previousLookY = event.clientY
  lookStartX = event.clientX
  lookStartY = event.clientY
  lookMoved = false
  touchStartedOnRight = event.clientX > window.innerWidth * 0.5
  touchGestureStartedAt = performance.now()
  if (touchStartedOnRight) beginMining('touch-canvas')
  renderer.domElement.setPointerCapture(event.pointerId)
})
renderer.domElement.addEventListener('pointermove', (event) => {
  if (!mobileActive || event.pointerId !== lookPointerId) return
  event.preventDefault()
  const dx = event.clientX - previousLookX
  const dy = event.clientY - previousLookY
  previousLookX = event.clientX
  previousLookY = event.clientY
  if (Math.hypot(event.clientX - lookStartX, event.clientY - lookStartY) > TOUCH_TAP_MAX_MOVE) {
    lookMoved = true
    if (miningSource === 'touch-canvas' && miningSession.active && !miningCompleted) cancelMining()
  }
  applyTouchLookDelta(dx, dy)
})
renderer.domElement.addEventListener('pointerup', (event) => {
  if (event.pointerId !== lookPointerId) return
  event.preventDefault()
  const shouldPlace = touchStartedOnRight && !lookMoved && !miningCompleted &&
    performance.now() - touchGestureStartedAt <= TOUCH_PLACE_TAP_MS
  lookPointerId = null
  if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId)
  if (shouldPlace) {
    vibrateTouch(12)
    placeTargetBlock()
  }
  cancelMining()
})
renderer.domElement.addEventListener('pointercancel', (event) => {
  if (event.pointerId === lookPointerId) {
    event.preventDefault()
    lookPointerId = null
    if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId)
    cancelMining()
  }
})

const clock = new THREE.Clock()
const fpsEl = document.querySelector<HTMLElement>('.perf-fps')
const msEl = document.querySelector<HTMLElement>('.perf-ms')
const blocksEl = document.querySelector<HTMLElement>('.perf-blocks')
const chunksEl = document.querySelector<HTMLElement>('.perf-chunks')
const terrainChunksEl = document.querySelector<HTMLElement>('.perf-terrain-chunks')
const dirtyEl = document.querySelector<HTMLElement>('.perf-dirty')
const callsEl = document.querySelector<HTMLElement>('.perf-calls')
const trianglesEl = document.querySelector<HTMLElement>('.perf-triangles')
const geometriesEl = document.querySelector<HTMLElement>('.perf-geometries')
const texturesEl = document.querySelector<HTMLElement>('.perf-textures')
const crystalBarEl = document.querySelector<HTMLElement>('.charge-bar')
const crystalValEl = document.querySelector<HTMLElement>('.crystal-val')
const threatValEl = document.querySelector<HTMLElement>('.threat-val')
const survivalBadgeEl = document.querySelector<HTMLElement>('.survival-badge')
const coldVignetteEl = document.querySelector<HTMLElement>('.cold-vignette')
const healthBarEl = document.querySelector<HTMLElement>('.health-bar')
const healthValEl = document.querySelector<HTMLElement>('.health-val')
const worldBiomeEl = document.querySelector<HTMLElement>('.world-biome')
const worldCoordinatesEl = document.querySelector<HTMLElement>('.world-coordinates')
const worldBadgeButton = document.querySelector<HTMLButtonElement>('.world-badge')
const saveMetaButton = document.querySelector<HTMLButtonElement>('.save-meta')
const previousPosition = new THREE.Vector3()
const movementDelta = new THREE.Vector3()
let fpsFrameCount = 0
let fpsElapsed = 0

const FRAME_SAMPLE_COUNT = 30
const frameBudgetSamples = new Float32Array(FRAME_SAMPLE_COUNT)
let frameBudgetIndex = 0
let frameBudgetCount = 0
let frameBudgetTotal = 0
let lastQualityAdjustAt = 0

function syncPerformanceGuardUi() {
  const level = performanceGuard.currentLevel
  document.body.dataset.runtimePressure = level
  const mode = document.querySelector<HTMLElement>('.perf-mode')
  if (mode) mode.textContent = level === 'normal' ? runtimeProfile.tier : `${runtimeProfile.tier} · ${level}`
}

syncPerformanceGuardUi()

function updateAdaptiveQuality(avgMs: number, elapsedTime: number) {
  if (elapsedTime - lastQualityAdjustAt < 2.5) return
  const previousQuality = renderQuality
  const bounds = qualityBounds()
  const targetFrameMs = 1000 / frameRateLimit
  if ((currentFps > 0 && currentFps < frameRateLimit * 0.82) || avgMs > targetFrameMs * 1.18) {
    renderQuality = Math.max(bounds.min, renderQuality - QUALITY_STEP)
  } else if (currentFps >= frameRateLimit * 0.96 && avgMs < targetFrameMs * 0.92) {
    renderQuality = Math.min(bounds.max, renderQuality + QUALITY_STEP)
  }
  if (Math.abs(renderQuality - previousQuality) >= 0.01) {
    applyRenderQuality()
    lastQualityAdjustAt = elapsedTime
  }
}

let lastSurvivalUiAt = -Infinity
let lastSurvivalCharge = -1
let lastSurvivalThreat = ''
let lastSurvivalProtectionLabel = ''
let lastSurvivalStyle = ''
let lastShardSignalAt = -Infinity
let lastBiomeUiAt = -Infinity

function copyCurrentCoordinates() {
  const position = controls.object.position
  const coordinateText = formatWorldCoordinatesForClipboard(position.x, position.y, position.z)
  if (!navigator.clipboard?.writeText) {
    showToast(`Coordinates ${coordinateText}`)
    return
  }
  void navigator.clipboard.writeText(coordinateText).then(
    () => showToast('Coordinates copied'),
    () => showToast(`Coordinates ${coordinateText}`),
  )
}

worldBadgeButton?.addEventListener('click', copyCurrentCoordinates)
saveMetaButton?.addEventListener('click', copyCurrentCoordinates)

function respawnPlayer() {
  survivalVitals.respawn()
  carriedCrystal = Math.max(0, carriedCrystal - 1)
  crystalPower = Math.max(35, crystalPower)
  controls.object.position.set(PLAYER_SPAWN.x, PLAYER_SPAWN.y, PLAYER_SPAWN.z)
  playerMotion.reset()
  showToast('Wayfinder recovered at the Ark')
}

function updateSurvivalLoop(dt: number, day: number, elapsedTime: number) {
  const deepNight = day < 0.23
  const night = day < 0.38
  const shardWardLevel = Math.min(collectedGlowShards, EXPLORATION_GOAL_SHARDS)
  const carriedProtection = Math.min(carriedCrystal, 4) * 0.045
  const shardProtection = shardWardLevel * SHARD_WARD_PROTECTION
  const drainProtection = carriedProtection + shardProtection
  const drainRate = deepNight
    ? Math.max(0.45, 2.8 - drainProtection * 20)
    : night
      ? Math.max(0.12, 0.55 - shardProtection * 2.2 - carriedProtection * 1.2)
      : -0.22
  crystalPower = Math.max(0, Math.min(100, crystalPower - drainRate * dt))

  const lowPower = crystalPower < 35
  const danger = deepNight && lowPower
  const coldIntensity = danger ? Math.min(1, (35 - crystalPower) / 35) * (1 - day / 0.23) : 0
  const vitalsUpdate = survivalVitals.update(dt, coldIntensity, day > 0.45 && crystalPower > 50)
  if (vitalsUpdate.died) respawnPlayer()
  const carriedLabel = carriedCrystal > 0 ? ` · x${carriedCrystal}` : ''
  const shardWardLabel = shardWardLevel > 0 ? ` · Ward ${shardWardLevel}` : ''
  const protectionLabel = `${carriedLabel}${shardWardLabel}`

  if (coldVignetteEl) {
    coldVignetteEl.style.opacity = String(coldIntensity)
  }

  renderer.toneMappingExposure = 1.08 - coldIntensity * 0.28
  const baseFogDensity = runtimeProfile.tier === 'ultra-low' ? 0.04 : lowPowerMode ? 0.03 : 0.015
  sceneFog.density = baseFogDensity + (1 - day) * 0.012 + coldIntensity * 0.035

  let phase = 'Day'
  let threat = carriedCrystal > 0 ? 'Protected' : shardWardLevel > 0 ? 'Beacon Ward' : 'Safe'
  let threatColor = '#a8ffb9'
  let styleBand = 'high'

  if (day > 0.8) {
    phase = 'Noon'
  } else if (day > 0.4) {
    phase = 'Day'
  } else if (day > 0.25) {
    phase = 'Dusk'
    threat = 'Night Approaching'
    threatColor = '#fff3a8'
  } else if (danger) {
    phase = 'Deep Night'
    threat = shardWardLevel > 0 ? 'Ward Strained' : 'Cold Exposure'
    threatColor = shardWardLevel > 0 ? '#fff3a8' : '#8fd8ff'
  } else {
    phase = 'Night'
    threat = carriedCrystal > 0 ? 'Crystal Ward' : shardWardLevel > 0 ? 'Beacon Ward' : 'Keep Power'
    threatColor = carriedCrystal > 0 ? '#d999ff' : shardWardLevel > 0 ? '#fff3a8' : '#ffb4d9'
  }

  if (danger && elapsedTime - lastSurvivalToastAt > 14) {
    showToast('Cold night: mine crystal to restore power')
    lastSurvivalToastAt = elapsedTime
  }

  const chargeInt = Math.floor(crystalPower)
  const threatText = `${phase} · ${threat}`

  if (!threatValEl || !crystalBarEl || !crystalValEl || !survivalBadgeEl) return
  const health = Math.round(survivalVitals.getHealth())
  if (healthBarEl) healthBarEl.style.width = `${health}%`
  if (healthValEl) healthValEl.textContent = `${health}%`
  if (
    elapsedTime - lastSurvivalUiAt < 0.25 &&
    chargeInt === lastSurvivalCharge &&
    threatText === lastSurvivalThreat &&
    protectionLabel === lastSurvivalProtectionLabel
  ) {
    return
  }

  lastSurvivalUiAt = elapsedTime
  if (threatText !== lastSurvivalThreat) {
    threatValEl.textContent = threatText
    threatValEl.style.color = threatColor
    lastSurvivalThreat = threatText
  } else if (threatValEl.style.color !== threatColor) {
    threatValEl.style.color = threatColor
  }
  if (chargeInt !== lastSurvivalCharge) {
    crystalBarEl.style.width = `${chargeInt}%`
    lastSurvivalCharge = chargeInt
  }
  if (protectionLabel !== lastSurvivalProtectionLabel || crystalValEl.textContent !== `${chargeInt}%${protectionLabel}`) {
    crystalValEl.textContent = `${chargeInt}%${protectionLabel}`
    lastSurvivalProtectionLabel = protectionLabel
  }

  if (chargeInt < 25) {
    styleBand = 'low'
  } else if (chargeInt < 60) {
    styleBand = 'mid'
  }

  if (styleBand === lastSurvivalStyle) return
  lastSurvivalStyle = styleBand
  if (styleBand === 'low') {
    crystalBarEl.style.background = 'linear-gradient(90deg, #5fcfff, #ff8c8c)'
    crystalValEl.style.color = '#8fd8ff'
    survivalBadgeEl.style.borderColor = 'rgba(95, 207, 255, 0.55)'
    survivalBadgeEl.style.boxShadow = '0 20px 50px rgba(95, 207, 255, 0.16)'
  } else if (styleBand === 'mid') {
    crystalBarEl.style.background = 'linear-gradient(90deg, #ffd754, #fff3a8)'
    crystalValEl.style.color = '#fff3a8'
    survivalBadgeEl.style.borderColor = 'rgba(255, 215, 84, 0.4)'
    survivalBadgeEl.style.boxShadow = '0 20px 50px rgba(255, 215, 84, 0.1)'
  } else {
    crystalBarEl.style.background = 'linear-gradient(90deg, #a78cff, #d999ff)'
    crystalValEl.style.color = '#d999ff'
    survivalBadgeEl.style.borderColor = 'rgba(141, 117, 255, 0.35)'
    survivalBadgeEl.style.boxShadow = '0 20px 50px rgba(0,0,0,0.35)'
  }
}

let lastLightCullAt = -Infinity
const LIGHT_CULL_DISTANCE_SQ = 24 * 24

function cullPointLights(elapsedTime: number) {
  if (elapsedTime - lastLightCullAt < 0.2) return
  lastLightCullAt = elapsedTime
  const playerPos = controls.object.position
  const candidates: Array<{ key: PackedBlockKey; light: THREE.PointLight; priority: number }> = []
  glowLightsByBlock.forEach((light, key) => {
    const dx = light.position.x - playerPos.x
    const dy = light.position.y - playerPos.y
    const dz = light.position.z - playerPos.z
    const distSq = dx * dx + dy * dy + dz * dz
    if (distSq > LIGHT_CULL_DISTANCE_SQ) {
      light.visible = false
      return
    }
    candidates.push({
      key,
      light,
      priority: light.userData.blockId === 'glow' ? 2 : 1,
    })
  })
  const guardedLightBudget = Math.floor(MAX_ACTIVE_GLOW_LIGHTS * performanceGuard.budget.pointLightScale)
  applyPointLightBudget(playerPos, candidates, guardedLightBudget)
}

function updateInstancedBounds() {
  if (!needUpdateBounds) return
  needUpdateBounds = false
  instancedBlockMeshes.forEach((mesh) => {
    if (mesh.count > 0) {
      mesh.computeBoundingBox()
      mesh.computeBoundingSphere()
    }
  })
  if (grassBladeMesh && grassBladeMesh.count > 0) {
    grassBladeMesh.computeBoundingBox()
    grassBladeMesh.computeBoundingSphere()
  }
}

function updateFrameStats(dt: number, elapsedTime: number) {
  const frameMs = dt * 1000
  frameBudgetTotal -= frameBudgetSamples[frameBudgetIndex]
  frameBudgetSamples[frameBudgetIndex] = frameMs
  frameBudgetTotal += frameMs
  frameBudgetIndex = (frameBudgetIndex + 1) % FRAME_SAMPLE_COUNT
  frameBudgetCount = Math.min(frameBudgetCount + 1, FRAME_SAMPLE_COUNT)
  currentAverageFrameMs = Math.round(frameBudgetTotal / frameBudgetCount)

  fpsFrameCount++
  fpsElapsed += dt
  if (fpsElapsed < 0.5) return
  currentFps = Math.round(fpsFrameCount / fpsElapsed)
  fpsFrameCount = 0
  fpsElapsed = 0

  const avgMs = currentAverageFrameMs
  const guardTransition = performanceGuard.sample({ fps: currentFps, averageFrameMs: avgMs })
  if (guardTransition.changed) {
    syncPerformanceGuardUi()
    lastTerrainEnsureScanKey = ''
    pendingTerrainEnsure = { x: controls.object.position.x, z: controls.object.position.z }
  }
  updateAdaptiveQuality(avgMs, elapsedTime)
  cosmeticEffectsReduced = performanceGuard.currentLevel !== 'normal' || (
    currentFps > 0 && (currentFps < 36 || avgMs > 24 || renderQuality <= MIN_RENDER_QUALITY + 0.02)
  )

  if (!showPerformanceHud) return
  if (fpsEl && msEl) {
    fpsEl.textContent = String(currentFps)
    msEl.textContent = `${avgMs} · Q${Math.round(renderQuality * 100)}%`
    fpsEl.style.color = currentFps >= frameRateLimit * 0.92 ? '#a8ffb9' : currentFps >= frameRateLimit * 0.65 ? '#fff3a8' : '#ffd7fa'
  }
  if (blocksEl) {
    blocksEl.textContent = String(blocks.size)
  }
  if (chunksEl) {
    chunksEl.textContent = String(chunks.size)
  }
  if (terrainChunksEl) {
    terrainChunksEl.textContent = `${generatedTerrainChunks.size}/${discoveredTerrainChunks.size}`
  }
  if (dirtyEl) {
    dirtyEl.textContent = `${terrainGenerationQueue.length + terrainWorkerInFlight}/${dirtyChunkKeys.size}/${optimizedChunks.getDirtyChunks().length}`
  }
  if (callsEl) callsEl.textContent = formatPerformanceNumber(renderer.info.render.calls)
  if (trianglesEl) trianglesEl.textContent = formatPerformanceNumber(renderer.info.render.triangles)
  if (geometriesEl) geometriesEl.textContent = formatPerformanceNumber(renderer.info.memory.geometries)
  if (texturesEl) texturesEl.textContent = formatPerformanceNumber(renderer.info.memory.textures)
}

function formatPerformanceNumber(value: number) {
  const safeValue = Math.max(0, Math.round(Number.isFinite(value) ? value : 0))
  if (safeValue < 1000) return String(safeValue)
  if (safeValue < 1_000_000) return `${(safeValue / 1000).toFixed(safeValue < 10_000 ? 1 : 0)}k`
  return `${(safeValue / 1_000_000).toFixed(safeValue < 10_000_000 ? 1 : 0)}m`
}

const AUTO_SAVE_INTERVAL = 300 // 5 minutes
let lastIdleFrameAt = -Infinity
let lastSaveActivityRefreshAt = -Infinity

function scheduleAutoSave() {
  if (autoSavePending) return
  autoSavePending = true
  saveActivity.begin()
  updateSaveActivityUi()
  idleTasks.schedule(() => {
    autoSavePending = false
    lastAutoSaveAt = simulationElapsedTime
    saveWorld(true)
  })
}

function animate() {
  requestAnimationFrame(animate)
  if (document.hidden) {
    clock.getDelta()
    return
  }
  const now = performance.now()
  if ((!hasStarted || isPaused) && now - lastIdleFrameAt < 100) return
  if (!hasStarted || isPaused) lastIdleFrameAt = now
  if (hasStarted && !isPaused && !gameplayFrameLimiter.shouldRun(now)) return
  const dt = Math.min(clock.getDelta(), 0.05)
  const workBudget = performanceGuard.budget
  const meshBatchBudget = Math.max(1, Math.floor(runtimeLimits.meshBatchSize * workBudget.meshBatchScale))
  const meshTimeBudget = Math.max(0.4, runtimeLimits.meshBudgetMs * workBudget.meshTimeScale)
  if (!hasStarted || isPaused) {
    rebuildDirtyChunkVisibleFaceSummaries(workBudget.visibleFaceSummaries)
    rebuildOptimizedChunkMeshes(meshBatchBudget, meshTimeBudget)
    updateInstancedBounds()
    renderer.render(scene, camera)
    return
  }
  simulationElapsedTime += dt
  const elapsedTime = simulationElapsedTime
  if (hasStarted && elapsedTime - lastAutoSaveAt > AUTO_SAVE_INTERVAL) {
    scheduleAutoSave()
  }
  if (elapsedTime - lastSaveActivityRefreshAt >= 15) {
    lastSaveActivityRefreshAt = elapsedTime
    updateSaveActivityUi()
  }
  rebuildDirtyChunkVisibleFaceSummaries(workBudget.visibleFaceSummaries)
  rebuildOptimizedChunkMeshes(meshBatchBudget, meshTimeBudget)
  updateInstancedBounds()
  updateFrameStats(dt, elapsedTime)
  cullPointLights(elapsedTime)
  if (elapsedTime - lastShardSignalAt > 0.35) {
    lastShardSignalAt = elapsedTime
    updateShardSignal()
  }
  if (worldBiomeEl && elapsedTime - lastBiomeUiAt > 0.75) {
    lastBiomeUiAt = elapsedTime
    const position = controls.object.position
    worldBiomeEl.textContent = `${getBiomeAt(position.x, position.z, worldSeed).name} · ${progression.getToolName()}`
    if (worldCoordinatesEl) {
      worldCoordinatesEl.textContent = formatWorldCoordinates(position.x, position.y, position.z)
    }
  }

  particleEffects.update(dt)

  const aimingActive = hasStarted && !isPaused && (controls.isLocked || mobileActive)
  const hit = aimingActive ? pickBlock() : undefined
  if (hit && hit.distance <= RAYCAST_REACH) {
    hitBlockPosition.set(hit.x, hit.y, hit.z)
    targetOutlineMesh.position.copy(hitBlockPosition)
    targetOutlineMesh.visible = true

    const selectedBlock = BLOCKS[selected].id
    const plan = planBuildPattern(hit)
    const isValidPlacement = validateBuildPlan(plan, selectedBlock) === ''
    if (plan.count === 1) {
      if (!previewMesh) {
        previewMesh = new THREE.Mesh(previewGeometry, previewMaterial)
        previewMesh.castShadow = false
        previewMesh.receiveShadow = false
        previewMesh.renderOrder = 10
        scene.add(previewMesh)
      }
      if (!previewOutlineMesh) {
        previewOutlineMesh = new THREE.LineSegments(previewOutlineGeometry, previewOutlineMaterial)
        previewOutlineMesh.renderOrder = 11
        scene.add(previewOutlineMesh)
      }
      previewMesh.position.copy(placePosition)
      previewMesh.scale.setScalar(1.01)
      const material = previewMesh.material as THREE.MeshStandardMaterial
      material.opacity = isValidPlacement ? 0.28 : 0.46
      material.color.setHex(isValidPlacement ? BLOCKS[selected].color : 0xff6666)
      material.emissive.setHex(isValidPlacement ? 0x234d2c : 0xff3333)
      material.emissiveIntensity = isValidPlacement ? 0.18 : 0.35
      previewMesh.visible = true
      previewOutlineMesh.position.copy(placePosition)
      previewOutlineMaterial.color.setHex(isValidPlacement ? 0xa8ffb9 : 0xff7777)
      previewOutlineMaterial.opacity = isValidPlacement ? 0.92 : 1
      previewOutlineMesh.visible = true
      if (patternPreviewMesh) patternPreviewMesh.visible = false
    } else {
      if (!patternPreviewMesh) {
        patternPreviewMesh = new THREE.InstancedMesh(previewGeometry, patternPreviewMaterial, 9)
        patternPreviewMesh.castShadow = false
        patternPreviewMesh.receiveShadow = false
        patternPreviewMesh.frustumCulled = false
        patternPreviewMesh.renderOrder = 10
        scene.add(patternPreviewMesh)
      }
      for (let index = 0; index < plan.count; index++) {
        const position = plan.positions[index]
        patternPreviewMatrix.makeTranslation(position.x, position.y, position.z)
        patternPreviewMesh.setMatrixAt(index, patternPreviewMatrix)
      }
      patternPreviewMesh.count = plan.count
      patternPreviewMesh.instanceMatrix.needsUpdate = true
      patternPreviewMaterial.opacity = isValidPlacement ? 0.24 : 0.4
      patternPreviewMaterial.color.setHex(isValidPlacement ? BLOCKS[selected].color : 0xff6666)
      patternPreviewMaterial.emissive.setHex(isValidPlacement ? 0x234d2c : 0xff3333)
      patternPreviewMaterial.emissiveIntensity = isValidPlacement ? 0.18 : 0.35
      patternPreviewMesh.visible = true
      if (previewMesh) previewMesh.visible = false
      if (previewOutlineMesh) previewOutlineMesh.visible = false
    }
  } else {
    targetOutlineMesh.visible = false
    if (previewMesh) {
      previewMesh.visible = false
    }
    if (previewOutlineMesh) {
      previewOutlineMesh.visible = false
    }
    if (patternPreviewMesh) patternPreviewMesh.visible = false
  }

  if (shardBeacon.visible) {
    const pulse = 1 + Math.sin(elapsedTime * 4.2) * 0.11
    shardBeaconRing.rotation.z += dt * 1.4
    shardBeaconHalo.rotation.z -= dt * 0.7
    shardBeacon.scale.setScalar(pulse)
    ;(shardBeaconRing.material as THREE.MeshBasicMaterial).opacity = cosmeticEffectsReduced ? 0.45 : 0.68 + Math.sin(elapsedTime * 3.4) * 0.16
  }
  arkCore.rotation.y += dt * 0.16
  arkCoreSpire.rotation.y -= dt * 0.42
  arkCoreModules.forEach((module, index) => {
    module.rotation.y += dt * (0.22 + index * 0.015)
  })

  const t = elapsedTime * 0.055
  const day = (Math.sin(t) + 1) / 2
  sun.intensity = 0.55 + day * 2.65
  hemi.intensity = 0.55 + day * 1.55
  moon.intensity = 0.18 + (1 - day) * 0.55
  sun.position.set(Math.cos(t) * 58, 18 + day * 62, Math.sin(t) * 58)
  stars.visible = day < 0.48
  skyColor.lerpColors(nightSkyColor, daySkyColor, day)
  sceneFog.color.copy(skyColor)
  updateSurvivalLoop(dt, day, elapsedTime)

  let moveRightInput = 0
  let moveForwardInput = 0
  if (keys.has('KeyW')) moveForwardInput += 1
  if (keys.has('KeyS')) moveForwardInput -= 1
  if (keys.has('KeyA')) moveRightInput -= 1
  if (keys.has('KeyD')) moveRightInput += 1
  if (mobileActive) {
    moveRightInput += mobileMove.x
    moveForwardInput -= mobileMove.y
  }
  const motionActive = controls.isLocked || mobileActive
  const motionStep = playerMotion.update(moveRightInput, moveForwardInput, keys.has('ShiftLeft'), motionActive, dt)
  if (motionActive) {
    previousPosition.copy(controls.object.position)
    controls.moveRight(motionStep.right)
    controls.moveForward(motionStep.forward)
    movementDelta.copy(controls.object.position).sub(previousPosition)
    controls.object.position.copy(previousPosition)
    movePlayerHorizontal(movementDelta)
    if (
      !tutorialGuide.isComplete('move') &&
      controls.object.position.distanceToSquared(previousPosition) > 0.0025
    ) {
      advanceTutorial('move')
    }
  }

  movePlayerVertical(motionStep.vertical)
  const pos = controls.object.position
  const terrainCenterKey = terrainChunkKey(chunkCoord(pos.x), chunkCoord(pos.z))
  if (terrainCenterKey !== lastTerrainCenterKey) {
    pendingTerrainEnsure = { x: pos.x, z: pos.z }
    lastTerrainCenterKey = terrainCenterKey
  }
  if (pendingTerrainEnsure && elapsedTime - lastTerrainEnsureAt >= TERRAIN_SCAN_INTERVAL) {
    ensureTerrainChunksAround(pendingTerrainEnsure.x, pendingTerrainEnsure.z, effectiveTerrainLoadRadius())
    pendingTerrainEnsure = null
    lastTerrainEnsureAt = elapsedTime
  }
  if (elapsedTime - lastTerrainEvictionAt >= (lowPowerMode ? 1.2 : 2)) {
    evictDistantTerrainChunks(pos.x, pos.z)
    lastTerrainEvictionAt = elapsedTime
  }
  const terrainQueueCadence = Math.max(
    workBudget.terrainFrameCadence,
    currentFps > 0 && (currentFps < 28 || renderQuality <= MIN_RENDER_QUALITY + 0.02) ? 4 : 1,
  )
  const terrainQueueBudget = terrainQueueFrameSkip++ % terrainQueueCadence === 0 ? TERRAIN_CHUNKS_PER_FRAME : 0
  if (terrainQueueBudget > 0) processTerrainQueue(terrainQueueBudget)
  const floor = playerCollision.findFloorAt(pos.x, pos.z, pos.y)
  if (pos.y < floor) { pos.y = floor; playerMotion.land() }
  else if (pos.y > floor + 0.05) playerMotion.setGrounded(false)
  if (playerCollision.collidesAt(pos)) pos.y = Math.max(pos.y, floor)
  updateMining()
  stabilizeFirstPersonLook()

  if (!cosmeticEffectsReduced || Math.floor(elapsedTime * 10) % 2 === 0) animateBlockMaterials(materials, elapsedTime)
  waterTimeUniform.value = elapsedTime
  grassTimeUniform.value = elapsedTime
  if (!cosmeticEffectsReduced) clouds.rotation.y += dt * 0.006
  const cloudCount = clouds.children.length
  const cloudUpdates = cosmeticEffectsReduced ? 0 : Math.min(cloudCount, adaptiveBudget(cloudCount, Math.min(3, cloudCount)))
  if (cloudAnimationCursor >= cloudCount) cloudAnimationCursor = 0
  for (let i = 0; i < cloudUpdates; i++) {
    const cloud = clouds.children[cloudAnimationCursor]
    cloud.position.x += Math.sin(elapsedTime * 0.08 + cloudAnimationCursor) * dt * 0.03
    cloudAnimationCursor = (cloudAnimationCursor + 1) % cloudCount
  }
  const sparkleCount = sparkles.children.length
  const sparkleUpdates = Math.min(sparkleCount, adaptiveBudget(sparkleCount, lowPowerMode ? 12 : 24))
  if (sparkleAnimationCursor >= sparkleCount) sparkleAnimationCursor = 0
  for (let i = 0; i < sparkleUpdates; i++) {
    const sparkle = sparkles.children[sparkleAnimationCursor]
    const seed = sparkle.userData.seed as number
    sparkle.position.y += Math.sin(elapsedTime * 1.4 + seed) * dt * 0.08
    sparkle.rotation.y += dt * 1.2
    sparkleAnimationCursor = (sparkleAnimationCursor + 1) % sparkleCount
  }
  renderer.render(scene, camera)
}
animate()

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  applyRenderQuality()
})

window.addEventListener('pagehide', () => {
  idleTasks.cancel()
  if (hasStarted) getWorldSaveSystem().save(serializeWorld())
  terrainWorker?.dispose()
  particleEffects.dispose()
  audioSystem.dispose()
}, { once: true })
