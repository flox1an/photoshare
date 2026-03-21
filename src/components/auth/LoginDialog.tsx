'use client'

import { useState, useCallback } from 'react'
import { useLoginActions } from '@/hooks/useLoginActions'
import { isNip05 } from '@/lib/nostr/nip05'
import { QRCodeLogin } from './QRCodeLogin'

type Tab = 'qr' | 'extension' | 'bunker'

interface LoginDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function LoginDialog({ isOpen, onClose }: LoginDialogProps) {
  const [tab, setTab] = useState<Tab>('qr')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [bunkerInput, setBunkerInput] = useState('')
  const [authUrl, setAuthUrl] = useState<string | null>(null)
  const login = useLoginActions()

  const handleTabChange = (t: Tab) => {
    setTab(t)
    setError(null)
    setAuthUrl(null)
  }

  const handleExtension = async () => {
    setIsLoading(true)
    setError(null)
    try {
      await login.extension()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Extension login failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleBunkerAuth = useCallback(async (url: string) => {
    setAuthUrl(url)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    if (!isIOS) window.open(url, '_blank', 'noopener,noreferrer')
  }, [])

  const isBunkerValid = (v: string) =>
    v.trim().startsWith('bunker://') || isNip05(v.trim())

  const handleBunker = async () => {
    if (!bunkerInput.trim()) {
      setError('Please enter a bunker URI or NIP-05 address')
      return
    }
    setIsLoading(true)
    setError(null)
    setAuthUrl(null)
    try {
      await login.bunker(bunkerInput, { onAuth: handleBunkerAuth })
      setAuthUrl(null)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bunker login failed')
      setAuthUrl(null)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" />

      {/* Panel */}
      <div className="relative w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 text-center">
          <h2 className="text-lg font-semibold text-zinc-100">Sign in with Nostr</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Upload photos under your Nostr identity
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mb-4 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="mx-6 mb-6">
          <div className="mb-5 flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5">
            {(['qr', 'extension', 'bunker'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => handleTabChange(t)}
                className={`flex-1 rounded-md py-1.5 text-xs font-medium capitalize transition-colors ${
                  tab === t
                    ? 'bg-zinc-700 text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {t === 'qr' ? 'QR' : t === 'extension' ? 'Extension' : 'Bunker'}
              </button>
            ))}
          </div>

          {/* QR tab */}
          {tab === 'qr' && (
            <QRCodeLogin
              onLogin={onClose}
              onError={(msg) => setError(msg)}
            />
          )}

          {/* Extension tab */}
          {tab === 'extension' && (
            <div className="flex flex-col items-center gap-4 py-2">
              <p className="text-center text-sm text-zinc-400">
                Connect with a NIP-07 browser extension (Alby, nos2x, etc.)
              </p>
              <button
                onClick={() => void handleExtension()}
                disabled={isLoading}
                className="w-full rounded-full border border-zinc-700 bg-zinc-800 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 transition-colors"
              >
                {isLoading ? 'Connecting…' : 'Connect Extension'}
              </button>
            </div>
          )}

          {/* Bunker tab */}
          {tab === 'bunker' && (
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                  Bunker URI or NIP-05 address
                </label>
                <input
                  type="text"
                  value={bunkerInput}
                  onChange={(e) => setBunkerInput(e.target.value)}
                  placeholder="bunker://… or user@domain.com"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-600"
                />
                {bunkerInput && !isBunkerValid(bunkerInput) && (
                  <p className="mt-1 text-xs text-red-400">
                    Enter a bunker:// URI or user@domain NIP-05 address
                  </p>
                )}
              </div>

              {authUrl && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-xs text-zinc-400">
                  <p className="mb-2">Authorization required:</p>
                  <a
                    href={authUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full rounded border border-zinc-700 bg-zinc-800 py-1.5 text-center text-zinc-300 hover:bg-zinc-700 transition-colors"
                  >
                    Open Authorization ↗
                  </a>
                </div>
              )}

              <button
                onClick={() => void handleBunker()}
                disabled={isLoading || !bunkerInput.trim() || !isBunkerValid(bunkerInput)}
                className="w-full rounded-full border border-zinc-700 bg-zinc-800 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 transition-colors"
              >
                {isLoading ? 'Connecting…' : 'Connect Bunker'}
              </button>
            </div>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-zinc-600 hover:text-zinc-400 transition-colors"
          aria-label="Close"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
