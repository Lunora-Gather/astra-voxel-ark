import { audioSystem } from './AudioSystem'

export type LegacySoundType = 'break' | 'place' | 'jump' | 'select'

export function unlockGameAudio() {
  audioSystem.unlock()
}

export function playGameSound(type: LegacySoundType, volume = 1) {
  const scaledGain = Math.max(0.002, Math.min(0.09, volume * 0.24))

  if (type === 'break') {
    audioSystem.playTone({ frequency: 220, endFrequency: 110, durationSeconds: 0.08, type: 'sine', gain: scaledGain })
    return
  }

  if (type === 'place') {
    audioSystem.playTone({ frequency: 330, endFrequency: 220, durationSeconds: 0.08, type: 'sine', gain: scaledGain })
    return
  }

  if (type === 'jump') {
    audioSystem.playTone({ frequency: 440, endFrequency: 660, durationSeconds: 0.1, type: 'sine', gain: scaledGain })
    return
  }

  audioSystem.playTone({ frequency: 520, endFrequency: 650, durationSeconds: 0.06, type: 'sine', gain: scaledGain })
}

export function playShardCollectSound() {
  audioSystem.playShardCollect()
}
