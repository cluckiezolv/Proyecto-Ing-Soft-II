// src/infrastructure/repositories/SupabaseProductRepository.js
import { ProductRepository } from "./ProductRepository.js";

export class SupabaseProductRepository extends ProductRepository {
  constructor(supabase) {
    super();
    this.supabase = supabase;
  }

  async getActiveProducts() {
    const { data, error } = await this.supabase
      .from("products")
      .select(`
        id, name, description, type, active,
        limits, requirements, weights, meta,
        external_apply_url,
        referral_url,
        lender:lender_id (
          id, name, active, brand_color, website,
          referral_url, referral_params, meta
        )
      `)
      .eq("active", true)
      .eq("lender.active", true);

    if (error) throw error;
    return data || [];
  }
}