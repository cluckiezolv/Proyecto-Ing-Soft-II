// src/infrastructure/repositories/SupabaseSubmissionRepository.js
import { SubmissionRepository } from "./SubmissionRepository.js";

export class SupabaseSubmissionRepository extends SubmissionRepository {
  constructor(supabase) {
    super();
    this.supabase = supabase;
  }

  async upsertSubmission(payload) {
    // onConflict: email,telefono (como tu código actual)
    const { data, error } = await this.supabase
      .from("submissions")
      .upsert(payload, {
        onConflict: "email,telefono",
        ignoreDuplicates: false,
      })
      .select("id")
      .single();

    if (error) throw error;
    return data.id;
  }
}