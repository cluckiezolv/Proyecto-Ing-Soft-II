// src/admin/ProductsPanel.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import AddProductModal from "./AddProductModal";

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow border border-slate-200 max-h-[85vh] flex flex-col overflow-hidden">
        <div className="p-5 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[--zolv-primary]">{title}</h2>
          <button className="px-3 py-1 rounded-lg border" onClick={onClose}>Cerrar</button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export default function ProductsPanel() {
  const [rows, setRows] = useState([]);
  const [lenders, setLenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [openAdd, setOpenAdd] = useState(false);

  const [openEdit, setOpenEdit] = useState(false);
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editErr, setEditErr] = useState("");

  async function fetchAll() {
    setLoading(true);
    setErr("");

    const [{ data: lendersData, error: e1 }, { data: prodData, error: e2 }] = await Promise.all([
      supabase.from("lenders").select("id,name,active,referral_url,referral_params").order("name"),
      supabase
        .from("products")
        .select("id,name,active,type,lender_id,description,limits,requirements,weights,meta,external_apply_url,referral_url")
        .order("name"),
    ]);

    if (e1) setErr(e1.message);
    if (e2) setErr(e2.message);

    setLenders(lendersData || []);
    setRows(prodData || []);
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [{ data: lendersData, error: e1 }, { data: prodData, error: e2 }] = await Promise.all([
          supabase.from("lenders").select("id,name,active,referral_url,referral_params").order("name"),
          supabase
            .from("products")
            .select("id,name,active,type,lender_id,description,limits,requirements,weights,meta,external_apply_url,referral_url")
            .order("name"),
        ]);
        if (cancelled) return;
        if (e1) setErr(e1.message);
        if (e2) setErr(e2.message);
        setLenders(lendersData || []);
        setRows(prodData || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const lendersById = useMemo(() => {
    const m = new Map();
    (lenders || []).forEach((l) => m.set(l.id, l));
    return m;
  }, [lenders]);

  function prettyType(t) {
    const v = (t || "").toLowerCase();
    if (v.includes("tarjeta") || v.includes("card")) return "Tarjeta";
    if (v.includes("personal") || v.includes("loan") || v.includes("consumo")) return "Personal";
    if (v.includes("auto")) return "Auto";
    if (v.includes("hipotec") || v.includes("mort")) return "Hipotecario";
    return t || "—";
  }

  function openEditModal(p) {
    setEditErr("");
    setEdit({
      id: p.id,
      lender_id: p.lender_id || "",
      name: p.name || "",
      type: p.type || "personal",
      description: p.description || "",
      active: !!p.active,
      referral_url: p.referral_url || "",
      external_apply_url: p.external_apply_url || "",
      _limits_raw: JSON.stringify(p.limits || { max_amount: null, max_term: null }, null, 2),
      _requirements_raw: JSON.stringify(p.requirements || {}, null, 2),
      _weights_raw: JSON.stringify(p.weights || {}, null, 2),
      _meta_raw: JSON.stringify(p.meta || {}, null, 2),
    });
    setOpenEdit(true);
  }

  const parseJSON = (raw) => {
    if (!raw || !raw.trim()) return null;
    return JSON.parse(raw);
  };

  async function saveEdit() {
    if (!edit?.id) return;

    setSaving(true);
    setEditErr("");

    try {
      // Validar JSONs
      let limits = null, requirements = null, weights = null, meta = null;
      try { limits = parseJSON(edit._limits_raw); } catch { throw new Error("JSON inválido en Limits."); }
      try { requirements = parseJSON(edit._requirements_raw); } catch { throw new Error("JSON inválido en Requirements."); }
      try { weights = parseJSON(edit._weights_raw); } catch { throw new Error("JSON inválido en Weights."); }
      try { meta = parseJSON(edit._meta_raw); } catch { throw new Error("JSON inválido en Meta."); }

      const payload = {
        lender_id: edit.lender_id || null,
        name: edit.name.trim(),
        type: edit.type,
        description: edit.description || null,
        active: !!edit.active,
        referral_url: edit.referral_url || null,
        external_apply_url: edit.external_apply_url || null,
        limits,
        requirements,
        weights,
        meta,
      };

      const { error } = await supabase.from("products").update(payload).eq("id", edit.id);
      if (error) throw error;

      await fetchAll();
      setOpenEdit(false);
    } catch (e) {
      setEditErr(e.message || "No se pudo guardar el producto");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">Productos</div>
        <div className="flex gap-2">
          <a
            href="#tab=lenders"
            className="px-3 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50"
            title="Ir a Instituciones"
          >
            Ir a Instituciones
          </a>
          <button className="px-3 py-2 rounded-xl bg-brand text-white" onClick={() => setOpenAdd(true)}>
            Nuevo producto
          </button>
        </div>
      </div>

      {err && <div className="text-sm text-red-600">{err}</div>}

      {loading ? (
        <div className="text-sm text-gray-600">Cargando…</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-gray-600">No hay productos cargados.</div>
      ) : (
        <div className="overflow-auto border rounded-2xl">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-3">Nombre</th>
                <th className="text-left p-3">Institución</th>
                <th className="text-left p-3">Tipo</th>
                <th className="text-left p-3">Activo</th>
                <th className="text-left p-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const lenderName = lendersById.get(r.lender_id)?.name || "—";
                return (
                  <tr key={r.id} className="border-t">
                    <td className="p-3">{r.name}</td>
                    <td className="p-3">{lenderName}</td>
                    <td className="p-3">{prettyType(r.type)}</td>
                    <td className="p-3">{r.active ? "Sí" : "No"}</td>
                    <td className="p-3">
                      <button
                        className="px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-50"
                        onClick={() => openEditModal(r)}
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Alta */}
      {openAdd && (
        <AddProductModal
          lenders={lenders}
          onClose={() => setOpenAdd(false)}
          onSaved={async () => {
            setOpenAdd(false);
            await fetchAll();
          }}
        />
      )}

      {/* Editar */}
      <Modal open={openEdit} onClose={() => setOpenEdit(false)} title="Editar producto">
        {!edit ? null : (
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-sm">Institución (lender)</label>
              <select
                className="mt-1 w-full border rounded-xl px-3 py-2"
                value={edit.lender_id}
                onChange={(e) => setEdit((s) => ({ ...s, lender_id: e.target.value }))}
              >
                <option value="">— Selecciona —</option>
                {lenders.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm">Nombre</label>
              <input
                className="mt-1 w-full border rounded-xl px-3 py-2"
                value={edit.name}
                onChange={(e) => setEdit((s) => ({ ...s, name: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-sm">Tipo</label>
              <select
                className="mt-1 w-full border rounded-xl px-3 py-2"
                value={edit.type}
                onChange={(e) => setEdit((s) => ({ ...s, type: e.target.value }))}
              >
                <option value="personal">Crédito personal</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="auto">Auto</option>
                <option value="hipotecario">Hipotecario</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="text-sm">Descripción</label>
              <textarea
                className="mt-1 w-full border rounded-xl px-3 py-2"
                rows={2}
                value={edit.description}
                onChange={(e) => setEdit((s) => ({ ...s, description: e.target.value }))}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-sm">Referral URL (producto) (opcional)</label>
              <input
                className="mt-1 w-full border rounded-xl px-3 py-2"
                placeholder="https://..."
                value={edit.referral_url}
                onChange={(e) => setEdit((s) => ({ ...s, referral_url: e.target.value }))}
              />
              <p className="text-xs text-gray-500 mt-1">
                Si no se llena, se usa el referral del lender.
              </p>
            </div>

            <div className="sm:col-span-2">
              <label className="text-sm">External apply URL (prioridad) (opcional)</label>
              <input
                className="mt-1 w-full border rounded-xl px-3 py-2"
                placeholder="https://..."
                value={edit.external_apply_url}
                onChange={(e) => setEdit((s) => ({ ...s, external_apply_url: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-sm">Limits (JSON)</label>
              <textarea
                className="mt-1 w-full border rounded-xl px-3 py-2"
                rows={5}
                value={edit._limits_raw}
                onChange={(e) => setEdit((s) => ({ ...s, _limits_raw: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-sm">Requirements (JSON)</label>
              <textarea
                className="mt-1 w-full border rounded-xl px-3 py-2"
                rows={5}
                value={edit._requirements_raw}
                onChange={(e) => setEdit((s) => ({ ...s, _requirements_raw: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-sm">Weights (JSON)</label>
              <textarea
                className="mt-1 w-full border rounded-xl px-3 py-2"
                rows={5}
                value={edit._weights_raw}
                onChange={(e) => setEdit((s) => ({ ...s, _weights_raw: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-sm">Meta (JSON)</label>
              <textarea
                className="mt-1 w-full border rounded-xl px-3 py-2"
                rows={5}
                value={edit._meta_raw}
                onChange={(e) => setEdit((s) => ({ ...s, _meta_raw: e.target.value }))}
              />
            </div>

            <div className="sm:col-span-2 flex items-center gap-2">
              <input
                id="product-active-edit"
                type="checkbox"
                checked={!!edit.active}
                onChange={(e) => setEdit((s) => ({ ...s, active: e.target.checked }))}
              />
              <label htmlFor="product-active-edit" className="text-sm">Activo</label>
            </div>

            {editErr && <div className="text-sm text-red-600 sm:col-span-2">{editErr}</div>}

            <div className="sm:col-span-2 flex justify-end gap-2">
              <button className="px-4 py-2 rounded-xl border" onClick={() => setOpenEdit(false)}>
                Cancelar
              </button>
              <button
                className="px-4 py-2 rounded-xl bg-[--zolv-primary] text-white"
                onClick={saveEdit}
                disabled={saving}
              >
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
