import type { BlockId } from '../blocks'
import type { BlockPosition } from '../world/ChunkManager'

export type VoxelFaceDirection = 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz'

export type VisibleVoxelFace = BlockPosition & {
  id: BlockId
  direction: VoxelFaceDirection
}

export type BlockLookup = (x: number, y: number, z: number) => BlockId | null

const FACE_OFFSETS: Record<VoxelFaceDirection, [number, number, number]> = {
  px: [1, 0, 0],
  nx: [-1, 0, 0],
  py: [0, 1, 0],
  ny: [0, -1, 0],
  pz: [0, 0, 1],
  nz: [0, 0, -1],
}

export function collectVisibleFaces(blocks: Iterable<BlockPosition & { id: BlockId }>, lookup: BlockLookup) {
  const faces: VisibleVoxelFace[] = []

  for (const block of blocks) {
    for (const [direction, [dx, dy, dz]] of Object.entries(FACE_OFFSETS) as [VoxelFaceDirection, [number, number, number]][]) {
      if (!lookup(block.x + dx, block.y + dy, block.z + dz)) {
        faces.push({ ...block, direction })
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
