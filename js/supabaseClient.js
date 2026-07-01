// ==========================================================
// Cliente Supabase compartido por app.js y admin.js
// ==========================================================

const IS_CONFIGURED =
  typeof SUPABASE_URL === "string" &&
  typeof SUPABASE_ANON_KEY === "string" &&
  !SUPABASE_URL.includes("TU-PROYECTO") &&
  !SUPABASE_ANON_KEY.includes("TU-ANON-PUBLIC-KEY");

let supabaseClient = null;

if (IS_CONFIGURED) {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
  document.addEventListener("DOMContentLoaded", () => {
    const el = document.getElementById("config-warning");
    if (el) {
      el.innerHTML =
        '<div class="config-warning">⚠ Falta configurar Supabase — edita <code>js/config.js</code> con tu URL y tu anon key, y ejecuta <code>sql/schema.sql</code> en tu proyecto.</div>';
    }
  });
}

const BUCKET_IMAGENES = "imagenes-academicas";
const BUCKET_DIAPOSITIVAS = "diapositivas-clase";
