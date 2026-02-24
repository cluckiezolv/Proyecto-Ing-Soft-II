// src/lib/referrals.js
export function buildQueryString(params) {
  const sp = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).length > 0) sp.set(k, String(v));
  });
  return sp.toString();
}

/**
 * Construye la URL final del CTA.
 * Prioridad:
 *   1) products.external_apply_url (si existe)
 *   2) lenders.referral_url + referral_params (si existen)
 *   3) null (si no hay nada configurado)
 *
 * Agrega UTM de la sesión si están presentes en la URL actual.
 */
export function buildReferralUrl(product, utmFromLocation = null) {
  const p = product || {};
  const lender = p.lender || {};

  // 1) URL específica por producto
  if (p.external_apply_url) {
    const url = new URL(p.external_apply_url, window.location.origin);
    if (utmFromLocation) {
      Object.entries(utmFromLocation).forEach(([k, v]) => url.searchParams.set(k, v));
    }
    return url.toString();
  }

  // 2) URL base del lender + params
  if (lender.referral_url) {
    const base = new URL(lender.referral_url, window.location.origin);

    // params por defecto del lender
    const defaults = lender.referral_params || {};
    Object.entries(defaults).forEach(([k, v]) => base.searchParams.set(k, v));

    // UTM de la sesión (si vienen)
    if (utmFromLocation) {
      Object.entries(utmFromLocation).forEach(([k, v]) => base.searchParams.set(k, v));
    }

    // (Opcional) Parametriza el producto
    if (p.id) base.searchParams.set("zolv_product_id", String(p.id));
    if (lender.id) base.searchParams.set("zolv_lender_id", String(lender.id));

    return base.toString();
  }

  // 3) Nada configurado
  return null;
}
