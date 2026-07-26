export function toWorldBlockCoordinate(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : 0
}

export function formatWorldCoordinates(x: unknown, y: unknown, z: unknown) {
  return `X ${toWorldBlockCoordinate(x)} · Y ${toWorldBlockCoordinate(y)} · Z ${toWorldBlockCoordinate(z)}`
}

export function formatWorldCoordinatesForClipboard(x: unknown, y: unknown, z: unknown) {
  return `${toWorldBlockCoordinate(x)}, ${toWorldBlockCoordinate(y)}, ${toWorldBlockCoordinate(z)}`
}
