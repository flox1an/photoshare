import { create } from 'zustand'
import type { ExtensionSigner, NostrConnectSigner } from 'applesauce-signers'

export type AccountType = 'extension' | 'bunker'

export interface PersistedAccount {
  type: AccountType
  bunkerUri?: string
}

interface NostrAccountState {
  pubkey: string | null
  signer: ExtensionSigner | NostrConnectSigner | null
  type: AccountType | null
  bunkerUri: string | null
  restoring: boolean
  login: (
    type: AccountType,
    signer: ExtensionSigner | NostrConnectSigner,
    pubkey: string,
    bunkerUri?: string,
  ) => void
  logout: () => void
  setRestoring: (v: boolean) => void
}

const STORAGE_KEY = 'photoshare:account'

export const useNostrAccountStore = create<NostrAccountState>((set) => ({
  pubkey: null,
  signer: null,
  type: null,
  bunkerUri: null,
  restoring: false,

  login: (type, signer, pubkey, bunkerUri) => {
    const persisted: PersistedAccount = {
      type,
      ...(bunkerUri ? { bunkerUri } : {}),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted))
    set({ pubkey, signer, type, bunkerUri: bunkerUri ?? null })
  },

  logout: () => {
    localStorage.removeItem(STORAGE_KEY)
    set({ pubkey: null, signer: null, type: null, bunkerUri: null })
  },

  setRestoring: (v) => set({ restoring: v }),
}))

export function getPersistedAccount(): PersistedAccount | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PersistedAccount
  } catch {
    return null
  }
}
