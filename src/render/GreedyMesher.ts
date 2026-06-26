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

type FaceKey = string

type FacePlane = 'xy' | 'xz' | 'zy'

type ProjectedFace = {
  face: VisibleVoxelFace
  plane: FacePlane
  u: number
  v: number
  depth: number
}

export function buildGreedyQuads(faces: Iterable<VisibleVoxelFace>) {
  const buckets = new Map<string, ProjectedFace[]>()

  for (const face of faces) {
    const projected = projectFace(face)
    const key = `${face.id}|${face.direction}|${projected.plane}|${projected.depth}`
    const bucket = buckets.get(key)
    if (bucket) bucket.push(projected)
    else buckets.set(key, [projected])
  }

  const quads: GreedyQuad[] = []
  for (const bucket of buckets.values()) {
    quads.push(...mergeProjectedFaces(bucket))
  }
  return quads
}

function mergeProjectedFaces(projectedFaces: ProjectedFace[]) {
  const remaining = new Map<FaceKey, ProjectedFace>()
  for (const projected of projectedFaces) {
    remaining.set(faceKey(projected.u, projected.v), projected)
  }

  const quads: GreedyQuad[] = []
  const sorted = [...projectedFaces].sort((a, b) => a.v - b.v || a.u - b.u)

  for (const start of sorted) {
    if (!remaining.has(faceKey(start.u, start.v))) continue

    let width = 1
    while (remaining.has(faceKey(start.u + width, start.v))) {
      width += 1
    }

    let height = 1
    heightLoop:
    while (true) {
      for (let du = 0; du < width; du += 1) {
        if (!remaining.has(faceKey(start.u + du, start.v + height))) {
          break heightLoop
        }
      }
      height += 1
    }

    for (let dv = 0; dv < height; dv += 1) {
      for (let du = 0; du < width; du += 1) {
        remaining.delete(faceKey(start.u + du, start.v + dv))
      }
    }

    quads.push(toQuad(start, width, height))
  }

  return quads
}

function projectFace(face: VisibleVoxelFace): ProjectedFace {
  if (face.direction === 'px' || face.direction === 'nx') {
    return { face, plane: 'zy', u: face.z, v: face.y, depth: face.x }
  }

  if (face.direction === 'py' || face.direction === 'ny') {
    return { face, plane: 'xz', u: face.x, v: face.z, depth: face.y }
  }

  return { face, plane: 'xy', u: face.x, v: face.y, depth: face.z }
}

function toQuad(projected: ProjectedFace, width: number, height: number): GreedyQuad {
  const { face, plane } = projected

  if (plane === 'zy') {
    return { id: face.id, direction: face.direction, x: face.x, y: projected.v, z: projected.u, width, height }
  }

  if (plane === 'xz') {
    return { id: face.id, direction: face.direction, x: projected.u, y: face.y, z: projected.v, width, height }
  }

  return { id: face.id, direction: face.direction, x: projected.u, y: projected.v, z: face.z, width, height }
}

function faceKey(u: number, v: number) {
  return `${u},${v}`
}
