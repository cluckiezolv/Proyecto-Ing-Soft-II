// src/application/services/EvaluationService.js
export class EvaluationService {
  constructor(strategyFactory) {
    this.strategyFactory = strategyFactory;
  }

  /**
   * @returns Array<{p: object, r: {elegible:boolean, score:number, razones:string[]}}>
   */
  evaluate(products, profile, tipoElegido) {
    return (products || [])
      .filter((p) => this.#isTipoMatch(p, tipoElegido))
      .map((p) => {
        const strategy = this.strategyFactory.create(p.type);
        return { p, r: strategy.evaluate(p, profile) };
      })
      .filter(({ r }) => r.elegible)
      .sort((a, b) => b.r.score - a.r.score);
  }

  #isTipoMatch(p, tipo) {
    const k = (p.kind || p.type || p.category || p.meta?.category || "").toString().toLowerCase();
    if (!tipo) return true;
    if (tipo === "tarjeta") return k.includes("card") || k.includes("tarjeta");
    if (tipo === "personal") return k.includes("loan") || k.includes("personal") || k.includes("consumo");
    return true;
  }
}