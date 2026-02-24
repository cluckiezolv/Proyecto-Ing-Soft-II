// src/admin/Login.jsx
import { useState } from "react";
import { supabase } from "../lib/supabaseClient.js";

export default function Login() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    const { error } = await supabase.auth.signInWithPassword({
      email, password: pass
    });
    if (error) {
      setError(error.message);
      return;
    }
    window.location.assign("/admin");
  }

  return (
    <div className="min-h-screen grid place-items-center bg-gray-50">
      <div className="w-full max-w-sm rounded-2xl shadow p-6 bg-white border">
        <div className="flex items-center gap-2 mb-4">
          <img src="/logo.svg" onError={(e)=>{e.currentTarget.onerror=null;e.currentTarget.src='/logo.png'}} alt="ZOLV" className="w-8 h-8"/>
          <div className="font-semibold text-brand">ZOLV Admin</div>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="text-sm">Email</label>
            <input type="email" className="mt-1 w-full border rounded-xl px-3 py-2"
                   value={email} onChange={e=>setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="text-sm">Contraseña</label>
            <input type="password" className="mt-1 w-full border rounded-xl px-3 py-2"
                   value={pass} onChange={e=>setPass(e.target.value)} required />
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <button type="submit" className="w-full px-4 py-2 rounded-xl bg-brand text-white">
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
