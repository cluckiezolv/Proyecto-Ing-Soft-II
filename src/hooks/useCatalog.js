// src/hooks/useCatalog.js
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { SupabaseProductRepository } from "../infrastructure/repositories/SupabaseProductRepository.js";

const productRepo = new SupabaseProductRepository(supabase);

export function useCatalog() {
  const [products, setProducts] = useState([]);
  const [error, setErr] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await productRepo.getActiveProducts();
        if (!cancelled) {
          setProducts(data);
          setErr(null);
        }
      } catch (e) {
        if (!cancelled) setErr(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return { products, loading, error };
}