export function blockKey(x: number, y: number, z: number) {
  return `${x},${y},${z}`
}

export function terrainNoise(x: number, z: number) {
  return Math.sin(x * 0.26) * 1.8 + Math.cos(z * 0.22) * 1.5 + Math.sin((x + z) * 0.12) * 1.25
}
