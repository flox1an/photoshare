// Type declaration for the NIP-07 Nostr browser extension API
declare global {
  interface Window {
    nostr?: {
      getPublicKey(): Promise<string>
      signEvent(event: object): Promise<object>
    }
  }
}

export {}
