// src/ZolvApp.jsx
import React, { useMemo, useState } from "react";
import { useCatalog } from "./hooks/useCatalog";
import { supabase } from "./lib/supabaseClient.js";

// ===== Constantes y helpers =====
const HIST = { ninguno: 0, limitado: 1, bueno: 2, excelente: 3 };

// Convierte valores a número solo cuando se necesitan; permite "" en el estado
const asNum = (v, fallback = 0) => {
  if (v === "" || v == null) return fallback;
  const normalized = typeof v === "string" ? v.replace(/,/g, "").trim() : v;
  const n = Number(normalized);
  return Number.isNaN(n) ? fallback : n;
};

// Formato para inputs de moneda (comas, sin decimales)
function formatCurrencyInput(value) {
  if (value === "" || value == null) return "";
  const normalized = value.toString().replace(/[$,]/g, "").trim();
  if (normalized === "") return "";
  const num = Number(normalized);
  if (Number.isNaN(num)) return "";
  return `$${num.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`;
}

function parseCurrencyInput(value) {
  return value.toString().replace(/[$,]/g, "");
}

function calcularDTI(ingresos, deudas) {
  const i = asNum(ingresos, 0);
  const d = asNum(deudas, 0);
  if (i <= 0) return 1;
  const dti = d / i;
  return Number.isFinite(dti) ? dti : 1;
}

// Scoring con parsing seguro
function scoreProducto(p, datos) {
  const r = p.requirements || {};
  const limits = p.limits || {};
  const weights = p.weights && p.weights.purpose ? p.weights.purpose : {};

  const edad = asNum(datos.edad, 0);
  const ingresos = asNum(datos.ingresos, 0);
  const deudas = asNum(datos.deudaMensual, 0);
  const antig = asNum(datos.antiguedad, 0);
  const monto = asNum(datos.monto, 0);
  const plazo = asNum(datos.plazo, 0);

  // --- Reglas base ---
  const edadOk = edad >= (r.age_min ?? 0) && edad <= (r.age_max ?? 200);

  // ✅ Mínimo de ingreso por tipo de empleo (si existe)
  const incomeMinByEmp =
    r.income_min_by_employment && typeof r.income_min_by_employment === "object"
      ? r.income_min_by_employment[datos.empleo]
      : null;

  const incomeMin = incomeMinByEmp ?? r.income_min ?? 0;
  const ingresoOk = ingresos >= incomeMin;

  const dti = calcularDTI(ingresos, deudas);
  const dtiOk = dti <= (r.dti_max ?? 1);

  const historialOk = (HIST[datos.historial] ?? 0) >= (r.history_min ?? 0);

  // Empleo permitido (si viene configurado)
  const allowed = Array.isArray(r.employment_allowed) ? r.employment_allowed : null;
  const empleoOk = !allowed || allowed.length === 0 || allowed.includes(datos.empleo);

  // ✅ Subtipo de empleo (p.ej. nómina plataforma) bloqueado por producto
  const disallowedSubtypes =
    r.employment_disallowed_subtype && typeof r.employment_disallowed_subtype === "object"
      ? r.employment_disallowed_subtype[datos.empleo]
      : null;

  const subtipoOk =
    !Array.isArray(disallowedSubtypes) || !disallowedSubtypes.includes(datos.subtipoEmpleo);

  // ✅ Antigüedad por tipo de empleo (si existe); si no, usa min_job_tenure_months
  const tenureMinByEmp =
    r.min_job_tenure_months_by_employment && typeof r.min_job_tenure_months_by_employment === "object"
      ? r.min_job_tenure_months_by_employment[datos.empleo]
      : null;

  const tenureMin = tenureMinByEmp ?? r.min_job_tenure_months ?? 0;
  const tenureOk = !tenureMin || antig >= tenureMin;

  // ✅ Estados permitidos
  const statesAllowed = Array.isArray(r.states_allowed) ? r.states_allowed : null;
  const estadoOk = !statesAllowed || statesAllowed.length === 0 || statesAllowed.includes(datos.estado);

  // ✅ Propósito requerido (solo aplica cuando el producto lo exija)
  const purposeRequired = r.purpose_required ?? null;
  const propositoOk = !purposeRequired || datos.proposito === purposeRequired;

  // Elegibilidad (hard filters)
  if (!(edadOk && ingresoOk && historialOk && empleoOk && subtipoOk && tenureOk && estadoOk && propositoOk)) {
    return {
      elegible: false,
      score: 0,
      razones: [
        !edadOk && "Edad fuera del rango",
        !ingresoOk &&
          `Ingresos por debajo del mínimo requerido ($${Math.round(incomeMin).toLocaleString("es-MX")})`,
        !historialOk && "Historial crediticio insuficiente",
        !empleoOk && "Tipo de empleo no permitido",
        !subtipoOk && "Tipo de empleo (plataforma) no permitido",
        !tenureOk && `Antigüedad insuficiente (mínimo ${tenureMin} meses)`,
        !estadoOk && "Estado de residencia no elegible para este producto",
        !propositoOk && "El propósito no coincide con el producto",
      ].filter(Boolean),
    };
  }

  // --- Scoring ---
  let score = 0;
  const razones = [];

  // ✅ Score por ingresos vs mínimo requerido (alineado a incomeMin)
  if (incomeMin > 0) {
    const ratio = ingresos / incomeMin;
    const incomeScore = Math.max(0, Math.min(10, Math.round(5 + (ratio - 1) * 5)));
    score += incomeScore;
    if (ratio >= 1.5) razones.push("Ingresos sólidos para el perfil");
  } else {
    score += 5;
  }

  // Peso por propósito
  const pesoProposito = weights[datos.proposito] ?? 0.5;
  score += 30 * pesoProposito;

  // DTI
  const dtiMax = r.dti_max ?? 1;
  const dtiScore = Math.max(0, 25 * (1 - dti / dtiMax));
  score += dtiScore;
  if (dti <= dtiMax * 0.7) razones.push("Buen manejo de deuda/ingresos");

  // Historial
  const histRatio = (HIST[datos.historial] ?? 0) / 3;
  score += 25 * histRatio;
  if (histRatio >= 0.66) razones.push("Historial crediticio sólido");

  // Monto vs límite
  const montoMax = limits.max_amount ?? Infinity;
  const montoScore =
    monto <= montoMax ? 10 : Math.max(0, 10 - ((monto - montoMax) / (montoMax * 0.5)) * 10);
  score += Number.isFinite(montoScore) ? montoScore : 0;
  if (Number.isFinite(montoMax) && monto <= montoMax * 0.6) razones.push("Monto solicitado conservador");

  // Plazo vs límite
  if ((limits.max_term ?? 0) > 0) {
    const plazoScore =
      plazo <= limits.max_term
        ? 10
        : Math.max(0, 10 - ((plazo - limits.max_term) / limits.max_term) * 10);
    score += plazoScore;
  } else {
    score += 5; // tarjetas (sin plazo)
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return {
    elegible: dtiOk,
    score,
    razones: dtiOk ? razones : [...razones, "Relación deuda/ingreso alta"],
  };
}

// Normaliza tipo de producto contra lo que venga del catálogo
function isTipoMatch(p, tipo) {
  const k = (p.kind || p.type || p.category || p.meta?.category || "").toString().toLowerCase();
  if (!tipo) return true;
  if (tipo === "tarjeta") {
    return k.includes("card") || k.includes("tarjeta");
  }
  if (tipo === "personal") {
    return k.includes("loan") || k.includes("personal") || k.includes("consumo");
  }
  return true;
}

// ===== UI util =====
function Gauge({ value }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="w-full">
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div className="h-3 rounded-full transition-all bg-brand-gradient" style={{ width: `${pct}%` }} />
      </div>
      <div className="text-xs text-gray-600 mt-1">Probabilidad estimada: {pct}%</div>
    </div>
  );
}

function Card({ children, className = "" }) {
  return <div className={`rounded-2xl shadow p-5 bg-white border border-slate-200 ${className}`}>{children}</div>;
}

function Header() {
  return (
    <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2">
          <img
            src="/logo.svg"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = "/logo.png";
            }}
            alt="ZOLV"
            className="w-8 h-8 rounded-xl object-contain"
          />
          <span className="font-semibold text-brand">ZOLV</span>
        </a>
        <nav className="hidden md:flex gap-6 text-sm text-brand">
          <a href="#como-funciona" className="hover:underline">
            ¿Cómo funciona?
          </a>
          <a href="#cuestionario" className="hover:underline">
            Encuesta
          </a>
          <a href="#resultados" className="hover:underline">
            Resultados
          </a>
          <a href="#legal" className="hover:underline">
            Aviso
          </a>
        </nav>
      </div>
    </header>
  );
}

// ===== Tracking helpers =====
function getUTM() {
  const params = new URLSearchParams(window.location.search);
  const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
  const utm = {};
  keys.forEach((k) => {
    const v = params.get(k);
    if (v) utm[k] = v;
  });
  return Object.keys(utm).length ? utm : null;
}

function clientUUID() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const rr = (Math.random() * 16) | 0,
      v = c === "x" ? rr : (rr & 0x3) | 0x8;
    return v.toString(16);
  });
}
function buildReferralUrl(product, submissionId) {
  // 1) Prioridad: URL específica del producto
  const base =
    product?.external_apply_url ||
    product?.referral_url ||
    product?.lender?.referral_url ||
    "";

  if (!base) return "";

  // 2) Params del lender (si existen)
  const lenderParams = product?.lender?.referral_params && typeof product.lender.referral_params === "object"
    ? product.lender.referral_params
    : {};

  // 3) UTM del usuario (si entró con UTM)
  const utm = getUTM() || {};

  // 4) Construir URL con params
  const url = new URL(base, window.location.origin);

  // lender referral params
  Object.entries(lenderParams).forEach(([k, v]) => {
    if (v != null && String(v).trim() !== "") url.searchParams.set(k, String(v));
  });

  // utm del tráfico (si existen, no pisa los del lender si ya estaban)
  Object.entries(utm).forEach(([k, v]) => {
    if (!url.searchParams.has(k) && v != null && String(v).trim() !== "") {
      url.searchParams.set(k, String(v));
    }
  });

  // (opcional) tracking interno
  if (submissionId) url.searchParams.set("zolv_submission_id", submissionId);
  url.searchParams.set("zolv_product_id", product?.id || "");

  return url.toString();
}


async function saveSubmissionAndRecs(datos, recomendaciones) {
  const email = (datos.email ?? "").trim().toLowerCase();
  const telefono = (datos.telefono ?? "").trim();

  // NO mandes id en el upsert
  const payload = {
    answers: datos,
    email: datos.email ?? null,
    telefono: datos.telefono ?? null,
    consentimiento: typeof datos.consentimiento === "boolean" ? datos.consentimiento : null,
    fecha_registro: datos.fechaRegistro ?? null,
    origen: datos.origen ?? null,
    utm: getUTM(),
    user_agent: navigator.userAgent,
  };

  const { data, error: e1 } = await supabase
    .from("submissions")
    .upsert(payload, {
      onConflict: "email,telefono",
      ignoreDuplicates: false,
    })
    .select("id")
    .single();

  if (e1) throw e1;

  const realId = data.id;

  const { error: delErr } = await supabase
    .from("recommendations")
    .delete()
    .eq("submission_id", realId);

  if (delErr) throw delErr;

  const rows = recomendaciones.map(({ p, r }, idx) => ({
    submission_id: realId,
    product_id: p.id,
    rank: idx + 1,
    score: r.score,
  }));

  const { error: e2 } = await supabase
    .from("recommendations")
    .insert(rows, { returning: "minimal" });

  if (e2) throw e2;

  return realId;
}


// ===== Página principal =====
export default function ZolvApp() {
  const { loading, products, error } = useCatalog();

  // Estado inicial: tipo vacío => se muestra primero el selector
  const [datos, setDatos] = useState({
    tipo: "", // "", "personal" o "tarjeta"
    edad: "",
    ingresos: "",
    deudaMensual: "",
    historial: "limitado",
    empleo: "nomina", // nomina | independiente | mixto | informal
    subtipoEmpleo: "tradicional", // tradicional | plataforma (solo visible si empleo=nomina)
    antiguedad: "",
    estado: "",
    proposito: "consumo",
    monto: "",
    plazo: "",
    // Solo para flujo de tarjetas (no depende de banco)
    tipoTarjeta: "basica", // basica | gold | platinum | premium

    // Datos de contacto (para seguimiento comercial)
    email: "",
    telefono: "",
    consentimiento: false,
  });

  const [resultados, setResultados] = useState([]);
  const [lastSubmissionId, setLastSubmissionId] = useState(null);

  const tipoElegido = !!datos.tipo;

  const recomendaciones = useMemo(() => {
    if (loading || error || !tipoElegido) return [];
    return (products || [])
      .filter((p) => isTipoMatch(p, datos.tipo))
      .map((p) => ({ p, r: scoreProducto(p, datos) }))
      .filter(({ r }) => r.elegible)
      .sort((a, b) => b.r.score - a.r.score);
  }, [products, datos, loading, error, tipoElegido]);

  async function onSubmit(e) {
    e.preventDefault();

    if (!tipoElegido) {
      alert("Selecciona si buscas crédito personal o tarjeta de crédito.");
      return;
    }
    if (datos.edad === "" || datos.ingresos === "") {
      alert("Completa al menos Edad e Ingresos para calcular correctamente.");
      return;
    }

    // ===== VALIDACIONES DE CONTACTO =====
    const email = (datos.email || "").trim().toLowerCase();
    const tel = (datos.telefono || "").replace(/\D+/g, ""); // solo dígitos

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const telOk = /^\d{10}$/.test(tel);

    if (!emailOk) {
      alert("Ingresa un correo válido.");
      return;
    }

    if (!telOk) {
      alert("El teléfono debe tener 10 dígitos (solo números).");
      return;
    }

    if (!datos.consentimiento) {
      alert("Debes aceptar el consentimiento para poder continuar.");
      return;
    }

    const datosParaGuardar = {
      ...datos,
      email,
      telefono: tel,
      fechaRegistro: new Date().toISOString(),
      origen: "encuesta_zolv",
    };

    setResultados(recomendaciones);

    try {
      const subId = await saveSubmissionAndRecs(datosParaGuardar, recomendaciones);
      setLastSubmissionId(subId);

      // Limpia solo los datos de contacto (para no borrar el resto si quieres seguir mostrando resultados)
      setDatos((d) => ({
        ...d,
        email: "",
        telefono: "",
        consentimiento: false,
      }));
    } catch (err) {
      console.error("No se pudo guardar la encuesta:", err);
      alert(`No se pudo guardar. Revisa consola. Error: ${err?.message || "desconocido"}`);
    }


    document.getElementById("resultados")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="min-h-screen bg-gray-50 text-zinc-900">
      <Header />

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-10">
        {/* Hero */}
        <section className="grid md:grid-cols-2 gap-6 items-center">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold leading-tight text-brand">
              Encuentra el crédito con <span className="text-accent">mayor probabilidad de aprobación</span>
            </h1>
            <p className="mt-3 text-gray-700">
              Responde una encuesta corta y te mostraremos opciones ajustadas a tu perfil. Hecho para México 🇲🇽.
            </p>
            <a href="#cuestionario" className="inline-flex mt-5 px-4 py-2 rounded-xl font-medium bg-brand text-white">
              Comenzar
            </a>
          </div>

          <Card className="md:translate-y-2">
            <h3 className="font-semibold mb-2 text-brand">Vista previa de recomendación</h3>
            {!tipoElegido ? (
              <p className="text-sm text-gray-600">
                Elige primero si buscas <strong>crédito personal</strong> o <strong>tarjeta de crédito</strong> en la
                sección de Encuesta.
              </p>
            ) : loading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-gray-200 rounded w-2/3" />
                <div className="h-3 bg-gray-200 rounded w-1/3" />
                <div className="h-3 bg-gray-200 rounded w-full" />
              </div>
            ) : recomendaciones[0] ? (
              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{recomendaciones[0].p.name}</div>
                    <div className="text-xs text-gray-600">
                      {recomendaciones[0].p.lender?.name || "Institución"} •{" "}
                      {recomendaciones[0].p.meta?.rate_type || "Tasa N/D"}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">Top 1</div>
                </div>
                <p className="mt-2 text-sm">{recomendaciones[0].p.description}</p>
                <div className="mt-3">
                  <Gauge value={recomendaciones[0].r.score} />
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-600">Completa la encuesta para ver recomendaciones.</p>
            )}
          </Card>
        </section>

        {/* Cómo funciona */}
        <section id="como-funciona" className="scroll-mt-24 grid md:grid-cols-3 gap-4">
          <Card>
            <div className="text-xs uppercase tracking-wide text-gray-500">Paso 1</div>
            <h3 className="font-semibold text-brand">Elige qué buscas</h3>
            <p className="text-sm mt-2">Crédito personal o tarjeta de crédito.</p>
          </Card>
          <Card>
            <div className="text-xs uppercase tracking-wide text-gray-500">Paso 2</div>
            <h3 className="font-semibold text-brand">Cuéntanos de ti</h3>
            <p className="text-sm mt-2">Edad, ingresos, deudas y propósito del crédito.</p>
          </Card>
          <Card>
            <div className="text-xs uppercase tracking-wide text-gray-500">Paso 3</div>
            <h3 className="font-semibold text-brand">Te recomendamos opciones</h3>
            <p className="text-sm mt-2">Verás por qué podrías ser aprobado y next steps.</p>
          </Card>
        </section>

        {/* Encuesta */}
        <section id="cuestionario" className="scroll-mt-24 grid md:grid-cols-3 gap-6 items-start">
          <div className="md:col-span-2">
            <Card>
              <h2 className="text-xl font-bold mb-4 text-brand">Encuesta</h2>

              {/* Paso 0: Selector grande de tipo */}
              {!tipoElegido && (
                <div className="sm:col-span-2">
                  <p className="text-sm text-gray-700 mb-3">¿Qué estás buscando?</p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setDatos((d) => ({
                          ...d,
                          tipo: "personal",
                          proposito: d.proposito || "consumo",
                        }))
                      }
                      className="w-full px-4 py-4 rounded-2xl border border-slate-300 bg-white hover:bg-slate-50 text-left shadow-sm"
                    >
                      <div className="text-lg font-semibold text-brand">Crédito personal</div>
                      <div className="text-sm text-gray-600">
                        Efectivo para gastos, consolidación, auto, vivienda, etc.
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDatos((d) => ({
                          ...d,
                          tipo: "tarjeta",
                          proposito: "consumo",
                          plazo: "",
                          tipoTarjeta: d.tipoTarjeta || "basica",
                        }))
                      }
                      className="w-full px-4 py-4 rounded-2xl border border-slate-300 bg-white hover:bg-slate-50 text-left shadow-sm"
                    >
                      <div className="text-lg font-semibold text-brand">Tarjeta de crédito</div>
                      <div className="text-sm text-gray-600">Línea revolvente; beneficios, meses sin intereses, etc.</div>
                    </button>
                  </div>
                </div>
              )}

              {/* Formulario: visible solo tras elegir tipo */}
              {tipoElegido && (
                <form onSubmit={onSubmit} className="grid sm:grid-cols-2 gap-4 mt-4">
                  <div className="sm:col-span-2">
                    <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-brand/10 text-brand text-sm">
                      Seleccionaste: <strong>{datos.tipo === "tarjeta" ? "Tarjeta de crédito" : "Crédito personal"}</strong>
                      <button
                        type="button"
                        className="ml-2 px-2 py-1 rounded border border-brand text-brand text-xs hover:bg-brand/10"
                        onClick={() => setDatos((d) => ({ ...d, tipo: "" }))}
                      >
                        Cambiar
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm">Edad</label>
                    <input
                      type="number"
                      placeholder="28"
                      className="mt-1 w-full border rounded-xl px-3 py-2"
                      value={datos.edad ?? ""}
                      onChange={(e) => setDatos((d) => ({ ...d, edad: e.target.value }))}
                      min={18}
                      max={90}
                    />
                  </div>

                  <div>
                    <label className="text-sm flex items-center gap-1">
                      Ingresos mensuales (MXN)
                      <span
                        title="Ingresos netos, son los ingresos que recibes en tus cuentas despues de haber pagado impuestos."
                        className="cursor-pointer text-yellow-600 font-bold"
                      >
                        !
                      </span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="15000"
                      className="mt-1 w-full border rounded-xl px-3 py-2"
                      value={formatCurrencyInput(datos.ingresos)}
                      onChange={(e) =>
                        setDatos((d) => ({
                          ...d,
                          ingresos: parseCurrencyInput(e.target.value),
                        }))
                      }
                    />
                  </div>

                  <div>
                    <label className="text-sm">Pago total mensual de deudas (MXN)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="2000"
                      className="mt-1 w-full border rounded-xl px-3 py-2"
                      value={formatCurrencyInput(datos.deudaMensual)}
                      onChange={(e) =>
                        setDatos((d) => ({
                          ...d,
                          deudaMensual: parseCurrencyInput(e.target.value),
                        }))
                      }
                    />
                  </div>

                  <div>
                    <label className="text-sm">Historial crediticio</label>
                    <select
                      className="mt-1 w-full border rounded-xl px-3 py-2"
                      value={datos.historial}
                      onChange={(e) => setDatos((d) => ({ ...d, historial: e.target.value }))}
                    >
                      <option value="ninguno">Ninguno</option>
                      <option value="limitado">Limitado</option>
                      <option value="bueno">Bueno</option>
                      <option value="excelente">Excelente</option>
                    </select>
                  </div>

                  {/* ✅ BLOQUE MODIFICADO: Empleo + Subtipo (solo si eligen Nómina) */}
                  <div>
                    <label className="text-sm">Tipo de empleo</label>
                    <select
                      className="mt-1 w-full border rounded-xl px-3 py-2"
                      value={datos.empleo}
                      onChange={(e) => {
                        const empleo = e.target.value;
                        setDatos((d) => ({
                          ...d,
                          empleo,
                          // ✅ solo se usa para Nómina; en otros casos lo reseteamos
                          subtipoEmpleo: empleo === "nomina" ? (d.subtipoEmpleo || "tradicional") : "tradicional",
                        }));
                      }}
                    >
                      <option value="nomina">Nómina</option>
                      <option value="independiente">Independiente</option>
                      <option value="mixto">Mixto</option>
                      <option value="informal">Informal</option>
                    </select>

                    {/* ✅ Solo aparece si eligen Nómina */}
                    {datos.empleo === "nomina" && (
                      <div className="mt-3">
                        <label className="text-sm">¿Trabajas en plataforma de reparto/movilidad?</label>
                        <select
                          className="mt-1 w-full border rounded-xl px-3 py-2"
                          value={datos.subtipoEmpleo ?? "tradicional"}
                          onChange={(e) => setDatos((d) => ({ ...d, subtipoEmpleo: e.target.value }))}
                          required
                        >
                          <option value="tradicional">No (empleo en empresa / nómina tradicional)</option>
                          <option value="plataforma">Sí (Uber, Didi, Rappi, etc.)</option>
                        </select>

                        <p className="text-xs text-gray-500 mt-1">Algunos productos no aceptan plataformas.</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-sm">Estado de residencia</label>
                    <select
                      className="mt-1 w-full border rounded-xl px-3 py-2"
                      value={datos.estado ?? ""}
                      onChange={(e) => setDatos((d) => ({ ...d, estado: e.target.value }))}
                      required
                    >
                      <option value="">Selecciona un estado</option>
                      <option value="Aguascalientes">Aguascalientes</option>
                      <option value="Baja California">Baja California</option>
                      <option value="Baja California Sur">Baja California Sur</option>
                      <option value="Campeche">Campeche</option>
                      <option value="Chiapas">Chiapas</option>
                      <option value="Chihuahua">Chihuahua</option>
                      <option value="CDMX">Ciudad de México</option>
                      <option value="Coahuila">Coahuila</option>
                      <option value="Colima">Colima</option>
                      <option value="Durango">Durango</option>
                      <option value="Estado de México">Estado de México</option>
                      <option value="Guanajuato">Guanajuato</option>
                      <option value="Guerrero">Guerrero</option>
                      <option value="Hidalgo">Hidalgo</option>
                      <option value="Jalisco">Jalisco</option>
                      <option value="Michoacán">Michoacán</option>
                      <option value="Morelos">Morelos</option>
                      <option value="Nayarit">Nayarit</option>
                      <option value="Nuevo León">Nuevo León</option>
                      <option value="Oaxaca">Oaxaca</option>
                      <option value="Puebla">Puebla</option>
                      <option value="Querétaro">Querétaro</option>
                      <option value="Quintana Roo">Quintana Roo</option>
                      <option value="San Luis Potosí">San Luis Potosí</option>
                      <option value="Sinaloa">Sinaloa</option>
                      <option value="Sonora">Sonora</option>
                      <option value="Tabasco">Tabasco</option>
                      <option value="Tamaulipas">Tamaulipas</option>
                      <option value="Tlaxcala">Tlaxcala</option>
                      <option value="Veracruz">Veracruz</option>
                      <option value="Yucatán">Yucatán</option>
                      <option value="Zacatecas">Zacatecas</option>

                    </select>
                  </div>

                  <div>
                    <label className="text-sm">Antigüedad en el empleo (meses)</label>
                    <input
                      type="number"
                      placeholder="12"
                      className="mt-1 w-full border rounded-xl px-3 py-2"
                      value={datos.antiguedad ?? ""}
                      onChange={(e) => setDatos((d) => ({ ...d, antiguedad: e.target.value }))}
                    />
                  </div>

                  {datos.tipo !== "tarjeta" ? (
                    <div>
                      <label className="text-sm">Propósito del crédito</label>
                      <select
                        className="mt-1 w-full border rounded-xl px-3 py-2"
                        value={datos.proposito}
                        onChange={(e) => setDatos((d) => ({ ...d, proposito: e.target.value }))}
                      >
                        <option value="consumo">Gastos/consumo</option>
                        <option value="consolidacion">Consolidar deudas</option>
                      
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="text-sm">Tipo de tarjeta</label>
                      <select
                        className="mt-1 w-full border rounded-xl px-3 py-2"
                        value={datos.tipoTarjeta}
                        onChange={(e) => setDatos((d) => ({ ...d, tipoTarjeta: e.target.value }))}
                      >
                        <option value="basica">Básica</option>
                        <option value="gold">Gold</option>
                        <option value="platinum">Platinum</option>
                        <option value="premium">Premium</option>
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="text-sm">Monto a solicitar (MXN)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="50000"
                      className="mt-1 w-full border rounded-xl px-3 py-2"
                      value={formatCurrencyInput(datos.monto)}
                      onChange={(e) =>
                        setDatos((d) => ({
                          ...d,
                          monto: parseCurrencyInput(e.target.value),
                        }))
                      }
                    />
                  </div>

                  {/* Oculta Plazo para tarjetas si lo prefieres */}
                  {datos.tipo !== "tarjeta" && (
                    <div>
                      <label className="text-sm">Plazo deseado (meses)</label>
                      <input
                        type="number"
                        placeholder="24"
                        className="mt-1 w-full border rounded-xl px-3 py-2"
                        value={datos.plazo ?? ""}
                        onChange={(e) => setDatos((d) => ({ ...d, plazo: e.target.value }))}
                        step={6}
                      />
                    </div>
                  )}

                  {/* Datos de contacto (lead) */}
                  <div className="sm:col-span-2">
                    <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-4">
                      <h4 className="font-semibold text-brand">Datos de contacto</h4>
                      <p className="text-xs text-gray-600 mt-1">
                        Los usaremos únicamente para contactarte sobre opciones relacionadas con tu solicitud.
                      </p>

                      <div className="grid sm:grid-cols-2 gap-4 mt-3">
                        <div>
                          <label className="text-sm">Correo electrónico*</label>
                          <input
                            type="email"
                            name="email"
                            placeholder="ejemplo@correo.com"
                            className="mt-1 w-full border rounded-xl px-3 py-2"
                            value={datos.email ?? ""}
                            onChange={(e) => setDatos((d) => ({ ...d, email: e.target.value }))}
                            required
                          />
                        </div>

                        <div>
                          <label className="text-sm">Teléfono celular (10 dígitos)*</label>
                          <input
                            type="tel"
                            name="telefono"
                            placeholder="5512345678"
                            inputMode="numeric"
                            className="mt-1 w-full border rounded-xl px-3 py-2"
                            value={datos.telefono ?? ""}
                            onChange={(e) => setDatos((d) => ({ ...d, telefono: e.target.value }))}
                            required
                          />
                        </div>
                      </div>

                      <label className="mt-3 flex items-start gap-2 text-xs text-gray-700">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={!!datos.consentimiento}
                          onChange={(e) => setDatos((d) => ({ ...d, consentimiento: e.target.checked }))}
                          required
                        />
                        <span>
                          Acepto que ZOLV trate mis datos personales para contactarme con fines informativos y comerciales,
                          conforme a su{" "}
                          <a href="/aviso-privacidad" target="_blank" rel="noopener noreferrer" className="underline">
                            Aviso de Privacidad
                          </a>
                          .
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="sm:col-span-2 flex items-center gap-3 mt-2">
                    <button
                      id="enviar-encuesta"
                      data-testid="enviar-encuesta"
                      type="submit"
                      className="px-4 py-3 rounded-xl font-medium bg-brand text-white w-full sm:w-auto border border-black/10 shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                      style={{ minWidth: 220 }}
                    >
                      Enviar encuesta
                    </button>
                    <span className="text-xs text-gray-600 hidden sm:inline">
                      Al continuar, aceptas nuestro aviso de privacidad.
                    </span>
                  </div>
                </form>
              )}
            </Card>
          </div>

          <div className="md:col-span-1">
            <Card>
              <h3 className="font-semibold text-brand">Tips rápidos</h3>
              <ul className="mt-2 text-sm list-disc pl-4 space-y-1">
                <li>Mantén tu deuda/ingreso por debajo de 40%.</li>
                <li>Antigüedad laboral ≥ 6 meses ayuda.</li>
                <li>Solicita montos acordes a tus ingresos.</li>
              </ul>
            </Card>
          </div>
        </section>

        {/* Resultados */}
        <section id="resultados" className="scroll-mt-24 space-y-4">
          <h2 className="text-xl font-bold text-brand">Resultados</h2>
          {error && <p className="text-sm text-red-600">Error cargando catálogo: {error.message}</p>}
          {loading ? (
            <div className="grid md:grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <Card key={i}>
                  <div className="animate-pulse space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-2/3" />
                    <div className="h-3 bg-gray-200 rounded w-1/3" />
                    <div className="h-3 bg-gray-200 rounded w-full" />
                  </div>
                </Card>
              ))}
            </div>
          ) : resultados.length === 0 ? (
            <p className="text-sm text-gray-600">
              {tipoElegido
                ? "Completa y envía la encuesta para ver recomendaciones personalizadas."
                : "Elige primero si buscas crédito personal o tarjeta de crédito."}
            </p>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {resultados.map(({ p, r }, idx) => (
                <Card key={p.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-xs text-gray-600">
                        {p.lender?.name || "Institución"} • {p.meta?.rate_type || "Tasa N/D"}
                      </div>
                    </div>
                    <div className="text-xs rounded-full px-2 py-1 bg-accent text-white">#{idx + 1}</div>
                  </div>

                  <p className="mt-2 text-sm">{p.description}</p>

                  <div className="mt-3">
                    <Gauge value={r.score} />
                  </div>

                  {r.razones.length > 0 && (
                    <ul className="mt-3 text-sm text-gray-700 list-disc pl-5 space-y-1">
                      {r.razones.map((z, i) => (
                        <li key={i}>{z}</li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {"max_amount" in (p.limits || {}) && (
                      <span className="text-xs rounded-full px-2 py-1 bg-brand/10 text-brand">
                        Monto máx: ${Number(p.limits.max_amount).toLocaleString()}
                      </span>
                    )}
                    {"max_term" in (p.limits || {}) && (
                      <span className="text-xs rounded-full px-2 py-1 bg-brand/10 text-brand">
                        Plazo máx: {p.limits.max_term}m
                      </span>
                    )}

                    {(() => {
                      const rr = p.requirements || {};
                      const incomeMinByEmp2 =
                        rr.income_min_by_employment && typeof rr.income_min_by_employment === "object"
                          ? rr.income_min_by_employment[datos.empleo]
                          : null;
                      const incomeMin2 = incomeMinByEmp2 ?? rr.income_min;
                      if (!incomeMin2) return null;

                      return (
                        <span className="text-xs rounded-full px-2 py-1 bg-brand/10 text-brand">
                          Ingreso mínimo requerido: ${Number(incomeMin2).toLocaleString("es-MX")}
                        </span>
                      );
                    })()}

                    {/*"dti_max" in (p.requirements || {}) && (
                      <span className="text-xs rounded-full px-2 py-1 bg-brand/10 text-brand">
                        DTI máx: {(p.requirements.dti_max * 100).toFixed(0)}%
                      </span>
                    )*/}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button className="px-3 py-2 rounded-xl border border-slate-300 text-slate-700">Detalles</button>
                    <button
                      className="px-3 py-2 rounded-xl bg-brand text-white"
                      onClick={async () => {
                        const url = buildReferralUrl(p, lastSubmissionId);

                        // Si no hay URL configurada, avisamos.
                        if (!url) {
                          alert("Este producto no tiene URL de referido configurada.");
                          return;
                        }

                        // Log best-effort
                        try {
                          await supabase
                            .from("click_events")
                            .insert(
                              {
                                submission_id: lastSubmissionId,
                                product_id: p.id,
                                context: { button: "cta", page: window.location.pathname, url }
                              },
                              { returning: "minimal" }
                            );
                        } catch (err) {
                          console.error("No se pudo registrar el clic:", err.message);
                        }

                        // ✅ Navegación (abre en nueva pestaña)
                        window.open(url, "_blank", "noopener,noreferrer");
                      }}
                    >
                      Iniciar solicitud
                    </button>

                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Legal */}
        <section id="legal" className="scroll-mt-24 pt-4">
          <Card>
            <h3 className="font-semibold text-brand">Transparencia</h3>
            <p className="text-sm text-gray-700 mt-2">
              Consulta nuestro <a href="/aviso-privacidad" className="underline">Aviso de Privacidad</a>, los{" "}
              <a href="/terminos" className="underline">Términos y Condiciones</a> y la{" "}
              <a href="/cookies" className="underline">Política de Cookies</a>. ZOLV no otorga créditos ni garantiza
              aprobaciones; verifica siempre CAT, comisiones y condiciones con la institución financiera correspondiente.
            </p>
          </Card>
        </section>
      </main>

      <footer className="border-t mt-6">
        <div className="max-w-5xl mx-auto px-4 py-6 text-sm flex flex-col md:flex-row gap-2 md:items-center md:justify-between text-brand">
          <div>© {new Date().getFullYear()} ZOLV. Todos los derechos reservados.</div>
          <div className="flex flex-wrap gap-4">
            <a href="/aviso-privacidad" className="hover:underline">Aviso de Privacidad</a>
            <a href="/terminos" className="hover:underline">Términos y Condiciones</a>
            <a href="/cookies" className="hover:underline">Política de Cookies</a>
          </div>
        </div>

        <div className="bg-white/70">
          <div className="max-w-5xl mx-auto px-4 pb-6 text-xs text-gray-600 leading-relaxed">
            ZOLV es un comparador informativo y no otorga créditos ni garantiza aprobaciones. Las recomendaciones se
            generan con base en reglas y criterios generales y pueden diferir de las políticas de cada institución.
            Antes de contratar, revisa cuidadosamente el CAT, comisiones, plazos, requisitos y condiciones con la
            institución financiera elegida. Para orientación adicional en México, consulta la CONDUSEF.
          </div>
        </div>
      </footer>
    </div>
  );
}
