// ==========================================================
// APP.JS — Vista pública (lectura)
// ==========================================================

const state = {
  materias: [],
  materiaActual: null, // objeto materia
  semanaActual: 1,
  seccionActual: "concepto",
  contenidosSemana: [], // todos los contenidos de la semana actual (todas las secciones)
  isAdmin: false,
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// Procesador de tablas Markdown
function parseMarkdownTables(text) {
  if (!text) return "";
  const tableRegex = /((?:\|.+\|\r?\n?)+)/g;
  return text.replace(tableRegex, (match) => {
    const lines = match.trim().split('\n');
    if (lines.length < 2) return match; 
    let html = '<div class="table-container" style="overflow-x: auto; margin: 16px 0; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 6px;"><table style="width:100%; border-collapse:collapse; font-size: 0.9rem; font-family: inherit; background: rgba(0, 0, 0, 0.15);">';
    lines.forEach((line, index) => {
      const cells = line.split('|').map(c => c.trim()).filter((c, i, a) => i > 0 && i < a.length - 1);
      if (line.includes('---')) return;
      if (index === 0) {
        html += '<thead style="background: rgba(255, 255, 255, 0.06); border-bottom: 2px solid rgba(255, 255, 255, 0.15);">';
        html += '<tr>' + cells.map(c => `<th style="padding: 10px 12px; text-align: left; color: #fff; font-weight: 600;">${c}</th>`).join('') + '</tr>';
        html += '</thead><tbody>';
      } else {
        html += '<tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">';
        html += cells.map(c => `<td style="padding: 10px 12px; color: #ccc; line-height: 1.4; vertical-align: top;">${c}</td>`).join('') + '</tr>';
      }
    });
    html += '</tbody></table></div>';
    return html;
  });
}

function showToast(msg, isError = false) {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.className = "toast";
  if (isError) toast.style.borderColor = "var(--amber-accent)";
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ---------- Carga inicial ----------

async function init() {
  buildWeekList();
  bindStaticEvents();

  if (!IS_CONFIGURED) {
    renderDemoState();
    return;
  }

  await loadMaterias();
  await checkSession();
  await loadContenidosSemana();
}

function renderDemoState() {
  $("#sheet-title").innerHTML = `Semana <span class="dim">1 — configura Supabase para ver datos reales</span>`;
  $("#cards").innerHTML = `<div class="empty-state">Conecta tu proyecto de Supabase en <code>js/config.js</code> para cargar contenido real.</div>`;
}

async function loadMaterias() {
  const { data, error } = await supabaseClient
    .from("materias")
    .select("*")
    .order("nombre", { ascending: true });

  if (error) {
    showToast("Error cargando materias: " + error.message, true);
    return;
  }

  state.materias = data || [];
  state.materiaActual = state.materias[0] || null;
  if (state.materiaActual) {
    document.body.setAttribute("data-materia", state.materiaActual.slug);
  }
  renderMateriaSwitch();
}

function renderMateriaSwitch() {
  const nav = $("#materia-switch");
  nav.innerHTML = "";
  state.materias.forEach((m) => {
    const btn = document.createElement("button");
    btn.className = "materia-btn" + (state.materiaActual && m.id === state.materiaActual.id ? " active" : "");
    btn.dataset.slug = m.slug;
    btn.textContent = m.nombre;
    btn.addEventListener("click", () => {
      state.materiaActual = m;
      document.body.setAttribute("data-materia", m.slug);
      renderMateriaSwitch();
      loadContenidosSemana();
    });
    nav.appendChild(btn);
  });
}

function buildWeekList() {
  const list = $("#week-list");
  list.innerHTML = "";
  for (let i = 1; i <= 9; i++) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.className = "week-item" + (i === state.semanaActual ? " active" : "");
    btn.dataset.semana = i;
    btn.innerHTML = `<span class="num">${String(i).padStart(2, "0")}</span> Semana ${i}`;
    btn.addEventListener("click", () => {
      state.semanaActual = i;
      $$(".week-item").forEach((el) => el.classList.remove("active"));
      btn.classList.add("active");
      loadContenidosSemana();
    });
    li.appendChild(btn);
    list.appendChild(li);
  }
}

function bindStaticEvents() {
  $$(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.seccionActual = btn.dataset.seccion;
      renderCards();
    });
  });
  $("#lightbox-backdrop").addEventListener("click", () => {
    $("#lightbox-backdrop").classList.add("hidden");
  });
}

async function loadContenidosSemana() {
  if (!state.materiaActual) return;
  $("#sheet-title").innerHTML = `${escapeHtml(state.materiaActual.nombre)} <span class="dim">— Semana ${state.semanaActual}</span>`;
  $("#sheet-meta").textContent = `${state.semanaActual}/9`;
  const { data, error } = await supabaseClient
    .from("contenidos")
    .select("*")
    .eq("materia_id", state.materiaActual.id)
    .eq("semana", state.semanaActual)
    .order("created_at", { ascending: true });
  state.contenidosSemana = error ? [] : (data || []);
  renderCards();
  renderResources();
}

function renderCards() {
  const container = $("#cards");
  const items = state.contenidosSemana.filter((c) => c.seccion === state.seccionActual);
  if (items.length === 0) {
    container.innerHTML = `<div class="empty-state">Todavía no hay contenido en esta sección.</div>`;
    return;
  }
  container.innerHTML = items.map((item) => cardTemplate(item)).join("");
}

// ==========================================================
// CARDTEMPLATE CORREGIDO: VISIBILIDAD Y HISTORIAL LIMPIO
// ==========================================================

function cardTemplate(item) {
  const actions = state.isAdmin
    ? `<div class="card-actions">
         <button class="icon-btn" data-edit="${item.id}" title="Editar">✏️</button>
       </div>`
    : "";

  const imageRender = item.url_imagen
    ? `<div class="card-image-container" style="margin-top: 16px; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.1); background: rgba(0, 0, 0, 0.2);">
        <img src="${item.url_imagen}" class="card-attached-img" style="width: 100%; height: auto; display: block; cursor: pointer;" onclick="openLightbox('${item.url_imagen}', '${escapeHtml(item.titulo)}')" />
      </div>`
    : "";

  let diapositivaViewer = "";
  if (item.url_diapositiva) {
    let rawUrl = item.url_diapositiva;

    // Limpiar URL de Supabase para evitar "downloads" automáticos
    if (rawUrl.includes('?download=')) {
      rawUrl = rawUrl.split('?download=')[0];
    }

    const urlString = rawUrl.toLowerCase();
    let iframeSrc = "";

    // LÓGICA: PDF directo / PPTX vía Google (con fondo blanco para visibilidad)
    if (urlString.endsWith('.pdf')) {
      iframeSrc = rawUrl;
    } else {
      // Usamos el visor de Google pero SIN el Date.now() para no ensuciar el historial
      iframeSrc = `https://docs.google.com/gview?url=${encodeURIComponent(rawUrl)}&embedded=true`;
    }

    diapositivaViewer = `
      <div class="card-slide-viewer" style="margin-top: 20px; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.1);">
        <div class="viewer-header" style="background: rgba(255,255,255,0.05); padding: 10px 15px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 0.85rem; color: #eee;">📊 Previsualización</span>
          <a href="${item.url_diapositiva}" target="_blank" class="btn-fullscreen-slide" style="font-size: 0.8rem; color: var(--amber-accent, #64ffda); text-decoration: none;">🔍 Abrir completa</a>
        </div>
        <iframe 
          src="${iframeSrc}" 
          style="width: 100%; height: 500px; border: none; background: white; display: block;"
          loading="lazy"
          allowfullscreen
        ></iframe>
      </div>
    `;
  }

  return `
    <article class="card">
      <div class="card-head">
        <div class="card-main-content" style="width: 100%;">
          <h3 class="card-title">${escapeHtml(item.titulo)}</h3>
          <div class="card-desc" style="white-space: pre-wrap; color: #ccc; line-height: 1.5; margin-top: 10px;">
            ${parseMarkdownTables(escapeHtml(item.descripcion || ""))}
          </div>
          ${imageRender}
          ${diapositivaViewer}
        </div>
        ${actions}
      </div>
    </article>
  `;
}

function renderResources() {
  const grid = $("#resource-grid");
  const conRecurso = state.contenidosSemana.filter((c) => c.url_imagen || c.url_diapositiva);
  if (conRecurso.length === 0) {
    grid.innerHTML = `<div class="empty-state">Sin recursos descargables.</div>`;
    return;
  }
  grid.innerHTML = "";
  conRecurso.forEach((item) => {
    if (item.url_imagen) {
      const card = document.createElement("button");
      card.className = "resource-card";
      card.innerHTML = `<img src="${item.url_imagen}" /> <div class="resource-label">🖼️ ${escapeHtml(item.titulo)}</div>`;
      card.addEventListener("click", () => openLightbox(item.url_imagen, item.titulo));
      grid.appendChild(card);
    }
    if (item.url_diapositiva) {
      const link = document.createElement("a");
      link.className = "resource-card";
      link.href = item.url_diapositiva;
      link.target = "_blank";
      link.innerHTML = `<div class="resource-label" style="padding-top:38px;">📎 ${escapeHtml(item.titulo)}</div>`;
      grid.appendChild(link);
    }
  });
}

function openLightbox(src, alt) {
  $("#lightbox-img").src = src;
  $("#lightbox-backdrop").classList.remove("hidden");
}

async function checkSession() { state.isAdmin = false; }
async function deleteContenido(id) { console.log("Eliminar:", id); }

document.addEventListener("DOMContentLoaded", init);