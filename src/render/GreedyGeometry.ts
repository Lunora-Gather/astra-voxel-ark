import * as THREE from 'three'
import type { BlockId } from '../blocks'
import type { GreedyQuad } from './GreedyMesher'
import type { VoxelFaceDirection } from './VoxelMesher'

export type GreedyGeometryGroup = {
  id: BlockId
  /** Box-material slot this group maps to: -1 whole-block, 0 side, 2 top, 3 bottom. */
  materialSlot: number
  geometry: THREE.BufferGeometry
  quadCount: number
  vertexCount: number
  triangleCount: number
}

export function buildGreedyGeometryGroups(
  quads: Iterable<GreedyQuad>,
  multiFaceIds?: ReadonlySet<BlockId>,
) {
  const byMaterial = new Map<string, { id: BlockId; materialSlot: number; quads: GreedyQuad[] }>()

  for (const quad of quads) {
    const materialSlot = multiFaceIds?.has(quad.id) ? faceMaterialSlot(quad.direction) : -1
    const key = materialSlot < 0 ? quad.id : `${quad.id}:${materialSlot}`
    const group = byMaterial.get(key)
    if (group) group.quads.push(quad)
    else byMaterial.set(key, { id: quad.id, materialSlot, quads: [quad] })
  }

  const groups: GreedyGeometryGroup[] = []
  for (const { id, materialSlot, quads: groupQuads } of byMaterial.values()) {
    groups.push({
      id,
      materialSlot,
      geometry: buildGreedyGeometry(groupQuads),
      quadCount: groupQuads.length,
      vertexCount: groupQuads.length * 4,
      triangleCount: groupQuads.length * 2,
    })
  }
  return groups
}

/** Maps a face direction onto the BoxGeometry material order [px, nx, py, ny, pz, nz]. */
function faceMaterialSlot(direction: VoxelFaceDirection) {
  if (direction === 'py') return 2
  if (direction === 'ny') return 3
  return 0
}

export function buildGreedyGeometry(quads: readonly GreedyQuad[] | Iterable<GreedyQuad>) {
  const quadList = Array.isArray(quads) ? (quads as readonly GreedyQuad[]) : [...quads]
  const quadCount = quadList.length
  const vertexCount = quadCount * 4
  const positions = new Float32Array(vertexCount * 3)
  const normals = new Float32Array(vertexCount * 3)
  const uvs = new Float32Array(vertexCount * 2)
  const indices = vertexCount > 65535 ? new Uint32Array(quadCount * 6) : new Uint16Array(quadCount * 6)

  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity

  for (let quadIndex = 0; quadIndex < quadCount; quadIndex += 1) {
    const quad = quadList[quadIndex]
    const { width, height } = quad
    const positionOffset = quadIndex * 12
    const lowX = quad.x - 0.5
    const lowY = quad.y - 0.5
    const lowZ = quad.z - 0.5
    let normalX = 0
    let normalY = 0
    let normalZ = 0

    // Vertex winding per direction matches the previous implementation exactly.
    switch (quad.direction) {
      case 'px': {
        const planeX = quad.x + 0.5
        normalX = 1
        writeQuadPositions(positions, positionOffset,
          planeX, lowY, lowZ,
          planeX, lowY + height, lowZ,
          planeX, lowY + height, lowZ + width,
          planeX, lowY, lowZ + width)
        break
      }
      case 'nx': {
        const planeX = quad.x - 0.5
        normalX = -1
        writeQuadPositions(positions, positionOffset,
          planeX, lowY, lowZ,
          planeX, lowY, lowZ + width,
          planeX, lowY + height, lowZ + width,
          planeX, lowY + height, lowZ)
        break
      }
      case 'py': {
        const planeY = quad.y + 0.5
        normalY = 1
        writeQuadPositions(positions, positionOffset,
          lowX, planeY, lowZ,
          lowX + width, planeY, lowZ,
          lowX + width, planeY, lowZ + height,
          lowX, planeY, lowZ + height)
        break
      }
      case 'ny': {
        const planeY = quad.y - 0.5
        normalY = -1
        writeQuadPositions(positions, positionOffset,
          lowX, planeY, lowZ,
          lowX, planeY, lowZ + height,
          lowX + width, planeY, lowZ + height,
          lowX + width, planeY, lowZ)
        break
      }
      case 'pz': {
        const planeZ = quad.z + 0.5
        normalZ = 1
        writeQuadPositions(positions, positionOffset,
          lowX, lowY, planeZ,
          lowX + width, lowY, planeZ,
          lowX + width, lowY + height, planeZ,
          lowX, lowY + height, planeZ)
        break
      }
      default: {
        const planeZ = quad.z - 0.5
        normalZ = -1
        writeQuadPositions(positions, positionOffset,
          lowX, lowY, planeZ,
          lowX, lowY + height, planeZ,
          lowX + width, lowY + height, planeZ,
          lowX + width, lowY, planeZ)
        break
      }
    }

    for (let vertex = 0; vertex < 4; vertex += 1) {
      const attributeIndex = positionOffset + vertex * 3
      normals[attributeIndex] = normalX
      normals[attributeIndex + 1] = normalY
      normals[attributeIndex + 2] = normalZ
      const vx = positions[attributeIndex]
      const vy = positions[attributeIndex + 1]
      const vz = positions[attributeIndex + 2]
      if (vx < minX) minX = vx
      if (vx > maxX) maxX = vx
      if (vy < minY) minY = vy
      if (vy > maxY) maxY = vy
      if (vz < minZ) minZ = vz
      if (vz > maxZ) maxZ = vz
    }

    // px/nz vertex windings walk height first, so their UVs swap axes to keep textures upright
    // (green grass band on top, brick courses horizontal) on every side face.
    const uvOffset = quadIndex * 8
    if (quad.direction === 'px' || quad.direction === 'nz') {
      uvs[uvOffset] = 0
      uvs[uvOffset + 1] = 0
      uvs[uvOffset + 2] = 0
      uvs[uvOffset + 3] = height
      uvs[uvOffset + 4] = width
      uvs[uvOffset + 5] = height
      uvs[uvOffset + 6] = width
      uvs[uvOffset + 7] = 0
    } else {
      uvs[uvOffset] = 0
      uvs[uvOffset + 1] = 0
      uvs[uvOffset + 2] = width
      uvs[uvOffset + 3] = 0
      uvs[uvOffset + 4] = width
      uvs[uvOffset + 5] = height
      uvs[uvOffset + 6] = 0
      uvs[uvOffset + 7] = height
    }

    const indexOffset = quadIndex * 6
    const baseVertex = quadIndex * 4
    indices[indexOffset] = baseVertex
    indices[indexOffset + 1] = baseVertex + 1
    indices[indexOffset + 2] = baseVertex + 2
    indices[indexOffset + 3] = baseVertex
    indices[indexOffset + 4] = baseVertex + 2
    indices[indexOffset + 5] = baseVertex + 3
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometry.setIndex(new THREE.BufferAttribute(indices, 1))
  applyBounds(geometry, quadCount, minX, minY, minZ, maxX, maxY, maxZ)
  return geometry
}

function writeQuadPositions(
  positions: Float32Array,
  offset: number,
  x0: number, y0: number, z0: number,
  x1: number, y1: number, z1: number,
  x2: number, y2: number, z2: number,
  x3: number, y3: number, z3: number,
) {
  positions[offset] = x0
  positions[offset + 1] = y0
  positions[offset + 2] = z0
  positions[offset + 3] = x1
  positions[offset + 4] = y1
  positions[offset + 5] = z1
  positions[offset + 6] = x2
  positions[offset + 7] = y2
  positions[offset + 8] = z2
  positions[offset + 9] = x3
  positions[offset + 10] = y3
  positions[offset + 11] = z3
}

export function applyBounds(
  geometry: THREE.BufferGeometry,
  vertexGroups: number,
  minX: number, minY: number, minZ: number,
  maxX: number, maxY: number, maxZ: number,
) {
  if (vertexGroups === 0) {
    geometry.boundingBox = new THREE.Box3(new THREE.Vector3(), new THREE.Vector3())
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0)
    return
  }
  const box = new THREE.Box3(new THREE.Vector3(minX, minY, minZ), new THREE.Vector3(maxX, maxY, maxZ))
  geometry.boundingBox = box
  const sphere = new THREE.Sphere()
  box.getBoundingSphere(sphere)
  geometry.boundingSphere = sphere
}
