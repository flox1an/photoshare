'use client'

import { useEffect } from 'react'
import { ExtensionSigner, NostrConnectSigner } from 'applesauce-signers'
import { useNostrAccountStore, getPersistedAccount } from '@/store/nostrAccountStore'

export function NostrAccountRestorer() {
  const { login, setRestoring } = useNostrAccountStore()

  useEffect(() => {
    void (async () => {
      const persisted = getPersistedAccount()
      if (!persisted) return

      setRestoring(true)
      try {
        if (persisted.type === 'extension') {
          if (typeof window === 'undefined' || !('nostr' in window)) {
            throw new Error('Extension not available')
          }
          const signer = new ExtensionSigner()
          const pubkey = await signer.getPublicKey()
          login('extension', signer, pubkey)
        } else if (persisted.type === 'bunker' && persisted.bunkerUri) {
          const signer = await NostrConnectSigner.fromBunkerURI(persisted.bunkerUri)
          const pubkey = await signer.getPublicKey()
          login('bunker', signer, pubkey, persisted.bunkerUri)
        }
      } catch {
        // Silent failure — bad credentials; clear and stay anonymous
        localStorage.removeItem('photoshare:account')
      } finally {
        setRestoring(false)
      }
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
