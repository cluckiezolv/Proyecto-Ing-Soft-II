// src/domain/strategies/scoringCore.js

const HIST = { ninguno: 0, limitado: 1, bueno: 2, excelente: 3 };

const asNum = (v, fallback = 0) => {
  if (v === "" || v == null) return fallback;
  const normalized = typeof v === "string" ? v.replace(/,/g, "").trim() : v;
  const n = Number(normalized);
  return Number.isNaN(n) ? fallback : n;
};

function calcularDTI(ingresos, deudas) {
  const i = asNum(ingresos, 0);
  const d = asNum(deudas, 0);
  if (i <= 0) return 1;
  const dti = d / i;
  return Number.isFinite(dti) ? dti : 1;
}

/**
 * Lógica base (derivada de tu scoreProducto actual)
 */
export function scoreProductoBase(product, datos) {
  const r = product.requirements || {};
  const limits = product.limits || {};
  const weights = product.weights && product.weights.purpose ? product.weights.purpose : {};

  const edad = asNum(datos.edad, 0);
  const ingresos = asNum(datos.ingresos, 0);
  const deudas = asNum(datos.deudaMensual, 0);
  const antig = asNum(datos.antiguedad, 0);
  const monto = asNum(datos.monto, 0);
  const plazo = asNum(datos.plazo, 0);

  const edadOk = edad >= (r.age_min ?? 0) && edad <= (r.age_max ?? 200);

  const incomeMinByEmp =
    r.income_min_by_employment && typeof r.income_min_by_employment === "object"
      ? r.income_min_by_employment[datos.empleo]
      : null;

  const incomeMin = incomeMinByEmp ?? r.income_min ?? 0;
  const ingresoOk = ingresos >= incomeMin;

  const dti = calcularDTI(ingresos, deudas);
  const dtiOk = dti <= (r.dti_max ?? 1);

  const historialOk = (HIST[datos.historial] ?? 0) >= (r.history_min ?? 0);

  const allowed = Array.isArray(r.employment_allowed) ? r.employment_allowed : null;
  const empleoOk = !allowed || allowed.length === 0 || allowed.includes(datos.empleo);

  const disallowedSubtypes =
    r.employment_disallowed_subtype && typeof r.employment_disallowed_subtype === "object"
      ? r.employment_disallowed_subtype[datos.empleo]
      : null;

  const subtipoOk =
    !Array.isArray(disallowedSubtypes) || !disallowedSubtypes.includes(datos.subtipoEmpleo);

  const tenureMinByEmp =
    r.min_job_tenure_months_by_employment && typeof r.min_job_tenure_months_by_employment === "object"
      ? r.min_job_tenure_months_by_employment[datos.empleo]
      : null;

  const tenureMin = tenureMinByEmp ?? r.min_job_tenure_months ?? 0;
  const tenureOk = !tenureMin || antig >= tenureMin;

  const statesAllowed = Array.isArray(r.states_allowed) ? r.states_allowed : null;
  const estadoOk = !statesAllowed || statesAllowed.length === 0 || statesAllowed.includes(datos.estado);

  const purposeRequired = r.purpose_required ?? null;
  const propositoOk = !purposeRequired || datos.proposito === purposeRequired;

  if (!(edadOk && ingresoOk && historialOk && empleoOk && subtipoOk && tenureOk && estadoOk && propositoOk)) {
    return {
      elegible: false,
      score: 0,
      razones: [
        !edadOk && "Edad fuera del rango",
        !ingresoOk && `Ingresos por debajo del mínimo requerido`,
        !historialOk && "Historial crediticio insuficiente",
        !empleoOk && "Tipo de empleo no permitido",
        !subtipoOk && "Tipo de empleo (plataforma) no permitido",
        !tenureOk && `Antigüedad insuficiente`,
        !estadoOk && "Estado no elegible",
        !propositoOk && "El propósito no coincide con el producto",
      ].filter(Boolean),
    };
  }

  let score = 0;
  const razones = [];

  if (incomeMin > 0) {
    const ratio = ingresos / incomeMin;
    const incomeScore = Math.max(0, Math.min(10, Math.round(5 + (ratio - 1) * 5)));
    score += incomeScore;
    if (ratio >= 1.5) razones.push("Ingresos sólidos para el perfil");
  } else {
    score += 5;
  }

  const pesoProposito = weights[datos.proposito] ?? 0.5;
  score += 30 * pesoProposito;

  const dtiMax = r.dti_max ?? 1;
  const dtiScore = Math.max(0, 25 * (1 - dti / dtiMax));
  score += dtiScore;
  if (dti <= dtiMax * 0.7) razones.push("Buen manejo de deuda/ingresos");

  const histRatio = (HIST[datos.historial] ?? 0) / 3;
  score += 25 * histRatio;
  if (histRatio >= 0.66) razones.push("Historial crediticio sólido");

  const montoMax = limits.max_amount ?? Infinity;
  const montoScore =
    monto <= montoMax ? 10 : Math.max(0, 10 - ((monto - montoMax) / (montoMax * 0.5)) * 10);
  score += Number.isFinite(montoScore) ? montoScore : 0;

  if ((limits.max_term ?? 0) > 0) {
    const plazoScore =
      plazo <= limits.max_term
        ? 10
        : Math.max(0, 10 - ((plazo - limits.max_term) / limits.max_term) * 10);
    score += plazoScore;
  } else {
    score += 5;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return { elegible: dtiOk, score, razones: dtiOk ? razones : [...razones, "Relación deuda/ingreso alta"] };
}