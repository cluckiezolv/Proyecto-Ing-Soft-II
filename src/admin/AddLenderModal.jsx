// src/admin/AddLenderModal.jsx
import { useState } from "react";
import { supabase } from "../lib/supabaseClient.js";

export default function AddLenderModal({ onClose, onSaved }) {
  const [form, setForm] = useState({
    name: "",
    website: "",
    brand_color: "#007b89",
    active: true,
    referral_url: "",
    referral_params: { utm_source: "zolv", utm_campaign: "home" },
  });
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setErr("");

    try {
      const payload = {
        name: form.name,
        website: form.website || null,
        brand_color: form.brand_color || null,
        active: !!form.active,
        referral_url: form.referral_url || null,
        referral_params: form.referral_params || null,
      };

      const { error } = await supabase.from("lenders").insert(payload, { returning: "minimal" });
      if (error) throw error;

      onSaved?.();
      onClose?.();
    } catch (e) {
      setErr(e.message || "No se pudo guardar el lender");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow">
        <h2 className="text-lg font-semibold text-[--zolv-primary]">Nuevo Lender</h2>

        <form onSubmit={onSubmit} className="mt-4 grid gap-3">
          <div>
            <label className="text-sm">Nombre</label>
            <input className="mt-1 w-full border rounded-xl px-3 py-2"
              value={form.name}
              onChange={(e)=>setForm(f=>({...f, name: e.target.value}))}
              required />
          </div>

          <div>
            <label className="text-sm">Website</label>
            <input className="mt-1 w-full border rounded-xl px-3 py-2"
              value={form.website}
              onChange={(e)=>setForm(f=>({...f, website: e.target.value}))} />
          </div>

          <div>
            <label className="text-sm">Color de marca</label>
            <input type="color" className="mt-1 h-10 w-16 border rounded"
              value={form.brand_color}
              onChange={(e)=>setForm(f=>({...f, brand_color: e.target.value}))} />
          </div>

          <div className="flex items-center gap-2">
            <input id="lender-active" type="checkbox"
              checked={form.active}
              onChange={(e)=>setForm(f=>({...f, active: e.target.checked}))} />
            <label htmlFor="lender-active" className="text-sm">Activo</label>
          </div>

          {/* REFERIDOS */}
          <div>
            <label className="text-sm">Referral URL</label>
            <input className="mt-1 w-full border rounded-xl px-3 py-2"
              placeholder="https://socio.mx/apply"
              value={form.referral_url}
              onChange={(e)=>setForm(f=>({...f, referral_url: e.target.value}))} />
            <p className="text-xs text-gray-500 mt-1">Si el lender tiene landing general de referido, colócala aquí.</p>
          </div>

          <div>
            <label className="text-sm">Referral params (JSON)</label>
            <textarea className="mt-1 w-full border rounded-xl px-3 py-2" rows={3}
              value={JSON.stringify(form.referral_params, null, 2)}
              onChange={(e)=>{
                try {
                  const json = JSON.parse(e.target.value || "{}");
                  setForm(f=>({...f, referral_params: json}));
                  setErr("");
                } catch {
                  setErr("El JSON de parámetros no es válido");
                }
              }} />
            <p className="text-xs text-gray-500 mt-1">Ejemplo: {"{ \"utm_source\": \"zolv\", \"utm_campaign\": \"home\" }"}</p>
          </div>

          {err && <div className="text-sm text-red-600">{err}</div>}

          <div className="mt-2 flex justify-end gap-2">
            <button type="button" className="px-4 py-2 rounded-xl border" onClick={onClose}>Cancelar</button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-[--zolv-primary] text-white" disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
