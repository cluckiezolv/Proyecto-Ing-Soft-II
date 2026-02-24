// src/domain/strategies/CreditCardStrategy.js
import { EvaluationStrategy } from "./EvaluationStrategy.js";
import { scoreProductoBase } from "./scoringCore.js";

export class CreditCardStrategy extends EvaluationStrategy {
  evaluate(product, profile) {
    // Para tarjetas, normalmente no hay plazo/monto rígido; si tu catálogo lo trae, igual funciona.
    // Esto te da una Strategy distinta (defendible) sin romper funcionalidad.
    return scoreProductoBase(product, profile);
  }
}