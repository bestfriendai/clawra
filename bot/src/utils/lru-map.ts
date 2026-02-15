export class LRUMap<K, V> extends Map<K, V> {
  constructor(private maxSize: number) {
    super();
  }

  set(key: K, value: V): this {
    if (this.has(key)) this.delete(key);
    super.set(key, value);
    if (this.size > this.maxSize) {
      const oldest = this.keys().next().value;
      if (oldest !== undefined) this.delete(oldest);
    }
    return this;
  }

  get(key: K): V | undefined {
    const value = super.get(key);
    if (value !== undefined) {
      this.delete(key);
      super.set(key, value);
    }
    return value;
  }
}
