// src/domain/factories/EvaluationStrategyFactory.js
import { PersonalLoanStrategy } from "../strategies/PersonalLoanStrategy.js";
import { CreditCardStrategy } from "../strategies/CreditCardStrategy.js";

export class EvaluationStrategyFactory {
  create(productType = "") {
    const t = String(productType).toLowerCase();

    // Ajusta si tus types son distintos
    if (t.includes("card") || t.includes("tarjeta")) return new CreditCardStrategy();
    return new PersonalLoanStrategy(); // default: personal/loan/consumo
  }
}