import { buildLandmarkPlan } from './LandmarkTemplates'
import { buildProceduralChunkPlan, proceduralTerrainHeightAt } from './ProceduralTerrain'
import { ARK_CORE_POSITION, isSpawnAreaProtected, PLAYER_SPAWN } from './SpawnArea'

export function assertLandmarkTemplatesSmoke() {
  const flatHeight = () => 10
  const fixtures = [
    { cx: -1, cz: -1, worldSeed: 0, templateId: 'moss-shrine', origin: '-6,11,-3', blockCount: 10 },
    { cx: -8, cz: -7, worldSeed: 0x12345678, templateId: 'moss-shrine', origin: '-60,11,-54', blockCount: 10 },
    { cx: -8, cz: -5, worldSeed: 0x12345678, templateId: 'crystal-bloom', origin: '-59,11,-36', blockCount: null },
    { cx: -7, cz: 1, worldSeed: 0x12345678, templateId: 'waystone', origin: '-51,11,13', blockCount: 5 },
  ] as const

  for (const fixture of fixtures) {
    const plan = buildLandmarkPlan(fixture.cx, fixture.cz, 8, fixture.worldSeed, flatHeight)
    if (!plan || plan.templateId !== fixture.templateId) {
      throw new Error(`Landmark smoke failed: expected ${fixture.templateId} at ${fixture.cx},${fixture.cz}`)
    }
    const origin = `${plan.origin.x},${plan.origin.y},${plan.origin.z}`
    if (origin !== fixture.origin) {
      throw new Error(`Landmark smoke failed: legacy origin moved from ${fixture.origin} to ${origin}`)
    }
    if (fixture.blockCount !== null && plan.blocks.length !== fixture.blockCount) {
      throw new Error(`Landmark smoke failed: ${fixture.templateId} block layout changed`)
    }
    if (fixture.templateId === 'crystal-bloom' && (plan.blocks.length < 4 || plan.blocks.length > 7)) {
      throw new Error('Landmark smoke failed: crystal bloom size left its legacy range')
    }
    const shardBlockKeys = new Set(plan.blocks
      .filter(({ id }) => id === 'glow' || id === 'crystal')
      .map(({ x, y, z }) => `${x},${y},${z}`))
    if (plan.shardKeys.length === 0 || plan.shardKeys.some((key) => !shardBlockKeys.has(key))) {
      throw new Error(`Landmark smoke failed: ${fixture.templateId} shard metadata is inconsistent`)
    }
    const repeat = buildLandmarkPlan(fixture.cx, fixture.cz, 8, fixture.worldSeed, flatHeight)
    if (JSON.stringify(repeat) !== JSON.stringify(plan)) {
      throw new Error(`Landmark smoke failed: ${fixture.templateId} is not deterministic`)
    }
  }

  for (const worldSeed of [0, 1, 0x12345678, 0xffffffff]) {
    for (let cx = -2; cx <= 2; cx += 1) {
      for (let cz = 0; cz <= 3; cz += 1) {
        const protectedPlan = buildLandmarkPlan(cx, cz, 8, worldSeed, flatHeight)
        if (protectedPlan && isSpawnAreaProtected(protectedPlan.origin.x, protectedPlan.origin.z, 3)) {
          throw new Error('Landmark smoke failed: generated structure entered the Ark spawn corridor')
        }
        const terrainPlan = buildProceduralChunkPlan(cx, cz, 8, worldSeed)
        if (terrainPlan.grassTufts.some(([x, , z]) => isSpawnAreaProtected(x, z))) {
          throw new Error('Landmark smoke failed: flora entered the Ark spawn corridor')
        }
        if (terrainPlan.blocks.some(({ x, y, z, id }) =>
          isSpawnAreaProtected(x, z) &&
          y > proceduralTerrainHeightAt(x, z, worldSeed) &&
          id !== 'water'
        )) {
          throw new Error('Landmark smoke failed: tree or resource decoration entered the Ark spawn corridor')
        }
      }
    }
  }
  if (!isSpawnAreaProtected(PLAYER_SPAWN.x, PLAYER_SPAWN.z) ||
      !isSpawnAreaProtected(ARK_CORE_POSITION.x, ARK_CORE_POSITION.z)) {
    throw new Error('Landmark smoke failed: Ark and player spawn must share a protected corridor')
  }

  let integratedPlan = null
  for (let cx = -3; cx <= 3 && !integratedPlan; cx += 1) {
    for (let cz = -3; cz <= 3 && !integratedPlan; cz += 1) {
      const plan = buildProceduralChunkPlan(cx, cz, 8, 0)
      if (plan.landmark) integratedPlan = plan
    }
  }
  if (!integratedPlan?.landmark) throw new Error('Landmark smoke failed: procedural terrain exposed no landmark metadata')
  const proceduralBlockKeys = new Set(integratedPlan.blocks.map(({ x, y, z }) => `${x},${y},${z}`))
  if (integratedPlan.landmark.shardKeys.some((key) => !proceduralBlockKeys.has(key))) {
    throw new Error('Landmark smoke failed: procedural chunk omitted a landmark shard block')
  }

  return true
}
