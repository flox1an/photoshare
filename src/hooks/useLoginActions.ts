'use client'

import { ExtensionSigner, NostrConnectSigner } from 'applesauce-signers'
import { useNostrAccountStore } from '@/store/nostrAccountStore'
import { isNip05, resolveNip05ToBunkerUri } from '@/lib/nostr/nip05'

export function useLoginActions() {
  const { login, logout } = useNostrAccountStore()

  return {
    async extension(): Promise<void> {
      if (typeof window === 'undefined' || !('nostr' in window) || !window.nostr) {
        throw new Error('Nostr extension not found. Please install a NIP-07 extension.')
      }
      const signer = new ExtensionSigner()
      const pubkey = await signer.getPublicKey()
      login('extension', signer, pubkey)
    },

    async bunker(
      input: string,
      opts?: { onAuth?: (url: string) => void },
    ): Promise<void> {
      const trimmed = input.trim()
      if (!trimmed) throw new Error('Bunker URI cannot be empty')
      if (!trimmed.startsWith('bunker://') && !isNip05(trimmed)) {
        throw new Error('Enter a bunker:// URI or NIP-05 address (user@domain)')
      }

      let bunkerUri = trimmed
      if (isNip05(trimmed)) {
        const result = await resolveNip05ToBunkerUri(trimmed)
        bunkerUri = result.bunkerUri
      }

      const signer = await NostrConnectSigner.fromBunkerURI(bunkerUri, {
        onAuth: opts?.onAuth,
      })
      const pubkey = await signer.getPublicKey()
      login('bunker', signer, pubkey, bunkerUri)
    },

    logout,
  }
}
