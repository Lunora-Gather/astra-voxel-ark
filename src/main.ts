import './style.css'
import * as THREE from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import { BLOCKS, type BlockId } from './blocks'
import { animateBlockMaterials, createBlockMaterials } from './textures'
import { blockKey, terrainNoise } from './worldMath'

const app = document.querySelector<HTMLDivElement>('#app')!
const GAME_VERSION_LABEL = 'v1.1 Smooth Playability'
const isTouchDevice = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0
const isSmallScreen = Math.min(window.innerWidth, window.innerHeight) <= 760
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const lowPowerMode = isTouchDevice || isSmallScreen || prefersReducedMotion

app.innerHTML = `
  <div class="hud">
    <div class="title"><span class="eyebrow">VOXEL SANDBOX</span><h1>ASTRAVOXEL ARK</h1><p>${GAME_VERSION_LABEL}</p></div>
    <div class="help"><strong>Controls</strong><br/><span class="desktop-help">WASD move · Space jump<br/>Mouse look · Left break · Right place<br/>1-18 select block · Click to enter<br/>Goal: find 6 landmark shards</span><span class="mobile-help">Left joystick: move · Drag right: look<br/>Tap right side: place · Hold right side: break<br/>Goal: find landmark shards</span></div>
    <div class="world-badge"><span class="badge-pulse"></span>${GAME_VERSION_LABEL}</div>

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
    <button class="help-toggle-btn" aria-label="Toggle Help">?</button>
    <div class="tutorial">
      <p><strong>🎮 Tips:</strong> Click to enter · Find 6 landmark shards · Save often</p>
    </div>
    <div class="save-tools">
      <button class="save-btn">Save</button>
      <button class="load-btn">Load</button>
      <button class="export-btn">Export</button>
      <button class="import-btn">Import</button>
      <button class="reset-btn">Reset</button>
      <input class="import-input" type="file" accept="application/json,.json" />
    </div>
    <div class="toast" aria-live="polite"></div>
    <div class="cold-vignette"></div>
    <div class="mine-progress"><div class="mine-ring"></div><span>Mining</span></div>
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
    <div class="start"><div class="panel"><span class="crest">✦</span><h2>星野方舟 v1.1</h2><p>Smooth Playability - tuned movement, steadier input, adaptive effects</p><button>Start Exploring</button></div></div>
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
const waterBlocks: THREE.Mesh[] = []
const grassTufts: THREE.Group[] = []
const grassTuftsByAnchor = new Map<string, THREE.Group[]>()
const SAVE_KEY = 'astra-voxel-ark-world-v1'
const CHUNK_SIZE = 8
const INITIAL_TERRAIN_LOAD_RADIUS = 1
const TERRAIN_LOAD_RADIUS = 1
const TERRAIN_MAX_RADIUS = 6
const TERRAIN_CHUNKS_PER_FRAME = 1
const TERRAIN_SCAN_INTERVAL = 0.2
const RAYCAST_REACH = 8
const GRASS_ANIMATION_BUDGET = lowPowerMode ? 55 : 140
const MIN_RENDER_QUALITY = lowPowerMode ? 0.68 : 0.78
const MAX_RENDER_QUALITY = lowPowerMode ? 0.95 : 1
const QUALITY_STEP = 0.06
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
type ChunkMetadata = {
  key: string
  x: number
  y: number
  z: number
  buckets: Map<BlockId, ChunkBucket>
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
const outlinedBlockIds = new Set<BlockId>(['wood', 'leaves', 'crystal', 'glow', 'brick', 'obsidian', 'copper', 'gold'])
const enableBlockOutlines = !lowPowerMode
const enableBlockShadows = !lowPowerMode
const MAX_GLOW_LIGHTS = lowPowerMode ? 12 : Number.POSITIVE_INFINITY
let blockMutationVersion = 0
let waterAnimationCursor = 0
let grassAnimationCursor = 0
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

function removeArrayItemAtUnordered<T>(array: T[], index: number) {
  const last = array.pop()
  if (index < array.length && last !== undefined) array[index] = last
}

function removeArrayItemUnordered<T>(array: T[], item: T) {
  const index = array.indexOf(item)
  if (index >= 0) removeArrayItemAtUnordered(array, index)
}

BLOCKS.forEach(({ id }) => {
  if (id === 'water') return
  const instancedMesh = new THREE.InstancedMesh(cubeGeometry, materials.get(id)!, INITIAL_INSTANCED_MESH_CAPACITY)
  instancedMesh.count = 0
  instancedMesh.castShadow = enableBlockShadows && (id === 'wood' || id === 'leaves' || id === 'crystal' || id === 'glow')
  instancedMesh.receiveShadow = enableBlockShadows
  instancedMesh.frustumCulled = false
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

function isSolidBlockId(id: BlockId | undefined): id is Exclude<BlockId, 'water'> {
  return Boolean(id && id !== 'water')
}

function hasExposedSolidFace(x: number, y: number, z: number) {
  return SOLID_NEIGHBOR_OFFSETS.some(([dx, dy, dz]) => !isSolidBlockId(blockData.get(blockKey(x + dx, y + dy, z + dz))))
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

function refreshSolidBlockVisualAt(k: string) {
  const id = blockData.get(k)
  if (!isSolidBlockId(id)) return
  const [x, y, z] = k.split(',').map(Number)
  const visual = blocks.get(k)
  const shouldRender = hasExposedSolidFace(x, y, z)

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

function refreshSolidBlockAndNeighbors(x: number, y: number, z: number) {
  refreshSolidBlockVisualAt(blockKey(x, y, z))
  SOLID_NEIGHBOR_OFFSETS.forEach(([dx, dy, dz]) => refreshSolidBlockVisualAt(blockKey(x + dx, y + dy, z + dz)))
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
  newMesh.frustumCulled = false
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

function getOrCreateChunk(x: number, y: number, z: number) {
  const cx = chunkCoord(x)
  const cy = chunkCoord(y)
  const cz = chunkCoord(z)
  const key = chunkKey(cx, cy, cz)
  let chunk = chunks.get(key)
  if (!chunk) {
    chunk = { key, x: cx, y: cy, z: cz, buckets: new Map() }
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
  markChunkDirty(chunk.key)
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
  markChunkDirty(cKey)
}

function seededNoise(...values: number[]) {
  return hashNoise(values.reduce((seed, value) => seed * 31 + value, 17))
}

function addGrassTuft(x: number, y: number, z: number) {
  const tuft = new THREE.Group()
  tuft.position.set(x + (seededNoise(x, y, z, 1) - 0.5) * 0.35, y + 0.56, z + (seededNoise(x, y, z, 2) - 0.5) * 0.35)
  tuft.userData.seed = seededNoise(x, y, z, 3) * Math.PI * 2
  tuft.userData.anchorKey = blockKey(x, y, z)
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(grassBladeGeometry, grassBladeMaterial)
    blade.rotation.y = (Math.PI / 3) * i + seededNoise(x, y, z, i, 4) * 0.22
    blade.scale.setScalar(0.72 + seededNoise(x, y, z, i, 5) * 0.35)
    tuft.add(blade)
  }
  world.add(tuft)
  grassTufts.push(tuft)
  const anchorKey = tuft.userData.anchorKey as string
  const anchorTufts = grassTuftsByAnchor.get(anchorKey)
  if (anchorTufts) anchorTufts.push(tuft)
  else grassTuftsByAnchor.set(anchorKey, [tuft])
}

function removeGrassTuftsAt(anchorKey: string) {
  const anchorTufts = grassTuftsByAnchor.get(anchorKey)
  if (!anchorTufts) return
  for (let i = anchorTufts.length - 1; i >= 0; i--) {
    const tuft = anchorTufts[i]
    world.remove(tuft)
    removeArrayItemUnordered(grassTufts, tuft)
  }
  grassTuftsByAnchor.delete(anchorKey)
}

function addBlock(x: number, y: number, z: number, id: BlockId, source: BlockSource = 'terrain') {
  const k = blockKey(x, y, z)
  if (source === 'terrain' && removedTerrainBlocks.has(k)) return
  if (blocks.has(k)) return
  if (source === 'player') {
    removedTerrainBlocks.delete(k)
    playerPlacedBlocks.add(k)
  }
  if (id === 'water') {
    const mesh = new THREE.Mesh(cubeGeometry, materials.get(id)!)
    mesh.position.set(x, y, z)
    mesh.castShadow = false
    mesh.receiveShadow = enableBlockShadows
    mesh.userData.block = true
    mesh.userData.id = id
    mesh.userData.baseY = y
    world.add(mesh)
    waterBlocks.push(mesh)
    blocks.set(k, mesh)
  } else {
    blocks.set(k, undefined)
  }
  blockMutationVersion++
  blockData.set(k, id)
  registerBlockInChunk(x, y, z, id, k)
  refreshSolidBlockAndNeighbors(x, y, z)

  const visual = blocks.get(k)

  if (visual instanceof THREE.Mesh && enableBlockOutlines && outlinedBlockIds.has(id)) {
    const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial)
    visual.add(edges)
  }

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
  const id = blockData.get(k) ?? (isInstancedBlockRef(visual) ? visual.id : visual instanceof THREE.Mesh ? visual.userData.id as BlockId | undefined : undefined)
  removeGlowLightAt(k)
  if (visual instanceof THREE.Mesh) {
    removeArrayItemUnordered(waterBlocks, visual)
    world.remove(visual)
  } else if (isInstancedBlockRef(visual)) {
    removeInstancedBlockVisual(k, visual)
  }
  removeGrassTuftsAt(k)
  blocks.delete(k)
  blockMutationVersion++
  blockData.delete(k)
  if (id) unregisterBlockFromChunk(x, y, z, id, k)
  refreshSolidBlockAndNeighbors(x, y, z)
}

function removeBlock(mesh: THREE.Mesh, source: 'player' | 'system' = 'system') {
  const p = mesh.position
  removeBlockAtKey(blockKey(Math.round(p.x), Math.round(p.y), Math.round(p.z)), source)
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
  waterBlocks.length = 0
  glowLightsByBlock.clear()
  chunks.clear()
  grassTuftsByAnchor.clear()
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
const particles: Array<{ mesh: THREE.Mesh; vx: number; vy: number; vz: number; life: number }> = []
const breakParticleGeometry = new THREE.BoxGeometry(0.15, 0.15, 0.15)
const breakParticleMaterials = new Map<BlockId, THREE.MeshStandardMaterial>()
const breakParticleOffset = new THREE.Vector3()

function getBreakParticleMaterial(blockId: BlockId) {
  let material = breakParticleMaterials.get(blockId)
  if (!material) {
    const block = BLOCKS.find(b => b.id === blockId)
    material = new THREE.MeshStandardMaterial({ color: block?.color || 0xffffff, roughness: 0.8 })
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
      life: 0.6,
    })
  }
}

// 简单音效 (Web Audio API)
const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
function playSound(type: 'break' | 'place' | 'jump', volume: number) {
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

function ensureTerrainChunksAround(x: number, z: number, radius = TERRAIN_LOAD_RADIUS) {
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
function showToast(message: string) {
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
resetButton.addEventListener('click', resetWorld)
if (localStorage.getItem(SAVE_KEY)) loadWorld()

const platform = new THREE.Mesh(
  new THREE.CylinderGeometry(40, 48, 2, 96),
  new THREE.MeshStandardMaterial({ color: 0x55657b, roughness: 0.9 })
)
platform.position.y = -2
platform.receiveShadow = !lowPowerMode
scene.add(platform)

const stars = new THREE.Group()
const starGeo = new THREE.SphereGeometry(0.035, 8, 8)
const starMat = new THREE.MeshBasicMaterial({ color: 0xffffff })
for (let i = 0; i < 260; i++) {
  const star = new THREE.Mesh(starGeo, starMat)
  star.position.set((Math.random() - 0.5) * 180, 35 + Math.random() * 80, (Math.random() - 0.5) * 180)
  stars.add(star)
}
scene.add(stars)

const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, roughness: 1 })
const cloudGeo = new THREE.SphereGeometry(1, 16, 8)
const clouds = new THREE.Group()
for (let i = 0; i < 18; i++) {
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
for (let i = 0; i < 120; i++) {
  const sparkle = new THREE.Mesh(sparkleGeo, sparkleMat)
  sparkle.position.set((Math.random() - 0.5) * 62, 5 + Math.random() * 18, (Math.random() - 0.5) * 62)
  sparkle.userData.seed = Math.random() * Math.PI * 2
  sparkles.add(sparkle)
}
scene.add(sparkles)

let selected = 0
const hotbar = document.querySelector<HTMLDivElement>('.hotbar')!
const blockInfo = document.querySelector<HTMLDivElement>('.block-info')!
const blockName = blockInfo.querySelector<HTMLDivElement>('.block-name')!
const blockCount = blockInfo.querySelector<HTMLDivElement>('.block-count')!
const hotbarSlots: HTMLButtonElement[] = []
const hotbarCounts: HTMLSpanElement[] = []

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
    hotbarSlots[i].classList.toggle('active', i === selected)
    hotbarCounts[i].textContent = String(countBlocksInInventory(BLOCKS[i].id))
  }
  updateBlockInfo()
}

function renderHotbar() {
  hotbar.innerHTML = BLOCKS.map((b, i) => {
    const count = countBlocksInInventory(b.id)
    return `<button class="slot ${i === selected ? 'active' : ''}" data-slot="${i}" aria-label="Select ${b.name}"><span class="key">${i + 1}</span><span class="swatch" style="background:#${b.color.toString(16).padStart(6, '0')}"></span><span class="name">${b.name}</span><span class="count">${count}</span></button>`
  }).join('')
  hotbarSlots.length = 0
  hotbarCounts.length = 0
  hotbar.querySelectorAll<HTMLButtonElement>('.slot').forEach((slot) => {
    hotbarSlots.push(slot)
    hotbarCounts.push(slot.querySelector<HTMLSpanElement>('.count')!)
    slot.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      event.stopPropagation()
      selected = Number(slot.dataset.slot)
      updateHotbar()
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

helpToggleBtn.addEventListener('click', (e) => {
  e.preventDefault()
  e.stopPropagation()
  const isVisible = helpPanel.classList.toggle('visible-mobile')
  tutorialPanel.classList.toggle('visible-mobile', isVisible)
  helpToggleBtn.textContent = isVisible ? '×' : '?'
})

if (isTouchDevice) {
  const tutorial = document.querySelector<HTMLDivElement>('.tutorial')
  if (tutorial) {
    tutorial.innerHTML = `<p><strong>🎮 Tips:</strong> Drag screen to look · Joystick to move · Tap right to place · Long-press to break</p>`
  }
}

function updateOrientationClass() {
  document.body.classList.toggle('portrait-touch', isTouchDevice && window.innerHeight > window.innerWidth)
}
updateOrientationClass()
window.addEventListener('resize', updateOrientationClass)
window.addEventListener('orientationchange', updateOrientationClass)

start.querySelector('button')!.addEventListener('click', () => {
  if (isTouchDevice) {
    mobileActive = true
    start.classList.add('hidden')
    return
  }
  controls.lock()
})
controls.addEventListener('lock', () => start.classList.add('hidden'))
controls.addEventListener('unlock', () => {
  if (!mobileActive) start.classList.remove('hidden')
})

document.addEventListener('keydown', (e) => {
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'Space'].includes(e.code)) e.preventDefault()
  keys.add(e.code)
  const n = Number(e.key)
  if (n >= 1 && n <= BLOCKS.length) { selected = n - 1; updateHotbar() }
  if (e.code === 'Space') runJump()
})
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
    showToast(`No ${BLOCKS[selected].name} in inventory`)
    return
  }

  if (canReplaceWater) {
    if (wouldTrapPlayer(hitBlockPosition)) return
    playSound('place', 0.25)
    removeBlockAtKey(hitKey)
    addBlock(hitBlockPosition.x, hitBlockPosition.y, hitBlockPosition.z, selectedBlock, 'player')
    consumeInventory(selectedBlock)
    updateHotbar()
    return
  }

  placeNormal.copy(hit.normal.lengthSq() > 0 ? hit.normal : upNormal)
  placePosition.copy(hitBlockPosition).add(placeNormal).round()
  const key = blockKey(placePosition.x, placePosition.y, placePosition.z)
  if (!blocks.has(key) && !wouldTrapPlayer(placePosition)) {
    playSound('place', 0.25)
    addBlock(placePosition.x, placePosition.y, placePosition.z, selectedBlock, 'player')
    consumeInventory(selectedBlock)
    updateHotbar()
  }
}

function collectExplorationShard(blockKey: string, blockId: BlockId) {
  if ((blockId !== 'crystal' && blockId !== 'glow') || !landmarkShardBlocks.has(blockKey) || collectedShardBlocks.has(blockKey)) {
    return false
  }

  landmarkShardBlocks.delete(blockKey)
  collectedShardBlocks.add(blockKey)
  collectedGlowShards = Math.min(EXPLORATION_GOAL_SHARDS, collectedGlowShards + 1)
  showToast(collectedGlowShards >= EXPLORATION_GOAL_SHARDS
    ? `Exploration goal complete: ${EXPLORATION_GOAL_SHARDS}/${EXPLORATION_GOAL_SHARDS} shards`
    : `Glow shard found: ${collectedGlowShards}/${EXPLORATION_GOAL_SHARDS}`)
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
  if (!controls.isLocked) return
  if (e.button === 0) breakTargetBlock()
  if (e.button === 2) placeTargetBlock()
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
const TOUCH_TAP_MAX_MOVE = 24
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
  touchMining = true
  touchMiningComplete = false
  touchMiningStartedAt = performance.now()
  mineRing.style.setProperty('--progress', '0deg')

  if (mineProgressTimeoutId) window.clearTimeout(mineProgressTimeoutId)
  mineProgressTimeoutId = window.setTimeout(() => {
    if (touchMining) {
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
  mineRing.style.setProperty('--progress', '0deg')
}

function updateTouchMining() {
  if (!touchMining) return
  const progress = Math.min((performance.now() - touchMiningStartedAt) / TOUCH_MINE_MS, 1)
  mineRing.style.setProperty('--progress', `${Math.round(progress * 360)}deg`)
  if (progress < 1 || touchMiningComplete) return
  touchMiningComplete = true
  mineProgress.classList.add('mining-complete')
  breakTargetBlock()
  window.setTimeout(cancelTouchMining, 180)
}

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
  object.rotation.y -= lookDx * 0.003
  camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x - lookDy * 0.003))
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
  if ((currentFps > 0 && currentFps < 38) || avgMs > 28) {
    renderQuality = Math.max(MIN_RENDER_QUALITY, renderQuality - QUALITY_STEP)
  } else if (currentFps >= 56 && avgMs < 18) {
    renderQuality = Math.min(MAX_RENDER_QUALITY, renderQuality + QUALITY_STEP)
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

function updateSurvivalLoop(dt: number, day: number, elapsedTime: number) {
  const deepNight = day < 0.23
  const night = day < 0.38
  const carriedProtection = Math.min(carriedCrystal, 4) * 0.045
  const drainRate = deepNight ? Math.max(0.5, 2.8 - carriedProtection * 20) : night ? 0.55 : -0.22
  crystalPower = Math.max(0, Math.min(100, crystalPower - drainRate * dt))

  const lowPower = crystalPower < 35
  const danger = deepNight && lowPower
  const coldIntensity = danger ? Math.min(1, (35 - crystalPower) / 35) * (1 - day / 0.23) : 0
  const protectionLabel = carriedCrystal > 0 ? ` · x${carriedCrystal}` : ''

  if (coldVignetteEl) {
    coldVignetteEl.style.opacity = String(coldIntensity)
  }

  renderer.toneMappingExposure = 1.08 - coldIntensity * 0.28
  sceneFog.density = 0.015 + (1 - day) * 0.012 + coldIntensity * 0.035

  let phase = 'Day'
  let threat = carriedCrystal > 0 ? 'Protected' : 'Safe'
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
    threat = 'Cold Exposure'
    threatColor = '#8fd8ff'
  } else {
    phase = 'Night'
    threat = carriedCrystal > 0 ? 'Crystal Ward' : 'Keep Power'
    threatColor = carriedCrystal > 0 ? '#d999ff' : '#ffb4d9'
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
    dirtyEl.textContent = String(terrainGenerationQueue.length)
  }
  dirtyChunkKeys.clear()
}

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05)
  const elapsedTime = clock.elapsedTime
  updateFrameStats(dt, elapsedTime)

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

  world.rotation.y = cosmeticEffectsReduced ? 0 : Math.sin(elapsedTime * 0.05) * 0.006
  if (!cosmeticEffectsReduced || Math.floor(elapsedTime * 10) % 2 === 0) animateBlockMaterials(materials, elapsedTime)
  const waterCount = waterBlocks.length
  const waterMinimum = cosmeticEffectsReduced ? Math.min(3, waterCount) : Math.min(8, waterCount)
  const waterUpdates = Math.min(waterCount, adaptiveBudget(waterCount, waterMinimum))
  if (waterAnimationCursor >= waterCount) waterAnimationCursor = 0
  for (let i = 0; i < waterUpdates; i++) {
    const water = waterBlocks[waterAnimationCursor]
    const phase = elapsedTime * 1.8 + waterAnimationCursor * 0.37
    water.position.y = (water.userData.baseY as number) + Math.sin(phase) * 0.035
    water.scale.y = 0.92 + Math.sin(phase * 1.3) * 0.035
    waterAnimationCursor = (waterAnimationCursor + 1) % waterCount
  }
  const grassCount = grassTufts.length
  const grassUpdates = Math.min(grassCount, adaptiveBudget(GRASS_ANIMATION_BUDGET, lowPowerMode ? 24 : 48))
  if (grassAnimationCursor >= grassCount) grassAnimationCursor = 0
  for (let i = 0; i < grassUpdates; i++) {
    const tuft = grassTufts[grassAnimationCursor]
    const seed = tuft.userData.seed as number
    tuft.rotation.z = Math.sin(elapsedTime * 1.35 + seed) * 0.06
    grassAnimationCursor = (grassAnimationCursor + 1) % grassCount
  }
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
