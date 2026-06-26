import { audioSystem } from './AudioSystem'

export type LegacySoundType = 'break' | 'place' | 'jump' | 'select'

export function unlockGameAudio() {
  audioSystem.unlock()
}

export function playGameSound(type: LegacySoundType, volume = 1) {
  const scaledGain = Math.max(0.002, Math.min(0.04, volume * 0.025))

  if (type === 'break') {
    audioSystem.playTone({ frequency: 220, durationSeconds: 0.08, type: 'sine', gain: scaledGain })
    return
  }

  if (type === 'place') {
    audioSystem.playTone({ frequency: 330, durationSeconds: 0.08, type: 'sine', gain: scaledGain })
    return
  }

  if (type === 'jump') {
    audioSystem.playTone({ frequency: 520, durationSeconds: 0.1, type: 'sine', gain: scaledGain })
    return
  }

  audioSystem.playTone({ frequency: 620, durationSeconds: 0.06, type: 'sine', gain: scaledGain })
}

export function playShardCollectSound() {
  audioSystem.playShardCollect()
}
