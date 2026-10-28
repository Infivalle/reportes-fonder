// @ts-nocheck
// GENERADO por scripts/build-functions.mjs a partir de src/. No editar a mano.
// Para regenerar: npm run build:functions

// src/catalogo/opciones.ts
var OPCIONES_PROVISIONALES = {
  satisfaction: ["Muy satisfecho", "Satisfecho", "Poco satisfecho"],
  resultsasexpected: ["S\xED", "Parcialmente", "No", "Todav\xEDa no se ha evidenciado"],
  paymentsonschedule: ["S\xED", "No"],
  needanothercredit: ["S\xED", "No"],
  financialRecords: ["S\xED", "No"],
  creditusedasapproved: ["S\xED", "No"],
  currentemployees: ["De 1 a 5", "De 5 a 10", "De 10 a 15"]
};

// src/limpieza/atipicos.ts
var FACTOR_ATIPICO = 100;
function esMontoAtipico(monthlyIncome, totalSalesValue) {
  if (monthlyIncome === null || totalSalesValue === null) return false;
  if (monthlyIncome <= 0) return false;
  return totalSalesValue > FACTOR_ATIPICO * monthlyIncome;
}

// src/limpieza/texto.ts
function normalizarTexto(texto) {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
}
function desescaparMysql(texto) {
  if (!texto.includes("\\")) return texto;
  return texto.replace(/\\([ntr0\\])/g, (_, c) => {
    switch (c) {
      case "n":
        return "\n";
      case "t":
        return "	";
      case "r":
        return "\r";
      case "0":
        return "\0";
      default:
        return "\\";
    }
  });
}

// src/limpieza/categorias.ts
function normalizarCategoria(valor, opciones) {
  if (valor === null) return { valor: null, fueraDeCatalogo: false };
  const clave = normalizarTexto(valor);
  if (clave === "") return { valor: null, fueraDeCatalogo: false };
  const canonica = opciones.find((o) => normalizarTexto(o) === clave);
  if (canonica !== void 0) return { valor: canonica, fueraDeCatalogo: false };
  return { valor: valor.trim(), fueraDeCatalogo: true };
}
function separarCodigos(valor) {
  if (valor === null) return [];
  const codigos = valor.split(",").map((c) => c.trim().toUpperCase()).filter((c) => c !== "");
  return [...new Set(codigos)];
}

// src/limpieza/duplicados.ts
var VENTANA_DUPLICADO_DIAS = 30;
var VENTANA_MS = VENTANA_DUPLICADO_DIAS * 24 * 60 * 60 * 1e3;
function decidirDuplicados(entradas) {
  const porBeneficiario = /* @__PURE__ */ new Map();
  for (const e of entradas) {
    const lista = porBeneficiario.get(e.beneficiarioId);
    if (lista === void 0) porBeneficiario.set(e.beneficiarioId, [e]);
    else lista.push(e);
  }
  const decisiones = /* @__PURE__ */ new Map();
  for (const lista of porBeneficiario.values()) {
    lista.sort((a, b) => Date.parse(a.creadaEn) - Date.parse(b.creadaEn) || a.id - b.id);
    let ultimaConservada = null;
    for (const e of lista) {
      if (ultimaConservada !== null && Date.parse(e.creadaEn) - Date.parse(ultimaConservada.creadaEn) < VENTANA_MS) {
        decisiones.set(e.id, {
          conservada: false,
          motivoDescarte: `duplicado: a menos de ${VENTANA_DUPLICADO_DIAS} d\xEDas de la asesor\xEDa ${ultimaConservada.id}`
        });
      } else {
        decisiones.set(e.id, { conservada: true, motivoDescarte: null });
        ultimaConservada = e;
      }
    }
  }
  return decisiones;
}

// src/limpieza/municipios.ts
var MUNICIPIOS_VALLE = [
  { codigo: "76001", nombre: "Cali" },
  { codigo: "76020", nombre: "Alcal\xE1" },
  { codigo: "76036", nombre: "Andaluc\xEDa" },
  { codigo: "76041", nombre: "Ansermanuevo" },
  { codigo: "76054", nombre: "Argelia" },
  { codigo: "76100", nombre: "Bol\xEDvar" },
  { codigo: "76109", nombre: "Buenaventura" },
  { codigo: "76111", nombre: "Guadalajara de Buga" },
  { codigo: "76113", nombre: "Bugalagrande" },
  { codigo: "76122", nombre: "Caicedonia" },
  { codigo: "76126", nombre: "Calima" },
  { codigo: "76130", nombre: "Candelaria" },
  { codigo: "76147", nombre: "Cartago" },
  { codigo: "76233", nombre: "Dagua" },
  { codigo: "76243", nombre: "El \xC1guila" },
  { codigo: "76246", nombre: "El Cairo" },
  { codigo: "76248", nombre: "El Cerrito" },
  { codigo: "76250", nombre: "El Dovio" },
  { codigo: "76275", nombre: "Florida" },
  { codigo: "76306", nombre: "Ginebra" },
  { codigo: "76318", nombre: "Guacar\xED" },
  { codigo: "76364", nombre: "Jamund\xED" },
  { codigo: "76377", nombre: "La Cumbre" },
  { codigo: "76400", nombre: "La Uni\xF3n" },
  { codigo: "76403", nombre: "La Victoria" },
  { codigo: "76497", nombre: "Obando" },
  { codigo: "76520", nombre: "Palmira" },
  { codigo: "76563", nombre: "Pradera" },
  { codigo: "76606", nombre: "Restrepo" },
  { codigo: "76616", nombre: "Riofr\xEDo" },
  { codigo: "76622", nombre: "Roldanillo" },
  { codigo: "76670", nombre: "San Pedro" },
  { codigo: "76736", nombre: "Sevilla" },
  { codigo: "76823", nombre: "Toro" },
  { codigo: "76828", nombre: "Trujillo" },
  { codigo: "76834", nombre: "Tulu\xE1" },
  { codigo: "76845", nombre: "Ulloa" },
  { codigo: "76863", nombre: "Versalles" },
  { codigo: "76869", nombre: "Vijes" },
  { codigo: "76890", nombre: "Yotoco" },
  { codigo: "76892", nombre: "Yumbo" },
  { codigo: "76895", nombre: "Zarzal" }
];
var ALIAS = {
  "SANTIAGO DE CALI": "76001",
  BUGA: "76111",
  "GUADALAJARA DE BUGA": "76111",
  "CALIMA EL DARIEN": "76126",
  "EL DARIEN": "76126",
  "ANSERMA NUEVO": "76041",
  AGUILA: "76243",
  "SAN PEDRO VALLE": "76670",
  // Registros de origen con la letra acentuada dañada ("�"): al normalizar, el "�" queda como espacio.
  "LA UNI N": "76400",
  "BOL VAR": "76100",
  "EL GUILA": "76243"
};
var POR_NOMBRE = new Map([
  ...MUNICIPIOS_VALLE.map((m) => [normalizarTexto(m.nombre), m.codigo]),
  ...Object.entries(ALIAS)
]);
var POR_CODIGO = new Map(MUNICIPIOS_VALLE.map((m) => [m.codigo, m]));
function sinSufijoValle(normalizado) {
  return normalizado.replace(/ VALLE DEL CAUCA$| VALLE$/, "");
}
function esDepartamentoValle(departamento) {
  if (departamento === null) return true;
  const d = normalizarTexto(departamento);
  return d === "" || d === "VALLE" || d === "VALLE DEL CAUCA";
}
function resolverMunicipio(ciudad, departamento) {
  if (ciudad === null || normalizarTexto(ciudad) === "") return { codigo: null, motivo: "vacio" };
  if (!esDepartamentoValle(departamento)) return { codigo: null, motivo: "otro_departamento" };
  const normalizado = normalizarTexto(ciudad);
  const codigo = POR_NOMBRE.get(normalizado) ?? POR_NOMBRE.get(sinSufijoValle(normalizado));
  if (codigo === void 0) return { codigo: null, motivo: "no_reconocido" };
  return { codigo, motivo: "ok" };
}

// src/formato/v1.ts
var COLUMNAS_V1 = [
  // asesorias.* (37)
  "id",
  "idbeneficiario",
  "idasesor",
  "creditusedasapproved",
  "creditUsageDescription",
  "idimprovements",
  "otherimprovement",
  "timetoresults",
  "resultsasexpected",
  "resultsExplanation",
  "evidenceFile",
  "financialRecords",
  "resourcemanager",
  "otherResourceManager",
  "paymentsonschedule",
  "paymentExplanation",
  "satisfaction",
  "needanothercredit",
  "creditINTendedUse",
  "monthlyIncome",
  "fixedCosts",
  "variableCosts",
  "debtLevel",
  "creditUsedPercentage",
  "monthlyPayment",
  "emergencyReserve",
  "monthlyClients",
  "monthlySales",
  "totalSalesValue",
  "currentemployees",
  "idsaleschannels",
  "othersaleschannel",
  "evidenceVisitFile",
  "estado",
  "observaciones",
  "created_at",
  "updated_at",
  // calculadas por la consulta (2)
  "es_duplicado",
  "asesor",
  // beneficiario (10)
  "documento",
  "benef_nombres",
  "benef_apellidos",
  "email",
  "celular",
  "departamento",
  "ciudad",
  "nombreempresa",
  "nit",
  "actividadeconomica",
  // agregadas (3)
  "proyectos",
  "mejoras_codigos",
  "canales_venta_codigos"
];
var NUM_COLUMNAS_V1 = COLUMNAS_V1.length;

// src/limpieza/fechas.ts
var PATRON = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;
var OFFSET_COLOMBIA_MS = -5 * 60 * 60 * 1e3;
function parseFechaUtc(texto) {
  const m = PATRON.exec(texto);
  if (m === null) return null;
  const [, y, mo, d, h, mi, s] = m.map(Number);
  const ms = Date.UTC(y, mo - 1, d, h, mi, s);
  const fecha = new Date(ms);
  if (fecha.getUTCFullYear() !== y || fecha.getUTCMonth() !== mo - 1 || fecha.getUTCDate() !== d || fecha.getUTCHours() !== h || fecha.getUTCMinutes() !== mi || fecha.getUTCSeconds() !== s) {
    return null;
  }
  return fecha.toISOString();
}

// src/limpieza/tsv.ts
function leerTsv(contenido) {
  const lineas = contenido.replace(/\r\n/g, "\n").split("\n");
  if (lineas.length > 0 && lineas[lineas.length - 1] === "") lineas.pop();
  const [cabecera, ...resto] = lineas;
  const encabezado = cabecera === void 0 ? [] : cabecera.split("	");
  const filas = resto.map(
    (linea) => linea.split("	").map((valor) => valor === "NULL" ? null : valor)
  );
  return { encabezado, filas };
}

// src/limpieza/validar.ts
var MAX_ERRORES = 30;
var RE_ENTERO = /^-?\d+$/;
var RE_DECIMAL = /^-?\d+(\.\d+)?$/;
function errorEncabezado(encabezado) {
  const esperado = new Set(COLUMNAS_V1);
  const recibido = new Set(encabezado);
  const faltan = COLUMNAS_V1.filter((c) => !recibido.has(c));
  const sobran = encabezado.filter((c) => !esperado.has(c));
  const errores = [];
  if (faltan.length > 0) errores.push(`Encabezado: faltan columnas: ${faltan.join(", ")}`);
  if (sobran.length > 0) errores.push(`Encabezado: sobran columnas: ${sobran.join(", ")}`);
  if (errores.length === 0) {
    const distinto = COLUMNAS_V1.findIndex((c, i) => encabezado[i] !== c);
    if (distinto !== -1) {
      errores.push(
        `Encabezado: el orden de las columnas no coincide con el formato v1 (primera diferencia en la columna ${distinto + 1}: se esperaba "${COLUMNAS_V1[distinto]}")`
      );
    }
  }
  return errores;
}
function validarTsvV1(contenido) {
  const { encabezado, filas } = leerTsv(contenido);
  if (encabezado.length === 0 || encabezado.length === 1 && encabezado[0] === "") {
    return { ok: false, errores: ["El archivo est\xE1 vac\xEDo"] };
  }
  const errHeader = errorEncabezado(encabezado);
  if (errHeader.length > 0) return { ok: false, errores: errHeader };
  const errores = [];
  let malas = 0;
  filas.forEach((fila, i) => {
    if (fila.length !== NUM_COLUMNAS_V1) {
      malas++;
      if (errores.length < MAX_ERRORES) {
        errores.push(`L\xEDnea ${i + 2}: tiene ${fila.length} columnas, se esperaban ${NUM_COLUMNAS_V1}`);
      }
    }
  });
  if (malas > MAX_ERRORES) errores.push(`\u2026 y ${malas - MAX_ERRORES} l\xEDneas m\xE1s con n\xFAmero de columnas incorrecto`);
  if (malas > 0) return { ok: false, errores };
  const indice = new Map(COLUMNAS_V1.map((c, i) => [c, i]));
  const validadas = [];
  let total = 0;
  const registrar = (linea, mensaje) => {
    total++;
    if (errores.length < MAX_ERRORES) errores.push(`L\xEDnea ${linea}: ${mensaje}`);
  };
  filas.forEach((fila, i) => {
    const linea = i + 2;
    let ok = true;
    const crudo = (col) => {
      const v = fila[indice.get(col) ?? -1];
      if (v === void 0 || v === null) return null;
      const limpio = desescaparMysql(v);
      return limpio.trim() === "" ? null : limpio;
    };
    const texto = (col) => {
      const v = crudo(col);
      return v === null ? null : v.trim();
    };
    const entero = (col, requerido = false) => {
      const v = texto(col);
      if (v === null) {
        if (requerido) {
          registrar(linea, `${col} es obligatorio`);
          ok = false;
        }
        return null;
      }
      if (!RE_ENTERO.test(v) || !Number.isSafeInteger(Number(v))) {
        registrar(linea, `${col} debe ser un entero (valor: "${v}")`);
        ok = false;
        return null;
      }
      return Number(v);
    };
    const decimal = (col) => {
      const v = texto(col);
      if (v === null) return null;
      if (!RE_DECIMAL.test(v)) {
        registrar(linea, `${col} debe ser un n\xFAmero (valor: "${v}")`);
        ok = false;
        return null;
      }
      return Number(v);
    };
    const fecha = (col, requerido = false) => {
      const v = texto(col);
      if (v === null) {
        if (requerido) {
          registrar(linea, `${col} es obligatorio`);
          ok = false;
        }
        return null;
      }
      const iso = parseFechaUtc(v);
      if (iso === null) {
        registrar(linea, `${col} no es una fecha v\xE1lida AAAA-MM-DD HH:MM:SS (valor: "${v}")`);
        ok = false;
      }
      return iso;
    };
    const id = entero("id", true);
    const beneficiarioId = entero("idbeneficiario", true);
    const creadaEn = fecha("created_at", true);
    const actualizadaEn = fecha("updated_at");
    const documento = texto("documento");
    if (documento === null) {
      registrar(linea, "la asesor\xEDa no tiene beneficiario (documento vac\xEDo)");
      ok = false;
    }
    const asesoria = {
      creditUsedAsApproved: texto("creditusedasapproved"),
      creditUsageDescription: crudo("creditUsageDescription"),
      otherImprovement: crudo("otherimprovement"),
      timeToResults: texto("timetoresults"),
      resultsAsExpected: texto("resultsasexpected"),
      resultsExplanation: crudo("resultsExplanation"),
      evidenceFile: texto("evidenceFile"),
      financialRecords: texto("financialRecords"),
      resourceManager: texto("resourcemanager"),
      otherResourceManager: crudo("otherResourceManager"),
      paymentsOnSchedule: texto("paymentsonschedule"),
      paymentExplanation: crudo("paymentExplanation"),
      satisfaction: texto("satisfaction"),
      needAnotherCredit: texto("needanothercredit"),
      creditIntendedUse: crudo("creditINTendedUse"),
      monthlyIncome: decimal("monthlyIncome"),
      fixedCosts: decimal("fixedCosts"),
      variableCosts: decimal("variableCosts"),
      debtLevel: decimal("debtLevel"),
      creditUsedPercentage: decimal("creditUsedPercentage"),
      monthlyPayment: decimal("monthlyPayment"),
      emergencyReserve: decimal("emergencyReserve"),
      monthlyClients: entero("monthlyClients"),
      monthlySales: entero("monthlySales"),
      totalSalesValue: decimal("totalSalesValue"),
      currentEmployees: texto("currentemployees"),
      otherSalesChannel: crudo("othersaleschannel"),
      evidenceVisitFile: texto("evidenceVisitFile"),
      estado: texto("estado"),
      observaciones: crudo("observaciones"),
      mejoras: separarCodigos(texto("mejoras_codigos")),
      canales: separarCodigos(texto("canales_venta_codigos"))
    };
    const proyectosTexto = texto("proyectos");
    const beneficiario = {
      nombres: texto("benef_nombres"),
      apellidos: texto("benef_apellidos"),
      email: texto("email"),
      celular: texto("celular"),
      departamento: texto("departamento"),
      ciudad: texto("ciudad"),
      nombreEmpresa: texto("nombreempresa"),
      nit: texto("nit"),
      actividadEconomica: texto("actividadeconomica"),
      proyectos: proyectosTexto === null ? [] : [...new Set(proyectosTexto.split("|").map((p) => p.trim()).filter((p) => p !== ""))]
    };
    if (ok && id !== null && beneficiarioId !== null && creadaEn !== null && documento !== null) {
      validadas.push({
        linea,
        asesoria: { id, beneficiarioId, creadaEn, actualizadaEn, ...asesoria },
        beneficiario: { id: beneficiarioId, documento, ...beneficiario }
      });
    }
  });
  if (total > 0) {
    if (total > MAX_ERRORES) errores.push(`\u2026 y ${total - MAX_ERRORES} errores m\xE1s`);
    return { ok: false, errores };
  }
  const vistos = /* @__PURE__ */ new Set();
  for (const f of validadas) {
    if (vistos.has(f.asesoria.id)) {
      return { ok: false, errores: [`L\xEDnea ${f.linea}: el id de asesor\xEDa ${f.asesoria.id} est\xE1 repetido`] };
    }
    vistos.add(f.asesoria.id);
  }
  return { ok: true, formato: "v1", filas: validadas };
}

// src/limpieza/limpiar.ts
var CAMPOS_CATEGORICOS = [
  ["satisfaction", "satisfaction"],
  ["resultsAsExpected", "resultsasexpected"],
  ["paymentsOnSchedule", "paymentsonschedule"],
  ["needAnotherCredit", "needanothercredit"],
  ["financialRecords", "financialRecords"],
  ["creditUsedAsApproved", "creditusedasapproved"],
  ["currentEmployees", "currentemployees"]
];
function limpiarTsv(contenido) {
  const validacion = validarTsvV1(contenido);
  if (!validacion.ok) return { ok: false, errores: validacion.errores };
  const advertencias = [];
  const beneficiariosMap = /* @__PURE__ */ new Map();
  for (const { linea, beneficiario } of validacion.filas) {
    const previo = beneficiariosMap.get(beneficiario.id);
    if (previo === void 0) {
      beneficiariosMap.set(beneficiario.id, beneficiario);
    } else if (previo.documento !== beneficiario.documento) {
      advertencias.push(
        `L\xEDnea ${linea}: el beneficiario ${beneficiario.id} aparece con otro documento; se conserva el de la primera aparici\xF3n`
      );
    }
  }
  const porDocumento = /* @__PURE__ */ new Map();
  for (const b of beneficiariosMap.values()) {
    const otro = porDocumento.get(b.documento);
    if (otro !== void 0 && otro !== b.id) {
      return {
        ok: false,
        errores: [`El documento ${b.documento} pertenece a dos beneficiarios distintos (${otro} y ${b.id})`]
      };
    }
    porDocumento.set(b.documento, b.id);
  }
  const sinReconocer = /* @__PURE__ */ new Map();
  const beneficiarios = [...beneficiariosMap.values()].sort((a, b) => a.id - b.id).map((b) => {
    const { codigo, motivo } = resolverMunicipio(b.ciudad, b.departamento);
    if (codigo === null && motivo !== "vacio") {
      const texto = (b.ciudad ?? "").trim();
      const entrada = sinReconocer.get(texto) ?? { motivo, ids: /* @__PURE__ */ new Set() };
      entrada.ids.add(b.id);
      sinReconocer.set(texto, entrada);
    }
    return {
      ...b,
      municipioCodigo: codigo,
      municipioOrigen: codigo === null ? "sin_ubicar" : "residencia"
    };
  });
  const decisiones = decidirDuplicados(
    validacion.filas.map(({ asesoria: a }) => ({
      id: a.id,
      beneficiarioId: a.beneficiarioId,
      creadaEn: a.creadaEn
    }))
  );
  const fuera = /* @__PURE__ */ new Map();
  let atipicos = 0;
  const asesorias = validacion.filas.map(({ asesoria }) => {
    const copia = { ...asesoria };
    for (const [campo, columna] of CAMPOS_CATEGORICOS) {
      const opciones = OPCIONES_PROVISIONALES[columna] ?? [];
      const r = normalizarCategoria(copia[campo], opciones);
      copia[campo] = r.valor;
      if (r.fueraDeCatalogo && r.valor !== null) {
        const clave = `${columna}\0${r.valor}`;
        fuera.set(clave, (fuera.get(clave) ?? 0) + 1);
      }
    }
    const decision = decisiones.get(copia.id);
    const atipica = esMontoAtipico(copia.monthlyIncome, copia.totalSalesValue);
    if (atipica) atipicos++;
    return {
      ...copia,
      conservada: decision?.conservada ?? true,
      motivoDescarte: decision?.motivoDescarte ?? null,
      atipica
    };
  }).sort((a, b) => a.id - b.id);
  const conservadas = asesorias.filter((a) => a.conservada);
  const resumen = {
    formato: "v1",
    filasLeidas: validacion.filas.length,
    asesoriasConservadas: conservadas.length,
    asesoriasDescartadas: asesorias.length - conservadas.length,
    beneficiariosDistintos: beneficiarios.length,
    beneficiariosConAsesoria: new Set(conservadas.map((a) => a.beneficiarioId)).size,
    municipiosSinReconocer: [...sinReconocer.entries()].map(([texto, v]) => ({ texto, motivo: v.motivo, beneficiarios: v.ids.size })).sort((a, b) => b.beneficiarios - a.beneficiarios || a.texto.localeCompare(b.texto)),
    valoresFueraDeCatalogo: [...fuera.entries()].map(([clave, filas]) => {
      const [campo = "", valor = ""] = clave.split("\0");
      return { campo, valor, filas };
    }).sort((a, b) => a.campo.localeCompare(b.campo) || b.filas - a.filas),
    montosAtipicos: atipicos,
    advertencias
  };
  const proyectos = [...new Set(beneficiarios.flatMap((b) => b.proyectos))].sort();
  return { ok: true, resultado: { resumen, proyectos, beneficiarios, asesorias } };
}

// src/limpieza/payload.ts
function construirPayloadDb(resultado, archivo) {
  const { resumen, proyectos, beneficiarios, asesorias } = resultado;
  return {
    carga: {
      archivo,
      formato: resumen.formato,
      filas_leidas: resumen.filasLeidas,
      asesorias_conservadas: resumen.asesoriasConservadas,
      asesorias_descartadas: resumen.asesoriasDescartadas,
      beneficiarios_distintos: resumen.beneficiariosDistintos
    },
    proyectos,
    beneficiarios: beneficiarios.map((b) => ({
      id: b.id,
      documento: b.documento,
      nombres: b.nombres,
      apellidos: b.apellidos,
      email: b.email,
      celular: b.celular,
      departamento: b.departamento,
      ciudad: b.ciudad,
      nombre_empresa: b.nombreEmpresa,
      nit: b.nit,
      actividad_economica: b.actividadEconomica,
      municipio_codigo: b.municipioCodigo,
      municipio_origen: b.municipioOrigen
    })),
    beneficiarios_proyecto: beneficiarios.flatMap(
      (b) => b.proyectos.map((proyecto) => ({ beneficiario_id: b.id, proyecto }))
    ),
    asesorias: asesorias.map((a) => ({
      id: a.id,
      beneficiario_id: a.beneficiarioId,
      credit_used_as_approved: a.creditUsedAsApproved,
      credit_usage_description: a.creditUsageDescription,
      other_improvement: a.otherImprovement,
      time_to_results: a.timeToResults,
      results_as_expected: a.resultsAsExpected,
      results_explanation: a.resultsExplanation,
      evidence_file: a.evidenceFile,
      financial_records: a.financialRecords,
      resource_manager: a.resourceManager,
      other_resource_manager: a.otherResourceManager,
      payments_on_schedule: a.paymentsOnSchedule,
      payment_explanation: a.paymentExplanation,
      satisfaction: a.satisfaction,
      need_another_credit: a.needAnotherCredit,
      credit_intended_use: a.creditIntendedUse,
      monthly_income: a.monthlyIncome,
      fixed_costs: a.fixedCosts,
      variable_costs: a.variableCosts,
      debt_level: a.debtLevel,
      credit_used_percentage: a.creditUsedPercentage,
      monthly_payment: a.monthlyPayment,
      emergency_reserve: a.emergencyReserve,
      monthly_clients: a.monthlyClients,
      monthly_sales: a.monthlySales,
      total_sales_value: a.totalSalesValue,
      current_employees: a.currentEmployees,
      other_sales_channel: a.otherSalesChannel,
      evidence_visit_file: a.evidenceVisitFile,
      estado: a.estado,
      observaciones: a.observaciones,
      creada_en: a.creadaEn,
      actualizada_en: a.actualizadaEn,
      conservada: a.conservada,
      motivo_descarte: a.motivoDescarte,
      atipica: a.atipica
    })),
    asesoria_mejoras: asesorias.flatMap(
      (a) => a.mejoras.map((codigo) => ({ asesoria_id: a.id, codigo }))
    ),
    asesoria_canales: asesorias.flatMap(
      (a) => a.canales.map((codigo) => ({ asesoria_id: a.id, codigo }))
    )
  };
}

// src/funciones/cargar-datos/manejador.ts
var MAX_BYTES = 25 * 1024 * 1024;
function cabeceras(entorno, req) {
  const h = { "Content-Type": "application/json" };
  const origen = req.headers.get("Origin");
  if (origen !== null && entorno.origenPermitido !== void 0 && origen === entorno.origenPermitido) {
    h["Access-Control-Allow-Origin"] = origen;
    h["Access-Control-Allow-Headers"] = "authorization, content-type, apikey";
    h["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    h["Vary"] = "Origin";
  }
  return h;
}
async function manejarCarga(req, deps) {
  const { entorno } = deps;
  const headers = cabeceras(entorno, req);
  const responder = (estado, cuerpo2) => new Response(JSON.stringify(cuerpo2), { status: estado, headers });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return responder(405, { ok: false, error: "M\xE9todo no permitido" });
  const autorizacion = req.headers.get("Authorization");
  if (autorizacion === null || !/^Bearer\s+\S+/i.test(autorizacion)) {
    return responder(401, { ok: false, error: "Falta la sesi\xF3n" });
  }
  let usuario;
  try {
    const r = await deps.fetch(`${entorno.supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: autorizacion, apikey: entorno.anonKey }
    });
    if (!r.ok) return responder(401, { ok: false, error: "Sesi\xF3n inv\xE1lida o vencida" });
    usuario = await r.json();
  } catch {
    return responder(502, { ok: false, error: "No se pudo verificar la sesi\xF3n" });
  }
  if (usuario.app_metadata?.rol !== "admin" || typeof usuario.id !== "string") {
    return responder(403, { ok: false, error: "Solo un administrador puede cargar datos" });
  }
  const largo = Number(req.headers.get("Content-Length") ?? "0");
  if (largo > MAX_BYTES) return responder(413, { ok: false, error: "El archivo es demasiado grande" });
  let cuerpo;
  try {
    cuerpo = await req.json();
  } catch {
    return responder(400, { ok: false, error: "El cuerpo debe ser JSON" });
  }
  if (typeof cuerpo.contenido !== "string" || cuerpo.contenido.length === 0) {
    return responder(400, { ok: false, error: "Falta el contenido del TSV" });
  }
  if (cuerpo.contenido.length > MAX_BYTES) {
    return responder(413, { ok: false, error: "El archivo es demasiado grande" });
  }
  const archivo = typeof cuerpo.archivo === "string" && cuerpo.archivo !== "" ? cuerpo.archivo.slice(0, 200) : "asesorias.tsv";
  const limpieza = limpiarTsv(cuerpo.contenido);
  if (!limpieza.ok) return responder(422, { ok: false, errores: limpieza.errores });
  const { resumen } = limpieza.resultado;
  if (cuerpo.confirmar !== true) {
    return responder(200, { ok: true, aplicado: false, resumen });
  }
  let cargaId;
  try {
    const payload = construirPayloadDb(limpieza.resultado, archivo);
    const r = await deps.fetch(`${entorno.supabaseUrl}/rest/v1/rpc/reemplazar_datos`, {
      method: "POST",
      headers: {
        apikey: entorno.serviceKey,
        Authorization: `Bearer ${entorno.serviceKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ p: payload, p_usuario: usuario.id })
    });
    if (!r.ok) {
      console.error("reemplazar_datos fall\xF3", r.status, await r.text());
      return responder(500, { ok: false, error: "La base de datos rechaz\xF3 la carga; no se cambi\xF3 nada" });
    }
    cargaId = Number(await r.json());
  } catch {
    return responder(502, { ok: false, error: "No se pudo completar la carga; no se cambi\xF3 nada" });
  }
  let dispatch = "omitido";
  if (entorno.githubToken !== void 0 && entorno.githubRepo !== void 0) {
    try {
      const r = await deps.fetch(`https://api.github.com/repos/${entorno.githubRepo}/dispatches`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${entorno.githubToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "fonder-cargar-datos",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ event_type: "datos-actualizados" })
      });
      dispatch = r.ok ? "enviado" : "fallo";
    } catch {
      dispatch = "fallo";
    }
  }
  return responder(200, { ok: true, aplicado: true, cargaId, resumen, dispatch });
}

// src/funciones/cargar-datos/entrada.ts
function leerEntorno() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) return null;
  return {
    supabaseUrl,
    anonKey,
    serviceKey,
    githubToken: Deno.env.get("GITHUB_DISPATCH_TOKEN") || void 0,
    githubRepo: Deno.env.get("GITHUB_REPO") || void 0,
    origenPermitido: Deno.env.get("ALLOWED_ORIGIN") || void 0
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
  return manejarCarga(req, { entorno, fetch: (...args) => fetch(...args) });
});
