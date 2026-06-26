export type ChunkRebuildTask<T> = {
  key: string
  priority?: number
  payload: T
}

export type ChunkRebuildBatch<T> = {
  tasks: ChunkRebuildTask<T>[]
  remaining: number
}

export class ChunkRebuildScheduler<T> {
  private readonly tasks = new Map<string, ChunkRebuildTask<T>>()

  enqueue(task: ChunkRebuildTask<T>) {
    const existing = this.tasks.get(task.key)
    if (!existing || (task.priority ?? 0) >= (existing.priority ?? 0)) {
      this.tasks.set(task.key, task)
    }
  }

  enqueueMany(tasks: Iterable<ChunkRebuildTask<T>>) {
    for (const task of tasks) {
      this.enqueue(task)
    }
  }

  nextBatch(limit: number): ChunkRebuildBatch<T> {
    const batchSize = Math.max(0, Math.floor(limit))
    if (batchSize === 0) return { tasks: [], remaining: this.tasks.size }

    const tasks = [...this.tasks.values()].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)).slice(0, batchSize)
    for (const task of tasks) {
      this.tasks.delete(task.key)
    }

    return {
      tasks,
      remaining: this.tasks.size,
    }
  }

  remove(key: string) {
    return this.tasks.delete(key)
  }

  clear() {
    this.tasks.clear()
  }

  get size() {
    return this.tasks.size
  }
}
