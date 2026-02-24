// src/infrastructure/repositories/SupabaseRecommendationRepository.js
import { RecommendationRepository } from "./RecommendationRepository.js";

export class SupabaseRecommendationRepository extends RecommendationRepository {
  constructor(supabase, tableName = "recommendations") {
    super();
    this.supabase = supabase;
    this.tableName = tableName; // usa "scores" si tu tabla se llama así
  }

  async replaceRecommendations(submissionId, rows) {
    const { error: delErr } = await this.supabase
      .from(this.tableName)
      .delete()
      .eq("submission_id", submissionId);

    if (delErr) throw delErr;

    const { error: insErr } = await this.supabase
      .from(this.tableName)
      .insert(rows, { returning: "minimal" });

    if (insErr) throw insErr;
  }
}