import { BuildPatternPlanner, BUILD_PATTERNS, isBuildPatternId } from './BuildPatternSystem'

export function assertBuildPatternSystemSmoke() {
  const planner = new BuildPatternPlanner()
  const anchor = { x: 10, y: 4, z: -3 }
  const single = planner.plan('single', anchor, { x: 0, z: -1 })
  const reused = planner.plan('pillar', anchor, { x: 0, z: -1 })
  if (single !== reused || reused.count !== 3 || reused.positions[2].y !== 6) {
    throw new Error('Build pattern smoke failed: planner should reuse results and build pillars upward')
  }

  const wallNorth = planner.plan('wall', anchor, { x: 0, z: -1 })
  if (wallNorth.count !== 6 || wallNorth.positions[0].x !== 9 || wallNorth.positions[2].x !== 11) {
    throw new Error('Build pattern smoke failed: north-facing walls should span the X axis')
  }
  const wallEast = planner.plan('wall', anchor, { x: 1, z: 0 })
  if (wallEast.positions[0].z !== -4 || wallEast.positions[2].z !== -2) {
    throw new Error('Build pattern smoke failed: east-facing walls should span the Z axis')
  }

  const stairsNorth = planner.plan('stairs', anchor, { x: 0, z: -1 })
  const northPositions = stairsNorth.positions.slice(0, stairsNorth.count)
  if (
    stairsNorth.count !== 6 ||
    northPositions[0].y !== 4 ||
    northPositions[2].y !== 5 ||
    northPositions[4].y !== 6 ||
    northPositions[4].z !== -5
  ) {
    throw new Error('Build pattern smoke failed: north-facing stairs should ascend forward in three steps')
  }
  const stairsEast = planner.plan('stairs', anchor, { x: 1, z: 0 })
  const stairUnique = new Set(stairsEast.positions.slice(0, stairsEast.count).map(({ x, y, z }) => `${x},${y},${z}`))
  if (stairsEast.positions[4].x !== 12 || stairUnique.size !== 6) {
    throw new Error('Build pattern smoke failed: east-facing stairs should rotate and retain six unique blocks')
  }

  const platform = planner.plan('platform', anchor, { x: 0, z: -1 })
  const unique = new Set(platform.positions.slice(0, platform.count).map(({ x, y, z }) => `${x},${y},${z}`))
  if (platform.count !== 9 || unique.size !== 9 || platform.positions.some(({ y }) => y !== anchor.y)) {
    throw new Error('Build pattern smoke failed: platforms should contain nine unique level positions')
  }
  if (BUILD_PATTERNS.length !== 5 || !isBuildPatternId('stairs') || isBuildPatternId('tower')) {
    throw new Error('Build pattern smoke failed: public pattern ids should remain constrained')
  }

  return true
}
