// src/domain/strategies/PersonalLoanStrategy.js
import { EvaluationStrategy } from "./EvaluationStrategy.js";
import { scoreProductoBase } from "./scoringCore.js";

export class PersonalLoanStrategy extends EvaluationStrategy {
  evaluate(product, profile) {
    return scoreProductoBase(product, profile);
  }
}