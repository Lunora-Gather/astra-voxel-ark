import { resolveClientCapabilities } from './RuntimeBootstrap'

export function assertRuntimeBootstrapSmoke() {
  const desktop = resolveClientCapabilities({
    hash: '',
    width: 1440,
    height: 900,
    coarsePointer: false,
    maxTouchPoints: 0,
    userAgent: 'Desktop',
    reducedMotion: false,
  })
  if (desktop.isSmokeTest || desktop.isTouchDevice || desktop.forcedRuntimeTier !== null) {
    throw new Error('Runtime bootstrap smoke failed: desktop capabilities')
  }

  const forcedTouch = resolveClientCapabilities({
    hash: '#smoke&touch=1&device-tier=ultra-low',
    width: 1280,
    height: 720,
    coarsePointer: false,
    maxTouchPoints: 0,
    userAgent: 'Desktop',
    reducedMotion: true,
  })
  if (!forcedTouch.isSmokeTest || !forcedTouch.isTouchDevice || forcedTouch.forcedRuntimeTier !== 'ultra-low') {
    throw new Error('Runtime bootstrap smoke failed: forced smoke capabilities')
  }

  const forcedDesktop = resolveClientCapabilities({
    hash: '#smoke&touch=0',
    width: 720,
    height: 420,
    coarsePointer: true,
    maxTouchPoints: 5,
    userAgent: 'Android',
    reducedMotion: false,
  })
  if (forcedDesktop.isTouchDevice || !forcedDesktop.hasTouchCapability) {
    throw new Error('Runtime bootstrap smoke failed: forced desktop mode')
  }
}
