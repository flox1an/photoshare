/**
 * Vitest global setup — fixes cross-realm Uint8Array issue in jsdom environment.
 *
 * Problem: When vitest runs tests with `// @vitest-environment jsdom`, jsdom's
 * TextEncoder creates Uint8Array objects that are NOT instances of Node.js's
 * Uint8Array (cross-realm issue). Libraries like @noble/hashes use
 * `data instanceof Uint8Array` which fails for jsdom-realm Uint8Arrays.
 *
 * Fix: Override Symbol.hasInstance on Uint8Array to accept jsdom's typed arrays
 * by duck-typing (checking buffer, byteLength, BYTES_PER_ELEMENT).
 * This makes `value instanceof Uint8Array` work cross-realm.
 */

// Patch Uint8Array[Symbol.hasInstance] to handle cross-realm typed arrays
// produced by jsdom's TextEncoder.encode()
Object.defineProperty(Uint8Array, Symbol.hasInstance, {
  value: function (this: typeof Uint8Array, value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (Object.prototype.toString.call(value) === "[object Uint8Array]") return true;
    const v = value as Record<string, unknown>;
    return (
      typeof v === "object" &&
      v.BYTES_PER_ELEMENT === 1 &&
      typeof v.buffer === "object" &&
      typeof v.byteLength === "number" &&
      v.constructor?.name === "Uint8Array"
    );
  },
  writable: true,
  configurable: true,
});
