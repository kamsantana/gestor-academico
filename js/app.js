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

// NUEVO: Procesador dinámico de tablas Markdown a HTML con diseño "plano técnico"
function parseMarkdownTables(text) {
  if (!text) return "";
  
  // Captura bloques de líneas que empiezan y terminan con la barra vertical '|'
  const tableRegex = /((?:\|.+\|\r?\n?)+)/g;
  
  return text.replace(tableRegex, (match) => {
    const lines = match.trim().split('\n');
    if (lines.length < 2) return match; 

    let html = '<div class="table-container" style="overflow-x: auto; margin: 16px 0; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 6px;"><table style="width:100%; border-collapse:collapse; font-size: 0.9rem; font-family: inherit; background: rgba(0, 0, 0, 0.15);">';
    
    lines.forEach((line, index) => {
      // Divide y limpia espacios de cada celda de la fila
      const cells = line.split('|').map(c => c.trim()).filter((c, i, a) => i > 0 && i < a.length - 1);
      
      // Salta las líneas divisorias de formato Markdown (ej: |--|--|--)
      if (line.includes('---')) return;

      if (index === 0) {
        // Estilo del encabezado
        html += '<thead style="background: rgba(255, 255, 255, 0.06); border-bottom: 2px solid rgba(255, 255, 255, 0.15);">';
        html += '<tr>' + cells.map(c => `<th style="padding: 10px 12px; text-align: left; color: #fff; font-weight: 600;">${c}</th>`).join('') + '</tr>';
        html += '</thead><tbody>';
      } else {
        // Estilo de las celdas de contenido
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
  $("#cards").innerHTML = `<div class="empty-state">Conecta tu proyecto de Supabase en <code>js/config.js</code> para cargar contenido real. Mientras tanto, esta es la interfaz de demostración.</div>`;
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
  
  // Sincronizar el fondo inicial de la pantalla
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
      
      // NUEVO: Cambiar dinámicamente el fondo de pantalla según la materia seleccionada
      document.body.setAttribute("data-materia", m.slug);
      
      renderMateriaSwitch();
      loadContenidosSemana();
    });
    nav.appendChild(btn);
  });
}

// ---------- Semanas ----------

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

// ---------- Tabs de sección ----------

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

// ---------- Cargar contenidos de la semana ----------

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

  if (error) {
    showToast("Error cargando contenidos: " + error.message, true);
    state.contenidosSemana = [];
  } else {
    state.contenidosSemana = data || [];
  }

  renderCards();
  renderResources();
}

// ---------- Tarjetas (conceptos / tareas / consultas) ----------

function renderCards() {
  const container = $("#cards");
  const items = state.contenidosSemana.filter((c) => c.seccion === state.seccionActual);

  if (items.length === 0) {
    container.innerHTML = `<div class="empty-state">Todavía no hay contenido en esta sección para la semana ${state.semanaActual}.</div>`;
    return;
  }

  container.innerHTML = items.map((item) => cardTemplate(item)).join("");

  if (state.isAdmin) {
    container.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", () => openResourceModal(items.find((i) => i.id === btn.dataset.edit)));
    });
    container.querySelectorAll("[data-delete]").forEach((btn) => {
      btn.addEventListener("click", () => deleteContenido(btn.dataset.delete));
    });
  }
}

// ==========================================================
// CARDTEMPLATE CON VISUALIZADOR DE IMÁGENES Y DIAPOSITIVAS
// ==========================================================

function cardTemplate(item) {
  const actions = state.isAdmin
    ? `<div class="card-actions">
         <button class="icon-btn" data-edit="${item.id}" title="Editar">✏️</button>
         <button class="icon-btn" data-delete="${item.id}" title="Eliminar">🗑️</button>
       </div>`
    : "";

  // NUEVO: Renderizador de imagen adjunta dentro de la tarjeta
  const imageRender = item.url_imagen
    ? `
      <div class="card-image-container" style="margin-top: 16px; border-radius: var(--radius-md); overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.08); background: rgba(0, 0, 0, 0.2);">
        <img 
          src="${item.url_imagen}" 
          alt="${escapeHtml(item.titulo)}" 
          class="card-attached-img" 
          style="width: 100%; height: auto; display: block; cursor: pointer;"
          onclick="openLightbox('${item.url_imagen}', '${escapeHtml(item.titulo)}')"
        />
      </div>
    `
    : "";

  // VISUALIZADOR DE DIAPOSITIVAS
  const diapositivaViewer = item.url_diapositiva
    ? `
      <div class="card-slide-viewer">
        <div class="viewer-header">
          <span>📊 Previsualización de Diapositivas</span>
          <a 
            href="${item.url_diapositiva}" 
            target="_blank" 
            rel="noopener noreferrer" 
            class="btn-fullscreen-slide"
          >
            🔍 Abrir completa
          </a>
        </div>
        <iframe 
          src="https://docs.google.com/gview?url=${encodeURIComponent(item.url_diapositiva)}&embedded=true" 
          loading="lazy"
          title="Vista previa de ${escapeHtml(item.titulo)}"
          allowfullscreen
        >
        </iframe>
      </div>
    `
    : "";

  // MODIFICADO: Se envuelve en un <div> y procesa las tablas después de escapar el HTML crudo
  return `
    <article class="card" data-seccion="${item.seccion}">
      <div class="card-head">
        <div class="card-main-content" style="width: 100%;">
          <h3 class="card-title">${escapeHtml(item.titulo)}</h3>
          <div class="card-desc" style="white-space: pre-wrap; color: #ccc; line-height: 1.5;">${parseMarkdownTables(escapeHtml(item.descripcion || ""))}</div>
          ${imageRender}
          ${diapositivaViewer}
        </div>
        ${actions}
      </div>
    </article>
  `;
}

// ---------- Recursos de la semana (imágenes / diapositivas) ----------

function renderResources() {
  const grid = $("#resource-grid");
  const conRecurso = state.contenidosSemana.filter((c) => c.url_imagen || c.url_diapositiva);

  if (conRecurso.length === 0) {
    grid.innerHTML = `<div class="empty-state">Sin recursos descargables para esta semana.</div>`;
    return;
  }

  grid.innerHTML = "";
  conRecurso.forEach((item) => {
    if (item.url_imagen) {
      const card = document.createElement("button");
      card.className = "resource-card";
      card.innerHTML = `<img src="${item.url_imagen}" alt="${escapeHtml(item.titulo)}" />
        <div class="resource-label">🖼️ ${escapeHtml(item.titulo)}</div>`;
      card.addEventListener("click", () => openLightbox(item.url_imagen, item.titulo));
      grid.appendChild(card);
    }
    if (item.url_diapositiva) {
      const link = document.createElement("a");
      link.className = "resource-card";
      link.href = item.url_diapositiva;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.innerHTML = `<div class="resource-label" style="padding-top:38px;">📎 ${escapeHtml(item.titulo)}</div>`;
      grid.appendChild(link);
    }
  });
}

function openLightbox(src, alt) {
  $("#lightbox-img").src = src;
  $("#lightbox-img").alt = alt || "";
  $("#lightbox-backdrop").classList.remove("hidden");
}

// ---------- Funciones de administración (placeholder) ----------

async function checkSession() {
  // Implementar lógica de sesión
  state.isAdmin = false; // Cambiar según autenticación
}

function openResourceModal(item) {
  // Implementar modal de edición
  console.log("Editar item:", item);
}

async function deleteContenido(id) {
  if (!confirm("¿Estás seguro de eliminar este contenido?")) return;
  // Implementar eliminación
  console.log("Eliminar item:", id);
}

document.addEventListener("DOMContentLoaded", init);