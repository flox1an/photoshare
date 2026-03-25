export interface DeferredQueue<T> {
  push: (item: T) => void;
  close: () => void;
  [Symbol.asyncIterator]: () => AsyncIterator<T>;
}

export function createDeferredQueue<T>(): DeferredQueue<T> {
  const buffer: T[] = [];
  const resolvers: Array<(result: IteratorResult<T>) => void> = [];
  let closed = false;

  const push = (item: T) => {
    if (resolvers.length > 0) {
      const resolve = resolvers.shift();
      resolve?.({ value: item, done: false });
    } else {
      buffer.push(item);
    }
  };

  const close = () => {
    closed = true;
    while (resolvers.length > 0) {
      const resolve = resolvers.shift();
      resolve?.({ value: undefined as unknown as T, done: true });
    }
  };

  return {
    push,
    close,
    [Symbol.asyncIterator]: () => ({
      next(): Promise<IteratorResult<T>> {
        if (buffer.length > 0) {
          const value = buffer.shift() as T;
          return Promise.resolve({ value, done: false });
        }
        if (closed) {
          return Promise.resolve({ value: undefined as unknown as T, done: true });
        }
        return new Promise((resolve) => resolvers.push(resolve));
      },
    }),
  };
}
