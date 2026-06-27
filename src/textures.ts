import * as THREE from 'three'
import { getBlockDef, type BlockId } from './blocks'

const TEXTURE_SIZE = 96
type BlockMaterial = THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[]
const generatedTextureCache = new Map<string, THREE.CanvasTexture>()

function hashSeed(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function seeded(seed: string) {
  let state = hashSeed(seed)
  return () => {
    state = Math.imul(1664525, state) + 1013904223
    return (state >>> 0) / 4294967296
  }
}

function makeTexture(seed: string, draw: (ctx: CanvasRenderingContext2D, rand: () => number) => void) {
  const cached = generatedTextureCache.get(seed)
  if (cached) return cached

  const canvas = document.createElement('canvas')
  canvas.width = TEXTURE_SIZE
  canvas.height = TEXTURE_SIZE
  const ctx = canvas.getContext('2d')!
  draw(ctx, seeded(seed))
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestMipmapNearestFilter
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.generateMipmaps = true
  generatedTextureCache.set(seed, texture)
  return texture
}

export function clearGeneratedTextureCache() {
  generatedTextureCache.forEach((texture) => texture.dispose())
  generatedTextureCache.clear()
}

export function getGeneratedTextureCacheSize() {
  return generatedTextureCache.size
}

function fill(ctx: CanvasRenderingContext2D, color: string) {
  ctx.fillStyle = color
  ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
}

function addLight(ctx: CanvasRenderingContext2D, strength = 0.2) {
  const gradient = ctx.createLinearGradient(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
  gradient.addColorStop(0, `rgba(255,255,255,${strength})`)
  gradient.addColorStop(0.52, 'rgba(255,255,255,0)')
  gradient.addColorStop(1, `rgba(0,0,0,${strength * 0.8})`)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
}

function pixelNoise(ctx: CanvasRenderingContext2D, rand: () => number, colors: string[], count: number, alpha = 0.38, max = 4) {
  for (let i = 0; i < count; i++) {
    ctx.globalAlpha = alpha * (0.45 + rand())
    ctx.fillStyle = colors[Math.floor(rand() * colors.length)]
    const size = 1 + Math.floor(rand() * max)
    ctx.fillRect(Math.floor(rand() * TEXTURE_SIZE), Math.floor(rand() * TEXTURE_SIZE), size, size)
  }
  ctx.globalAlpha = 1
}

function blockMaterial(blockId: BlockId, map: THREE.Texture, options: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  const block = getBlockDef(blockId)
  return new THREE.MeshStandardMaterial({
    color: block.color,
    map,
    emissive: block.emissive ?? 0x000000,
    emissiveIntensity: block.emissive ? 0.8 : 0,
    transparent: block.transparent ?? false,
    opacity: block.opacity ?? 1,
    roughness: block.roughness ?? 0.85,
    metalness: block.metalness ?? 0,
    ...options,
  })
}

function dirtTexture(seedName = 'dirt') {
  return makeTexture(seedName, (ctx, rand) => {
    fill(ctx, '#8f5e3c')
    pixelNoise(ctx, rand, ['#b57a4f', '#6d432b', '#a46c44', '#c08b61'], 340, 0.42, 5)
    for (let y = 6; y < TEXTURE_SIZE; y += 11 + Math.floor(rand() * 6)) {
      ctx.globalAlpha = 0.12
      ctx.fillStyle = rand() > 0.5 ? '#5c3826' : '#c28a5d'
      ctx.fillRect(0, y, TEXTURE_SIZE, 1)
    }
    ctx.globalAlpha = 1
    addLight(ctx, 0.12)
  })
}

function grassTopTexture() {
  return makeTexture('grass-top', (ctx, rand) => {
    fill(ctx, '#4f9f4c')
    pixelNoise(ctx, rand, ['#78c85f', '#3f863e', '#9add72', '#2f6e36'], 420, 0.42, 4)
    for (let i = 0; i < 85; i++) {
      const x = rand() * TEXTURE_SIZE
      const y = rand() * TEXTURE_SIZE
      ctx.strokeStyle = rand() > 0.25 ? '#8ee36d' : '#2f783c'
      ctx.globalAlpha = 0.35 + rand() * 0.35
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, y + 3)
      ctx.lineTo(x + (rand() - 0.5) * 6, y - 4 - rand() * 5)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
    addLight(ctx, 0.16)
  })
}

function grassSideTexture() {
  return makeTexture('grass-side', (ctx, rand) => {
    fill(ctx, '#90603d')
    pixelNoise(ctx, rand, ['#b57a4f', '#70452c', '#c58d5e'], 240, 0.34, 4)
    const band = 24
    const grass = ctx.createLinearGradient(0, 0, 0, band)
    grass.addColorStop(0, '#72c95e')
    grass.addColorStop(1, '#4c963f')
    ctx.fillStyle = grass
    ctx.fillRect(0, 0, TEXTURE_SIZE, band)
    for (let x = -2; x < TEXTURE_SIZE; x += 4) {
      const drop = 8 + rand() * 18
      ctx.fillStyle = rand() > 0.35 ? '#5eb14d' : '#8cdf6c'
      ctx.beginPath()
      ctx.moveTo(x, band)
      ctx.lineTo(x + 3 + rand() * 4, band)
      ctx.lineTo(x + 1 + rand() * 3, band + drop)
      ctx.closePath()
      ctx.fill()
    }
    addLight(ctx, 0.11)
  })
}

function stoneTexture(seedName: string, base: string, flecks: string[], cracks = true) {
  return makeTexture(seedName, (ctx, rand) => {
    fill(ctx, base)
    pixelNoise(ctx, rand, flecks, 520, 0.36, 5)
    for (let i = 0; i < 22; i++) {
      ctx.globalAlpha = 0.12 + rand() * 0.13
      ctx.strokeStyle = rand() > 0.5 ? '#f2f5f7' : '#3f4650'
      ctx.lineWidth = 1 + Math.floor(rand() * 2)
      ctx.beginPath()
      let x = rand() * TEXTURE_SIZE
      let y = rand() * TEXTURE_SIZE
      ctx.moveTo(x, y)
      for (let j = 0; j < 4; j++) {
        x += (rand() - 0.5) * 22
        y += (rand() - 0.5) * 22
        ctx.lineTo(x, y)
      }
      if (cracks) ctx.stroke()
    }
    ctx.globalAlpha = 1
    addLight(ctx, 0.1)
  })
}

function gravelTexture() {
  return makeTexture('gravel', (ctx, rand) => {
    fill(ctx, '#969696')
    for (let i = 0; i < 105; i++) {
      const shade = ['#707070', '#858585', '#b8b8b8', '#d0d0d0'][Math.floor(rand() * 4)]
      ctx.fillStyle = shade
      ctx.globalAlpha = 0.55 + rand() * 0.35
      ctx.beginPath()
      ctx.ellipse(rand() * TEXTURE_SIZE, rand() * TEXTURE_SIZE, 2 + rand() * 6, 2 + rand() * 5, rand() * Math.PI, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    addLight(ctx, 0.12)
  })
}

function woodTopTexture(seedName: string, core: string, ring: string, dark: string) {
  return makeTexture(`${seedName}-top`, (ctx, rand) => {
    fill(ctx, core)
    const cx = TEXTURE_SIZE / 2 + (rand() - 0.5) * 8
    const cy = TEXTURE_SIZE / 2 + (rand() - 0.5) * 8
    for (let r = 8; r < 68; r += 5 + rand() * 4) {
      ctx.strokeStyle = rand() > 0.35 ? ring : dark
      ctx.globalAlpha = 0.5 + rand() * 0.3
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.ellipse(cx, cy, r * (0.85 + rand() * 0.24), r * (0.78 + rand() * 0.25), rand() * 0.2, 0, Math.PI * 2)
      ctx.stroke()
    }
    pixelNoise(ctx, rand, [ring, dark, '#fff0c8'], 120, 0.17, 3)
    ctx.globalAlpha = 1
    addLight(ctx, 0.15)
  })
}

function woodSideTexture(seedName: string, base: string, light: string, dark: string) {
  return makeTexture(`${seedName}-side`, (ctx, rand) => {
    fill(ctx, base)
    for (let x = -4; x < TEXTURE_SIZE; x += 5 + Math.floor(rand() * 4)) {
      const width = 2 + rand() * 4
      const gradient = ctx.createLinearGradient(x, 0, x + width, 0)
      gradient.addColorStop(0, dark)
      gradient.addColorStop(0.5, light)
      gradient.addColorStop(1, dark)
      ctx.globalAlpha = 0.26 + rand() * 0.26
      ctx.fillStyle = gradient
      ctx.fillRect(x, 0, width, TEXTURE_SIZE)
    }
    for (let i = 0; i < 7; i++) {
      ctx.globalAlpha = 0.35
      ctx.fillStyle = dark
      ctx.beginPath()
      ctx.ellipse(rand() * TEXTURE_SIZE, 12 + rand() * 70, 3 + rand() * 7, 8 + rand() * 12, rand() * 0.4, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 0.28
      ctx.strokeStyle = light
      ctx.stroke()
    }
    ctx.globalAlpha = 1
    addLight(ctx, 0.12)
  })
}

function leavesTexture() {
  return makeTexture('leaves', (ctx, rand) => {
    fill(ctx, '#44a663')
    pixelNoise(ctx, rand, ['#7edb91', '#2f7c4b', '#5ecf79', '#1d633d'], 430, 0.38, 5)
    for (let i = 0; i < 50; i++) {
      ctx.strokeStyle = rand() > 0.45 ? '#9bf1a6' : '#276d45'
      ctx.globalAlpha = 0.25
      ctx.beginPath()
      const x = rand() * TEXTURE_SIZE
      const y = rand() * TEXTURE_SIZE
      ctx.moveTo(x - 5, y)
      ctx.quadraticCurveTo(x, y - 6, x + 6, y)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
    addLight(ctx, 0.12)
  })
}

function waterTexture() {
  return makeTexture('water', (ctx, rand) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, TEXTURE_SIZE)
    gradient.addColorStop(0, '#8eeaff')
    gradient.addColorStop(0.45, '#3ab7ef')
    gradient.addColorStop(1, '#1e75c4')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
    for (let y = -12; y < TEXTURE_SIZE + 12; y += 12) {
      ctx.strokeStyle = rand() > 0.35 ? '#d3fbff' : '#1b8dda'
      ctx.globalAlpha = 0.28
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let x = -8; x <= TEXTURE_SIZE + 8; x += 8) {
        const waveY = y + Math.sin(x * 0.18 + rand() * 2) * 4
        x === -8 ? ctx.moveTo(x, waveY) : ctx.lineTo(x, waveY)
      }
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  })
}

function crystalTexture() {
  return makeTexture('crystal', (ctx, rand) => {
    fill(ctx, '#8068ff')
    const facets = ['#d9d0ff', '#a891ff', '#583fc5', '#ffffff']
    for (let i = 0; i < 34; i++) {
      ctx.globalAlpha = 0.2 + rand() * 0.42
      ctx.fillStyle = facets[Math.floor(rand() * facets.length)]
      const x = rand() * TEXTURE_SIZE
      const y = rand() * TEXTURE_SIZE
      ctx.beginPath()
      ctx.moveTo(x, y - 18)
      ctx.lineTo(x + 14 + rand() * 8, y)
      ctx.lineTo(x, y + 18)
      ctx.lineTo(x - 10 - rand() * 8, y)
      ctx.closePath()
      ctx.fill()
    }
    ctx.globalAlpha = 0.55
    ctx.strokeStyle = '#f2ecff'
    ctx.lineWidth = 2
    for (let i = 0; i < 8; i++) {
      ctx.beginPath()
      ctx.moveTo(rand() * TEXTURE_SIZE, 0)
      ctx.lineTo(rand() * TEXTURE_SIZE, TEXTURE_SIZE)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
    addLight(ctx, 0.24)
  })
}

function glowTexture() {
  return makeTexture('glow', (ctx, rand) => {
    fill(ctx, '#ffcf65')
    const glow = ctx.createRadialGradient(48, 48, 4, 48, 48, 68)
    glow.addColorStop(0, '#fff8d4')
    glow.addColorStop(0.55, '#ffc35d')
    glow.addColorStop(1, '#d96e24')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
    for (let i = 0; i < 18; i++) {
      ctx.globalAlpha = 0.26 + rand() * 0.34
      ctx.strokeStyle = rand() > 0.5 ? '#fff7bf' : '#ff8c28'
      ctx.lineWidth = 1 + Math.floor(rand() * 3)
      ctx.beginPath()
      ctx.moveTo(rand() * TEXTURE_SIZE, rand() * TEXTURE_SIZE)
      ctx.lineTo(rand() * TEXTURE_SIZE, rand() * TEXTURE_SIZE)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  })
}

function metalTexture(seedName: string, base: string, light: string, dark: string) {
  return makeTexture(seedName, (ctx, rand) => {
    fill(ctx, base)
    pixelNoise(ctx, rand, [light, dark, base], 280, 0.24, 4)
    for (let i = 0; i < 16; i++) {
      ctx.globalAlpha = 0.22 + rand() * 0.28
      ctx.fillStyle = rand() > 0.45 ? light : dark
      ctx.beginPath()
      ctx.ellipse(rand() * TEXTURE_SIZE, rand() * TEXTURE_SIZE, 6 + rand() * 18, 1.5 + rand() * 5, -0.65 + rand() * 0.35, 0, Math.PI * 2)
      ctx.fill()
    }
    addLight(ctx, 0.24)
  })
}

function brickTexture() {
  return makeTexture('brick', (ctx, rand) => {
    fill(ctx, '#7d3329')
    const brickH = 20
    for (let y = 0; y < TEXTURE_SIZE; y += brickH) {
      const offset = (Math.floor(y / brickH) % 2) * 24
      for (let x = -offset; x < TEXTURE_SIZE; x += 48) {
        ctx.fillStyle = rand() > 0.5 ? '#bd563b' : '#d06642'
        ctx.fillRect(x + 2, y + 2, 44, brickH - 4)
        pixelNoise(ctx, rand, ['#e18a5b', '#833927'], 12, 0.24, 3)
      }
    }
    ctx.strokeStyle = '#4d2b28'
    ctx.lineWidth = 3
    for (let y = 0; y <= TEXTURE_SIZE; y += brickH) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(TEXTURE_SIZE, y)
      ctx.stroke()
    }
    addLight(ctx, 0.1)
  })
}

function simpleTexture(seedName: string, base: string, flecks: string[], count = 300) {
  return makeTexture(seedName, (ctx, rand) => {
    fill(ctx, base)
    pixelNoise(ctx, rand, flecks, count, 0.35, 4)
    addLight(ctx, 0.12)
  })
}

export function createBlockMaterials() {
  const dirt = dirtTexture()
  const materials = new Map<BlockId, BlockMaterial>()

  materials.set('grass', [
    blockMaterial('grass', grassSideTexture()),
    blockMaterial('grass', grassSideTexture()),
    blockMaterial('grass', grassTopTexture()),
    blockMaterial('grass', dirt),
    blockMaterial('grass', grassSideTexture()),
    blockMaterial('grass', grassSideTexture()),
  ])
  materials.set('dirt', blockMaterial('dirt', dirt))
  materials.set('stone', blockMaterial('stone', stoneTexture('stone', '#858d98', ['#b9c0c9', '#59616d', '#9da6b2', '#707985'])))
  materials.set('wood', [
    blockMaterial('wood', woodSideTexture('oak', '#a86b35', '#d8954f', '#603719')),
    blockMaterial('wood', woodSideTexture('oak', '#a86b35', '#d8954f', '#603719')),
    blockMaterial('wood', woodTopTexture('oak', '#c18448', '#e1a866', '#74451f')),
    blockMaterial('wood', woodTopTexture('oak', '#c18448', '#e1a866', '#74451f')),
    blockMaterial('wood', woodSideTexture('oak', '#a86b35', '#d8954f', '#603719')),
    blockMaterial('wood', woodSideTexture('oak', '#a86b35', '#d8954f', '#603719')),
  ])
  materials.set('leaves', blockMaterial('leaves', leavesTexture(), { alphaTest: 0.08 }))
  materials.set('water', blockMaterial('water', waterTexture(), {
    depthWrite: false,
    emissive: 0x10395e,
    emissiveIntensity: 0.08,
    opacity: 0.62,
    roughness: 0.06,
    metalness: 0.02,
  }))
  materials.set('crystal', blockMaterial('crystal', crystalTexture(), {
    emissive: 0x5e45c8,
    emissiveIntensity: 0.62,
    opacity: 0.88,
    transparent: true,
    roughness: 0.18,
    metalness: 0.14,
  }))
  materials.set('glow', blockMaterial('glow', glowTexture(), {
    emissive: 0xffb13b,
    emissiveIntensity: 1.35,
    roughness: 0.28,
  }))
  materials.set('sand', blockMaterial('sand', simpleTexture('sand', '#d9bf81', ['#f4dfad', '#bfa36d', '#fff1c8'], 360)))
  materials.set('gravel', blockMaterial('gravel', gravelTexture()))
  materials.set('brick', blockMaterial('brick', brickTexture()))
  materials.set('obsidian', blockMaterial('obsidian', stoneTexture('obsidian', '#151528', ['#322d4f', '#0a0a15', '#5c507d'], false), {
    roughness: 0.28,
    metalness: 0.18,
  }))
  materials.set('clay', blockMaterial('clay', simpleTexture('clay', '#a88862', ['#c5ad84', '#876a4b', '#b7966d'], 300)))
  materials.set('moss', blockMaterial('moss', stoneTexture('moss', '#64745a', ['#82a965', '#43503f', '#a1c178', '#6c8460'])))
  materials.set('spruce', [
    blockMaterial('spruce', woodSideTexture('spruce', '#5a351d', '#8a5b36', '#2f1b12')),
    blockMaterial('spruce', woodSideTexture('spruce', '#5a351d', '#8a5b36', '#2f1b12')),
    blockMaterial('spruce', woodTopTexture('spruce', '#765032', '#a0704b', '#372014')),
    blockMaterial('spruce', woodTopTexture('spruce', '#765032', '#a0704b', '#372014')),
    blockMaterial('spruce', woodSideTexture('spruce', '#5a351d', '#8a5b36', '#2f1b12')),
    blockMaterial('spruce', woodSideTexture('spruce', '#5a351d', '#8a5b36', '#2f1b12')),
  ])
  materials.set('birch', [
    blockMaterial('birch', woodSideTexture('birch', '#e7d4ad', '#fff1cf', '#6d5b45')),
    blockMaterial('birch', woodSideTexture('birch', '#e7d4ad', '#fff1cf', '#6d5b45')),
    blockMaterial('birch', woodTopTexture('birch', '#e2c795', '#f4dfad', '#8a704c')),
    blockMaterial('birch', woodTopTexture('birch', '#e2c795', '#f4dfad', '#8a704c')),
    blockMaterial('birch', woodSideTexture('birch', '#e7d4ad', '#fff1cf', '#6d5b45')),
    blockMaterial('birch', woodSideTexture('birch', '#e7d4ad', '#fff1cf', '#6d5b45')),
  ])
  materials.set('copper', blockMaterial('copper', metalTexture('copper', '#a85c40', '#e59a67', '#5e2d22'), {
    roughness: 0.48,
    metalness: 0.86,
  }))
  materials.set('gold', blockMaterial('gold', metalTexture('gold', '#c99b2f', '#ffe27b', '#8a6119'), {
    roughness: 0.34,
    metalness: 0.95,
  }))

  return materials
}

export function animateBlockMaterials(materials: Map<BlockId, BlockMaterial>, elapsedTime: number) {
  const water = materials.get('water')
  const waterMaterial = Array.isArray(water) ? water[0] : water
  if (!waterMaterial?.map) return
  waterMaterial.map.offset.x = (elapsedTime * 0.018) % 1
  waterMaterial.map.offset.y = (Math.sin(elapsedTime * 0.28) * 0.015 + elapsedTime * 0.012) % 1
}
