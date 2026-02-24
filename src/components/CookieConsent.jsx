// src/components/CookieConsent.jsx
import React, { useEffect, useMemo, useState } from "react";

// Llave en localStorage
const KEY = "zolv_cookie_prefs_v1";

// Utilidades de almacenamiento
function readPrefs() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writePrefs(p) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {}
}

// Estado inicial sin usar setState dentro de useEffect
function useInitialOpen() {
  // Abierto si NO hay preferencias guardadas
  return useMemo(() => readPrefs() == null, []);
}

export default function CookieConsent() {
  const [open, setOpen] = useState(useInitialOpen());
  const [prefs, setPrefs] = useState(() => readPrefs() || {
    necessary: true, // siempre on
    analytics: false,
    marketing: false,
  });

  // Si ya existen preferencias al montar, dispara evento para que el resto de la app reaccione
  useEffect(() => {
    const existing = readPrefs();
    if (existing) {
      window.dispatchEvent(new CustomEvent("zolv:cookie-prefs", { detail: existing }));
    }
  }, []);

  function acceptAll() {
    const next = { necessary: true, analytics: true, marketing: true };
    setPrefs(next);
    writePrefs(next);
    window.dispatchEvent(new CustomEvent("zolv:cookie-prefs", { detail: next }));
    setOpen(false);
  }

  function rejectNonEssential() {
    const next = { necessary: true, analytics: false, marketing: false };
    setPrefs(next);
    writePrefs(next);
    window.dispatchEvent(new CustomEvent("zolv:cookie-prefs", { detail: next }));
    setOpen(false);
  }

  function saveCustom() {
    const next = { ...prefs, necessary: true };
    setPrefs(next);
    writePrefs(next);
    window.dispatchEvent(new CustomEvent("zolv:cookie-prefs", { detail: next }));
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50">
      <div className="mx-auto max-w-5xl m-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="text-sm text-gray-700">
            <div className="font-semibold text-brand mb-1">Usamos cookies</div>
            <p>
              Utilizamos cookies necesarias para que el sitio funcione y, con tu
              consentimiento, cookies de analítica y marketing. Puedes cambiar tus
              preferencias en cualquier momento. Revisa nuestra{" "}
              <a className="underline text-brand" href="/cookies">Política de Cookies</a>.
            </p>

            {/* Controles simples de categorías */}
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked readOnly />
                Necesarias
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={prefs.analytics}
                  onChange={(e) => setPrefs(p => ({ ...p, analytics: e.target.checked }))}
                />
                Analítica
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={prefs.marketing}
                  onChange={(e) => setPrefs(p => ({ ...p, marketing: e.target.checked }))}
                />
                Marketing
              </label>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:pt-5">
            <button
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700"
              onClick={rejectNonEssential}
            >
              Rechazar
            </button>
            <button
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700"
              onClick={saveCustom}
            >
              Guardar elección
            </button>
            <button
              className="px-4 py-2 rounded-xl bg-brand text-white"
              onClick={acceptAll}
            >
              Aceptar todo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
