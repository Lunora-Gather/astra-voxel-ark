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
  group: THREE.Group
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

    const group = new THREE.Group()
    group.name = `chunk-mesh:${key}`
    const meshes: THREE.Mesh[] = []

    if (this.mergedMaterial && geometryGroups.length > 0) {
      const geometry = mergeGeometryGroupsWithVertexColors(geometryGroups, this.blockColors)
      const mesh = new THREE.Mesh(geometry, this.mergedMaterial)
      mesh.name = `chunk-mesh:${key}:merged`
      mesh.castShadow = this.castShadow
      mesh.receiveShadow = this.receiveShadow
      group.add(mesh)
      meshes.push(mesh)
    } else {
    for (const geometryGroup of geometryGroups) {
      const material = this.materials.get(geometryGroup.id)
      if (!material) continue

      const mesh = new THREE.Mesh(geometryGroup.geometry, material)
      mesh.name = `chunk-mesh:${key}:${geometryGroup.id}`
      mesh.castShadow = this.castShadow
      mesh.receiveShadow = this.receiveShadow
      group.add(mesh)
      meshes.push(mesh)
    }
    }

    this.scene.add(group)
    const rendered: RenderedChunkMesh = { key, group, meshes }
    this.renderedChunks.set(key, rendered)
    return rendered
  }

  getChunk(key: string) {
    return this.renderedChunks.get(key) ?? null
  }

  removeChunk(key: string) {
    const rendered = this.renderedChunks.get(key)
    if (!rendered) return false

    this.scene.remove(rendered.group)
    for (const mesh of rendered.meshes) {
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
}

function mergeGeometryGroupsWithVertexColors(
  groups: GreedyGeometryGroup[],
  blockColors: Map<BlockId, THREE.ColorRepresentation>,
) {
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const colors: number[] = []
  const indices: number[] = []
  let vertexOffset = 0

  for (const group of groups) {
    const position = group.geometry.getAttribute('position')
    const normal = group.geometry.getAttribute('normal')
    const uv = group.geometry.getAttribute('uv')
    const index = group.geometry.getIndex()
    const color = new THREE.Color(blockColors.get(group.id) ?? 0xffffff)
    for (let i = 0; i < position.count; i += 1) {
      positions.push(position.getX(i), position.getY(i), position.getZ(i))
      normals.push(normal.getX(i), normal.getY(i), normal.getZ(i))
      uvs.push(uv.getX(i), uv.getY(i))
      colors.push(color.r, color.g, color.b)
    }
    if (index) {
      for (let i = 0; i < index.count; i += 1) indices.push(vertexOffset + index.getX(i))
    }
    vertexOffset += position.count
    group.geometry.dispose()
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}
