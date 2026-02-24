// src/admin/AddProductModal.jsx
import { useState } from "react";
import { supabase } from "../lib/supabaseClient.js";

export default function AddProductModal({ onClose, onSaved, lenders = [] }) {
  const [form, setForm] = useState({
    lender_id: lenders[0]?.id || null,
    name: "",
    // ✅ Ajustado a types típicos (para evitar products_type_check)
    type: "personal", // personal | tarjeta | auto | hipotecario
    description: "",
    active: true,
    limits: { max_amount: null, max_term: null },
    requirements: {
      income_min: null,
      dti_max: 0.6,
      age_min: 18,
      age_max: 75,
      history_min: 1,
      employment_allowed: ["nomina", "independiente", "mixto"],
    },
    weights: { purpose: { consumo: 0.6, consolidacion: 0.7, auto: 0.5, vivienda: 0.4 } },
    meta: { rate_type: "Fija" },
    external_apply_url: "",
  });

  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const parseJSON = (raw, fallback) => {
    try {
      const v = JSON.parse(raw || "{}");
      setErr("");
      return v;
    } catch {
      setErr("Uno de los campos JSON no es válido.");
      return fallback;
    }
  };

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setErr("");

    if (!form.lender_id) {
      setErr("Selecciona un Lender.");
      setSaving(false);
      return;
    }
    if (!form.name.trim()) {
      setErr("El nombre del producto es obligatorio.");
      setSaving(false);
      return;
    }

    try {
      // ✅ Por si en algún momento llegan valores legacy:
      const TYPE_MAP = {
        personal_loan: "personal",
        credit_card: "tarjeta",
        auto_loan: "auto",
        mortgage: "hipotecario",
      };
      const normalizedType = TYPE_MAP[form.type] || form.type;

      const payload = {
        lender_id: form.lender_id,
        name: form.name.trim(),
        type: normalizedType,
        description: form.description || null,
        active: !!form.active,
        limits: form.limits || null,
        requirements: form.requirements || null,
        weights: form.weights || null,
        meta: form.meta || null,
        external_apply_url: form.external_apply_url || null,
      };

      const { error } = await supabase.from("products").insert(payload, { returning: "minimal" });
      if (error) throw error;

      onSaved?.();
      onClose?.();
    } catch (e2) {
      setErr(e2.message || "No se pudo guardar el producto");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
      {/* ✅ Modal con altura máxima y scroll interno */}
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow border border-slate-200 max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header fijo */}
        <div className="p-5 border-b">
          <h2 className="text-lg font-semibold text-[--zolv-primary]">Nuevo Producto</h2>
        </div>

        {/* Body scrolleable */}
        <div className="p-5 overflow-y-auto">
          <form onSubmit={onSubmit} className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="text-sm">Lender</label>
              <select
                className="mt-1 w-full border rounded-xl px-3 py-2"
                value={form.lender_id || ""}
                onChange={(e) => setForm((f) => ({ ...f, lender_id: e.target.value || null }))}
              >
                <option value="">— Selecciona —</option>
                {lenders.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm">Nombre del producto</label>
              <input
                className="mt-1 w-full border rounded-xl px-3 py-2"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>

            <div>
              <label className="text-sm">Tipo</label>
              <select
                className="mt-1 w-full border rounded-xl px-3 py-2"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              >
                <option value="personal">Crédito personal</option>
                <option value="tarjeta">Tarjeta de crédito</option>
                <option value="auto">Auto</option>
                <option value="hipotecario">Hipotecario</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="text-sm">Descripción</label>
              <textarea
                className="mt-1 w-full border rounded-xl px-3 py-2"
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-sm">Límites (JSON)</label>
              <textarea
                className="mt-1 w-full border rounded-xl px-3 py-2"
                rows={5}
                value={JSON.stringify(form.limits, null, 2)}
                onChange={(e) => setForm((f) => ({ ...f, limits: parseJSON(e.target.value, f.limits) }))}
              />
            </div>

            <div>
              <label className="text-sm">Requisitos (JSON)</label>
              <textarea
                className="mt-1 w-full border rounded-xl px-3 py-2"
                rows={5}
                value={JSON.stringify(form.requirements, null, 2)}
                onChange={(e) =>
                  setForm((f) => ({ ...f, requirements: parseJSON(e.target.value, f.requirements) }))
                }
              />
            </div>

            <div>
              <label className="text-sm">Pesos (JSON)</label>
              <textarea
                className="mt-1 w-full border rounded-xl px-3 py-2"
                rows={5}
                value={JSON.stringify(form.weights, null, 2)}
                onChange={(e) => setForm((f) => ({ ...f, weights: parseJSON(e.target.value, f.weights) }))}
              />
            </div>

            <div>
              <label className="text-sm">Meta (JSON)</label>
              <textarea
                className="mt-1 w-full border rounded-xl px-3 py-2"
                rows={5}
                value={JSON.stringify(form.meta, null, 2)}
                onChange={(e) => setForm((f) => ({ ...f, meta: parseJSON(e.target.value, f.meta) }))}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-sm">URL específica del producto (opcional)</label>
              <input
                className="mt-1 w-full border rounded-xl px-3 py-2"
                placeholder="https://socio.mx/landing-específica"
                value={form.external_apply_url}
                onChange={(e) => setForm((f) => ({ ...f, external_apply_url: e.target.value }))}
              />
              <p className="text-xs text-gray-500 mt-1">
                Si se llena, el CTA usará esta URL en lugar del referral del lender.
              </p>
            </div>

            <div className="flex items-center gap-2 sm:col-span-2">
              <input
                id="product-active"
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              />
              <label htmlFor="product-active" className="text-sm">
                Activo
              </label>
            </div>

            {err && <div className="text-sm text-red-600 sm:col-span-2">{err}</div>}

            {/* Espacio extra para que nunca quede tapado por el footer sticky */}
            <div className="h-2 sm:col-span-2" />
          </form>
        </div>

        {/* ✅ Footer sticky visible siempre */}
        <div className="p-5 border-t bg-white sticky bottom-0">
          <div className="flex justify-end gap-2">
            <button type="button" className="px-4 py-2 rounded-xl border" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={(e) => onSubmit(e)}
              className="px-4 py-2 rounded-xl bg-[--zolv-primary] text-white"
              disabled={saving}
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
