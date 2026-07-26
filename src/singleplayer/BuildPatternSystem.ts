export type BuildPatternId = 'single' | 'pillar' | 'wall' | 'platform'

export type BuildPatternDefinition = {
  id: BuildPatternId
  name: string
  blockCount: number
  description: string
}

export type BuildPosition = {
  x: number
  y: number
  z: number
}

export type BuildPlan = {
  pattern: BuildPatternId
  count: number
  positions: BuildPosition[]
}

export const BUILD_PATTERNS: readonly BuildPatternDefinition[] = [
  { id: 'single', name: 'Single', blockCount: 1, description: 'Place one block' },
  { id: 'pillar', name: 'Pillar', blockCount: 3, description: 'Build three blocks upward' },
  { id: 'wall', name: 'Wall', blockCount: 6, description: 'Build a three-by-two wall' },
  { id: 'platform', name: 'Platform', blockCount: 9, description: 'Build a three-by-three floor' },
]

const MAX_PATTERN_BLOCKS = Math.max(...BUILD_PATTERNS.map(({ blockCount }) => blockCount))

export class BuildPatternPlanner {
  private readonly planResult: BuildPlan = {
    pattern: 'single',
    count: 1,
    positions: Array.from({ length: MAX_PATTERN_BLOCKS }, () => ({ x: 0, y: 0, z: 0 })),
  }

  plan(
    pattern: BuildPatternId,
    anchor: Readonly<BuildPosition>,
    facing: Readonly<Pick<BuildPosition, 'x' | 'z'>>,
  ) {
    this.planResult.pattern = pattern
    if (pattern === 'pillar') {
      this.planResult.count = 3
      for (let y = 0; y < 3; y++) this.write(y, anchor.x, anchor.y + y, anchor.z)
      return this.planResult
    }
    if (pattern === 'wall') {
      this.planResult.count = 6
      const alongZ = Math.abs(facing.x) > Math.abs(facing.z)
      let index = 0
      for (let y = 0; y < 2; y++) {
        for (let tangent = -1; tangent <= 1; tangent++) {
          this.write(
            index++,
            anchor.x + (alongZ ? 0 : tangent),
            anchor.y + y,
            anchor.z + (alongZ ? tangent : 0),
          )
        }
      }
      return this.planResult
    }
    if (pattern === 'platform') {
      this.planResult.count = 9
      let index = 0
      for (let x = -1; x <= 1; x++) {
        for (let z = -1; z <= 1; z++) this.write(index++, anchor.x + x, anchor.y, anchor.z + z)
      }
      return this.planResult
    }

    this.planResult.pattern = 'single'
    this.planResult.count = 1
    this.write(0, anchor.x, anchor.y, anchor.z)
    return this.planResult
  }

  private write(index: number, x: number, y: number, z: number) {
    const position = this.planResult.positions[index]
    position.x = Math.round(x)
    position.y = Math.round(y)
    position.z = Math.round(z)
  }
}

export function isBuildPatternId(value: unknown): value is BuildPatternId {
  return BUILD_PATTERNS.some(({ id }) => id === value)
}

export function getBuildPatternDefinition(id: BuildPatternId) {
  return BUILD_PATTERNS.find((pattern) => pattern.id === id) ?? BUILD_PATTERNS[0]
}
