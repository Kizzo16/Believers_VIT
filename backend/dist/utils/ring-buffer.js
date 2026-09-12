"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RingBuffer = void 0;
/**
 * Generic Bounded Ring Buffer
 * Replicates Python's collections.deque(maxlen=N) with fixed memory footprint.
 */
class RingBuffer {
    items = [];
    maxlen;
    constructor(maxlen = 100) {
        if (maxlen <= 0) {
            throw new Error("RingBuffer maxlen must be greater than 0");
        }
        this.maxlen = maxlen;
    }
    push(item) {
        if (this.items.length >= this.maxlen) {
            this.items.shift();
        }
        this.items.push(item);
    }
    toArray() {
        return [...this.items];
    }
    get length() {
        return this.items.length;
    }
    find(predicate) {
        return this.items.find(predicate);
    }
    clear() {
        this.items = [];
    }
    [Symbol.iterator]() {
        return this.items[Symbol.iterator]();
    }
}
exports.RingBuffer = RingBuffer;
