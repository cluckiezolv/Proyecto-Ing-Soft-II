// src/admin/RequireAdmin.jsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";

export default function RequireAdmin({ children }) {
  const [status, setStatus] = useState("checking"); // checking | ok | noauth

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.email) {
        if (mounted) setStatus("noauth");
        return;
      }
      const { data, error } = await supabase
        .from("admins")
        .select("email")
        .eq("email", session.user.email)
        .maybeSingle();
      if (error || !data) {
        if (mounted) setStatus("noauth");
      } else {
        if (mounted) setStatus("ok");
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (status === "checking") {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="text-sm text-gray-600">Verificando acceso…</div>
      </div>
    );
  }
  if (status === "noauth") {
    window.location.assign("/admin/login");
    return null;
  }
  return children;
}
