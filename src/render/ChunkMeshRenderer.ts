import * as THREE from 'three'
import type { BlockId } from '../blocks'
import type { GreedyGeometryGroup } from './GreedyGeometry'

export type ChunkMeshRendererOptions = {
  scene: THREE.Scene
  materials: Map<BlockId, THREE.Material | THREE.Material[]>
  castShadow?: boolean
  receiveShadow?: boolean
}

export type RenderedChunkMesh = {
  key: string
  group: THREE.Group
  meshes: THREE.Mesh[]
}

export class ChunkMeshRenderer {
  private readonly scene: THREE.Scene
  private readonly materials: Map<BlockId, THREE.Material | THREE.Material[]>
  private readonly castShadow: boolean
  private readonly receiveShadow: boolean
  private readonly renderedChunks = new Map<string, RenderedChunkMesh>()

  constructor({ scene, materials, castShadow = false, receiveShadow = true }: ChunkMeshRendererOptions) {
    this.scene = scene
    this.materials = materials
    this.castShadow = castShadow
    this.receiveShadow = receiveShadow
  }

  upsertChunk(key: string, geometryGroups: GreedyGeometryGroup[]) {
    this.removeChunk(key)

    const group = new THREE.Group()
    group.name = `chunk-mesh:${key}`
    const meshes: THREE.Mesh[] = []

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
