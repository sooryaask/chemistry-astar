import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base must match the GitHub repo name for Pages to resolve assets correctly
export default defineConfig({
  plugins: [react()],
  base: '/chemistry-astar/',
  define: {
    // react-mathquill's bundled MathQuill references `global` (Node.js),
    // which doesn't exist in browsers. Map it to `globalThis`.
    global: 'globalThis',
  },
})
