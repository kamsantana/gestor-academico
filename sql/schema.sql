-- ==========================================================
-- ESQUEMA: Gestor Académico (Arquitectura de Software / Calidad de Software)
-- Ejecutar en: Supabase > SQL Editor
-- ==========================================================

-- 1) EXTENSIONES ---------------------------------------------------------
create extension if not exists "uuid-ossp";

-- 2) TABLAS ---------------------------------------------------------------

create table if not exists materias (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null,
  slug text unique not null,
  color text default '#4FD1E8'
);

create table if not exists contenidos (
  id uuid primary key default uuid_generate_v4(),
  materia_id uuid references materias(id) on delete cascade not null,
  semana int not null check (semana between 1 and 9),
  seccion text not null check (seccion in ('concepto', 'tarea', 'consulta')),
  titulo text not null,
  descripcion text,
  url_imagen text,
  url_diapositiva text,
  created_at timestamp with time zone default now()
);

-- 3) DATOS INICIALES -------------------------------------------------------

insert into materias (nombre, slug, color) values
  ('Arquitectura de Software', 'arquitectura-de-software', '#4FD1E8'),
  ('Calidad de Software', 'calidad-de-software', '#E8734A')
on conflict (slug) do nothing;

-- Dato de prueba (Fase 2 del roadmap)
insert into contenidos (materia_id, semana, seccion, titulo, descripcion)
select id, 1, 'concepto', 'Introducción a la materia',
       'Contenido de ejemplo. Edítalo o bórralo desde el panel de administración.'
from materias where slug = 'arquitectura-de-software'
limit 1;

-- 4) ROW LEVEL SECURITY (RLS) ----------------------------------------------

alter table materias enable row level security;
alter table contenidos enable row level security;

-- Lectura pública (cualquiera, incluso sin sesión, puede leer)
create policy "Lectura publica materias"
  on materias for select
  using (true);

create policy "Lectura publica contenidos"
  on contenidos for select
  using (true);

-- Escritura solo para usuarios autenticados (tu usuario admin)
create policy "Insertar solo autenticado"
  on contenidos for insert
  to authenticated
  with check (true);

create policy "Actualizar solo autenticado"
  on contenidos for update
  to authenticated
  using (true)
  with check (true);

create policy "Eliminar solo autenticado"
  on contenidos for delete
  to authenticated
  using (true);

-- (Opcional) permitir editar el nombre/color de materias solo a autenticados
create policy "Editar materias solo autenticado"
  on materias for update
  to authenticated
  using (true)
  with check (true);

-- 5) STORAGE (Buckets) -----------------------------------------------------
-- Estos buckets también se pueden crear desde el panel Storage de Supabase.
-- Si prefieres SQL, ejecuta esto (requiere permisos de servicio):

insert into storage.buckets (id, name, public)
values
  ('imagenes-academicas', 'imagenes-academicas', true),
  ('diapositivas-clase', 'diapositivas-clase', true)
on conflict (id) do nothing;

-- Políticas de Storage: lectura pública, escritura solo autenticado
create policy "Lectura publica imagenes"
  on storage.objects for select
  using (bucket_id = 'imagenes-academicas');

create policy "Lectura publica diapositivas"
  on storage.objects for select
  using (bucket_id = 'diapositivas-clase');

create policy "Subida imagenes solo autenticado"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'imagenes-academicas');

create policy "Subida diapositivas solo autenticado"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'diapositivas-clase');

create policy "Borrado archivos solo autenticado"
  on storage.objects for delete
  to authenticated
  using (bucket_id in ('imagenes-academicas', 'diapositivas-clase'));

-- ==========================================================
-- FIN. Después de ejecutar esto, crea tu usuario admin en:
-- Authentication > Users > Add user (Supabase Dashboard)
-- ==========================================================
