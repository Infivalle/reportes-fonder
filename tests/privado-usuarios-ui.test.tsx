// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UsuarioListado } from '../src/privado/usuarios'

const estado = vi.hoisted(() => ({ cliente: null as unknown }))
vi.mock('../src/privado/cliente', () => ({ clienteCompartido: () => estado.cliente }))

import { PaginaPrivada } from '../src/interfaz/PaginaPrivada'

const YO = { id: 'u-admin', email: 'admin@x.test', app_metadata: { rol: 'admin' } as Record<string, unknown>, user_metadata: {} as Record<string, unknown> }

const base: UsuarioListado[] = [
  { id: 'u-admin', correo: 'admin@x.test', rol: 'admin', activo: true, creadoEn: null, ultimoAcceso: '2026-11-16T15:00:00Z', tiene2fa: true },
  { id: 'u-ases', correo: 'asesor@x.test', rol: 'asesor', activo: true, creadoEn: null, ultimoAcceso: null, tiene2fa: false },
  { id: 'u-doble', correo: 'doble@x.test', rol: 'asesor', activo: false, creadoEn: null, ultimoAcceso: null, tiene2fa: true },
]

/** Cliente de mentira con sesión de admin y una Edge Function simulada. */
function montar(opts: { usuario?: typeof YO; respuesta?: (cuerpo: Record<string, unknown>) => { data?: unknown; error?: unknown } } = {}) {
  const usuario = opts.usuario ?? YO
  const invoke = vi.fn((_nombre: string, { body }: { body: Record<string, unknown> }) => {
    if (opts.respuesta !== undefined) {
      const r = opts.respuesta(body)
      return Promise.resolve({ data: r.data ?? null, error: r.error ?? null })
    }
    if (body['accion'] === 'listar') return Promise.resolve({ data: { ok: true, usuarios: base }, error: null })
    if (body['accion'] === 'crear') return Promise.resolve({ data: { ok: true, usuario: { ...base[1], id: 'u-nuevo', correo: String(body['correo']) }, claveTemporal: 'Temporal-Clave-12#' }, error: null })
    return Promise.resolve({ data: { ok: true, usuario: base[1] }, error: null })
  })
  const updateUser = vi.fn(() => Promise.resolve({ error: null }))
  estado.cliente = {
    auth: {
      getSession: () => Promise.resolve({ data: { session: { user: usuario } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: () => Promise.resolve({ error: null }),
      updateUser,
    },
    functions: { invoke },
  }
  return { invoke, updateUser }
}

afterEach(() => {
  cleanup()
  estado.cliente = null
})

async function abrirUsuarios() {
  await userEvent.click(await screen.findByRole('button', { name: 'Usuarios' }))
}

describe('Panel de usuarios', () => {
  it('lista los usuarios; en la propia cuenta no hay acciones', async () => {
    montar()
    render(<PaginaPrivada />)
    await abrirUsuarios()
    const fila = (await screen.findByRole('row', { name: /admin@x.test/ }))
    expect(within(fila).getByText('(usted)')).toBeTruthy()
    expect(within(fila).queryByRole('button')).toBeNull()
    const otra = screen.getByRole('row', { name: /asesor@x.test/ })
    expect(within(otra).getByRole('button', { name: 'Pasar a administrador a asesor@x.test' })).toBeTruthy()
    expect(within(otra).getByRole('button', { name: 'Desactivar a asesor@x.test' })).toBeTruthy()
    expect(within(otra).queryByRole('button', { name: /Quitar segundo factor/ })).toBeNull() // sin 2FA
    const doble = screen.getByRole('row', { name: /doble@x.test/ })
    expect(within(doble).getByRole('button', { name: 'Reactivar a doble@x.test' })).toBeTruthy()
    expect(within(doble).getByRole('button', { name: 'Quitar segundo factor a doble@x.test' })).toBeTruthy()
  })

  it('crear muestra la contraseña temporal una sola vez y se puede ocultar', async () => {
    const { invoke } = montar()
    render(<PaginaPrivada />)
    await abrirUsuarios()
    await userEvent.type(await screen.findByLabelText('Correo'), 'nuevo@x.test')
    await userEvent.selectOptions(screen.getByLabelText('Rol'), 'admin')
    await userEvent.click(screen.getByRole('button', { name: 'Crear usuario' }))
    expect(await screen.findByText('Temporal-Clave-12#')).toBeTruthy()
    expect(invoke).toHaveBeenCalledWith('gestionar-usuarios', { body: { accion: 'crear', correo: 'nuevo@x.test', rol: 'admin' } })
    await userEvent.click(screen.getByRole('button', { name: /ocultar/ }))
    expect(screen.queryByText('Temporal-Clave-12#')).toBeNull()
  })

  it('las acciones piden confirmación y Cancelar no llama al servidor', async () => {
    const { invoke } = montar()
    render(<PaginaPrivada />)
    await abrirUsuarios()
    await userEvent.click(await screen.findByRole('button', { name: 'Desactivar a asesor@x.test' }))
    const antes = invoke.mock.calls.length
    expect(screen.getByText('¿Desactivar?')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(invoke.mock.calls.length).toBe(antes)

    await userEvent.click(screen.getByRole('button', { name: 'Desactivar a asesor@x.test' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('gestionar-usuarios', { body: { accion: 'desactivar', id: 'u-ases' } }))
    expect(await screen.findByText(/Listo: desactivar · asesor@x.test/)).toBeTruthy()
  })

  it('restablecer contraseña entrega la clave nueva', async () => {
    const { invoke } = montar({
      respuesta: (c) => (c['accion'] === 'listar' ? { data: { ok: true, usuarios: base } } : { data: { ok: true, usuario: base[1], claveTemporal: 'Otra-Clave-77!' } }),
    })
    render(<PaginaPrivada />)
    await abrirUsuarios()
    await userEvent.click(await screen.findByRole('button', { name: 'Restablecer contraseña a asesor@x.test' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(await screen.findByText('Otra-Clave-77!')).toBeTruthy()
    expect(invoke).toHaveBeenCalledWith('gestionar-usuarios', { body: { accion: 'restablecer_clave', id: 'u-ases' } })
  })

  it('muestra el mensaje de error que devuelve la función', async () => {
    montar({
      respuesta: (c) =>
        c['accion'] === 'listar'
          ? { data: { ok: true, usuarios: base } }
          : { error: { context: new Response(JSON.stringify({ ok: false, error: 'Es el único administrador activo: cree o active otro antes' }), { status: 409 }) } },
    })
    render(<PaginaPrivada />)
    await abrirUsuarios()
    await userEvent.click(await screen.findByRole('button', { name: 'Desactivar a asesor@x.test' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/único administrador activo/)
  })

  it('si no hay conexión con la función lo dice', async () => {
    montar({ respuesta: () => ({ error: new Error('Failed to send a request') }) })
    render(<PaginaPrivada />)
    await abrirUsuarios()
    expect((await screen.findByRole('alert')).textContent).toMatch(/No se pudo comunicar/)
  })
})

describe('Contraseña temporal', () => {
  const temporal = { ...YO, user_metadata: { debe_cambiar_clave: true } }

  it('obliga a elegir contraseña antes de mostrar nada más', async () => {
    montar({ usuario: temporal })
    render(<PaginaPrivada />)
    expect(await screen.findByLabelText('Contraseña nueva')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Usuarios' })).toBeNull()
  })

  it('rechaza contraseñas débiles o distintas y, si es válida, la guarda y apaga la marca', async () => {
    const { updateUser } = montar({ usuario: temporal })
    render(<PaginaPrivada />)
    await userEvent.type(await screen.findByLabelText('Contraseña nueva'), 'corta')
    await userEvent.type(screen.getByLabelText('Repita la contraseña'), 'corta')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/12 caracteres/)
    expect(updateUser).not.toHaveBeenCalled()

    await userEvent.clear(screen.getByLabelText('Contraseña nueva'))
    await userEvent.type(screen.getByLabelText('Contraseña nueva'), 'Una-Clave-Larga-9!')
    await userEvent.clear(screen.getByLabelText('Repita la contraseña'))
    await userEvent.type(screen.getByLabelText('Repita la contraseña'), 'Otra-Distinta-9!')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/no coinciden/)
    expect(updateUser).not.toHaveBeenCalled()

    await userEvent.clear(screen.getByLabelText('Repita la contraseña'))
    await userEvent.type(screen.getByLabelText('Repita la contraseña'), 'Una-Clave-Larga-9!')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }))
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ password: 'Una-Clave-Larga-9!', data: { debe_cambiar_clave: false } }))
  })
})
