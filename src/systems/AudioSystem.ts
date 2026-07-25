export type ToneOptions = {
  frequency: number
  endFrequency?: number
  durationSeconds?: number
  type?: OscillatorType
  gain?: number
}

type BrowserWindowWithWebkitAudio = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext
}

export class AudioSystem {
  private context: AudioContext | null = null
  private masterGain: GainNode | null = null
  private enabled = true
  private masterVolume = 0.7

  setEnabled(enabled: boolean) {
    this.enabled = enabled
    this.syncMasterGain()
  }

  setMasterVolume(volume: number) {
    this.masterVolume = clamp01(volume)
    this.syncMasterGain()
  }

  unlock() {
    if (!this.enabled || this.masterVolume <= 0) return
    const context = this.getContext()
    if (!context) return
    if (context.state === 'suspended') {
      void context.resume().catch(() => undefined)
    }
  }

  playTone({ frequency, endFrequency, durationSeconds = 0.08, type = 'square', gain = 0.035 }: ToneOptions) {
    if (!this.enabled || this.masterVolume <= 0) return false

    const context = this.getContext()
    if (!context) return false
    const oscillator = context.createOscillator()
    const envelope = context.createGain()
    const now = context.currentTime
    const duration = Math.max(0.02, durationSeconds)

    oscillator.type = type
    oscillator.frequency.setValueAtTime(Math.max(1, frequency), now)
    if (typeof endFrequency === 'number' && Number.isFinite(endFrequency)) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + duration)
    }
    envelope.gain.setValueAtTime(0.0001, now)
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), now + Math.min(0.01, duration * 0.25))
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration)

    oscillator.connect(envelope)
    envelope.connect(this.getMasterGain())
    oscillator.start(now)
    oscillator.stop(now + duration + 0.02)
    return true
  }

  playBlockBreak(blockTone = 180) {
    this.playTone({ frequency: blockTone, durationSeconds: 0.075, type: 'triangle', gain: 0.025 })
  }

  playBlockPlace() {
    this.playTone({ frequency: 260, durationSeconds: 0.055, type: 'square', gain: 0.018 })
  }

  playJump() {
    this.playTone({ frequency: 520, durationSeconds: 0.09, type: 'sine', gain: 0.018 })
  }

  playSelect() {
    this.playTone({ frequency: 620, durationSeconds: 0.055, type: 'sine', gain: 0.014 })
  }

  playShardCollect() {
    this.playTone({ frequency: 620, durationSeconds: 0.12, type: 'sine', gain: 0.028 })
    window.setTimeout(() => this.playTone({ frequency: 930, durationSeconds: 0.11, type: 'sine', gain: 0.022 }), 55)
  }

  dispose() {
    if (this.context) {
      void this.context.close().catch(() => undefined)
    }
    this.context = null
    this.masterGain = null
  }

  private getContext(): AudioContext | null {
    if (!this.context) {
      const AudioContextCtor = window.AudioContext || (window as BrowserWindowWithWebkitAudio).webkitAudioContext
      if (!AudioContextCtor) return null
      try {
        this.context = new AudioContextCtor()
      } catch {
        return null
      }
    }
    return this.context
  }

  private getMasterGain() {
    const context = this.getContext()
    if (!context) throw new Error('Audio context unavailable')
    if (!this.masterGain) {
      this.masterGain = context.createGain()
      this.masterGain.gain.value = this.enabled ? this.masterVolume : 0
      this.masterGain.connect(context.destination)
    }
    return this.masterGain
  }

  private syncMasterGain() {
    if (!this.masterGain || !this.context) return
    const value = this.enabled ? this.masterVolume : 0
    this.masterGain.gain.cancelScheduledValues(this.context.currentTime)
    this.masterGain.gain.setTargetAtTime(value, this.context.currentTime, 0.012)
  }
}

export const audioSystem = new AudioSystem()

function clamp01(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
}
