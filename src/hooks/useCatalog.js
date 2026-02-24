// src/hooks/useCatalog.js
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";

export function useCatalog() {
  const [products, setProducts] = useState([]);
  const [error, setErr] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("products")
        .select(`
          id, name, description, type, active,
          limits, requirements, weights, meta,
          external_apply_url,
          lender:lender_id (
            id, name, active, brand_color, website,
            referral_url, referral_params
          )
        `)
        .eq("active", true)
        .eq("lender.active", true);

      if (cancelled) return;

      if (error) setErr(error);
      else setErr(null);

      setProducts(data || []);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, []);

  return { products, loading, error };
}
