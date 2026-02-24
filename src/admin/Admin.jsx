// src/admin/Admin.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import ProductsPanel from "./ProductsPanel";
import LendersPanel from "./LendersPanel";

const TABS = [
  { key: "products", label: "Productos" },
  { key: "lenders", label: "Instituciones" },
];

function getTabFromHash() {
  const m = /tab=([a-z]+)/i.exec(window.location.hash);
  return m?.[1] || "products";
}
function setTabInHash(tab) {
  const url = new URL(window.location.href);
  url.hash = `#tab=${tab}`;
  history.replaceState(null, "", url);
}

export default function Admin() {
  const [email, setEmail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(getTabFromHash());

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user?.email ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null);
    });
    const onHash = () => setTab(getTabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => {
      sub.subscription?.unsubscribe();
      window.removeEventListener("hashchange", onHash);
    };
  }, []);

  const activeTab = useMemo(() => (TABS.find(t => t.key === tab) ? tab : "products"), [tab]);

  if (loading) return <div className="p-6">Cargando…</div>;
  if (!email) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <h1 className="text-xl font-bold mb-2">Admin</h1>
        <p className="text-sm text-gray-600 mb-4">Inicia sesión para continuar.</p>
        <a href="/admin/login" className="inline-flex px-4 py-2 rounded-xl bg-brand text-white">Ir a Login</a>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand">Administración</h1>
        <div className="text-xs text-gray-500">Sesión: {email}</div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setTabInHash(t.key); }}
            className={
              "px-4 py-2 -mb-px border-b-2 " +
              (activeTab === t.key
                ? "border-brand text-brand font-medium"
                : "border-transparent text-gray-600 hover:text-brand")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      <div className="pt-2">
        {activeTab === "products" && <ProductsPanel />}
        {activeTab === "lenders" && <LendersPanel />}
      </div>
    </div>
  );
}
