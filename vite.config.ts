/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Ruta base de GitHub Pages: https://<owner>.github.io/reportes-fonder/
// Si el repositorio cambia de nombre, cambiar también esta constante.
const BASE = '/reportes-fonder/'

export default defineConfig({
  base: BASE,
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
  },
})
