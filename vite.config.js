import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base must match the GitHub repo name for Pages to resolve assets correctly
export default defineConfig({
  plugins: [react()],
  base: '/chemistry-astar/',
})
