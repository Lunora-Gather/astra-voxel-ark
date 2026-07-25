export type ChunkCoordinate = { cx: number; cz: number }

export function selectChunksForEviction(
  loadedKeys: Iterable<string>,
  center: ChunkCoordinate,
  keepRadius: number,
  limit: number,
) {
  const candidates: Array<ChunkCoordinate & { key: string; distance: number }> = []
  for (const key of loadedKeys) {
    const [cx, cz] = key.split(',').map(Number)
    if (!Number.isInteger(cx) || !Number.isInteger(cz)) continue
    const distance = Math.max(Math.abs(cx - center.cx), Math.abs(cz - center.cz))
    if (distance <= keepRadius) continue
    candidates.push({ key, cx, cz, distance })
  }
  candidates.sort((a, b) => b.distance - a.distance)
  return candidates.slice(0, Math.max(0, Math.floor(limit)))
}
