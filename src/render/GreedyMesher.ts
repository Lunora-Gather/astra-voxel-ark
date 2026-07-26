import type { BlockId } from '../blocks'
import type { VisibleVoxelFace, VoxelFaceDirection } from './VoxelMesher'

export type GreedyQuad = {
  id: BlockId
  direction: VoxelFaceDirection
  x: number
  y: number
  z: number
  width: number
  height: number
}

// Cell keys pack (u, v) into one integer so row/column neighbours are +1 / +COORD_SPAN.
// 17 bits per axis matches the packed block key coordinate range.
const COORD_OFFSET = 131072
const COORD_SPAN = 262144

const DIRECTION_INDEX: Record<VoxelFaceDirection, number> = { px: 0, nx: 1, py: 2, ny: 3, pz: 4, nz: 5 }

export function buildGreedyQuads(faces: Iterable<VisibleVoxelFace>) {
  // Two-level buckets keep keys numeric: outer by block id, inner by direction + slice depth.
  const buckets = new Map<BlockId, Map<number, VisibleVoxelFace[]>>()

  for (const face of faces) {
    let byId = buckets.get(face.id)
    if (!byId) {
      byId = new Map()
      buckets.set(face.id, byId)
    }
    const depth = face.direction === 'px' || face.direction === 'nx'
      ? face.x
      : face.direction === 'py' || face.direction === 'ny'
        ? face.y
        : face.z
    const sliceKey = DIRECTION_INDEX[face.direction] + (depth + COORD_OFFSET) * 8
    const slice = byId.get(sliceKey)
    if (slice) slice.push(face)
    else byId.set(sliceKey, [face])
  }

  const quads: GreedyQuad[] = []
  for (const byId of buckets.values()) {
    for (const slice of byId.values()) {
      mergeSliceFaces(slice, quads)
    }
  }
  return quads
}

function mergeSliceFaces(faces: VisibleVoxelFace[], quads: GreedyQuad[]) {
  // Every face in the slice shares id, direction and depth; only (u, v) vary.
  const cells = new Map<number, VisibleVoxelFace>()
  const cellKeys: number[] = []
  for (const face of faces) {
    const key = cellKey(face)
    if (!cells.has(key)) {
      cells.set(key, face)
      cellKeys.push(key)
    }
  }
  // Ascending numeric order is v-major, u-minor because u occupies the low bits.
  cellKeys.sort(compareNumbers)

  for (const startKey of cellKeys) {
    const start = cells.get(startKey)
    if (!start) continue

    let width = 1
    while (cells.has(startKey + width)) {
      width += 1
    }

    let height = 1
    heightLoop:
    while (true) {
      const rowKey = startKey + height * COORD_SPAN
      for (let du = 0; du < width; du += 1) {
        if (!cells.has(rowKey + du)) {
          break heightLoop
        }
      }
      height += 1
    }

    for (let dv = 0; dv < height; dv += 1) {
      const rowKey = startKey + dv * COORD_SPAN
      for (let du = 0; du < width; du += 1) {
        cells.delete(rowKey + du)
      }
    }

    quads.push({
      id: start.id,
      direction: start.direction,
      x: start.x,
      y: start.y,
      z: start.z,
      width,
      height,
    })
  }
}

function cellKey(face: VisibleVoxelFace) {
  let u: number
  let v: number
  if (face.direction === 'px' || face.direction === 'nx') {
    u = face.z
    v = face.y
  } else if (face.direction === 'py' || face.direction === 'ny') {
    u = face.x
    v = face.z
  } else {
    u = face.x
    v = face.y
  }
  return (v + COORD_OFFSET) * COORD_SPAN + (u + COORD_OFFSET)
}

function compareNumbers(a: number, b: number) {
  return a - b
}
