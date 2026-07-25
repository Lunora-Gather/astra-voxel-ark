export type SessionMode = 'singleplayer' | 'multiplayer'

export type SessionDescriptor = {
  mode: SessionMode
  available: boolean
  label: string
}

export interface SessionGateway {
  readonly session: SessionDescriptor
  start(): Promise<void>
  stop(): Promise<void>
}

export class LocalSessionGateway implements SessionGateway {
  readonly session: SessionDescriptor = {
    mode: 'singleplayer',
    available: true,
    label: 'Local Expedition',
  }

  async start() {}
  async stop() {}
}

/**
 * Stable boundary for a future authoritative multiplayer implementation.
 * World simulation does not import transport, lobby or account concerns.
 */
export class ReservedMultiplayerGateway implements SessionGateway {
  readonly session: SessionDescriptor = {
    mode: 'multiplayer',
    available: false,
    label: 'Multiplayer · Coming later',
  }

  async start() {
    throw new Error('Multiplayer is reserved but not implemented')
  }

  async stop() {}
}
