# Gestor Académico — Arquitectura de Software / Calidad de Software

Aplicación web responsiva para gestionar y visualizar contenido académico (conceptos, tareas, consultas y recursos) organizado en un ciclo de 9 semanas, para dos materias. Incluye vista pública de solo lectura y un panel de administración protegido por autenticación.

## Estructura del proyecto

```
gestor-academico/
├── index.html              # Página única (vista pública + login + panel admin)
├── css/
│   └── styles.css          # Identidad visual "plano técnico"
├── js/
│   ├── config.js           # ← AQUÍ pegas tus credenciales de Supabase
│   ├── supabaseClient.js   # Inicializa el cliente de Supabase
│   ├── app.js               # Lógica pública (lectura)
│   └── admin.js             # Lógica de administración (login + CRUD)
└── sql/
    └── schema.sql           # Tablas, políticas RLS y buckets de Storage
```

## Puesta en marcha (paso a paso)

### 1. Crear el proyecto en Supabase
1. Ve a [supabase.com](https://supabase.com) y crea un proyecto nuevo.
2. Ve a **SQL Editor** → pega el contenido completo de `sql/schema.sql` → **Run**.
   - Esto crea las tablas `materias` y `contenidos`, las políticas RLS (lectura pública / escritura solo autenticada), inserta las dos materias y crea los dos buckets de Storage (`imagenes-academicas`, `diapositivas-clase`).
3. Ve a **Authentication → Users → Add user** y crea tu usuario administrador (correo + contraseña). Ese será el único login válido para el panel de edición.

### 2. Conectar el frontend
1. Ve a **Project Settings → API** en Supabase.
2. Copia el **Project URL** y la **anon public key**.
3. Ábrelas en `js/config.js` y reemplaza:
   ```js
   const SUPABASE_URL = "https://TU-PROYECTO.supabase.co";
   const SUPABASE_ANON_KEY = "TU-ANON-PUBLIC-KEY";
   ```

### 3. Probar en local
Abre `index.html` con una extensión tipo "Live Server" (VS Code) o corre un servidor simple:
```bash
npx serve .
# o
python3 -m http.server 8080
```
No lo abras con doble clic directo (`file://`) porque algunos navegadores bloquean las peticiones fetch en ese modo.

### 4. Usar el panel de administración
- Botón **"Iniciar sesión"** (arriba a la derecha) → ingresa con el usuario creado en el paso 1.3.
- Al iniciar sesión aparece el botón **"+ Añadir nuevo recurso"** y, al pasar el cursor sobre cada tarjeta, los íconos ✏️ (editar) y 🗑️ (eliminar).
- Los archivos que subas en el formulario (imagen / diapositiva) se guardan en Supabase Storage y su URL pública se enlaza automáticamente al contenido.

### 5. Desplegar (Vercel / Netlify / GitHub Pages)
Como es un sitio 100% estático, puedes subir la carpeta tal cual:

**Vercel / Netlify:**
1. Sube esta carpeta a un repositorio de GitHub.
2. Importa el repo en Vercel o Netlify (framework: "Other" / sin build step).
3. Deploy.

**GitHub Pages:**
1. Sube el repo a GitHub.
2. Settings → Pages → Source: rama `main`, carpeta `/root`.
3. Guarda — tu sitio quedará en `https://tuusuario.github.io/tu-repo/`.

> ⚠️ La `anon key` de Supabase es segura de exponer en el frontend: el acceso de escritura está protegido por las políticas RLS definidas en `schema.sql`, no por ocultar la key.

## Roadmap de desarrollo (referencia)

- **Fase 1 — Local:** plantillas HTML/CSS estáticas (✅ incluido en este proyecto).
- **Fase 2 — Base de datos:** tablas + datos de prueba en Supabase (`sql/schema.sql`).
- **Fase 3 — Conexión JS:** consultas dinámicas por semana/sección (`js/app.js`).
- **Fase 4 — Panel admin y archivos:** login + CRUD + subida a Storage (`js/admin.js`).
- **Fase 5 — Despliegue:** GitHub + Vercel/Netlify/GitHub Pages (ver arriba).

## Notas de diseño

La interfaz usa el lenguaje visual de un **plano técnico de arquitectura** (rejilla de fondo, marcas de registro en las esquinas, bloques de título, tarjetas tipo "hoja de especificación"), en línea con que la materia principal es *Arquitectura de Software*. La materia "Calidad de Software" se distingue con un acento ámbar (tipo sello de control de calidad) frente al cian de "Arquitectura".
