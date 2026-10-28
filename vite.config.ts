/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Ruta base de GitHub Pages: https://<owner>.github.io/repotes-fonder/
// Si el repositorio cambia de nombre, cambiar también esta constante.
const BASE = '/repotes-fonder/'

export default defineConfig({
  base: BASE,
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
  },
})
