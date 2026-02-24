// src/application/ZolvController.js
export class ZolvController {
  constructor({ productRepo, submissionRepo, recRepo, evaluationService }) {
    this.productRepo = productRepo;
    this.submissionRepo = submissionRepo;
    this.recRepo = recRepo;
    this.evaluationService = evaluationService;
  }

  async getCatalog() {
    return await this.productRepo.getActiveProducts();
  }

  evaluate(products, profile, tipoElegido) {
    return this.evaluationService.evaluate(products, profile, tipoElegido);
  }

  async saveSubmissionAndRecommendations(datos, recomendaciones) {
    const payload = {
      answers: datos,
      email: datos.email ?? null,
      telefono: datos.telefono ?? null,
      consentimiento: typeof datos.consentimiento === "boolean" ? datos.consentimiento : null,
      fecha_registro: datos.fechaRegistro ?? null,
      origen: datos.origen ?? null,
      utm: datos.utm ?? null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      applicant: datos.applicant ?? null, // si lo usas
    };

    const submissionId = await this.submissionRepo.upsertSubmission(payload);

    const rows = recomendaciones.map(({ p, r }, idx) => ({
      submission_id: submissionId,
      product_id: p.id,
      rank: idx + 1,
      score: r.score,
    }));

    await this.recRepo.replaceRecommendations(submissionId, rows);
    return submissionId;
  }
}