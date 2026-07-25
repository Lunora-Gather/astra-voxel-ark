import * as THREE from 'three'
import type { BlockId } from '../blocks'
import type { GreedyQuad } from './GreedyMesher'

export type GreedyGeometryGroup = {
  id: BlockId
  geometry: THREE.BufferGeometry
  quadCount: number
  vertexCount: number
  triangleCount: number
}

export function buildGreedyGeometryGroups(quads: Iterable<GreedyQuad>) {
  const byBlock = new Map<BlockId, GreedyQuad[]>()

  for (const quad of quads) {
    const group = byBlock.get(quad.id)
    if (group) group.push(quad)
    else byBlock.set(quad.id, [quad])
  }

  return [...byBlock.entries()].map(([id, blockQuads]) => ({
    id,
    geometry: buildGreedyGeometry(blockQuads),
    quadCount: blockQuads.length,
    vertexCount: blockQuads.length * 4,
    triangleCount: blockQuads.length * 2,
  }))
}

export function buildGreedyGeometry(quads: Iterable<GreedyQuad>) {
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  for (const quad of quads) {
    const baseIndex = positions.length / 3
    const { vertices, normal } = getQuadVertices(quad)

    for (const vertex of vertices) {
      positions.push(vertex[0], vertex[1], vertex[2])
      normals.push(normal[0], normal[1], normal[2])
    }

    uvs.push(0, 0, quad.width, 0, quad.width, quad.height, 0, quad.height)
    indices.push(baseIndex, baseIndex + 1, baseIndex + 2, baseIndex, baseIndex + 2, baseIndex + 3)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

type QuadVertices = {
  vertices: [number, number, number][]
  normal: [number, number, number]
}

function getQuadVertices(quad: GreedyQuad): QuadVertices {
  const { x, y, z, width, height } = quad
  const minX = x - 0.5
  const minY = y - 0.5
  const minZ = z - 0.5

  if (quad.direction === 'px') {
    const planeX = x + 0.5
    return {
      normal: [1, 0, 0],
      vertices: [
        [planeX, minY, minZ],
        [planeX, minY + height, minZ],
        [planeX, minY + height, minZ + width],
        [planeX, minY, minZ + width],
      ],
    }
  }

  if (quad.direction === 'nx') {
    const planeX = x - 0.5
    return {
      normal: [-1, 0, 0],
      vertices: [
        [planeX, minY, minZ],
        [planeX, minY, minZ + width],
        [planeX, minY + height, minZ + width],
        [planeX, minY + height, minZ],
      ],
    }
  }

  if (quad.direction === 'py') {
    const planeY = y + 0.5
    return {
      normal: [0, 1, 0],
      vertices: [
        [minX, planeY, minZ],
        [minX + width, planeY, minZ],
        [minX + width, planeY, minZ + height],
        [minX, planeY, minZ + height],
      ],
    }
  }

  if (quad.direction === 'ny') {
    const planeY = y - 0.5
    return {
      normal: [0, -1, 0],
      vertices: [
        [minX, planeY, minZ],
        [minX, planeY, minZ + height],
        [minX + width, planeY, minZ + height],
        [minX + width, planeY, minZ],
      ],
    }
  }

  if (quad.direction === 'pz') {
    const planeZ = z + 0.5
    return {
      normal: [0, 0, 1],
      vertices: [
        [minX, minY, planeZ],
        [minX + width, minY, planeZ],
        [minX + width, minY + height, planeZ],
        [minX, minY + height, planeZ],
      ],
    }
  }

  const planeZ = z - 0.5
  return {
    normal: [0, 0, -1],
    vertices: [
      [minX, minY, planeZ],
      [minX, minY + height, planeZ],
      [minX + width, minY + height, planeZ],
      [minX + width, minY, planeZ],
    ],
  }
}
