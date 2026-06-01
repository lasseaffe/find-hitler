import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    pool: 'vmThreads', // forks pool hits spawn UNKNOWN on Windows
  },
})
