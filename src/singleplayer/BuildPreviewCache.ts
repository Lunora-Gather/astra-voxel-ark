import type { BlockId } from '../blocks'
import type { BuildPatternId } from './BuildPatternSystem'

export type BuildPreviewFacingAxis = -2 | -1 | 0 | 1 | 2

export type BuildPreviewSignature = {
  hitX: number
  hitY: number
  hitZ: number
  normalX: number
  normalY: number
  normalZ: number
  hitBlock: BlockId
  selectedBlock: BlockId
  pattern: BuildPatternId
  facingAxis: BuildPreviewFacingAxis
  worldVersion: number
  inventoryCount: number
  playerX: number
  playerY: number
  playerZ: number
}

export function createBuildPreviewSignature(): BuildPreviewSignature {
  return {
    hitX: 0,
    hitY: 0,
    hitZ: 0,
    normalX: 0,
    normalY: 0,
    normalZ: 0,
    hitBlock: 'grass',
    selectedBlock: 'grass',
    pattern: 'single',
    facingAxis: 0,
    worldVersion: -1,
    inventoryCount: -1,
    playerX: 0,
    playerY: 0,
    playerZ: 0,
  }
}

export class BuildPreviewCache {
  private readonly previous = createBuildPreviewSignature()
  private valid = false

  shouldRefresh(next: Readonly<BuildPreviewSignature>) {
    const previous = this.previous
    const changed = !this.valid ||
      previous.hitX !== next.hitX ||
      previous.hitY !== next.hitY ||
      previous.hitZ !== next.hitZ ||
      previous.normalX !== next.normalX ||
      previous.normalY !== next.normalY ||
      previous.normalZ !== next.normalZ ||
      previous.hitBlock !== next.hitBlock ||
      previous.selectedBlock !== next.selectedBlock ||
      previous.pattern !== next.pattern ||
      previous.facingAxis !== next.facingAxis ||
      previous.worldVersion !== next.worldVersion ||
      previous.inventoryCount !== next.inventoryCount ||
      previous.playerX !== next.playerX ||
      previous.playerY !== next.playerY ||
      previous.playerZ !== next.playerZ

    if (!changed) return false
    previous.hitX = next.hitX
    previous.hitY = next.hitY
    previous.hitZ = next.hitZ
    previous.normalX = next.normalX
    previous.normalY = next.normalY
    previous.normalZ = next.normalZ
    previous.hitBlock = next.hitBlock
    previous.selectedBlock = next.selectedBlock
    previous.pattern = next.pattern
    previous.facingAxis = next.facingAxis
    previous.worldVersion = next.worldVersion
    previous.inventoryCount = next.inventoryCount
    previous.playerX = next.playerX
    previous.playerY = next.playerY
    previous.playerZ = next.playerZ
    this.valid = true
    return true
  }

  clear() {
    this.valid = false
  }
}
