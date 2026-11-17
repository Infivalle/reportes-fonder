// @ts-nocheck
// GENERADO por scripts/build-functions.mjs a partir de src/. No editar a mano.
// Para regenerar: npm run build:functions

// src/funciones/gestionar-usuarios/clave.ts
var MINUSCULAS = "abcdefghijkmnpqrstuvwxyz";
var MAYUSCULAS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
var NUMEROS = "23456789";
var SIMBOLOS = "!#$%&*+-=?@";
var TODOS = MINUSCULAS + MAYUSCULAS + NUMEROS + SIMBOLOS;
function entero(n) {
  const limite = Math.floor(4294967296 / n) * n;
  const buf = new Uint32Array(1);
  for (; ; ) {
    crypto.getRandomValues(buf);
    const v = buf[0] ?? 0;
    if (v < limite) return v % n;
  }
}
function letraDe(alfabeto) {
  return alfabeto.charAt(entero(alfabeto.length));
}
function generarClaveTemporal(largo = 20) {
  if (largo < 12) throw new Error("El largo m\xEDnimo es 12");
  const letras = [letraDe(MINUSCULAS), letraDe(MAYUSCULAS), letraDe(NUMEROS), letraDe(SIMBOLOS)];
  while (letras.length < largo) letras.push(letraDe(TODOS));
  for (let i = letras.length - 1; i > 0; i -= 1) {
    const j = entero(i + 1);
    const a = letras[i] ?? "";
    letras[i] = letras[j] ?? "";
    letras[j] = a;
  }
  return letras.join("");
}

// src/funciones/gestionar-usuarios/manejador.ts
var MAX_CUERPO = 10 * 1024;
var BLOQUEO = "876000h";
var RE_CORREO = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;
var RE_ID = /^[0-9a-fA-F-]{36}$/;
function cabeceras(entorno, req) {
  const h = { "Content-Type": "application/json", "Cache-Control": "no-store" };
  const origen = req.headers.get("Origin");
  if (origen !== null && entorno.origenPermitido !== void 0 && origen === entorno.origenPermitido) {
    h["Access-Control-Allow-Origin"] = origen;
    h["Access-Control-Allow-Headers"] = "authorization, content-type, apikey, x-client-info";
    h["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    h["Vary"] = "Origin";
  }
  return h;
}
function leerAal(autorizacion) {
  try {
    const token = autorizacion.replace(/^Bearer\s+/i, "");
    const carga = token.split(".")[1];
    if (carga === void 0) return "";
    const json = atob(carga.replace(/-/g, "+").replace(/_/g, "/"));
    const o = JSON.parse(json);
    return typeof o.aal === "string" ? o.aal : "";
  } catch {
    return "";
  }
}
function rolDe(u) {
  const r = u.app_metadata?.rol;
  return r === "admin" || r === "asesor" ? r : null;
}
function estaActivo(u, ahora) {
  if (u.banned_until === null || u.banned_until === void 0) return true;
  const t = Date.parse(u.banned_until);
  return Number.isNaN(t) || t <= ahora;
}
function aListado(u, ahora) {
  return {
    id: u.id ?? "",
    correo: u.email ?? "",
    rol: rolDe(u),
    activo: estaActivo(u, ahora),
    creadoEn: u.created_at ?? null,
    ultimoAcceso: u.last_sign_in_at ?? null,
    tiene2fa: Array.isArray(u.factors) ? u.factors.some((f) => f.status === "verified") : null
  };
}
var ErrorHttp = class extends Error {
  constructor(estado, mensaje) {
    super(mensaje);
    this.estado = estado;
  }
  estado;
};
async function manejarUsuarios(req, deps) {
  const { entorno } = deps;
  const headers = cabeceras(entorno, req);
  const responder = (estado, cuerpo2) => new Response(JSON.stringify(cuerpo2), { status: estado, headers });
  const generarClave = deps.generarClave ?? generarClaveTemporal;
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return responder(405, { ok: false, error: "M\xE9todo no permitido" });
  const autorizacion = req.headers.get("Authorization");
  if (autorizacion === null || !/^Bearer\s+\S+/i.test(autorizacion)) return responder(401, { ok: false, error: "Falta la sesi\xF3n" });
  let yo;
  try {
    const r = await deps.fetch(`${entorno.supabaseUrl}/auth/v1/user`, { headers: { Authorization: autorizacion, apikey: entorno.anonKey } });
    if (!r.ok) return responder(401, { ok: false, error: "Sesi\xF3n inv\xE1lida o vencida" });
    yo = await r.json();
  } catch {
    return responder(502, { ok: false, error: "No se pudo verificar la sesi\xF3n" });
  }
  if (rolDe(yo) !== "admin" || typeof yo.id !== "string") {
    return responder(403, { ok: false, error: "Solo un administrador puede gestionar usuarios" });
  }
  if (entorno.exigirAal2 === true && leerAal(autorizacion) !== "aal2") {
    return responder(403, { ok: false, error: "Falta el segundo factor de autenticaci\xF3n", codigo: "requiere_aal2" });
  }
  const yoId = yo.id;
  if (Number(req.headers.get("Content-Length") ?? "0") > MAX_CUERPO) return responder(413, { ok: false, error: "Solicitud demasiado grande" });
  let cuerpo;
  try {
    const texto = await req.text();
    if (texto.length > MAX_CUERPO) return responder(413, { ok: false, error: "Solicitud demasiado grande" });
    const j = JSON.parse(texto);
    if (j === null || typeof j !== "object" || Array.isArray(j)) throw new Error("no es objeto");
    cuerpo = j;
  } catch {
    return responder(400, { ok: false, error: "El cuerpo debe ser un objeto JSON" });
  }
  const auth = async (metodo, ruta, datos) => {
    const r = await deps.fetch(`${entorno.supabaseUrl}/auth/v1${ruta}`, {
      method: metodo,
      headers: { apikey: entorno.serviceKey, Authorization: `Bearer ${entorno.serviceKey}`, "Content-Type": "application/json" },
      ...datos === void 0 ? {} : { body: JSON.stringify(datos) }
    });
    const texto = await r.text();
    let c;
    try {
      c = texto === "" ? null : JSON.parse(texto);
    } catch {
      c = null;
    }
    return { estado: r.status, cuerpo: c };
  };
  const todos = async () => {
    const lista = [];
    for (let pagina = 1; pagina <= 50; pagina += 1) {
      const r = await auth("GET", `/admin/users?page=${pagina}&per_page=200`);
      if (r.estado !== 200) throw new ErrorHttp(502, "No se pudo leer la lista de usuarios");
      const usuarios = r.cuerpo?.users ?? [];
      lista.push(...usuarios);
      if (usuarios.length < 200) break;
    }
    return lista;
  };
  const uno = async (id) => {
    const r = await auth("GET", `/admin/users/${id}`);
    if (r.estado === 404) throw new ErrorHttp(404, "El usuario no existe");
    if (r.estado !== 200 || r.cuerpo === null) throw new ErrorHttp(502, "No se pudo leer el usuario");
    return r.cuerpo;
  };
  const bitacora = async (accion, detalle) => {
    let r;
    try {
      r = await deps.fetch(`${entorno.supabaseUrl}/rest/v1/bitacora`, {
        method: "POST",
        headers: { apikey: entorno.serviceKey, Authorization: `Bearer ${entorno.serviceKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ usuario_id: yoId, accion, detalle })
      });
    } catch {
      throw new ErrorHttp(500, "No se pudo registrar la acci\xF3n en la bit\xE1cora; no se hizo ning\xFAn cambio");
    }
    if (!r.ok) {
      console.error("bitacora fall\xF3", r.status, await r.text());
      throw new ErrorHttp(500, "No se pudo registrar la acci\xF3n en la bit\xE1cora; no se hizo ning\xFAn cambio");
    }
  };
  const idObjetivo = () => {
    const id = cuerpo["id"];
    if (typeof id !== "string" || !RE_ID.test(id)) throw new ErrorHttp(400, "Falta el identificador del usuario");
    if (id === yoId) throw new ErrorHttp(409, "No puede hacer este cambio sobre su propia cuenta");
    return id;
  };
  const rolPedido = () => {
    const r = cuerpo["rol"];
    if (r !== "admin" && r !== "asesor") throw new ErrorHttp(400, "El rol debe ser admin o asesor");
    return r;
  };
  const protegerUltimoAdmin = async (objetivo) => {
    if (rolDe(objetivo) !== "admin" || !estaActivo(objetivo, Date.now())) return;
    const activos = (await todos()).filter((u) => rolDe(u) === "admin" && estaActivo(u, Date.now()));
    if (activos.length <= 1) throw new ErrorHttp(409, "Es el \xFAnico administrador activo: cree o active otro antes");
  };
  const actualizar = async (id, cambios) => {
    const r = await auth("PUT", `/admin/users/${id}`, cambios);
    if (r.estado !== 200) {
      console.error("actualizar usuario fall\xF3", r.estado);
      throw new ErrorHttp(502, "Auth rechaz\xF3 el cambio");
    }
    return r.cuerpo;
  };
  try {
    switch (cuerpo["accion"]) {
      case "listar": {
        const ahora = Date.now();
        const usuarios = (await todos()).map((u) => aListado(u, ahora)).sort((a, b) => a.correo.localeCompare(b.correo));
        return responder(200, { ok: true, usuarios });
      }
      case "crear": {
        const correo = typeof cuerpo["correo"] === "string" ? cuerpo["correo"].trim().toLowerCase() : "";
        if (correo.length > 254 || !RE_CORREO.test(correo)) throw new ErrorHttp(400, "El correo no es v\xE1lido");
        const rol = rolPedido();
        await bitacora("usuario_crea", { rol });
        const clave = generarClave();
        const r = await auth("POST", "/admin/users", {
          email: correo,
          password: clave,
          email_confirm: true,
          app_metadata: { rol },
          user_metadata: { debe_cambiar_clave: true }
        });
        const codigoAuth = r.cuerpo?.error_code;
        if (codigoAuth === "email_exists" || codigoAuth === "user_already_exists") throw new ErrorHttp(409, "Ya existe un usuario con ese correo");
        if (r.estado !== 200 && r.estado !== 201) {
          console.error("crear usuario fall\xF3", r.estado, typeof codigoAuth === "string" ? codigoAuth : "");
          throw new ErrorHttp(502, "Auth no pudo crear el usuario");
        }
        return responder(200, { ok: true, usuario: aListado(r.cuerpo, Date.now()), claveTemporal: clave });
      }
      case "cambiar_rol": {
        const id = idObjetivo();
        const rol = rolPedido();
        const objetivo = await uno(id);
        if (rolDe(objetivo) === rol) throw new ErrorHttp(409, "El usuario ya tiene ese rol");
        if (rol !== "admin") await protegerUltimoAdmin(objetivo);
        await bitacora("usuario_cambia_rol", { objetivo_id: id, rol_anterior: rolDe(objetivo), rol_nuevo: rol });
        const u = await actualizar(id, { app_metadata: { ...objetivo.app_metadata ?? {}, rol } });
        return responder(200, { ok: true, usuario: aListado(u, Date.now()) });
      }
      case "desactivar": {
        const id = idObjetivo();
        const objetivo = await uno(id);
        await protegerUltimoAdmin(objetivo);
        await bitacora("usuario_desactiva", { objetivo_id: id });
        const u = await actualizar(id, { ban_duration: BLOQUEO });
        return responder(200, { ok: true, usuario: aListado(u, Date.now()) });
      }
      case "reactivar": {
        const id = idObjetivo();
        await uno(id);
        await bitacora("usuario_reactiva", { objetivo_id: id });
        const u = await actualizar(id, { ban_duration: "none" });
        return responder(200, { ok: true, usuario: aListado(u, Date.now()) });
      }
      case "restablecer_clave": {
        const id = idObjetivo();
        const objetivo = await uno(id);
        await bitacora("usuario_restablece_clave", { objetivo_id: id });
        const clave = generarClave();
        const u = await actualizar(id, { password: clave, user_metadata: { ...objetivo.user_metadata ?? {}, debe_cambiar_clave: true } });
        return responder(200, { ok: true, usuario: aListado(u, Date.now()), claveTemporal: clave });
      }
      case "quitar_2fa": {
        const id = idObjetivo();
        const objetivo = await uno(id);
        const factores = (objetivo.factors ?? []).map((f) => f.id).filter((f) => typeof f === "string");
        if (factores.length === 0) throw new ErrorHttp(409, "El usuario no tiene un segundo factor registrado");
        await bitacora("usuario_quita_2fa", { objetivo_id: id, factores: factores.length });
        for (const f of factores) {
          const r = await auth("DELETE", `/admin/users/${id}/factors/${f}`);
          if (r.estado !== 200 && r.estado !== 204) throw new ErrorHttp(502, "Auth no pudo quitar el segundo factor");
        }
        return responder(200, { ok: true, usuario: aListado(await uno(id), Date.now()) });
      }
      default:
        return responder(400, { ok: false, error: "Acci\xF3n desconocida" });
    }
  } catch (e) {
    if (e instanceof ErrorHttp) return responder(e.estado, { ok: false, error: e.message });
    console.error("gestionar-usuarios fall\xF3", e instanceof Error ? e.message : "error");
    return responder(502, { ok: false, error: "No se pudo completar la operaci\xF3n" });
  }
}

// src/funciones/gestionar-usuarios/entrada.ts
function leerEntorno() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) return null;
  return {
    supabaseUrl,
    anonKey,
    serviceKey,
    origenPermitido: Deno.env.get("ALLOWED_ORIGIN") || void 0,
    exigirAal2: Deno.env.get("EXIGIR_AAL2") === "true"
  };
}
Deno.serve((req) => {
  const entorno = leerEntorno();
  if (entorno === null) {
    return new Response(JSON.stringify({ ok: false, error: "Configuraci\xF3n incompleta" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
  return manejarUsuarios(req, { entorno, fetch: (...args) => fetch(...args) });
});
