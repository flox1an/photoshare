'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { NostrConnectSigner } from 'applesauce-signers'
import { useNostrAccountStore } from '@/store/nostrAccountStore'
import { subscriptionMethod, publishMethod } from '@/lib/nostr/relay'

const NOSTRCONNECT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
]

function buildBunkerUri(remotePubkey: string, relays: string[], secret?: string): string {
  const params = new URLSearchParams()
  relays.forEach((relay) => params.append('relay', relay))
  if (secret) params.append('secret', secret)
  return `bunker://${remotePubkey}?${params.toString()}`
}

interface QRCodeLoginProps {
  onLogin: () => void
  onError: (msg: string) => void
}

export function QRCodeLogin({ onLogin, onError }: QRCodeLoginProps) {
  const [uri, setUri] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const { login } = useNostrAccountStore()

  const generate = useCallback(async () => {
    abortRef.current?.abort()
    setUri(null)
    setCopied(false)

    try {
      const signer = new NostrConnectSigner({
        relays: NOSTRCONNECT_RELAYS,
        subscriptionMethod,
        publishMethod,
      })

      const nostrConnectUri = signer.getNostrConnectURI({
        name: 'photoshare',
        url: typeof window !== 'undefined' ? window.location.origin : '',
      })
      setUri(nostrConnectUri)

      const controller = new AbortController()
      abortRef.current = controller

      await signer.waitForSigner(controller.signal)

      const pubkey = await signer.getPublicKey()
      const remote = signer.remote
      if (!remote) throw new Error('Failed to get remote signer pubkey')

      const bunkerUri = buildBunkerUri(remote, NOSTRCONNECT_RELAYS, signer.secret)
      login('bunker', signer, pubkey, bunkerUri)
      onLogin()
    } catch (err) {
      const isAbort =
        err instanceof Error &&
        (err.name === 'AbortError' || err.message.toLowerCase().includes('abort'))
      if (isAbort) return
      onError(err instanceof Error ? err.message : 'Connection failed')
    }
  }, [login, onLogin, onError])

  useEffect(() => {
    void generate()
    return () => {
      abortRef.current?.abort()
    }
  }, [generate])

  const handleCopy = async () => {
    if (!uri) return
    try {
      await navigator.clipboard.writeText(uri)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard not available
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-center">
        <p className="text-sm text-zinc-400">Scan with your Nostr signer app</p>
        <p className="text-xs text-zinc-600 mt-1">Amber, Nostrudel, or any NIP-46 signer</p>
      </div>

      <div className="p-4 bg-white rounded-xl">
        {uri ? (
          <QRCodeSVG value={uri} size={200} level="M" marginSize={0} />
        ) : (
          <div className="w-[200px] h-[200px] flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-zinc-600 border-t-zinc-300 animate-spin" />
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleCopy}
          disabled={!uri}
          className="text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-40 transition-colors"
        >
          {copied ? 'Copied!' : 'Copy URI'}
        </button>
        <button
          onClick={() => void generate()}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Refresh
        </button>
      </div>
    </div>
  )
}
