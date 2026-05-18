# GymFlow Roadmap

## ✅ Fase 1 — Fundación
- [x] Proyecto Vite + React + TypeScript + Tailwind v4
- [x] Supabase Cloud (São Paulo) — conexión verificada
- [x] Schema completo con RLS, triggers, funciones y view `progress_comparison`
- [x] Tipos de base de datos generados (`database.types.ts`)
- [x] Auth con login único y redirect por rol
- [x] Seed de 26 ejercicios cargado

## ✅ Fase 2 — Admin Dashboard
- [x] Layout con sidebar colapsable negro + rojo
- [x] Miembros: CRUD completo con creación de auth users
- [x] Membresías: asignar plan, ver estado, 3 cards resumen, admin_override
- [x] Ejercicios: grilla con thumbnails YouTube, filtros por grupo muscular
- [x] Rutinas: 3 columnas (miembros → días → ejercicios), auto-save

## ✅ Fase 3 — User App
- [x] Home con saludo, membresía (3 estados), novedades, mini dashboard stats
- [x] Rutina: selector de días → ejercicios del profe (readonly) + inputs del miembro → guardado con lógica baseline automática
- [x] Membresía: detalle ampliado del plan, fechas, días restantes
- [x] Progreso: comparación baseline vs current vs delta + historial de sesiones
- [x] UserLayout con drawer de navegación mobile-first
- [x] PWA: manifest.json, meta tags mobile
- [x] Modo oscuro automático (prefers-color-scheme)
- [x] View `progress_comparison` corregida (DISTINCT ON + ORDER BY logged_at DESC)
- [x] RLS policies agregadas para `workout_logs`, `workout_sessions`, `routine_exercises`, `exercises`

### Bugs corregidos en Fase 3
- [x] Profile.id no cargado a tiempo en Rutina.tsx — guardia `if (!profile?.id) return`
- [x] Ejercicios no visibles en rutina — RLS en `routine_exercises` sin SELECT policy para members
- [x] "undefinedkg" en Progreso — ProgressItem type usaba `current_weight_kg` pero la view devuelve `current_weight`
- [x] renderizado de nulls en Baseline / Actual / Progreso

## 🔄 Fase 4 — Pulido pre-lanzamiento (en progreso)

### 4.1 ✅ Bloqueo membresía vencida con planes de pago
- [x] `MembershipGate` component — wrapper en UserLayout que chequea membresía activa
- [x] Pantalla de bloqueo con cards de planes (Mensual/Semestral/Anual) + botón Consultar → WhatsApp
- [x] Fetch de planes activos desde `membership_plans`
- [x] Botón "Cerrar sesión" en pantalla de bloqueo

### 4.2 ✅ Backend Node.js (parcial — falta deploy a Render)
- [x] Servicio Node.js con cron para `expire_memberships()` (alternativa a pg_cron que requiere Supabase Pro)
- [x] Endpoint `POST /api/members` con `service_role` para crear auth users sin confirmación de email
- [x] Members.tsx conectado al endpoint del backend
- [ ] Configurar Resend para emails de reset de contraseña
- [ ] Template de recovery email personalizado
- [ ] Deploy a Render con entorno configurado

### 4.3 ✅ Expiración automática
- [x] Cron en Node.js programado para ejecutar `expire_memberships()` diariamente
- [x] Verificado: función `expire_memberships()` existe y responde 204 en BD

### 4.4 ✅ Datos de demo
- [x] Script `demo_seed.sql` con datos de demostración para presentación comercial
- [x] 3 miembros de prueba, 12 ejercicios, 3 rutinas, progreso simulado

### 4.5 ✅ Ícono PWA
- [x] Icono dumbbell generado con sharp (192px y 512px)
- [x] manifest.json apunta a los assets correctos

### 4.6 ✅ Noticias del gym (admin → user app)
- [x] Tabla `gym_news` con RLS (admin gestiona, miembro ve activas)
- [x] Página admin `/admin/news` con CRUD completo (crear, toggle activo, eliminar)
- [x] Sidebar de admin con item "Noticias"
- [x] Home del miembro consume noticias activas desde BD (reemplaza hardcodeadas)
- [x] Tags con colores automáticos: Aviso (rojo), Nuevo (azul), Importante (amarillo), Promoción (verde)

### 4.7 ✅ Separar Planes (catálogo) de Membresías (asignaciones)
- [x] Nueva página `PlanCatalog.tsx` — CRUD del catálogo `membership_plans` (nombre, precio, duración, toggle activo)
- [x] Sidebar: "Planes" (🏷️) → catálogo, "Membresías" (💳) → asignaciones
- [x] Ruta `/admin/plan-catalog` registrada en App.tsx

### 4.8 🔲 Deploy a Netlify
- [x] archivo `_redirects` para SPA fallback
- [ ] Setear environment variables en Netlify Dashboard (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_BACKEND_URL)
- [ ] Redeploy forzado

### Refactors pendientes
- [ ] `Routines.tsx` (1449 líneas) — dividir en componentes
- [ ] `useAuth.ts` — unificar los 3 useEffects en uno
- [ ] Reemplazar `(supabase as any)` con tipos generados
- [x] Login: branding unificado con rojo #DC2626
- [ ] Dashboard de admin con datos reales (hoy es placeholder)

## 🔲 Fase 5 — Post MVP
- [ ] Sistema de puntos y gamificación (rachas, logros)
- [ ] Estrategia de multitenancy para múltiples gimnasios
- [ ] Testing (vitest + MSW para integration tests)
- [ ] CI/CD con GitHub Actions
