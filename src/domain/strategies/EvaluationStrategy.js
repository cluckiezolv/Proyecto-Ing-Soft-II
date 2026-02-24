// src/domain/strategies/EvaluationStrategy.js
export class EvaluationStrategy {
  /**
   * @param {object} product
   * @param {object} profile
   * @returns {{elegible:boolean, score:number, razones:string[]}}
   */
  evaluate(product, profile) {
    throw new Error("Not implemented");
  }
}