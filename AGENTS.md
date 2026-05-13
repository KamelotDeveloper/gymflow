# GymFlow — Domain Model

## What is GymFlow

Sistema de gestión de gimnasio. Dos roles: **admin** (dashboard de gestión) y **member** (app de usuario). Construido sobre Supabase (PostgreSQL 15+).

## Core Entities

| Entity | Role |
|---|---|
| `profiles` | Extiende auth.users. Se crea automáticamente al registrar via trigger. |
| `membership_plans` | Catálogo de planes (Mensual/Semestral/Anual pre-seedeados). Soft-delete via `is_active`. |
| `memberships` | Una activa por miembro. `admin_override` permite extender acceso manualmente sin renovación. |
| `exercises` | Biblioteca global de ejercicios con video YouTube obligatorio. Agrupados por `muscle_group`. |
| `routines` | Plantillas de entrenamiento creadas por admin. `is_template` para rutinas base del gym. |
| `routine_exercises` | Detalle de ejercicios dentro de una rutina (series, reps, peso sugerido, orden). |
| `routine_assignments` | Asignación de rutina a miembro. Solo una activa a la vez. |
| `workout_sessions` | Cada vez que un miembro abre y completa su rutina. |
| `workout_logs` | Corazón del progreso: cada set de cada ejercicio en cada sesión. |

## Progress Tracking (Baseline / Current / Delta)

- **Baseline** (`is_baseline = true`): primera vez que un usuario registra un ejercicio. **Inmutable** — nunca se actualiza desde la app (RLS lo bloquea, solo admin puede override).
- **Current** (`is_baseline = false`): datos de sesiones posteriores. La app lee el último registro.
- **Comparison**: `progress_comparison` view que expone delta_reps y delta_weight_kg por miembro/ejercicio/set.

## Membership Lifecycle

- `expire_memberships()`: function para programar con cron, marca como `expired` membresías vencidas sin `admin_override`.
- `get_active_membership(p_profile_id)`: helper para obtener membresía vigente (considera tanto active como admin_override).

## Domain Rules

- Dos roles: `admin` y `member`. Solo admin puede crear/editar ejercicios, rutinas, planes. Miembro solo registra sesiones y ve lo propio.
- RLS (Row Level Security) en todas las tablas. Miembro ve solo sus datos. Admin ve todo.
- `workout_logs` con `is_baseline = true` no se pueden modificar desde app.
- Planes se desactivan (`is_active = false`), no se borran.
- Ejercicios requieren video URL (YouTube u otro) — no hay ejercicio sin video.

## Files

| File | What |
|---|---|
| `agent.txt` | DDL completo con dominio, RLS, funciones, triggers y comentarios |
| `gymflow_erd_schema.html` | ERD visual (Mermaid, CDN via esm.sh, requiere internet) |
