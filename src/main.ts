import './style.css'
import * as THREE from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import { BLOCKS, type BlockId } from './blocks'
import { animateBlockMaterials, createBlockMaterials } from './textures'
import { blockKey, terrainNoise } from './worldMath'

const app = document.querySelector<HTMLDivElement>('#app')!
const GAME_VERSION_LABEL = 'v1.4.1 Beacon Trail'
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
const lowPowerMode = isTouchDevice || hasTouchCapability || isSmallScreen || prefersReducedMotion

app.innerHTML = `
  <div class="hud">
    <div class="hud-stack hud-left-stack">
      <div class="title"><span class="eyebrow">VOXEL SANDBOX</span><h1>ASTRAVOXEL ARK</h1><p>${GAME_VERSION_LABEL}</p></div>
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
        </div>
      </div>
      <div class="tutorial">
        <p><strong>Tips:</strong> Click to enter · Follow beacon to shards · Save often</p>
      </div>
      <div class="compass-badge" aria-live="polite">
        <span class="compass-arrow">↑</span>
        <span class="compass-distance">Beacon scanning</span>
      </div>
      <div class="wayfinder-badge">
        <span class="wayfinder-label">Ark Core</span>
        <span class="wayfinder-value">Scanning</span>
      </div>
    </div>

    <div class="hud-stack hud-right-stack">
      <div class="help"><strong>Controls</strong><br/><span class="desktop-help">WASD move · Space jump<br/>Mouse look · Left break · Right place<br/>1-18 select block · Click to enter<br/>Goal: repair Ark Core with 6 landmark shards</span><span class="mobile-help">Left joystick: move · Drag right: look<br/>Tap right side: place · Hold right side: break<br/>Repair Ark Core with shards</span></div>
      <div class="perf-badge">
        <div class="perf-metric"><span class="perf-label">FPS</span><span class="perf-fps">--</span></div>
        <div class="perf-divider"></div>
        <div class="perf-metric"><span class="perf-label">Frame</span><div><span class="perf-ms">--</span><span class="perf-unit">ms</span></div></div>
        <div class="perf-divider"></div>
        <div class="perf-metric"><span class="perf-label">Chunks</span><span class="perf-chunks">0</span></div>
        <div class="perf-divider"></div>
        <div class="perf-metric"><span class="perf-label">Terrain</span><span class="perf-terrain-chunks">0</span></div>
        <div class="perf-divider"></div>
        <div class="perf-metric"><span class="perf-label">Blocks</span><span class="perf-blocks">0</span></div>
        <div class="perf-divider"></div>
        <div class="perf-metric"><span class="perf-label">Queue</span><span class="perf-dirty">0</span></div>
        <div class="perf-divider"></div>
        <div class="perf-metric"><span class="perf-label">Mode</span><span class="perf-mode">${lowPowerMode ? 'Low' : 'Full'}</span></div>
      </div>
      <div class="world-badge"><span class="badge-pulse"></span>${GAME_VERSION_LABEL}</div>
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
          <span>Game Menu</span>
          <button class="resume-btn">Resume</button>
        </div>
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
        </div>
        <div class="save-tools">
          <button class="save-btn">Save</button>
          <button class="load-btn">Load</button>
          <button class="export-btn">Export</button>
          <button class="import-btn">Import</button>
          <button class="reset-btn">Reset</button>
          <input class="import-input" type="file" accept="application/json,.json" />
        </div>
      </div>
    </div>
    <div class="start"><div class="panel"><span class="crest">✦</span><h2>星野方舟 v1.4</h2><p>Beacon Trail - repair the Ark Core through landmark shards and warded nights</p><button>Start Exploring</button></div></div>
  </div>
`

const scene = new THREE.Scene()
const nightSkyColor = new THREE.Color(0x17213d)
const daySkyColor = new THREE.Color(0xaedcff)
const skyColor = new THREE.Color(0xaedcff)
const sceneFog = new THREE.FogExp2(skyColor, 0.018)
scene.background = skyColor
scene.fog = sceneFog

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 600)
camera.position.set(0, 12, 18)
camera.rotation.order = 'YXZ'

const renderer = new THREE.WebGLRenderer({ antialias: !lowPowerMode, powerPreference: lowPowerMode ? 'low-power' : 'high-performance' })
renderer.setSize(window.innerWidth, window.innerHeight)
let renderQuality = lowPowerMode ? 0.85 : 1
function applyRenderQuality() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio * renderQuality, lowPowerMode ? 1.1 : 1.5))
}
applyRenderQuality()
renderer.shadowMap.enabled = !lowPowerMode
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.08
app.appendChild(renderer.domElement)

const controls = new PointerLockControls(camera, renderer.domElement)
scene.add(controls.object)
const SETTINGS_KEY = 'astra-voxel-ark-settings-v1'
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
const blocks = new Map<string, BlockVisual>()
const blockData = new Map<string, BlockId>()
const INITIAL_INSTANCED_MESH_CAPACITY = 15000
const instancedBlockMeshes = new Map<BlockId, THREE.InstancedMesh>()
const instancedBlockKeys = new Map<BlockId, string[]>()
const instancedBlockCapacities = new Map<BlockId, number>()
const instancedMatrix = new THREE.Matrix4()
const hiddenInstanceMatrix = new THREE.Matrix4().makeTranslation(0, -100000, 0)
const glowLights: THREE.PointLight[] = []
const glowLightsByBlock = new Map<string, THREE.PointLight>()
let grassBladeMesh: THREE.InstancedMesh | null = null
const grassBladeKeys: string[] = []
let needUpdateBounds = false
const INITIAL_GRASS_CAPACITY = 12000
const SAVE_KEY = 'astra-voxel-ark-world-v1'
const CHUNK_SIZE = 8
const INITIAL_TERRAIN_LOAD_RADIUS = 1
const TERRAIN_MAX_RADIUS = 6
const TERRAIN_CHUNKS_PER_FRAME = 1
const TERRAIN_SCAN_INTERVAL = 0.2
let terrainLoadRadius = 1
const RAYCAST_REACH = 8
const GRASS_ANIMATION_BUDGET = lowPowerMode ? 55 : 140
const MIN_RENDER_QUALITY = lowPowerMode ? 0.68 : 0.78
const MAX_RENDER_QUALITY = lowPowerMode ? 0.95 : 1
const QUALITY_STEP = 0.06
type QualityPreset = 'low' | 'balanced' | 'high'
const WALK_SPEED = 7.6
const SPRINT_SPEED = 12.2
const GROUND_ACCEL_RESPONSE = 14
const GROUND_STOP_RESPONSE = 12
const AIR_ACCEL_RESPONSE = 6
const AIR_STOP_RESPONSE = 2.5
const JUMP_VELOCITY = 8.2
const GRAVITY = 21.5
const TOUCH_JOYSTICK_DEADZONE = 0.1
const TOUCH_LOOK_DEADZONE = 0.35
function adaptiveBudget(base: number, minimum: number) {
  const pressureScale = currentFps > 0 && currentFps < 36 ? 0.65 : 1
  return Math.max(minimum, Math.round(base * (0.45 + renderQuality * 0.55) * pressureScale))
}
const BLOCK_IDS = new Set<BlockId>(BLOCKS.map((block) => block.id))
type SavedBlock = [number, number, number, BlockId]
type SavedWorld = {
  version: number
  savedAt: number
  blocks: SavedBlock[]
  terrainChunks?: string[]
  removedBlocks?: string[]
  playerPlacedBlocks?: string[]
  inventory?: Partial<Record<BlockId, number>>
  survival?: {
    crystalPower?: number
    carriedCrystal?: number
  }
  exploration?: {
    glowShards?: number
    collectedShardBlocks?: string[]
  }
}
type BlockSource = 'terrain' | 'player' | 'save'
type ChunkBucket = {
  id: BlockId
  material: THREE.Material | THREE.Material[]
  blockKeys: Set<string>
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
const queuedTerrainChunks = new Set<string>()
const terrainGenerationQueue: Array<{ cx: number; cz: number }> = []
let lastTerrainEnsureScanKey = ''
let lastTerrainCenterKey = ''
let pendingTerrainEnsure: { x: number; z: number } | null = null
let lastTerrainEnsureAt = -Infinity
const removedTerrainBlocks = new Set<string>()
const playerPlacedBlocks = new Set<string>()
const landmarkShardBlocks = new Set<string>()
const collectedShardBlocks = new Set<string>()
const inventoryCounts = new Map<BlockId, number>()
const keys = new Set<string>()
let velocityY = 0
let canJump = false
let crystalPower = 68
let carriedCrystal = 0
let collectedGlowShards = 0
let lastSurvivalToastAt = 0
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
const MAX_GLOW_LIGHTS = lowPowerMode ? 0 : Number.POSITIVE_INFINITY

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

function hasExposedFace(x: number, y: number, z: number, id: BlockId) {
  const isOpaque = isOpaqueBlockId(id)
  return SOLID_NEIGHBOR_OFFSETS.some(([dx, dy, dz]) => {
    const neighborId = blockData.get(blockKey(x + dx, y + dy, z + dz))
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
    const neighborId = blockData.get(blockKey(x + dx, y + dy, z + dz))
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

function removeGlowLightAt(k: string) {
  const light = glowLightsByBlock.get(k)
  if (!light) return
  scene.remove(light)
  removeArrayItemUnordered(glowLights, light)
  glowLightsByBlock.delete(k)
}

function ensureGlowLightAt(k: string, x: number, y: number, z: number, id: BlockId) {
  if ((id !== 'glow' && id !== 'crystal') || glowLightsByBlock.has(k) || glowLights.length >= MAX_GLOW_LIGHTS) return
  const light = new THREE.PointLight(
    id === 'glow' ? 0xffcf7a : 0x9b86ff,
    lowPowerMode ? (id === 'glow' ? 0.55 : 0.35) : (id === 'glow' ? 1.2 : 0.75),
    lowPowerMode ? 5 : 8,
  )
  light.position.set(x, y + 0.2, z)
  scene.add(light)
  glowLightsByBlock.set(k, light)
  glowLights.push(light)
}

function refreshBlockVisualAt(k: string) {
  const id = blockData.get(k)
  if (!id) return
  const [x, y, z] = k.split(',').map(Number)
  const visual = blocks.get(k)
  const shouldRender = hasExposedFace(x, y, z, id)

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
  refreshBlockVisualAt(blockKey(x, y, z))
  SOLID_NEIGHBOR_OFFSETS.forEach(([dx, dy, dz]) => refreshBlockVisualAt(blockKey(x + dx, y + dy, z + dz)))
}

function addInstancedBlockVisual(k: string, x: number, y: number, z: number, id: BlockId) {
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

function growInstancedBlockMesh(id: BlockId, oldMesh: THREE.InstancedMesh, keysForType: string[]) {
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

function removeInstancedBlockVisual(k: string, ref: InstancedBlockRef) {
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

function getBlockKeyFromHit(hit: THREE.Intersection<THREE.Object3D>) {
  if (hit.object instanceof THREE.InstancedMesh) {
    const id = hit.object.userData.id as BlockId | undefined
    const instanceId = hit.instanceId
    if (!id || instanceId === undefined) return undefined
    return instancedBlockKeys.get(id)?.[instanceId]
  }
  const p = hit.object.position
  return blockKey(Math.round(p.x), Math.round(p.y), Math.round(p.z))
}

function getBlockPositionFromKey(key: string, target: THREE.Vector3) {
  const [x, y, z] = key.split(',').map(Number)
  return target.set(x, y, z)
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

function registerBlockInChunk(x: number, y: number, z: number, id: BlockId, key: string) {
  const chunk = getOrCreateChunk(x, y, z)
  let bucket = chunk.buckets.get(id)
  if (!bucket) {
    bucket = { id, material: materials.get(id)!, blockKeys: new Set() }
    chunk.buckets.set(id, bucket)
  }
  bucket.blockKeys.add(key)
  markBlockAndNeighborChunksDirty(x, y, z)
}

function unregisterBlockFromChunk(x: number, y: number, z: number, id: BlockId, key: string) {
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
      const [x, y, z] = key.split(',').map(Number)
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

function seededNoise(...values: number[]) {
  return hashNoise(values.reduce((seed, value) => seed * 31 + value, 17))
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
  const anchorKey = blockKey(x, y, z)
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

function removeGrassTuftsAt(anchorKey: string) {
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
  const k = blockKey(x, y, z)
  if (source === 'terrain' && removedTerrainBlocks.has(k)) return
  if (blocks.has(k)) return
  if (source === 'player') {
    removedTerrainBlocks.delete(k)
    playerPlacedBlocks.add(k)
  }
  blocks.set(k, undefined)
  blockMutationVersion++
  blockData.set(k, id)
  registerBlockInChunk(x, y, z, id, k)
  refreshBlockAndNeighbors(x, y, z)

  const visual = blocks.get(k)
  if (visual) ensureGlowLightAt(k, x, y, z, id)
}

function removeBlockAtKey(k: string, source: 'player' | 'system' = 'system') {
  if (!blocks.has(k)) return
  const visual = blocks.get(k)
  const [x, y, z] = k.split(',').map(Number)
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
  if (id) unregisterBlockFromChunk(x, y, z, id, k)
  refreshBlockAndNeighbors(x, y, z)
}

function setStarterInventory() {
  inventoryCounts.clear()
  BLOCKS.forEach(({ id }) => {
    inventoryCounts.set(id, Math.max(0, STARTER_INVENTORY[id] ?? 0))
  })
}

function addToInventory(id: BlockId, amount = 1) {
  inventoryCounts.set(id, Math.max(0, (inventoryCounts.get(id) ?? 0) + amount))
}

function consumeInventory(id: BlockId) {
  const count = inventoryCounts.get(id) ?? 0
  if (count <= 0) return false
  inventoryCounts.set(id, count - 1)
  return true
}

function readSavedInventory(savedInventory: SavedWorld['inventory']) {
  setStarterInventory()
  if (!savedInventory || typeof savedInventory !== 'object') return
  BLOCKS.forEach(({ id }) => {
    const count = savedInventory[id]
    if (typeof count === 'number' && Number.isFinite(count)) {
      inventoryCounts.set(id, Math.max(0, Math.floor(count)))
    }
  })
}

function readSavedExploration(savedExploration: SavedWorld['exploration']) {
  collectedShardBlocks.clear()
  collectedGlowShards = 0
  if (!savedExploration || typeof savedExploration !== 'object') return

  if (typeof savedExploration.glowShards === 'number' && Number.isFinite(savedExploration.glowShards)) {
    collectedGlowShards = Math.max(0, Math.min(EXPLORATION_GOAL_SHARDS, Math.floor(savedExploration.glowShards)))
  }
  if (Array.isArray(savedExploration.collectedShardBlocks)) {
    savedExploration.collectedShardBlocks.filter(isValidBlockKey).forEach((key) => collectedShardBlocks.add(key))
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
  generatedTerrainChunks.clear()
  queuedTerrainChunks.clear()
  terrainGenerationQueue.length = 0
  lastTerrainEnsureScanKey = ''
  lastTerrainCenterKey = ''
  pendingTerrainEnsure = null
  removedTerrainBlocks.clear()
  playerPlacedBlocks.clear()
  landmarkShardBlocks.clear()
}

function serializeWorld(): SavedWorld {
  const savedBlocks: SavedBlock[] = []
  blockData.forEach((id, key) => {
    savedBlocks.push([...key.split(',').map(Number), id] as SavedBlock)
  })
  return {
    version: 4,
    savedAt: Date.now(),
    blocks: savedBlocks,
    terrainChunks: [...generatedTerrainChunks],
    removedBlocks: [...removedTerrainBlocks],
    playerPlacedBlocks: [...playerPlacedBlocks],
    inventory: Object.fromEntries(BLOCKS.map(({ id }) => [id, inventoryCounts.get(id) ?? 0])) as Partial<Record<BlockId, number>>,
    survival: {
      crystalPower,
      carriedCrystal,
    },
    exploration: {
      glowShards: collectedGlowShards,
      collectedShardBlocks: [...collectedShardBlocks],
    },
  }
}

function isValidBlockId(id: unknown): id is BlockId {
  return typeof id === 'string' && BLOCK_IDS.has(id as BlockId)
}

function isValidSavedBlock(block: unknown): block is SavedBlock {
  if (!Array.isArray(block) || block.length !== 4) return false
  const [x, y, z, id] = block
  return Number.isInteger(x) && Number.isInteger(y) && Number.isInteger(z) && isValidBlockId(id)
}

function isValidTerrainChunkKey(key: unknown): key is string {
  if (typeof key !== 'string') return false
  const parts = key.split(',')
  if (parts.length !== 2) return false
  const [cx, cz] = parts.map(Number)
  return Number.isInteger(cx) && Number.isInteger(cz) && isTerrainChunkInBounds(cx, cz)
}

function isValidBlockKey(key: unknown): key is string {
  if (typeof key !== 'string') return false
  const parts = key.split(',')
  if (parts.length !== 3) return false
  const [x, y, z] = parts.map(Number)
  return Number.isInteger(x) && Number.isInteger(y) && Number.isInteger(z)
}

function getLandmarkShardKeysForChunk(cx: number, cz: number) {
  const shardKeys: string[] = []
  if (cx === 0 && cz === 0) return shardKeys
  const roll = hashNoise(cx * 92821 + cz * 68917 + 17)
  if (roll > 0.28) return shardKeys

  const startX = cx * CHUNK_SIZE
  const startZ = cz * CHUNK_SIZE
  const originX = startX + 2 + Math.floor(hashNoise(cx * 317 + cz * 911 + 3) * 4)
  const originZ = startZ + 2 + Math.floor(hashNoise(cx * 613 + cz * 271 + 5) * 4)
  const originY = terrainHeightAt(originX, originZ) + 1
  if (originY <= 4) return shardKeys

  if (roll < 0.11) {
    shardKeys.push(blockKey(originX, originY + 2, originZ))
  } else if (roll < 0.2) {
    const clusterSize = 4 + Math.floor(hashNoise(cx * 149 + cz * 463 + 29) * 4)
    for (let i = 0; i < clusterSize; i++) {
      const dx = Math.floor(hashNoise(cx * 101 + cz * 103 + i * 37) * 3) - 1
      const dz = Math.floor(hashNoise(cx * 107 + cz * 109 + i * 41) * 3) - 1
      const dy = i > 3 ? 1 : 0
      shardKeys.push(blockKey(originX + dx, originY + dy, originZ + dz))
    }
  } else {
    shardKeys.push(blockKey(originX, originY + 2, originZ))
  }
  return shardKeys
}

function rebuildLandmarkShardBlocks() {
  landmarkShardBlocks.clear()
  generatedTerrainChunks.forEach((key) => {
    const [cx, cz] = key.split(',').map(Number)
    if (!Number.isInteger(cx) || !Number.isInteger(cz)) return
    getLandmarkShardKeysForChunk(cx, cz).forEach((shardKey) => {
      const id = blockData.get(shardKey)
      if ((id === 'glow' || id === 'crystal') && !playerPlacedBlocks.has(shardKey) && !collectedShardBlocks.has(shardKey)) {
        landmarkShardBlocks.add(shardKey)
      }
    })
  })
}

function applySavedWorld(data: SavedWorld) {
  if (!Array.isArray(data.blocks)) throw new Error('Bad save')
  const savedBlocks = data.blocks.filter(isValidSavedBlock)
  clearWorldBlocks()
  readSavedInventory(data.inventory)
  readSavedExploration(data.exploration)
  savedBlocks.forEach(([x, y, z, id]) => addBlock(x, y, z, id, 'save'))
  if (Array.isArray(data.terrainChunks)) {
    data.terrainChunks.filter(isValidTerrainChunkKey).forEach((key) => generatedTerrainChunks.add(key))
  } else {
    savedBlocks.forEach(([x, , z]) => generatedTerrainChunks.add(terrainChunkKeyForBlock(x, z)))
  }
  if (Array.isArray(data.removedBlocks)) {
    data.removedBlocks.filter(isValidBlockKey).forEach((key) => removedTerrainBlocks.add(key))
  }
  playerPlacedBlocks.clear()
  if (Array.isArray(data.playerPlacedBlocks)) {
    data.playerPlacedBlocks.filter(isValidBlockKey).forEach((key) => {
      if (blockData.has(key)) playerPlacedBlocks.add(key)
    })
  }
  rebuildLandmarkShardBlocks()
  crystalPower = typeof data.survival?.crystalPower === 'number' ? Math.max(0, Math.min(100, data.survival.crystalPower)) : 68
  carriedCrystal = typeof data.survival?.carriedCrystal === 'number' ? Math.max(0, Math.floor(data.survival.carriedCrystal)) : 0
  controls.object.position.set(0, 12, 18)
  velocityY = 0
}

function saveWorld() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(serializeWorld()))
  showToast('World saved')
}

function loadWorld() {
  const raw = localStorage.getItem(SAVE_KEY)
  if (!raw) {
    showToast('No save yet')
    return false
  }
  try {
    applySavedWorld(JSON.parse(raw) as SavedWorld)
    showToast('World loaded')
    return true
  } catch {
    showToast('Save is broken')
    return false
  }
}

function exportWorld() {
  const data = JSON.stringify(serializeWorld(), null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const link = document.createElement('a')
  const date = new Date().toISOString().slice(0, 10)
  link.href = URL.createObjectURL(blob)
  link.download = `astravoxel-ark-save-${date}.json`
  link.click()
  URL.revokeObjectURL(link.href)
  showToast('Save exported')
}

function importWorld(file: File) {
  const reader = new FileReader()
  reader.addEventListener('load', () => {
    try {
      const data = JSON.parse(String(reader.result)) as SavedWorld
      applySavedWorld(data)
      localStorage.setItem(SAVE_KEY, JSON.stringify(serializeWorld()))
      updateHotbar()
      showToast('Save imported')
    } catch {
      showToast('Import failed')
    }
  })
  reader.readAsText(file)
}

function resetWorld() {
  clearWorldBlocks()
  setStarterInventory()
  localStorage.removeItem(SAVE_KEY)
  crystalPower = 68
  carriedCrystal = 0
  collectedGlowShards = 0
  collectedShardBlocks.clear()
  generateWorld()
  controls.object.position.set(0, 12, 18)
  velocityY = 0
  updateHotbar()
  showToast('New world')
}

function isSolidBlockAt(x: number, y: number, z: number) {
  const id = blockData.get(blockKey(x, y, z))
  return !!id && id !== 'water'
}

function playerOverlapsBlockAt(pos: THREE.Vector3, x: number, y: number, z: number, clearance = 0) {
  const playerBottom = pos.y - PLAYER_HEIGHT - clearance
  const playerTop = pos.y + PLAYER_HEAD_CLEARANCE + clearance
  const overlapsXZ =
    Math.abs(pos.x - x) < PLAYER_RADIUS + 0.5 + clearance &&
    Math.abs(pos.z - z) < PLAYER_RADIUS + 0.5 + clearance
  const overlapsY = playerBottom < y + 0.5 && playerTop > y - 0.5
  return overlapsXZ && overlapsY
}

function playerCollidesAt(pos: THREE.Vector3, clearance = 0) {
  const minX = Math.floor(pos.x - PLAYER_RADIUS - 0.5 - clearance)
  const maxX = Math.ceil(pos.x + PLAYER_RADIUS + 0.5 + clearance)
  const minY = Math.floor(pos.y - PLAYER_HEIGHT - 0.5 - clearance)
  const maxY = Math.ceil(pos.y + PLAYER_HEAD_CLEARANCE + 0.5 + clearance)
  const minZ = Math.floor(pos.z - PLAYER_RADIUS - 0.5 - clearance)
  const maxZ = Math.ceil(pos.z + PLAYER_RADIUS + 0.5 + clearance)

  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        if (!isSolidBlockAt(x, y, z)) continue
        if (playerOverlapsBlockAt(pos, x, y, z, clearance)) return true
      }
    }
  }
  return false
}

function findFloorAt(x: number, z: number, maxEyeY = Infinity) {
  let floor = PLAYER_EYE_HEIGHT
  const minX = Math.floor(x - PLAYER_RADIUS)
  const maxX = Math.ceil(x + PLAYER_RADIUS)
  const minZ = Math.floor(z - PLAYER_RADIUS)
  const maxZ = Math.ceil(z + PLAYER_RADIUS)
  for (let y = 18; y >= -2; y--) {
    for (let bx = minX; bx <= maxX; bx++) {
      for (let bz = minZ; bz <= maxZ; bz++) {
        const eyeY = y + PLAYER_EYE_HEIGHT
        if (eyeY <= maxEyeY + 0.05 && isSolidBlockAt(bx, y, bz)) return eyeY
      }
    }
  }
  return floor
}

const stepProbe = new THREE.Vector3()
const xCollisionProbe = new THREE.Vector3()
const zCollisionProbe = new THREE.Vector3()
const verticalCollisionProbe = new THREE.Vector3()

function tryStepTo(pos: THREE.Vector3, x: number, z: number) {
  if (!canJump || velocityY > 0.01) return false
  stepProbe.set(x, pos.y + STEP_HEIGHT, z)
  if (playerCollidesAt(stepProbe)) return false
  const steppedFloor = findFloorAt(x, z, pos.y + STEP_HEIGHT)
  if (steppedFloor <= pos.y + STEP_HEIGHT + 0.05 && steppedFloor > pos.y + 0.05) {
    pos.set(x, steppedFloor, z)
    velocityY = 0
    return true
  }
  return false
}

function movePlayerHorizontal(delta: THREE.Vector3) {
  const pos = controls.object.position
  if (delta.lengthSq() === 0) return

  const xTarget = pos.x + delta.x
  xCollisionProbe.set(xTarget, pos.y, pos.z)
  if (!playerCollidesAt(xCollisionProbe) || tryStepTo(pos, xTarget, pos.z)) pos.x = xTarget

  const zTarget = pos.z + delta.z
  zCollisionProbe.set(pos.x, pos.y, zTarget)
  if (!playerCollidesAt(zCollisionProbe) || tryStepTo(pos, pos.x, zTarget)) pos.z = zTarget
}

function movePlayerVertical(deltaY: number) {
  if (deltaY === 0) return
  const pos = controls.object.position
  const startY = pos.y
  const targetY = startY + deltaY
  verticalCollisionProbe.set(pos.x, targetY, pos.z)

  if (!playerCollidesAt(verticalCollisionProbe)) {
    pos.y = targetY
    return
  }

  let open = 0
  let blocked = 1
  for (let i = 0; i < 8; i++) {
    const mid = (open + blocked) / 2
    verticalCollisionProbe.set(pos.x, startY + deltaY * mid, pos.z)
    if (playerCollidesAt(verticalCollisionProbe)) blocked = mid
    else open = mid
  }

  pos.y = startY + deltaY * open
  velocityY = 0
  if (deltaY < 0) canJump = true
}

// 破坏粒子系统
type Particle = { mesh: THREE.Mesh; vx: number; vy: number; vz: number; life: number }
const particles: Particle[] = []
const breakParticleGeometry = new THREE.BoxGeometry(0.15, 0.15, 0.15)
const breakParticleMaterials = new Map<BlockId, THREE.MeshStandardMaterial>()
const breakParticleOffset = new THREE.Vector3()
const shardBurstMaterial = new THREE.MeshBasicMaterial({ color: 0xfff3a8, transparent: true, opacity: 0.92 })

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
const previewOutlineGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.025, 1.025, 1.025))
const previewOutlineMaterial = new THREE.LineBasicMaterial({ color: 0xa8ffb9, transparent: true, opacity: 0.95, depthTest: false })
const targetOutlineGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.018, 1.018, 1.018))
const targetOutlineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.88, depthTest: false })
let previewMesh: THREE.Mesh | null = null
let previewOutlineMesh: THREE.LineSegments | null = null
const targetOutlineMesh = new THREE.LineSegments(targetOutlineGeometry, targetOutlineMaterial)
targetOutlineMesh.renderOrder = 12
targetOutlineMesh.visible = false
scene.add(targetOutlineMesh)

const BLOCK_COLOR_MAP = new Map<BlockId, number>(BLOCKS.map((b) => [b.id, b.color]))
function getBreakParticleMaterial(blockId: BlockId) {
  let material = breakParticleMaterials.get(blockId)
  if (!material) {
    material = new THREE.MeshStandardMaterial({ color: BLOCK_COLOR_MAP.get(blockId) ?? 0xffffff, roughness: 0.8 })
    breakParticleMaterials.set(blockId, material)
  }
  return material
}

function createBreakParticles(position: THREE.Vector3, blockId: BlockId) {
  if (cosmeticEffectsReduced && particles.length > 18) return
  const material = getBreakParticleMaterial(blockId)
  const particleCount = cosmeticEffectsReduced ? 3 : 6
  for (let i = 0; i < particleCount; i++) {
    const mesh = new THREE.Mesh(breakParticleGeometry, material)
    breakParticleOffset.set((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4)
    mesh.position.copy(position).add(breakParticleOffset)
    scene.add(mesh)
    particles.push({
      mesh,
      vx: (Math.random() - 0.5) * 5.5,
      vy: 1.5 + Math.random() * 3.5,
      vz: (Math.random() - 0.5) * 5.5,
      life: cosmeticEffectsReduced ? 0.5 : 0.8,
    })
  }
}

function createShardBurst(position: THREE.Vector3) {
  if (cosmeticEffectsReduced && particles.length > 24) return
  const particleCount = cosmeticEffectsReduced ? 8 : 16
  for (let i = 0; i < particleCount; i++) {
    const mesh = new THREE.Mesh(sparkleGeo, shardBurstMaterial)
    breakParticleOffset.set((Math.random() - 0.5) * 0.7, (Math.random() - 0.2) * 0.7, (Math.random() - 0.5) * 0.7)
    mesh.position.copy(position).add(breakParticleOffset)
    mesh.scale.setScalar(1.4 + Math.random() * 1.8)
    scene.add(mesh)
    particles.push({
      mesh,
      vx: (Math.random() - 0.5) * 7,
      vy: 2.8 + Math.random() * 4.5,
      vz: (Math.random() - 0.5) * 7,
      life: cosmeticEffectsReduced ? 0.55 : 0.9,
    })
  }
}

// 简单音效 (Web Audio API)
let audioContext: AudioContext | null = null
function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
  }
  if (audioContext.state === 'suspended') {
    void audioContext.resume().catch(() => undefined)
  }
  return audioContext
}
function playSound(type: 'break' | 'place' | 'jump' | 'select', volume: number) {
  const audioContext = getAudioContext()
  const osc = audioContext.createOscillator()
  const gain = audioContext.createGain()
  osc.connect(gain)
  gain.connect(audioContext.destination)

  gain.gain.setValueAtTime(volume, audioContext.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.08)

  if (type === 'break') {
    osc.frequency.setValueAtTime(220, audioContext.currentTime)
    osc.frequency.exponentialRampToValueAtTime(110, audioContext.currentTime + 0.08)
  } else if (type === 'place') {
    osc.frequency.setValueAtTime(330, audioContext.currentTime)
    osc.frequency.exponentialRampToValueAtTime(220, audioContext.currentTime + 0.08)
  } else if (type === 'jump') {
    osc.frequency.setValueAtTime(440, audioContext.currentTime)
    osc.frequency.exponentialRampToValueAtTime(660, audioContext.currentTime + 0.1)
  } else if (type === 'select') {
    osc.frequency.setValueAtTime(520, audioContext.currentTime)
    osc.frequency.exponentialRampToValueAtTime(650, audioContext.currentTime + 0.06)
  }

  osc.type = 'sine'
  osc.start(audioContext.currentTime)
  osc.stop(audioContext.currentTime + 0.1)
}

function isTerrainChunkInBounds(cx: number, cz: number) {
  return Math.hypot(cx, cz) <= TERRAIN_MAX_RADIUS
}

function hashNoise(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function terrainHeightAt(x: number, z: number) {
  const distance = Math.sqrt(x * x + z * z)
  return Math.max(1, Math.floor(terrainNoise(x, z) + 5.2 - distance * 0.012))
}

function addExplorationMarks(cx: number, cz: number) {
  if (cx === 0 && cz === 0) return
  const roll = hashNoise(cx * 92821 + cz * 68917 + 17)
  if (roll > 0.28) return

  const startX = cx * CHUNK_SIZE
  const startZ = cz * CHUNK_SIZE
  const originX = startX + 2 + Math.floor(hashNoise(cx * 317 + cz * 911 + 3) * 4)
  const originZ = startZ + 2 + Math.floor(hashNoise(cx * 613 + cz * 271 + 5) * 4)
  const originY = terrainHeightAt(originX, originZ) + 1
  if (originY <= 4) return

  const addLandmarkBlock = (x: number, y: number, z: number, id: BlockId) => {
    addBlock(x, y, z, id)
    const key = blockKey(x, y, z)
    if ((id === 'glow' || id === 'crystal') && blockData.get(key) === id && !collectedShardBlocks.has(key)) {
      landmarkShardBlocks.add(key)
    }
  }

  if (roll < 0.11) {
    const offsets: Array<[number, number, number, BlockId]> = [
      [0, 0, 0, 'moss'], [1, 0, 0, 'stone'], [-1, 0, 0, 'moss'], [0, 0, 1, 'stone'],
      [0, 1, 0, 'brick'], [1, 1, 0, 'moss'], [0, 1, 1, 'brick'], [0, 2, 0, 'glow'],
      [-1, 0, 1, 'gravel'], [1, 0, 1, 'gravel'],
    ]
    offsets.forEach(([dx, dy, dz, id]) => addLandmarkBlock(originX + dx, originY + dy, originZ + dz, id))
    return
  }

  if (roll < 0.2) {
    const clusterSize = 4 + Math.floor(hashNoise(cx * 149 + cz * 463 + 29) * 4)
    for (let i = 0; i < clusterSize; i++) {
      const dx = Math.floor(hashNoise(cx * 101 + cz * 103 + i * 37) * 3) - 1
      const dz = Math.floor(hashNoise(cx * 107 + cz * 109 + i * 41) * 3) - 1
      const dy = i > 3 ? 1 : 0
      addLandmarkBlock(originX + dx, originY + dy, originZ + dz, i === 0 ? 'glow' : 'crystal')
    }
    return
  }

  addLandmarkBlock(originX, originY, originZ, 'obsidian')
  addLandmarkBlock(originX, originY + 1, originZ, 'stone')
  addLandmarkBlock(originX, originY + 2, originZ, 'crystal')
  addLandmarkBlock(originX + 1, originY, originZ, 'gravel')
  addLandmarkBlock(originX - 1, originY, originZ, 'gravel')
}

function generateTerrainChunk(cx: number, cz: number) {
  const key = terrainChunkKey(cx, cz)
  if (!isTerrainChunkInBounds(cx, cz)) {
    queuedTerrainChunks.delete(key)
    return false
  }
  if (generatedTerrainChunks.has(key)) return false
  queuedTerrainChunks.delete(key)

  const startX = cx * CHUNK_SIZE
  const startZ = cz * CHUNK_SIZE
  for (let x = startX; x < startX + CHUNK_SIZE; x++) {
    for (let z = startZ; z < startZ + CHUNK_SIZE; z++) {
      const height = terrainHeightAt(x, z)
      for (let y = 0; y <= height; y++) {
        const id: BlockId = y === height ? 'grass' : y > height - 3 ? 'dirt' : 'stone'
        addBlock(x, y, z, id)
      }
      if (height < 3) addBlock(x, 3, z, 'water')
      if (height > 3 && seededNoise(x, height, z, 11) < 0.065) addGrassTuft(x, height, z)
      if (height > 4 && seededNoise(x, height, z, 12) < 0.03) makeTree(x, height + 1, z)
      if (height > 2 && seededNoise(x, height, z, 13) < 0.016) addBlock(x, height + 1, z, seededNoise(x, height, z, 14) > 0.5 ? 'crystal' : 'glow')
    }
  }
  addExplorationMarks(cx, cz)
  generatedTerrainChunks.add(key)
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
  while (generated < limit && terrainGenerationQueue.length > 0) {
    const next = terrainGenerationQueue.shift()!
    if (generateTerrainChunk(next.cx, next.cz)) generated++
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

function generateWorld() {
  lastTerrainEnsureScanKey = ''
  ensureTerrainChunksAround(0, 0, INITIAL_TERRAIN_LOAD_RADIUS)
  processTerrainQueue(terrainGenerationQueue.length)
}

function makeTree(x: number, y: number, z: number) {
  const trunk = 3 + Math.floor(seededNoise(x, y, z, 21) * 2)
  for (let i = 0; i < trunk; i++) addBlock(x, y + i, z, 'wood')
  const top = y + trunk
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = -1; dy <= 1; dy++) {
    if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy) < 4 && seededNoise(x, y, z, dx, dy, dz, 22) > 0.12) addBlock(x + dx, top + dy, z + dz, 'leaves')
  }
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
const exportButton = document.querySelector<HTMLButtonElement>('.export-btn')!
const importButton = document.querySelector<HTMLButtonElement>('.import-btn')!
const resetButton = document.querySelector<HTMLButtonElement>('.reset-btn')!
const importInput = document.querySelector<HTMLInputElement>('.import-input')!
saveButton.addEventListener('click', saveWorld)
loadButton.addEventListener('click', () => {
  if (loadWorld()) updateHotbar()
})
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
    showToast('Tap Reset again to confirm')
    return
  }
  resetConfirmUntil = 0
  resetWorld()
})
if (localStorage.getItem(SAVE_KEY)) loadWorld()

const platform = new THREE.Mesh(
  new THREE.CylinderGeometry(40, 48, 2, 96),
  new THREE.MeshStandardMaterial({ color: 0x55657b, roughness: 0.9 })
)
platform.position.y = -2
platform.receiveShadow = !lowPowerMode
scene.add(platform)

const maxStars = lowPowerMode ? 60 : 260
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
const maxClouds = lowPowerMode ? 6 : 18
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
const maxSparkles = lowPowerMode ? 24 : 120
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
  return inventoryCounts.get(blockId) ?? 0
}

function updateBlockInfo() {
  const block = BLOCKS[selected]
  blockName.textContent = block.name
  blockCount.textContent = String(countBlocksInInventory(block.id))
}

function updateHotbar() {
  for (let i = 0; i < hotbarSlots.length; i++) {
    const count = countBlocksInInventory(BLOCKS[i].id)
    hotbarSlots[i].classList.toggle('active', i === selected)
    hotbarSlots[i].classList.toggle('empty', count <= 0)
    hotbarCounts[i].textContent = String(count)
  }
  hotbarSlots[selected]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  updateBlockInfo()
}

function pulseSelectedSlot() {
  const slot = hotbarSlots[selected]
  if (!slot) return
  slot.classList.remove('selected-pulse')
  void slot.offsetWidth
  slot.classList.add('selected-pulse')
  window.setTimeout(() => slot.classList.remove('selected-pulse'), 180)
}

function selectHotbarSlot(index: number, source: 'pointer' | 'wheel' | 'key' | 'auto' = 'pointer') {
  if (!Number.isInteger(index) || index < 0 || index >= BLOCKS.length) return
  const changed = selected !== index
  selected = index
  updateHotbar()
  if (source !== 'auto') {
    pulseSelectedSlot()
    if (changed || source === 'wheel') playSound('select', source === 'wheel' ? 0.08 : 0.06)
  }
}

function directionLabel(dx: number, dz: number) {
  const angle = Math.atan2(dx, -dz)
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return directions[Math.round((angle / (Math.PI / 4) + 8) % 8)]
}

function findNearestShard() {
  let nearestKey = ''
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
  if (!nearestKey) return null
  getBlockPositionFromKey(nearestKey, hitBlockPosition)
  return {
    key: nearestKey,
    x: hitBlockPosition.x,
    y: hitBlockPosition.y,
    z: hitBlockPosition.z,
    dx: hitBlockPosition.x - pos.x,
    dz: hitBlockPosition.z - pos.z,
    distance: Math.sqrt(nearestDistanceSq),
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
  compassDistance.textContent = `${directionLabel(nearest.dx, nearest.dz)} · ${Math.round(nearest.distance)}m`
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
  hotbar.innerHTML = BLOCKS.map((b, i) => {
    const count = countBlocksInInventory(b.id)
    return `<button class="slot ${i === selected ? 'active' : ''} ${count <= 0 ? 'empty' : ''}" data-slot="${i}" aria-label="Select ${b.name}"><span class="key">${i + 1}</span><span class="swatch" style="background:#${b.color.toString(16).padStart(6, '0')}"></span><span class="count">${count}</span></button>`
  }).join('')
  hotbarSlots.length = 0
  hotbarCounts.length = 0
  hotbar.querySelectorAll<HTMLButtonElement>('.slot').forEach((slot) => {
    hotbarSlots.push(slot)
    hotbarCounts.push(slot.querySelector<HTMLSpanElement>('.count')!)
    slot.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      event.stopPropagation()
      selectHotbarSlot(Number(slot.dataset.slot), 'pointer')
    })
  })
  updateBlockInfo()
}
renderHotbar()

const start = document.querySelector<HTMLDivElement>('.start')!
let mobileActive = false

const helpToggleBtn = document.querySelector<HTMLButtonElement>('.help-toggle-btn')!
const helpPanel = document.querySelector<HTMLDivElement>('.help')!
const tutorialPanel = document.querySelector<HTMLDivElement>('.tutorial')!
const menuToggleBtn = document.querySelector<HTMLButtonElement>('.menu-toggle-btn')!
const pauseMenu = document.querySelector<HTMLDivElement>('.pause-menu')!
const resumeButton = document.querySelector<HTMLButtonElement>('.resume-btn')!
const sensitivityInput = document.querySelector<HTMLInputElement>('.sensitivity-input')!
const sensitivityValue = document.querySelector<HTMLOutputElement>('.sensitivity-value')!
const fovInput = document.querySelector<HTMLInputElement>('.fov-input')!
const fovValue = document.querySelector<HTMLOutputElement>('.fov-value')!
const viewDistanceSelect = document.querySelector<HTMLSelectElement>('.view-distance-select')!
const qualityButtons = [...document.querySelectorAll<HTMLButtonElement>('.quality-btn')]
const perfToggle = document.querySelector<HTMLInputElement>('.perf-toggle')!
type HudDensity = 'roomy' | 'compact' | 'minimal'
let hudLayoutFrame = 0
let hasStarted = false
let isPaused = false

type GameSettings = {
  sensitivity: number
  fov: number
  viewDistance: number
  quality: QualityPreset
  showPerf: boolean
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function readStoredSettings(): GameSettings {
  const fallback: GameSettings = {
    sensitivity: Math.round(mouseLookSpeed * 100),
    fov: camera.fov,
    viewDistance: terrainLoadRadius,
    quality: qualityPreset,
    showPerf: showPerformanceHud,
  }
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<GameSettings>
    const quality = parsed.quality === 'low' || parsed.quality === 'balanced' || parsed.quality === 'high'
      ? parsed.quality
      : fallback.quality
    return {
      sensitivity: clampNumber(Number(parsed.sensitivity) || fallback.sensitivity, 35, 150),
      fov: clampNumber(Number(parsed.fov) || fallback.fov, 60, 90),
      viewDistance: Math.round(clampNumber(Number(parsed.viewDistance) || fallback.viewDistance, 1, 3)),
      quality,
      showPerf: Boolean(parsed.showPerf),
    }
  } catch {
    return fallback
  }
}

function qualityBounds() {
  if (qualityPreset === 'low') return { min: lowPowerMode ? 0.55 : 0.6, max: lowPowerMode ? 0.72 : 0.78, start: lowPowerMode ? 0.62 : 0.7 }
  if (qualityPreset === 'high') return { min: lowPowerMode ? 0.78 : 0.86, max: lowPowerMode ? 0.98 : 1, start: lowPowerMode ? 0.88 : 1 }
  return { min: MIN_RENDER_QUALITY, max: MAX_RENDER_QUALITY, start: lowPowerMode ? 0.85 : 0.94 }
}

function applyQualityPreset(nextPreset: QualityPreset, resetScale = false) {
  qualityPreset = nextPreset
  const bounds = qualityBounds()
  renderQuality = resetScale ? bounds.start : clampNumber(renderQuality, bounds.min, bounds.max)
  renderer.shadowMap.enabled = nextPreset !== 'low' && !lowPowerMode
  applyRenderQuality()
  qualityButtons.forEach((button) => button.classList.toggle('active', button.dataset.quality === nextPreset))
}

function writeStoredSettings() {
  const settings: GameSettings = {
    sensitivity: Number(sensitivityInput.value),
    fov: Number(fovInput.value),
    viewDistance: Number(viewDistanceSelect.value),
    quality: qualityPreset,
    showPerf: showPerformanceHud,
  }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

function setPerformanceHudVisible(visible: boolean) {
  showPerformanceHud = visible
  document.body.classList.toggle('show-perf-hud', visible)
  perfToggle.checked = visible
}

function applySettings(settings: GameSettings, persist = false) {
  const sensitivity = clampNumber(settings.sensitivity, 35, 150)
  mouseLookSpeed = sensitivity / 100
  touchLookSpeed = mouseLookSpeed * 0.0034
  controls.pointerSpeed = mouseLookSpeed
  sensitivityInput.value = String(Math.round(sensitivity))
  sensitivityValue.textContent = `${Math.round(sensitivity)}%`

  const fov = clampNumber(settings.fov, 60, 90)
  camera.fov = fov
  camera.updateProjectionMatrix()
  fovInput.value = String(Math.round(fov))
  fovValue.textContent = String(Math.round(fov))

  terrainLoadRadius = Math.round(clampNumber(settings.viewDistance, 1, 3))
  viewDistanceSelect.value = String(terrainLoadRadius)
  lastTerrainEnsureScanKey = ''
  pendingTerrainEnsure = { x: controls.object.position.x, z: controls.object.position.z }

  applyQualityPreset(settings.quality, persist)
  setPerformanceHudVisible(settings.showPerf)
  if (persist) writeStoredSettings()
}

applySettings(readStoredSettings())

function resetInputState() {
  keys.clear()
  mobileMove.set(0, 0)
  joystickPointerId = null
  lookPointerId = null
  stick.style.transform = 'translate(-50%, -50%)'
  cancelTouchMining()
}

function openPauseMenu() {
  if (!hasStarted) return
  isPaused = true
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
sensitivityInput.addEventListener('input', () => {
  applySettings({
    sensitivity: Number(sensitivityInput.value),
    fov: Number(fovInput.value),
    viewDistance: Number(viewDistanceSelect.value),
    quality: qualityPreset,
    showPerf: showPerformanceHud,
  }, true)
})
fovInput.addEventListener('input', () => {
  applySettings({
    sensitivity: Number(sensitivityInput.value),
    fov: Number(fovInput.value),
    viewDistance: Number(viewDistanceSelect.value),
    quality: qualityPreset,
    showPerf: showPerformanceHud,
  }, true)
})
viewDistanceSelect.addEventListener('change', () => {
  applySettings({
    sensitivity: Number(sensitivityInput.value),
    fov: Number(fovInput.value),
    viewDistance: Number(viewDistanceSelect.value),
    quality: qualityPreset,
    showPerf: showPerformanceHud,
  }, true)
})
qualityButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const nextQuality = button.dataset.quality
    if (nextQuality !== 'low' && nextQuality !== 'balanced' && nextQuality !== 'high') return
    applySettings({
      sensitivity: Number(sensitivityInput.value),
      fov: Number(fovInput.value),
      viewDistance: Number(viewDistanceSelect.value),
      quality: nextQuality,
      showPerf: showPerformanceHud,
    }, true)
  })
})
perfToggle.addEventListener('change', () => {
  applySettings({
    sensitivity: Number(sensitivityInput.value),
    fov: Number(fovInput.value),
    viewDistance: Number(viewDistanceSelect.value),
    quality: qualityPreset,
    showPerf: perfToggle.checked,
  }, true)
})

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
  tutorialPanel.classList.toggle('visible-mobile', isVisible)
  helpToggleBtn.textContent = isVisible ? '×' : '?'
  applyHudLayoutClass()
})

if (isTouchDevice) {
  const tutorial = document.querySelector<HTMLDivElement>('.tutorial')
  if (tutorial) {
    tutorial.innerHTML = `<p><strong>🎮 Tips:</strong> Drag screen to look · Joystick to move · Tap right to place · Long-press to break · Swipe hotbar</p>`
  }
}

function updateOrientationClass() {
  applyHudLayoutClass()
  document.body.classList.toggle('portrait-touch', isTouchDevice && window.innerHeight > window.innerWidth)
  if (isTouchDevice && window.innerHeight > window.innerWidth) {
    keys.clear()
    mobileMove.set(0, 0)
    joystickPointerId = null
    lookPointerId = null
    stick.style.transform = 'translate(-50%, -50%)'
    cancelTouchMining()
  }
}

start.querySelector('button')!.addEventListener('click', () => {
  getAudioContext()
  hasStarted = true
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
  if (isPaused) return
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'Space'].includes(e.code)) e.preventDefault()
  keys.add(e.code)
  const n = Number(e.key)
  if (n >= 1 && n <= BLOCKS.length) selectHotbarSlot(n - 1, 'key')
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
  mobileMove.set(0, 0)
  stick.style.transform = 'translate(-50%, -50%)'
})

type PickHit = {
  key: string
  distance: number
  normal: THREE.Vector3
}
const pickDirection = new THREE.Vector3()
const pickNormal = new THREE.Vector3()
const placeNormal = new THREE.Vector3()
const placePosition = new THREE.Vector3()
const hitBlockPosition = new THREE.Vector3()
const upNormal = new THREE.Vector3(0, 1, 0)

function pickBlock() {
  camera.getWorldDirection(pickDirection).normalize()
  const origin = controls.object.position
  let ix = Math.floor(origin.x + 0.5)
  let iy = Math.floor(origin.y + 0.5)
  let iz = Math.floor(origin.z + 0.5)
  const stepX = pickDirection.x >= 0 ? 1 : -1
  const stepY = pickDirection.y >= 0 ? 1 : -1
  const stepZ = pickDirection.z >= 0 ? 1 : -1
  const tDeltaX = Math.abs(1 / (pickDirection.x || Number.EPSILON))
  const tDeltaY = Math.abs(1 / (pickDirection.y || Number.EPSILON))
  const tDeltaZ = Math.abs(1 / (pickDirection.z || Number.EPSILON))
  let tMaxX = (((stepX > 0 ? ix + 0.5 : ix - 0.5) - origin.x) / (pickDirection.x || Number.EPSILON))
  let tMaxY = (((stepY > 0 ? iy + 0.5 : iy - 0.5) - origin.y) / (pickDirection.y || Number.EPSILON))
  let tMaxZ = (((stepZ > 0 ? iz + 0.5 : iz - 0.5) - origin.z) / (pickDirection.z || Number.EPSILON))
  let traveled = 0
  pickNormal.set(0, 0, 0)

  while (traveled <= RAYCAST_REACH) {
    const key = blockKey(ix, iy, iz)
    if (blocks.has(key) && traveled > 0.05) {
      return { key, distance: traveled, normal: pickNormal.clone() } satisfies PickHit
    }
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      ix += stepX
      traveled = tMaxX
      tMaxX += tDeltaX
      pickNormal.set(-stepX, 0, 0)
    } else if (tMaxY < tMaxZ) {
      iy += stepY
      traveled = tMaxY
      tMaxY += tDeltaY
      pickNormal.set(0, -stepY, 0)
    } else {
      iz += stepZ
      traveled = tMaxZ
      tMaxZ += tDeltaZ
      pickNormal.set(0, 0, -stepZ)
    }
  }
  return undefined
}

function breakTargetBlock() {
  const hit = pickBlock()
  if (!hit || hit.distance > RAYCAST_REACH) return
  const minedKey = hit.key
  const blockId = blockData.get(minedKey)
  if (!blockId) return
  getBlockPositionFromKey(minedKey, hitBlockPosition)
  if (hitBlockPosition.y > 0) {
    const canAbsorbCharge = !playerPlacedBlocks.has(minedKey)
    // 破坏粒子
    createBreakParticles(hitBlockPosition, blockId)
    // 简单音效反馈（可选：用 Web Audio API）
    playSound('break', 0.3)
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
    const collectedShard = collectExplorationShard(minedKey, blockId)
    if (canAbsorbCharge) absorbCrystalPower(blockId, !collectedShard)
    updateHotbar()
  }
}

function placeTargetBlock() {
  const hit = pickBlock()
  if (!hit || hit.distance > RAYCAST_REACH) return
  const hitKey = hit.key
  const selectedBlock = BLOCKS[selected].id
  getBlockPositionFromKey(hitKey, hitBlockPosition)
  const hitBlockId = blockData.get(hitKey)
  const canReplaceWater = hitBlockId === 'water' && selectedBlock !== 'water'

  if (countBlocksInInventory(selectedBlock) <= 0) {
    showToast(`No ${BLOCKS[selected].name}`)
    return
  }

  if (canReplaceWater) {
    if (wouldTrapPlayer(hitBlockPosition)) {
      showToast('Too close to place')
      return
    }
    playSound('place', 0.25)
    removeBlockAtKey(hitKey)
    addBlock(hitBlockPosition.x, hitBlockPosition.y, hitBlockPosition.z, selectedBlock, 'player')
    consumeInventory(selectedBlock)
    selectNextAvailableBlock()
    updateHotbar()
    return
  }

  placeNormal.copy(hit.normal.lengthSq() > 0 ? hit.normal : upNormal)
  placePosition.copy(hitBlockPosition).add(placeNormal).round()
  const key = blockKey(placePosition.x, placePosition.y, placePosition.z)
  if (blocks.has(key)) {
    showToast('Blocked')
    return
  }
  if (wouldTrapPlayer(placePosition)) {
    showToast('Too close to place')
    return
  }
  playSound('place', 0.25)
  addBlock(placePosition.x, placePosition.y, placePosition.z, selectedBlock, 'player')
  consumeInventory(selectedBlock)
  selectNextAvailableBlock()
  updateHotbar()
}

function collectExplorationShard(blockKey: string, blockId: BlockId) {
  if ((blockId !== 'crystal' && blockId !== 'glow') || !landmarkShardBlocks.has(blockKey) || collectedShardBlocks.has(blockKey)) {
    return false
  }

  getBlockPositionFromKey(blockKey, hitBlockPosition)
  createShardBurst(hitBlockPosition)
  compassBadge.classList.add('pulse')
  window.setTimeout(() => compassBadge.classList.remove('pulse'), 650)
  landmarkShardBlocks.delete(blockKey)
  collectedShardBlocks.add(blockKey)
  collectedGlowShards = Math.min(EXPLORATION_GOAL_SHARDS, collectedGlowShards + 1)
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
  return playerOverlapsBlockAt(
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
    breakTargetBlock()
  } else if (e.button === 2) {
    placeTargetBlock()
  } else if (e.button === 1) {
    e.preventDefault()
    const hit = pickBlock()
    if (hit && hit.distance <= RAYCAST_REACH) {
      const hitId = blockData.get(hit.key)
      if (hitId) {
        const idx = BLOCKS.findIndex((b) => b.id === hitId)
        if (idx >= 0) selectHotbarSlot(idx, 'pointer')
      }
    }
  }
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
let touchMining = false
let touchMiningComplete = false
let touchMiningStartedAt = 0
let touchStartedOnRight = false
const TOUCH_TAP_MAX_MOVE = isTouchDevice ? 30 : 24
const TOUCH_MINE_MS = 650

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

function updateJoystick(event: PointerEvent) {
  const rect = joystick.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  const max = rect.width * 0.34
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
  const adjustedMagnitude = (magnitude - TOUCH_JOYSTICK_DEADZONE) / (1 - TOUCH_JOYSTICK_DEADZONE)
  mobileMove.set(rawX / magnitude * adjustedMagnitude, rawY / magnitude * adjustedMagnitude)
}

joystick.addEventListener('pointerdown', (event) => {
  if (joystickPointerId !== null) return
  stopUiTouch(event)
  joystickPointerId = event.pointerId
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
}
joystick.addEventListener('pointerup', releaseJoystick)
joystick.addEventListener('pointercancel', releaseJoystick)

function runJump() {
  if (!canJump) return
  velocityY = JUMP_VELOCITY
  canJump = false
  playSound('jump', 0.2)
}

bindTouchButton(jumpButton, runJump)
bindTouchButton(breakButton, breakTargetBlock)
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

function beginTouchMining() {
  if (!pickBlock()) return
  touchMining = true
  touchMiningComplete = false
  touchMiningStartedAt = performance.now()
  mineRing.style.setProperty('--progress', '0deg')

  if (mineProgressTimeoutId) window.clearTimeout(mineProgressTimeoutId)
  mineProgressTimeoutId = window.setTimeout(() => {
    if (touchMining) {
      mineProgress.querySelector('span')!.textContent = 'Hold to break'
      mineProgress.classList.add('visible')
    }
  }, 120)
}

function cancelTouchMining() {
  touchMining = false
  touchMiningComplete = false
  if (mineProgressTimeoutId) {
    window.clearTimeout(mineProgressTimeoutId)
    mineProgressTimeoutId = null
  }
  mineProgress.classList.remove('visible')
  mineProgress.classList.remove('mining-complete')
  mineProgress.querySelector('span')!.textContent = 'Hold'
  mineRing.style.setProperty('--progress', '0deg')
}

function updateTouchMining() {
  if (!touchMining) return
  const progress = Math.min((performance.now() - touchMiningStartedAt) / TOUCH_MINE_MS, 1)
  mineRing.style.setProperty('--progress', `${Math.round(progress * 360)}deg`)
  if (progress < 1 || touchMiningComplete) return
  touchMiningComplete = true
  mineProgress.classList.add('mining-complete')
  mineProgress.querySelector('span')!.textContent = 'Break'
  breakTargetBlock()
  window.setTimeout(cancelTouchMining, 180)
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
  if (touchStartedOnRight) beginTouchMining()
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
    if (touchMining && !touchMiningComplete) cancelTouchMining()
  }
  const object = controls.object
  const lookDx = Math.abs(dx) < TOUCH_LOOK_DEADZONE ? 0 : dx
  const lookDy = Math.abs(dy) < TOUCH_LOOK_DEADZONE ? 0 : dy
  object.rotation.y -= lookDx * touchLookSpeed
  camera.rotation.x = clampLookPitch(camera.rotation.x - lookDy * touchLookSpeed)
  stabilizeFirstPersonLook()
})
renderer.domElement.addEventListener('pointerup', (event) => {
  if (event.pointerId !== lookPointerId) return
  event.preventDefault()
  const shouldPlace = touchStartedOnRight && !lookMoved && touchMining && !touchMiningComplete
  lookPointerId = null
  if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId)
  if (shouldPlace) placeTargetBlock()
  cancelTouchMining()
})
renderer.domElement.addEventListener('pointercancel', (event) => {
  if (event.pointerId === lookPointerId) {
    event.preventDefault()
    lookPointerId = null
    if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId)
    cancelTouchMining()
  }
})

const clock = new THREE.Clock()
const fpsEl = document.querySelector<HTMLElement>('.perf-fps')
const msEl = document.querySelector<HTMLElement>('.perf-ms')
const blocksEl = document.querySelector<HTMLElement>('.perf-blocks')
const chunksEl = document.querySelector<HTMLElement>('.perf-chunks')
const terrainChunksEl = document.querySelector<HTMLElement>('.perf-terrain-chunks')
const dirtyEl = document.querySelector<HTMLElement>('.perf-dirty')
const crystalBarEl = document.querySelector<HTMLElement>('.charge-bar')
const crystalValEl = document.querySelector<HTMLElement>('.crystal-val')
const threatValEl = document.querySelector<HTMLElement>('.threat-val')
const survivalBadgeEl = document.querySelector<HTMLElement>('.survival-badge')
const coldVignetteEl = document.querySelector<HTMLElement>('.cold-vignette')
const moveDirection = new THREE.Vector3()
const targetMoveVelocity = new THREE.Vector3()
const smoothedMoveVelocity = new THREE.Vector3()
const previousPosition = new THREE.Vector3()
const movementDelta = new THREE.Vector3()
let fpsFrameCount = 0
let fpsElapsed = 0
let currentFps = 0

const FRAME_SAMPLE_COUNT = 30
const frameBudgetSamples = new Float32Array(FRAME_SAMPLE_COUNT)
let frameBudgetIndex = 0
let frameBudgetCount = 0
let frameBudgetTotal = 0
let lastQualityAdjustAt = 0

function updateAdaptiveQuality(avgMs: number, elapsedTime: number) {
  if (elapsedTime - lastQualityAdjustAt < 2.5) return
  const previousQuality = renderQuality
  const bounds = qualityBounds()
  if ((currentFps > 0 && currentFps < 38) || avgMs > 28) {
    renderQuality = Math.max(bounds.min, renderQuality - QUALITY_STEP)
  } else if (currentFps >= 56 && avgMs < 18) {
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
  const carriedLabel = carriedCrystal > 0 ? ` · x${carriedCrystal}` : ''
  const shardWardLabel = shardWardLevel > 0 ? ` · Ward ${shardWardLevel}` : ''
  const protectionLabel = `${carriedLabel}${shardWardLabel}`

  if (coldVignetteEl) {
    coldVignetteEl.style.opacity = String(coldIntensity)
  }

  renderer.toneMappingExposure = 1.08 - coldIntensity * 0.28
  sceneFog.density = 0.015 + (1 - day) * 0.012 + coldIntensity * 0.035

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
  glowLights.forEach((light) => {
    const dx = light.position.x - playerPos.x
    const dy = light.position.y - playerPos.y
    const dz = light.position.z - playerPos.z
    const distSq = dx * dx + dy * dy + dz * dz
    light.visible = distSq <= LIGHT_CULL_DISTANCE_SQ
  })
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

  fpsFrameCount++
  fpsElapsed += dt
  if (fpsElapsed < 0.5) return
  currentFps = Math.round(fpsFrameCount / fpsElapsed)
  fpsFrameCount = 0
  fpsElapsed = 0

  const avgMs = Math.round(frameBudgetTotal / frameBudgetCount)
  updateAdaptiveQuality(avgMs, elapsedTime)
  cosmeticEffectsReduced = currentFps > 0 && (currentFps < 36 || avgMs > 24 || renderQuality <= MIN_RENDER_QUALITY + 0.02)

  if (fpsEl && msEl) {
    fpsEl.textContent = String(currentFps)
    msEl.textContent = `${avgMs} · Q${Math.round(renderQuality * 100)}%`
    fpsEl.style.color = currentFps >= 55 ? '#a8ffb9' : currentFps >= 30 ? '#fff3a8' : '#ffd7fa'
  }
  if (blocksEl) {
    blocksEl.textContent = String(blocks.size)
  }
  if (chunksEl) {
    chunksEl.textContent = String(chunks.size)
  }
  if (terrainChunksEl) {
    terrainChunksEl.textContent = `${generatedTerrainChunks.size}/${Math.round(Math.PI * TERRAIN_MAX_RADIUS * TERRAIN_MAX_RADIUS)}`
  }
  if (dirtyEl) {
    dirtyEl.textContent = `${terrainGenerationQueue.length}/${dirtyChunkKeys.size}`
  }
}

const AUTO_SAVE_INTERVAL = 300 // 5 minutes
let lastAutoSaveAt = 0

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05)
  const elapsedTime = clock.elapsedTime
  if (hasStarted && elapsedTime - lastAutoSaveAt > AUTO_SAVE_INTERVAL) {
    lastAutoSaveAt = elapsedTime
    localStorage.setItem(SAVE_KEY, JSON.stringify(serializeWorld()))
  }
  rebuildDirtyChunkVisibleFaceSummaries(currentFps > 0 && currentFps < 36 ? 4 : 12)
  updateInstancedBounds()
  updateFrameStats(dt, elapsedTime)
  cullPointLights(elapsedTime)
  if (elapsedTime - lastShardSignalAt > 0.35) {
    lastShardSignalAt = elapsedTime
    updateShardSignal()
  }

  // 更新粒子
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.life -= dt
    if (p.life <= 0) {
      scene.remove(p.mesh)
      removeArrayItemAtUnordered(particles, i)
      continue
    }
    p.mesh.position.x += p.vx * dt
    p.mesh.position.y += p.vy * dt
    p.mesh.position.z += p.vz * dt
    p.vy -= 15 * dt
    p.mesh.rotation.x += dt * 2
    p.mesh.rotation.y += dt * 1.5
    p.mesh.scale.setScalar(Math.max(0, p.life / 0.6))
  }

  const aimingActive = hasStarted && !isPaused && (controls.isLocked || mobileActive)
  const hit = aimingActive ? pickBlock() : undefined
  if (hit && hit.distance <= RAYCAST_REACH) {
    getBlockPositionFromKey(hit.key, hitBlockPosition)
    const hitBlockId = blockData.get(hit.key)
    const canReplaceWater = hitBlockId === 'water' && BLOCKS[selected].id !== 'water'
    targetOutlineMesh.position.copy(hitBlockPosition)
    targetOutlineMesh.visible = true
    
    if (canReplaceWater) {
      placePosition.copy(hitBlockPosition)
    } else {
      placeNormal.copy(hit.normal.lengthSq() > 0 ? hit.normal : upNormal)
      placePosition.copy(hitBlockPosition).add(placeNormal).round()
    }
    
    const key = blockKey(placePosition.x, placePosition.y, placePosition.z)
    const hasInventory = countBlocksInInventory(BLOCKS[selected].id) > 0
    const isValidPlacement = hasInventory && (canReplaceWater || !blocks.has(key)) && !wouldTrapPlayer(placePosition)
    
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
  } else {
    targetOutlineMesh.visible = false
    if (previewMesh) {
      previewMesh.visible = false
    }
    if (previewOutlineMesh) {
      previewOutlineMesh.visible = false
    }
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

  const speed = keys.has('ShiftLeft') ? SPRINT_SPEED : WALK_SPEED
  moveDirection.set(0, 0, 0)
  if (keys.has('KeyW')) moveDirection.z -= 1
  if (keys.has('KeyS')) moveDirection.z += 1
  if (keys.has('KeyA')) moveDirection.x -= 1
  if (keys.has('KeyD')) moveDirection.x += 1
  if (mobileActive) {
    moveDirection.x += mobileMove.x
    moveDirection.z += mobileMove.y
  }
  if (moveDirection.lengthSq() > 1) moveDirection.normalize()
  targetMoveVelocity.copy(moveDirection).multiplyScalar(speed)
  const movementResponse = moveDirection.lengthSq() > 0
    ? canJump ? GROUND_ACCEL_RESPONSE : AIR_ACCEL_RESPONSE
    : canJump ? GROUND_STOP_RESPONSE : AIR_STOP_RESPONSE
  smoothedMoveVelocity.lerp(targetMoveVelocity, 1 - Math.exp(-movementResponse * dt))
  if (smoothedMoveVelocity.lengthSq() < 0.0004) smoothedMoveVelocity.set(0, 0, 0)
  if (controls.isLocked || mobileActive) {
    previousPosition.copy(controls.object.position)
    controls.moveRight(smoothedMoveVelocity.x * dt)
    controls.moveForward(-smoothedMoveVelocity.z * dt)
    movementDelta.copy(controls.object.position).sub(previousPosition)
    controls.object.position.copy(previousPosition)
    movePlayerHorizontal(movementDelta)
  } else {
    smoothedMoveVelocity.set(0, 0, 0)
  }

  velocityY -= GRAVITY * dt
  movePlayerVertical(velocityY * dt)
  const pos = controls.object.position
  const terrainCenterKey = terrainChunkKey(chunkCoord(pos.x), chunkCoord(pos.z))
  if (terrainCenterKey !== lastTerrainCenterKey) {
    pendingTerrainEnsure = { x: pos.x, z: pos.z }
    lastTerrainCenterKey = terrainCenterKey
  }
  if (pendingTerrainEnsure && elapsedTime - lastTerrainEnsureAt >= TERRAIN_SCAN_INTERVAL) {
    ensureTerrainChunksAround(pendingTerrainEnsure.x, pendingTerrainEnsure.z)
    pendingTerrainEnsure = null
    lastTerrainEnsureAt = elapsedTime
  }
  const terrainQueueIsUnderPressure = currentFps > 0 && (currentFps < 28 || renderQuality <= MIN_RENDER_QUALITY + 0.02)
  const terrainQueueBudget = terrainQueueIsUnderPressure ? (terrainQueueFrameSkip++ % 4 === 0 ? 1 : 0) : TERRAIN_CHUNKS_PER_FRAME
  if (terrainQueueBudget > 0) processTerrainQueue(terrainQueueBudget)
  const floor = findFloorAt(pos.x, pos.z, pos.y)
  if (pos.y < floor) { pos.y = floor; velocityY = 0; canJump = true }
  else if (pos.y > floor + 0.05) canJump = false
  if (playerCollidesAt(pos)) pos.y = Math.max(pos.y, floor)
  updateTouchMining()
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
  requestAnimationFrame(animate)
}
animate()

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  applyRenderQuality()
})
