// src/admin/LendersPanel.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import AddLenderModal from "./AddLenderModal";

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow border border-slate-200 max-h-[85vh] flex flex-col overflow-hidden">
        <div className="p-5 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[--zolv-primary]">{title}</h2>
          <button className="px-3 py-1 rounded-lg border" onClick={onClose}>Cerrar</button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export default function LendersPanel() {
  const [rows, setRows] = useState([]);
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
    const { data, error } = await supabase
      .from("lenders")
      .select("id,name,website,brand_color,active,referral_url,referral_params")
      .order("name");
    if (error) setErr(error.message);
    setRows(data || []);
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("lenders")
          .select("id,name,website,brand_color,active,referral_url,referral_params")
          .order("name");
        if (cancelled) return;
        if (error) setErr(error.message);
        setRows(data || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const parseJSON = (raw, fallback) => {
    try {
      return JSON.parse(raw || "{}");
    } catch {
      return fallback;
    }
  };

  function openEditModal(l) {
    setEditErr("");
    setEdit({
      id: l.id,
      name: l.name || "",
      website: l.website || "",
      brand_color: l.brand_color || "#007b89",
      active: !!l.active,
      referral_url: l.referral_url || "",
      referral_params: l.referral_params || { utm_source: "zolv", utm_campaign: "home" },
      _referral_params_raw: JSON.stringify(l.referral_params || { utm_source: "zolv", utm_campaign: "home" }, null, 2),
    });
    setOpenEdit(true);
  }

  async function saveEdit() {
    if (!edit?.id) return;

    setSaving(true);
    setEditErr("");

    // validar JSON referral_params
    const referralParams = parseJSON(edit._referral_params_raw, null);
    if (edit._referral_params_raw?.trim() && referralParams == null) {
      setEditErr("El JSON de referral_params no es válido.");
      setSaving(false);
      return;
    }

    const payload = {
      name: edit.name.trim(),
      website: edit.website || null,
      brand_color: edit.brand_color || null,
      active: !!edit.active,
      referral_url: edit.referral_url || null,
      referral_params: referralParams || null,
    };

    const { error } = await supabase.from("lenders").update(payload).eq("id", edit.id);
    if (error) {
      setEditErr(error.message);
      setSaving(false);
      return;
    }

    await fetchAll();
    setOpenEdit(false);
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">Instituciones</div>
        <button className="px-3 py-2 rounded-xl bg-brand text-white" onClick={() => setOpenAdd(true)}>
          Nuevo lender
        </button>
      </div>

      {err && <div className="text-sm text-red-600">{err}</div>}

      {loading ? (
        <div className="text-sm text-gray-600">Cargando…</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-gray-600">No hay lenders cargados.</div>
      ) : (
        <div className="overflow-auto border rounded-2xl">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-3">Nombre</th>
                <th className="text-left p-3">Activo</th>
                <th className="text-left p-3">Referral URL</th>
                <th className="text-left p-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id} className="border-t">
                  <td className="p-3">{l.name}</td>
                  <td className="p-3">{l.active ? "Sí" : "No"}</td>
                  <td className="p-3 text-xs text-gray-700 truncate max-w-90">

                    {l.referral_url || "—"}
                  </td>
                  <td className="p-3">
                    <button
                      className="px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-50"
                      onClick={() => openEditModal(l)}
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openAdd && (
        <AddLenderModal
          onClose={() => setOpenAdd(false)}
          onSaved={async () => {
            setOpenAdd(false);
            await fetchAll();
          }}
        />
      )}

      {/* Modal Editar */}
      <Modal open={openEdit} onClose={() => setOpenEdit(false)} title="Editar lender">
        {!edit ? null : (
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-sm">Nombre</label>
              <input
                className="mt-1 w-full border rounded-xl px-3 py-2"
                value={edit.name}
                onChange={(e) => setEdit((s) => ({ ...s, name: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-sm">Website</label>
              <input
                className="mt-1 w-full border rounded-xl px-3 py-2"
                value={edit.website}
                onChange={(e) => setEdit((s) => ({ ...s, website: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-sm">Color de marca</label>
              <input
                type="color"
                className="mt-1 h-10 w-20 border rounded"
                value={edit.brand_color}
                onChange={(e) => setEdit((s) => ({ ...s, brand_color: e.target.value }))}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-sm">Referral URL</label>
              <input
                className="mt-1 w-full border rounded-xl px-3 py-2"
                placeholder="https://socio.mx/apply"
                value={edit.referral_url}
                onChange={(e) => setEdit((s) => ({ ...s, referral_url: e.target.value }))}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-sm">Referral params (JSON)</label>
              <textarea
                className="mt-1 w-full border rounded-xl px-3 py-2"
                rows={5}
                value={edit._referral_params_raw}
                onChange={(e) => setEdit((s) => ({ ...s, _referral_params_raw: e.target.value }))}
              />
              <p className="text-xs text-gray-500 mt-1">
                Ejemplo: {"{ \"utm_source\": \"zolv\", \"utm_campaign\": \"home\" }"}
              </p>
            </div>

            <div className="sm:col-span-2 flex items-center gap-2">
              <input
                id="lender-active-edit"
                type="checkbox"
                checked={!!edit.active}
                onChange={(e) => setEdit((s) => ({ ...s, active: e.target.checked }))}
              />
              <label htmlFor="lender-active-edit" className="text-sm">Activo</label>
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
