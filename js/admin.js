// ==========================================================
// ADMIN.JS — Autenticación y modo editor (crear/editar/eliminar)
// ==========================================================

document.addEventListener("DOMContentLoaded", () => {
  if (!IS_CONFIGURED) return;

  // ----- Abrir / cerrar modal de login -----
  $("#btn-login").addEventListener("click", () => {
    $("#login-backdrop").classList.remove("hidden");
    $("#login-error").classList.add("hidden");
  });

  $("#login-cancel").addEventListener("click", () => {
    $("#login-backdrop").classList.add("hidden");
  });

  $("#login-backdrop").addEventListener("click", (e) => {
    if (e.target.id === "login-backdrop") $("#login-backdrop").classList.add("hidden");
  });

  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("#login-email").value.trim();
    const password = $("#login-password").value;
    const errorEl = $("#login-error");
    errorEl.classList.add("hidden");

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
      errorEl.textContent = "Credenciales inválidas. " + error.message;
      errorEl.classList.remove("hidden");
      return;
    }

    $("#login-backdrop").classList.add("hidden");
    $("#login-form").reset();
    await enterAdminMode();
  });

  // ----- Añadir recurso -----
  $("#btn-add").addEventListener("click", () => openResourceModal(null));

  $("#resource-cancel").addEventListener("click", () => closeResourceModal());
  $("#resource-backdrop").addEventListener("click", (e) => {
    if (e.target.id === "resource-backdrop") closeResourceModal();
  });

  $("#resource-form").addEventListener("submit", handleResourceSubmit);

  // NUEVO: Escuchar el evento de pegar (Ctrl+V) una imagen o captura dentro del modal
  $("#resource-form").addEventListener("paste", (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    
    for (let index in items) {
      const item = items[index];
      // Detectamos si lo que viene en el portapapeles es una imagen
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const blob = item.getAsFile();
        
        // Empaquetamos el blob temporal como un archivo File real de JS
        const file = new File([blob], `captura-${Date.now()}.png`, { type: "image/png" });
        
        // Lo inyectamos de forma dinámica al input nativo de tu HTML (#f-imagen)
        const fileInput = $("#f-imagen");
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;
        
        // Modificamos el marcador de posición de la descripción para dar feedback visual
        const descEl = $("#f-descripcion");
        descEl.placeholder = "¡Imagen de ejercicio detectada y cargada con éxito! 🎉";
        
        break;
      }
    }
  });
});

// ---------- Sesión ----------

async function checkSession() {
  if (!IS_CONFIGURED) return;
  const { data } = await supabaseClient.auth.getSession();
  if (data.session) {
    await enterAdminMode();
  }
}

async function enterAdminMode() {
  state.isAdmin = true;
  const area = $("#session-area");
  area.innerHTML = `
    <span class="admin-pill">● Modo editor</span>
    <button class="btn-ghost" id="btn-logout">Cerrar sesión</button>
  `;
  $("#btn-logout").addEventListener("click", logout);
  $("#btn-add").classList.remove("hidden");
  renderCards();
}

async function logout() {
  await supabaseClient.auth.signOut();
  state.isAdmin = false;
  $("#session-area").innerHTML = `<button class="btn-ghost" id="btn-login">Iniciar sesión</button>`;
  $("#btn-login").addEventListener("click", () => {
    $("#login-backdrop").classList.remove("hidden");
  });
  $("#btn-add").classList.add("hidden");
  renderCards();
  showToast("Sesión cerrada.");
}

// ---------- Modal Añadir / Editar recurso ----------

function fillSemanaOptions() {
  const select = $("#f-semana");
  select.innerHTML = "";
  for (let i = 1; i <= 9; i++) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = `Semana ${i}`;
    select.appendChild(opt);
  }
}

function openResourceModal(item) {
  fillSemanaOptions();
  $("#resource-error").classList.add("hidden");
  $("#resource-form").reset();
  $("#f-descripcion").placeholder = ""; // Limpiar placeholder de feedback

  if (item) {
    $("#resource-modal-title").textContent = "Editar recurso";
    $("#resource-id").value = item.id;
    $("#f-semana").value = item.semana;
    $("#f-seccion").value = item.seccion;
    $("#f-titulo").value = item.titulo;
    $("#f-descripcion").value = item.descripcion || "";
  } else {
    $("#resource-modal-title").textContent = "Añadir nuevo recurso";
    $("#resource-id").value = "";
    $("#f-semana").value = state.semanaActual;
    $("#f-seccion").value = state.seccionActual;
  }

  $("#resource-backdrop").classList.remove("hidden");
}

function closeResourceModal() {
  $("#resource-backdrop").classList.add("hidden");
}

async function uploadFile(bucket, file) {
  const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
  const { error } = await supabaseClient.storage.from(bucket).upload(path, file);
  if (error) throw error;
  const { data } = supabaseClient.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

async function handleResourceSubmit(e) {
  e.preventDefault();
  const submitBtn = $("#resource-submit");
  const errorEl = $("#resource-error");
  errorEl.classList.add("hidden");
  submitBtn.disabled = true;
  submitBtn.textContent = "Guardando…";

  try {
    const id = $("#resource-id").value;
    const payload = {
      materia_id: state.materiaActual.id,
      semana: parseInt($("#f-semana").value, 10),
      seccion: $("#f-seccion").value,
      titulo: $("#f-titulo").value.trim(),
      descripcion: $("#f-descripcion").value.trim(),
    };

    const imagenFile = $("#f-imagen").files[0];
    const diapositivaFile = $("#f-diapositiva").files[0];

    if (imagenFile) payload.url_imagen = await uploadFile(BUCKET_IMAGENES, imagenFile);
    if (diapositivaFile) payload.url_diapositiva = await uploadFile(BUCKET_DIAPOSITIVAS, diapositivaFile);

    let result;
    if (id) {
      result = await supabaseClient.from("contenidos").update(payload).eq("id", id);
    } else {
      result = await supabaseClient.from("contenidos").insert(payload);
    }

    if (result.error) throw result.error;

    closeResourceModal();
    showToast(id ? "Recurso actualizado." : "Recurso creado.");
    await loadContenidosSemana();
  } catch (err) {
    errorEl.textContent = "No se pudo guardar: " + err.message;
    errorEl.classList.remove("hidden");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Guardar";
  }
}

async function deleteContenido(id) {
  if (!confirm("¿Eliminar este recurso? Esta acción no se puede deshacer.")) return;

  const { error } = await supabaseClient.from("contenidos").delete().eq("id", id);
  if (error) {
    showToast("Error al eliminar: " + error.message, true);
    return;
  }
  showToast("Recurso eliminado.");
  await loadContenidosSemana();
}