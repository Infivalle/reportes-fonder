// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

type Usuario = { id: string; email: string; app_metadata: Record<string, unknown>; user_metadata?: Record<string, unknown> } | null

const estado = vi.hoisted(() => ({ cliente: null as unknown }))
vi.mock('../src/privado/cliente', () => ({ clienteCompartido: () => estado.cliente }))

import { PaginaPrivada } from '../src/interfaz/PaginaPrivada'

function clienteCon(usuario: Usuario, errorAcceso = false) {
  const signIn = vi.fn(() => Promise.resolve({ error: errorAcceso ? { message: 'Invalid login credentials' } : null }))
  const signOut = vi.fn(() => Promise.resolve({ error: null }))
  estado.cliente = {
    auth: {
      getSession: () => Promise.resolve({ data: { session: usuario === null ? null : { user: usuario } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: signIn,
      signOut,
    },
  }
  return { signIn, signOut }
}

afterEach(() => {
  cleanup()
  estado.cliente = null
})

describe('PaginaPrivada', () => {
  it('sin configuración de Supabase lo dice', () => {
    estado.cliente = null
    render(<PaginaPrivada />)
    expect(screen.getByRole('alert').textContent).toMatch(/no está configurado/)
  })

  it('sin sesión muestra el formulario y no las descargas', async () => {
    clienteCon(null)
    render(<PaginaPrivada />)
    expect(await screen.findByLabelText('Correo')).toBeTruthy()
    expect(screen.getByLabelText('Contraseña')).toBeTruthy()
    expect(screen.queryByText(/Generar y descargar/)).toBeNull()
  })

  it('un error de acceso muestra un mensaje único', async () => {
    const { signIn } = clienteCon(null, true)
    render(<PaginaPrivada />)
    await userEvent.type(await screen.findByLabelText('Correo'), 'x@y.test')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'mala')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Correo o contraseña incorrectos.'))
    expect(signIn).toHaveBeenCalledWith({ email: 'x@y.test', password: 'mala' })
  })

  it('el admin ve las dos descargas; la del cruce espera el archivo', async () => {
    clienteCon({ id: 'u1', email: 'admin@x.test', app_metadata: { rol: 'admin' } })
    render(<PaginaPrivada />)
    const cruce = await screen.findByRole('button', { name: 'Generar y descargar el cruce' })
    expect((cruce as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Generar y descargar la data limpia' }) as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByText(/Administrador/)).toBeTruthy()
  })

  it('el asesor no ve descargas', async () => {
    clienteCon({ id: 'u2', email: 'asesor@x.test', app_metadata: { rol: 'asesor' } })
    render(<PaginaPrivada />)
    expect(await screen.findByText(/no incluye descargas/)).toBeTruthy()
    expect(screen.queryByText(/Generar y descargar/)).toBeNull()
  })

  it('un rol puesto por el propio usuario (user_metadata) no da acceso', async () => {
    clienteCon({ id: 'u3', email: 'x@x.test', app_metadata: {}, user_metadata: { rol: 'admin' } })
    render(<PaginaPrivada />)
    expect(await screen.findByText(/no tiene un rol asignado/)).toBeTruthy()
    expect(screen.queryByText(/Generar y descargar/)).toBeNull()
  })

  it('cerrar sesión llama a signOut', async () => {
    const { signOut } = clienteCon({ id: 'u1', email: 'admin@x.test', app_metadata: { rol: 'admin' } })
    render(<PaginaPrivada />)
    await userEvent.click(await screen.findByRole('button', { name: 'Cerrar sesión' }))
    expect(signOut).toHaveBeenCalled()
  })
})
