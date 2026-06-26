export type ToneOptions = {
  frequency: number
  durationSeconds?: number
  type?: OscillatorType
  gain?: number
}

export class AudioSystem {
  private context: AudioContext | null = null
  private masterGain: GainNode | null = null
  private enabled = true

  setEnabled(enabled: boolean) {
    this.enabled = enabled
  }

  unlock() {
    const context = this.getContext()
    if (context.state === 'suspended') {
      void context.resume()
    }
  }

  playTone({ frequency, durationSeconds = 0.08, type = 'square', gain = 0.035 }: ToneOptions) {
    if (!this.enabled) return

    const context = this.getContext()
    const oscillator = context.createOscillator()
    const envelope = context.createGain()
    const now = context.currentTime

    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, now)
    envelope.gain.setValueAtTime(0.0001, now)
    envelope.gain.exponentialRampToValueAtTime(gain, now + 0.01)
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + durationSeconds)

    oscillator.connect(envelope)
    envelope.connect(this.getMasterGain())
    oscillator.start(now)
    oscillator.stop(now + durationSeconds + 0.02)
  }

  playBlockBreak(blockTone = 180) {
    this.playTone({ frequency: blockTone, durationSeconds: 0.075, type: 'triangle', gain: 0.025 })
  }

  playBlockPlace() {
    this.playTone({ frequency: 260, durationSeconds: 0.055, type: 'square', gain: 0.018 })
  }

  playShardCollect() {
    this.playTone({ frequency: 620, durationSeconds: 0.12, type: 'sine', gain: 0.028 })
    window.setTimeout(() => this.playTone({ frequency: 930, durationSeconds: 0.11, type: 'sine', gain: 0.022 }), 55)
  }

  dispose() {
    if (this.context) {
      void this.context.close()
    }
    this.context = null
    this.masterGain = null
  }

  private getContext() {
    if (!this.context) {
      this.context = new AudioContext()
    }
    return this.context
  }

  private getMasterGain() {
    const context = this.getContext()
    if (!this.masterGain) {
      this.masterGain = context.createGain()
      this.masterGain.gain.value = 1
      this.masterGain.connect(context.destination)
    }
    return this.masterGain
  }
}

export const audioSystem = new AudioSystem()
