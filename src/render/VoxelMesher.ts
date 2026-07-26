import type { BlockId } from '../blocks'
import type { BlockPosition } from '../world/ChunkManager'

export type VoxelFaceDirection = 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz'

export type VisibleVoxelFace = BlockPosition & {
  id: BlockId
  direction: VoxelFaceDirection
}

export type BlockLookup = (x: number, y: number, z: number) => BlockId | null

export const FACE_DIRECTIONS: readonly VoxelFaceDirection[] = ['px', 'nx', 'py', 'ny', 'pz', 'nz']
const FACE_DX = [1, -1, 0, 0, 0, 0] as const
const FACE_DY = [0, 0, 1, -1, 0, 0] as const
const FACE_DZ = [0, 0, 0, 0, 1, -1] as const

export function collectVisibleFaces(blocks: Iterable<BlockPosition & { id: BlockId }>, lookup: BlockLookup) {
  const faces: VisibleVoxelFace[] = []

  for (const block of blocks) {
    const { x, y, z, id } = block
    for (let face = 0; face < 6; face += 1) {
      if (!lookup(x + FACE_DX[face], y + FACE_DY[face], z + FACE_DZ[face])) {
        faces.push({ x, y, z, id, direction: FACE_DIRECTIONS[face] })
      }
    }
  }

  return faces
}

export function groupFacesByBlockId(faces: Iterable<VisibleVoxelFace>) {
  const groups = new Map<BlockId, VisibleVoxelFace[]>()
  for (const face of faces) {
    const group = groups.get(face.id)
    if (group) {
      group.push(face)
    } else {
      groups.set(face.id, [face])
    }
  }
  return groups
}
