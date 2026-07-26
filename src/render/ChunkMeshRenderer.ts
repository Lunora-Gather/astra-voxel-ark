import * as THREE from 'three'
import type { BlockId } from '../blocks'
import type { GreedyGeometryGroup } from './GreedyGeometry'

export type ChunkMeshRendererOptions = {
  scene: THREE.Object3D
  materials: Map<BlockId, THREE.Material | THREE.Material[]>
  mergedMaterial?: THREE.Material | null
  blockColors?: Map<BlockId, THREE.ColorRepresentation>
  castShadow?: boolean
  receiveShadow?: boolean
}

export type RenderedChunkMesh = {
  key: string
  meshes: THREE.Mesh[]
}

export class ChunkMeshRenderer {
  private readonly scene: THREE.Object3D
  private readonly materials: Map<BlockId, THREE.Material | THREE.Material[]>
  private readonly mergedMaterial: THREE.Material | null
  private readonly blockColors: Map<BlockId, THREE.ColorRepresentation>
  private readonly castShadow: boolean
  private readonly receiveShadow: boolean
  private readonly renderedChunks = new Map<string, RenderedChunkMesh>()

  constructor({
    scene,
    materials,
    mergedMaterial = null,
    blockColors = new Map(),
    castShadow = false,
    receiveShadow = true,
  }: ChunkMeshRendererOptions) {
    this.scene = scene
    this.materials = materials
    this.mergedMaterial = mergedMaterial
    this.blockColors = blockColors
    this.castShadow = castShadow
    this.receiveShadow = receiveShadow
  }

  upsertChunk(key: string, geometryGroups: GreedyGeometryGroup[]) {
    this.removeChunk(key)

    const meshes: THREE.Mesh[] = []

    if (this.mergedMaterial && geometryGroups.length > 0) {
      const geometry = mergeGeometryGroupsWithVertexColors(geometryGroups, this.blockColors)
      const mesh = this.createStaticMesh(geometry, this.mergedMaterial, `chunk-mesh:${key}:merged`)
      meshes.push(mesh)
    } else {
      for (const geometryGroup of geometryGroups) {
        const material = this.resolveGroupMaterial(geometryGroup)
        if (!material) continue
        const mesh = this.createStaticMesh(geometryGroup.geometry, material, `chunk-mesh:${key}:${geometryGroup.id}`)
        meshes.push(mesh)
      }
    }

    const rendered: RenderedChunkMesh = { key, meshes }
    this.renderedChunks.set(key, rendered)
    return rendered
  }

  getChunk(key: string) {
    return this.renderedChunks.get(key) ?? null
  }

  removeChunk(key: string) {
    const rendered = this.renderedChunks.get(key)
    if (!rendered) return false

    for (const mesh of rendered.meshes) {
      this.scene.remove(mesh)
      mesh.geometry.dispose()
    }
    this.renderedChunks.delete(key)
    return true
  }

  clear() {
    for (const key of [...this.renderedChunks.keys()]) {
      this.removeChunk(key)
    }
  }

  dispose() {
    this.clear()
  }

  get size() {
    return this.renderedChunks.size
  }

  private createStaticMesh(geometry: THREE.BufferGeometry, material: THREE.Material, name: string) {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = name
    mesh.castShadow = this.castShadow
    mesh.receiveShadow = this.receiveShadow
    // Chunk geometry lives in world space at the identity transform; skip matrix recomposition.
    mesh.matrixAutoUpdate = false
    this.scene.add(mesh)
    return mesh
  }

  private resolveGroupMaterial(group: GreedyGeometryGroup): THREE.Material | null {
    const material = this.materials.get(group.id)
    if (!material) return null
    if (!Array.isArray(material)) return material
    const slot = group.materialSlot >= 0 ? group.materialSlot : 2
    return material[slot] ?? material[0] ?? null
  }
}

const mergedBaseColor = new THREE.Color()
const mergedFaceColor = new THREE.Color()

function mergeGeometryGroupsWithVertexColors(
  groups: GreedyGeometryGroup[],
  blockColors: Map<BlockId, THREE.ColorRepresentation>,
) {
  let vertexCount = 0
  let indexCount = 0
  for (const group of groups) {
    vertexCount += group.geometry.getAttribute('position').count
    const index = group.geometry.getIndex()
    indexCount += index ? index.count : 0
  }

  const positions = new Float32Array(vertexCount * 3)
  const normals = new Float32Array(vertexCount * 3)
  const uvs = new Float32Array(vertexCount * 2)
  const colors = new Float32Array(vertexCount * 3)
  const indices = vertexCount > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount)

  let vertexOffset = 0
  let indexOffset = 0
  for (const group of groups) {
    const position = group.geometry.getAttribute('position')
    const normal = group.geometry.getAttribute('normal')
    const uv = group.geometry.getAttribute('uv')
    const index = group.geometry.getIndex()
    const groupVertexCount = position.count

    positions.set(position.array as Float32Array, vertexOffset * 3)
    normals.set(normal.array as Float32Array, vertexOffset * 3)
    uvs.set(uv.array as Float32Array, vertexOffset * 2)

    resolveMergedGroupColor(group, blockColors, mergedFaceColor)
    for (let vertex = 0; vertex < groupVertexCount; vertex += 1) {
      const colorIndex = (vertexOffset + vertex) * 3
      colors[colorIndex] = mergedFaceColor.r
      colors[colorIndex + 1] = mergedFaceColor.g
      colors[colorIndex + 2] = mergedFaceColor.b
    }

    if (index) {
      const indexArray = index.array
      for (let i = 0; i < index.count; i += 1) {
        indices[indexOffset + i] = vertexOffset + (indexArray[i] as number)
      }
      indexOffset += index.count
    }
    vertexOffset += groupVertexCount
    group.geometry.dispose()
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.setIndex(new THREE.BufferAttribute(indices, 1))
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

function resolveMergedGroupColor(
  group: GreedyGeometryGroup,
  blockColors: Map<BlockId, THREE.ColorRepresentation>,
  target: THREE.Color,
) {
  target.set(blockColors.get(group.id) ?? 0xffffff)
  if (group.id !== 'grass' || group.materialSlot === 2 || group.materialSlot === -1) return target
  mergedBaseColor.set(blockColors.get('dirt') ?? 0x9b6a45)
  if (group.materialSlot === 3) return target.copy(mergedBaseColor)
  return target.lerp(mergedBaseColor, 0.45)
}
