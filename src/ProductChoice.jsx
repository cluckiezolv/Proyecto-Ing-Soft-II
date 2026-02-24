// src/components/ProductChoice.jsx
export default function ProductChoice({ value, onChange, onContinue }) {
  return (
    <section className="w-full max-w-3xl mx-auto mt-10 p-6 rounded-xl border border-slate-200 bg-white">
      <h2 className="text-2xl font-semibold text-ink">
        ¿Qué producto quieres comparar?
      </h2>
      <p className="mt-2 text-slate-600">
        Selecciona una opción para personalizar la encuesta y los resultados.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onChange("personal_loan")}
          className={[
            "p-4 rounded-xl border text-left transition",
            value === "personal_loan"
              ? "border-accent ring-2 ring-accent/20"
              : "border-slate-200 hover:border-slate-300",
          ].join(" ")}
        >
          <div className="font-semibold text-ink">Crédito personal</div>
          <div className="mt-1 text-sm text-slate-600">
            Ideal si necesitas un monto fijo y pagos mensuales.
          </div>
        </button>

        <button
          type="button"
          onClick={() => onChange("credit_card")}
          className={[
            "p-4 rounded-xl border text-left transition",
            value === "credit_card"
              ? "border-accent ring-2 ring-accent/20"
              : "border-slate-200 hover:border-slate-300",
          ].join(" ")}
        >
          <div className="font-semibold text-ink">Tarjeta de crédito</div>
          <div className="mt-1 text-sm text-slate-600">
            Ideal para línea revolvente, recompensas y pagos flexibles.
          </div>
        </button>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <div className="text-sm text-slate-500">
          {value
            ? `Seleccionado: ${
                value === "personal_loan" ? "Crédito personal" : "Tarjeta de crédito"
              }`
            : "Selecciona una opción para continuar."}
        </div>

        <button
          type="button"
          onClick={onContinue}
          disabled={!value}
          className={[
            "px-5 py-2.5 rounded-lg font-semibold transition",
            !value
              ? "bg-slate-200 text-slate-500 cursor-not-allowed"
              : "bg-accent text-white hover:opacity-95",
          ].join(" ")}
        >
          Continuar
        </button>
      </div>
    </section>
  );
}
