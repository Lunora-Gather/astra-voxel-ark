export type BlockId = 'grass' | 'dirt' | 'stone' | 'wood' | 'leaves' | 'water' | 'crystal' | 'glow' | 'sand' | 'gravel' | 'brick' | 'obsidian' | 'clay' | 'moss' | 'spruce' | 'birch' | 'copper' | 'gold'

export type BlockDef = {
  id: BlockId
  name: string
  color: number
  emissive?: number
  transparent?: boolean
  opacity?: number
  roughness?: number
  metalness?: number
}

export const BLOCKS: BlockDef[] = [
  { id: 'grass', name: 'Grass', color: 0x67b65d, roughness: 0.9 },
  { id: 'dirt', name: 'Dirt', color: 0x9b6a45, roughness: 0.95 },
  { id: 'stone', name: 'Stone', color: 0x8b93a1, roughness: 1 },
  { id: 'wood', name: 'Wood', color: 0xb1763f, roughness: 0.82 },
  { id: 'leaves', name: 'Leaves', color: 0x55b779, transparent: true, opacity: 0.86, roughness: 0.75 },
  { id: 'water', name: 'Water', color: 0x52bfff, transparent: true, opacity: 0.56, roughness: 0.2, metalness: 0.05 },
  { id: 'crystal', name: 'Crystal', color: 0x8d75ff, emissive: 0x34206d, roughness: 0.35, metalness: 0.2 },
  { id: 'glow', name: 'Glow', color: 0xffe6a8, emissive: 0xffb13b, roughness: 0.45 },
  { id: 'sand', name: 'Sand', color: 0xd4b896, roughness: 0.98 },
  { id: 'gravel', name: 'Gravel', color: 0x9d9d9d, roughness: 0.96 },
  { id: 'brick', name: 'Brick', color: 0xd14c3a, roughness: 0.93 },
  { id: 'obsidian', name: 'Obsidian', color: 0x1a1a2e, roughness: 0.4, metalness: 0.15 },
  { id: 'clay', name: 'Clay', color: 0xa88862, roughness: 0.85 },
  { id: 'moss', name: 'Moss Stone', color: 0x6b8e4d, roughness: 0.95 },
  { id: 'spruce', name: 'Spruce', color: 0x6b3a1e, roughness: 0.84 },
  { id: 'birch', name: 'Birch', color: 0xd4a574, roughness: 0.82 },
  { id: 'copper', name: 'Copper', color: 0xb67d40, roughness: 0.65, metalness: 0.8 },
  { id: 'gold', name: 'Gold', color: 0xefd521, roughness: 0.4, metalness: 0.9 },
]
