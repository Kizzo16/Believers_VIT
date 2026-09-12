/**
 * Generic Bounded Ring Buffer
 * Replicates Python's collections.deque(maxlen=N) with fixed memory footprint.
 */
export class RingBuffer<T> {
  private items: T[] = [];
  readonly maxlen: number;

  constructor(maxlen: number = 100) {
    if (maxlen <= 0) {
      throw new Error("RingBuffer maxlen must be greater than 0");
    }
    this.maxlen = maxlen;
  }

  push(item: T): void {
    if (this.items.length >= this.maxlen) {
      this.items.shift();
    }
    this.items.push(item);
  }

  toArray(): T[] {
    return [...this.items];
  }

  get length(): number {
    return this.items.length;
  }

  find(predicate: (item: T) => boolean): T | undefined {
    return this.items.find(predicate);
  }

  clear(): void {
    this.items = [];
  }

  [Symbol.iterator](): Iterator<T> {
    return this.items[Symbol.iterator]();
  }
}
