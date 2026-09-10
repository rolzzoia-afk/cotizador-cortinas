export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agente_docs: {
        Row: {
          activo: boolean
          categoria: string
          contenido_md: string
          empresa_id: string
          id: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          activo?: boolean
          categoria: string
          contenido_md?: string
          empresa_id: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          activo?: boolean
          categoria?: string
          contenido_md?: string
          empresa_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "agente_docs_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agente_docs_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agente_docs_versiones: {
        Row: {
          categoria: string
          contenido_md: string
          created_at: string
          doc_id: string
          empresa_id: string
          id: string
          updated_by: string | null
          version: number
        }
        Insert: {
          categoria: string
          contenido_md: string
          created_at?: string
          doc_id: string
          empresa_id: string
          id?: string
          updated_by?: string | null
          version: number
        }
        Update: {
          categoria?: string
          contenido_md?: string
          created_at?: string
          doc_id?: string
          empresa_id?: string
          id?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "agente_docs_versiones_doc_id_fkey"
            columns: ["doc_id"]
            isOneToOne: false
            referencedRelation: "agente_docs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agente_docs_versiones_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      alertas_planes_huerfanos: {
        Row: {
          cortes_planeados: number
          detected_at: string
          empresa_id: string
          events_registrados: number
          id: number
          minutos_desde_plan: number
          ot: string
          resolucion_notas: string | null
          resolved_at: string | null
          resuelto_por: string | null
          severidad: string
          ultimo_plan_at: string
        }
        Insert: {
          cortes_planeados: number
          detected_at?: string
          empresa_id: string
          events_registrados: number
          id?: number
          minutos_desde_plan: number
          ot: string
          resolucion_notas?: string | null
          resolved_at?: string | null
          resuelto_por?: string | null
          severidad: string
          ultimo_plan_at: string
        }
        Update: {
          cortes_planeados?: number
          detected_at?: string
          empresa_id?: string
          events_registrados?: number
          id?: number
          minutos_desde_plan?: number
          ot?: string
          resolucion_notas?: string | null
          resolved_at?: string | null
          resuelto_por?: string | null
          severidad?: string
          ultimo_plan_at?: string
        }
        Relationships: []
      }
      alertas_stock: {
        Row: {
          codigo: string
          created_at: string | null
          empresa_id: string
          id: string
          leida: boolean | null
          leida_at: string | null
          leida_por: string | null
          mensaje: string | null
          tipo_alerta: string
        }
        Insert: {
          codigo: string
          created_at?: string | null
          empresa_id?: string
          id?: string
          leida?: boolean | null
          leida_at?: string | null
          leida_por?: string | null
          mensaje?: string | null
          tipo_alerta: string
        }
        Update: {
          codigo?: string
          created_at?: string | null
          empresa_id?: string
          id?: string
          leida?: boolean | null
          leida_at?: string | null
          leida_por?: string | null
          mensaje?: string | null
          tipo_alerta?: string
        }
        Relationships: []
      }
      almacenes: {
        Row: {
          activo: boolean
          camioneta_id: string | null
          codigo: string
          creado_en: string
          empresa_id: string
          id: string
          nombre: string
          tipo: string
        }
        Insert: {
          activo?: boolean
          camioneta_id?: string | null
          codigo: string
          creado_en?: string
          empresa_id: string
          id?: string
          nombre: string
          tipo?: string
        }
        Update: {
          activo?: boolean
          camioneta_id?: string | null
          codigo?: string
          creado_en?: string
          empresa_id?: string
          id?: string
          nombre?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "almacenes_camioneta_id_fkey"
            columns: ["camioneta_id"]
            isOneToOne: false
            referencedRelation: "camionetas"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          accion: string
          datos_anteriores: Json | null
          datos_nuevos: Json | null
          diff: Json | null
          empresa_id: string
          entidad_id: string | null
          id: number
          tabla: string
          timestamp: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          accion: string
          datos_anteriores?: Json | null
          datos_nuevos?: Json | null
          diff?: Json | null
          empresa_id: string
          entidad_id?: string | null
          id?: number
          tabla: string
          timestamp?: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          accion?: string
          datos_anteriores?: Json | null
          datos_nuevos?: Json | null
          diff?: Json | null
          empresa_id?: string
          entidad_id?: string | null
          id?: number
          tabla?: string
          timestamp?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      avisos_produccion: {
        Row: {
          area: string
          atendido: boolean
          atendido_en: string | null
          atendido_por: string | null
          creado_en: string
          creado_por: string | null
          creado_por_id: string | null
          empresa_id: string
          id: string
          mensaje: string
          ot: string
        }
        Insert: {
          area?: string
          atendido?: boolean
          atendido_en?: string | null
          atendido_por?: string | null
          creado_en?: string
          creado_por?: string | null
          creado_por_id?: string | null
          empresa_id: string
          id?: string
          mensaje: string
          ot?: string
        }
        Update: {
          area?: string
          atendido?: boolean
          atendido_en?: string | null
          atendido_por?: string | null
          creado_en?: string
          creado_por?: string | null
          creado_por_id?: string | null
          empresa_id?: string
          id?: string
          mensaje?: string
          ot?: string
        }
        Relationships: []
      }
      camionetas: {
        Row: {
          activa: boolean | null
          created_at: string | null
          empresa_id: string
          id: string
          instalador: string | null
          nombre: string
          patente: string | null
        }
        Insert: {
          activa?: boolean | null
          created_at?: string | null
          empresa_id: string
          id?: string
          instalador?: string | null
          nombre: string
          patente?: string | null
        }
        Update: {
          activa?: boolean | null
          created_at?: string | null
          empresa_id?: string
          id?: string
          instalador?: string | null
          nombre?: string
          patente?: string | null
        }
        Relationships: []
      }
      clientes: {
        Row: {
          created_at: string | null
          direccion: string | null
          email: string | null
          empresa_id: string
          id: string
          nombre: string
          rut: string | null
          telefono: string | null
        }
        Insert: {
          created_at?: string | null
          direccion?: string | null
          email?: string | null
          empresa_id: string
          id?: string
          nombre: string
          rut?: string | null
          telefono?: string | null
        }
        Update: {
          created_at?: string | null
          direccion?: string | null
          email?: string | null
          empresa_id?: string
          id?: string
          nombre?: string
          rut?: string | null
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      coaching_objeciones: {
        Row: {
          activo: boolean
          categoria: string
          created_at: string
          empresa_id: string
          id: string
          objecion: string
          orden: number
          respuesta: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          categoria: string
          created_at?: string
          empresa_id: string
          id?: string
          objecion: string
          orden?: number
          respuesta: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          categoria?: string
          created_at?: string
          empresa_id?: string
          id?: string
          objecion?: string
          orden?: number
          respuesta?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coaching_objeciones_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      coaching_tips: {
        Row: {
          activo: boolean
          contenido: string
          created_at: string
          empresa_id: string
          fuente: string | null
          id: string
          orden: number
          titulo: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          contenido: string
          created_at?: string
          empresa_id: string
          fuente?: string | null
          id?: string
          orden?: number
          titulo: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          contenido?: string
          created_at?: string
          empresa_id?: string
          fuente?: string | null
          id?: string
          orden?: number
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coaching_tips_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      colmena_panos: {
        Row: {
          codigo: string | null
          created_at: string | null
          datos_extra: Json | null
          disponible: boolean | null
          empresa_id: string
          fecha_uso: string | null
          id: string
          medida_alto: number | null
          medida_ancho: number | null
          ot_asignada: string | null
          tela_id: string | null
          tipo: string | null
          ubicacion: string | null
        }
        Insert: {
          codigo?: string | null
          created_at?: string | null
          datos_extra?: Json | null
          disponible?: boolean | null
          empresa_id: string
          fecha_uso?: string | null
          id?: string
          medida_alto?: number | null
          medida_ancho?: number | null
          ot_asignada?: string | null
          tela_id?: string | null
          tipo?: string | null
          ubicacion?: string | null
        }
        Update: {
          codigo?: string | null
          created_at?: string | null
          datos_extra?: Json | null
          disponible?: boolean | null
          empresa_id?: string
          fecha_uso?: string | null
          id?: string
          medida_alto?: number | null
          medida_ancho?: number | null
          ot_asignada?: string | null
          tela_id?: string | null
          tipo?: string | null
          ubicacion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "colmena_panos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colmena_panos_tela_id_fkey"
            columns: ["tela_id"]
            isOneToOne: false
            referencedRelation: "telas"
            referencedColumns: ["id"]
          },
        ]
      }
      colmena_panos_backup_20260626: {
        Row: {
          codigo: string | null
          created_at: string | null
          datos_extra: Json | null
          disponible: boolean | null
          empresa_id: string | null
          fecha_uso: string | null
          id: string | null
          medida_alto: number | null
          medida_ancho: number | null
          ot_asignada: string | null
          tela_id: string | null
          tipo: string | null
          ubicacion: string | null
        }
        Insert: {
          codigo?: string | null
          created_at?: string | null
          datos_extra?: Json | null
          disponible?: boolean | null
          empresa_id?: string | null
          fecha_uso?: string | null
          id?: string | null
          medida_alto?: number | null
          medida_ancho?: number | null
          ot_asignada?: string | null
          tela_id?: string | null
          tipo?: string | null
          ubicacion?: string | null
        }
        Update: {
          codigo?: string | null
          created_at?: string | null
          datos_extra?: Json | null
          disponible?: boolean | null
          empresa_id?: string | null
          fecha_uso?: string | null
          id?: string | null
          medida_alto?: number | null
          medida_ancho?: number | null
          ot_asignada?: string | null
          tela_id?: string | null
          tipo?: string | null
          ubicacion?: string | null
        }
        Relationships: []
      }
      colmena_panos_backup_20260707_rolzzo: {
        Row: {
          codigo: string | null
          created_at: string | null
          datos_extra: Json | null
          disponible: boolean | null
          empresa_id: string | null
          fecha_uso: string | null
          id: string | null
          medida_alto: number | null
          medida_ancho: number | null
          ot_asignada: string | null
          tela_id: string | null
          tipo: string | null
          ubicacion: string | null
        }
        Insert: {
          codigo?: string | null
          created_at?: string | null
          datos_extra?: Json | null
          disponible?: boolean | null
          empresa_id?: string | null
          fecha_uso?: string | null
          id?: string | null
          medida_alto?: number | null
          medida_ancho?: number | null
          ot_asignada?: string | null
          tela_id?: string | null
          tipo?: string | null
          ubicacion?: string | null
        }
        Update: {
          codigo?: string | null
          created_at?: string | null
          datos_extra?: Json | null
          disponible?: boolean | null
          empresa_id?: string | null
          fecha_uso?: string | null
          id?: string | null
          medida_alto?: number | null
          medida_ancho?: number | null
          ot_asignada?: string | null
          tela_id?: string | null
          tipo?: string | null
          ubicacion?: string | null
        }
        Relationships: []
      }
      colmena_panos_backup_galpon_log_20260626: {
        Row: {
          codigo: string | null
          created_at: string | null
          datos_extra: Json | null
          disponible: boolean | null
          empresa_id: string | null
          fecha_uso: string | null
          id: string | null
          medida_alto: number | null
          medida_ancho: number | null
          ot_asignada: string | null
          tela_id: string | null
          tipo: string | null
          ubicacion: string | null
        }
        Insert: {
          codigo?: string | null
          created_at?: string | null
          datos_extra?: Json | null
          disponible?: boolean | null
          empresa_id?: string | null
          fecha_uso?: string | null
          id?: string | null
          medida_alto?: number | null
          medida_ancho?: number | null
          ot_asignada?: string | null
          tela_id?: string | null
          tipo?: string | null
          ubicacion?: string | null
        }
        Update: {
          codigo?: string | null
          created_at?: string | null
          datos_extra?: Json | null
          disponible?: boolean | null
          empresa_id?: string | null
          fecha_uso?: string | null
          id?: string | null
          medida_alto?: number | null
          medida_ancho?: number | null
          ot_asignada?: string | null
          tela_id?: string | null
          tipo?: string | null
          ubicacion?: string | null
        }
        Relationships: []
      }
      colmena_panos_backup_reactivar_20260904: {
        Row: {
          codigo: string | null
          created_at: string | null
          datos_extra: Json | null
          disponible: boolean | null
          empresa_id: string | null
          fecha_uso: string | null
          id: string | null
          medida_alto: number | null
          medida_ancho: number | null
          ot_asignada: string | null
          tela_id: string | null
          tipo: string | null
          ubicacion: string | null
        }
        Insert: {
          codigo?: string | null
          created_at?: string | null
          datos_extra?: Json | null
          disponible?: boolean | null
          empresa_id?: string | null
          fecha_uso?: string | null
          id?: string | null
          medida_alto?: number | null
          medida_ancho?: number | null
          ot_asignada?: string | null
          tela_id?: string | null
          tipo?: string | null
          ubicacion?: string | null
        }
        Update: {
          codigo?: string | null
          created_at?: string | null
          datos_extra?: Json | null
          disponible?: boolean | null
          empresa_id?: string | null
          fecha_uso?: string | null
          id?: string | null
          medida_alto?: number | null
          medida_ancho?: number | null
          ot_asignada?: string | null
          tela_id?: string | null
          tipo?: string | null
          ubicacion?: string | null
        }
        Relationships: []
      }
      colmena_panos_backup_vaciado_20260806: {
        Row: {
          codigo: string | null
          created_at: string | null
          datos_extra: Json | null
          disponible: boolean | null
          empresa_id: string | null
          fecha_uso: string | null
          id: string | null
          medida_alto: number | null
          medida_ancho: number | null
          ot_asignada: string | null
          tela_id: string | null
          tipo: string | null
          ubicacion: string | null
        }
        Insert: {
          codigo?: string | null
          created_at?: string | null
          datos_extra?: Json | null
          disponible?: boolean | null
          empresa_id?: string | null
          fecha_uso?: string | null
          id?: string | null
          medida_alto?: number | null
          medida_ancho?: number | null
          ot_asignada?: string | null
          tela_id?: string | null
          tipo?: string | null
          ubicacion?: string | null
        }
        Update: {
          codigo?: string | null
          created_at?: string | null
          datos_extra?: Json | null
          disponible?: boolean | null
          empresa_id?: string | null
          fecha_uso?: string | null
          id?: string | null
          medida_alto?: number | null
          medida_ancho?: number | null
          ot_asignada?: string | null
          tela_id?: string | null
          tipo?: string | null
          ubicacion?: string | null
        }
        Relationships: []
      }
      colmena_sync_state: {
        Row: {
          empresa_id: string
          last_sync_at: string
          last_sync_by: string | null
        }
        Insert: {
          empresa_id: string
          last_sync_at?: string
          last_sync_by?: string | null
        }
        Update: {
          empresa_id?: string
          last_sync_at?: string
          last_sync_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "colmena_sync_state_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      colmena_tubos: {
        Row: {
          agregado_por_admin: boolean | null
          cod: string | null
          created_at: string | null
          datos_extra: Json | null
          disponible: boolean | null
          empresa_id: string
          id: string
          medida_cm: number | null
          medida_mm: number | null
          n_colmena: string | null
          serial: string | null
          tubo_raiz_id: string
        }
        Insert: {
          agregado_por_admin?: boolean | null
          cod?: string | null
          created_at?: string | null
          datos_extra?: Json | null
          disponible?: boolean | null
          empresa_id: string
          id?: string
          medida_cm?: number | null
          medida_mm?: number | null
          n_colmena?: string | null
          serial?: string | null
          tubo_raiz_id?: string
        }
        Update: {
          agregado_por_admin?: boolean | null
          cod?: string | null
          created_at?: string | null
          datos_extra?: Json | null
          disponible?: boolean | null
          empresa_id?: string
          id?: string
          medida_cm?: number | null
          medida_mm?: number | null
          n_colmena?: string | null
          serial?: string | null
          tubo_raiz_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "colmena_tubos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      colmena_tubos_audit: {
        Row: {
          app_sync_active: boolean
          cod: string | null
          deleted_at: string
          deleted_by_role: string
          deleted_by_user: string | null
          empresa_id: string
          id: number
          medida_cm: number | null
          n_colmena: string | null
          payload: Json
          tubo_id: string
          tubo_raiz_id: string | null
        }
        Insert: {
          app_sync_active: boolean
          cod?: string | null
          deleted_at?: string
          deleted_by_role: string
          deleted_by_user?: string | null
          empresa_id: string
          id?: number
          medida_cm?: number | null
          n_colmena?: string | null
          payload: Json
          tubo_id: string
          tubo_raiz_id?: string | null
        }
        Update: {
          app_sync_active?: boolean
          cod?: string | null
          deleted_at?: string
          deleted_by_role?: string
          deleted_by_user?: string | null
          empresa_id?: string
          id?: number
          medida_cm?: number | null
          n_colmena?: string | null
          payload?: Json
          tubo_id?: string
          tubo_raiz_id?: string | null
        }
        Relationships: []
      }
      colmena_tubos_backup_20260702_reversa_3088b: {
        Row: {
          agregado_por_admin: boolean | null
          cod: string | null
          created_at: string | null
          datos_extra: Json | null
          disponible: boolean | null
          empresa_id: string | null
          id: string | null
          medida_cm: number | null
          medida_mm: number | null
          n_colmena: string | null
          serial: string | null
          tubo_raiz_id: string | null
        }
        Insert: {
          agregado_por_admin?: boolean | null
          cod?: string | null
          created_at?: string | null
          datos_extra?: Json | null
          disponible?: boolean | null
          empresa_id?: string | null
          id?: string | null
          medida_cm?: number | null
          medida_mm?: number | null
          n_colmena?: string | null
          serial?: string | null
          tubo_raiz_id?: string | null
        }
        Update: {
          agregado_por_admin?: boolean | null
          cod?: string | null
          created_at?: string | null
          datos_extra?: Json | null
          disponible?: boolean | null
          empresa_id?: string | null
          id?: string | null
          medida_cm?: number | null
          medida_mm?: number | null
          n_colmena?: string | null
          serial?: string | null
          tubo_raiz_id?: string | null
        }
        Relationships: []
      }
      colmena_tubos_backup_20260703_reversa_3088b: {
        Row: {
          agregado_por_admin: boolean | null
          cod: string | null
          created_at: string | null
          datos_extra: Json | null
          disponible: boolean | null
          empresa_id: string | null
          id: string | null
          medida_cm: number | null
          medida_mm: number | null
          n_colmena: string | null
          serial: string | null
          tubo_raiz_id: string | null
        }
        Insert: {
          agregado_por_admin?: boolean | null
          cod?: string | null
          created_at?: string | null
          datos_extra?: Json | null
          disponible?: boolean | null
          empresa_id?: string | null
          id?: string | null
          medida_cm?: number | null
          medida_mm?: number | null
          n_colmena?: string | null
          serial?: string | null
          tubo_raiz_id?: string | null
        }
        Update: {
          agregado_por_admin?: boolean | null
          cod?: string | null
          created_at?: string | null
          datos_extra?: Json | null
          disponible?: boolean | null
          empresa_id?: string | null
          id?: string | null
          medida_cm?: number | null
          medida_mm?: number | null
          n_colmena?: string | null
          serial?: string | null
          tubo_raiz_id?: string | null
        }
        Relationships: []
      }
      colmena_tubos_backup_20260715_prueba_banda: {
        Row: {
          agregado_por_admin: boolean | null
          cod: string | null
          created_at: string | null
          datos_extra: Json | null
          disponible: boolean | null
          empresa_id: string | null
          id: string | null
          medida_cm: number | null
          medida_mm: number | null
          n_colmena: string | null
          serial: string | null
          tubo_raiz_id: string | null
        }
        Insert: {
          agregado_por_admin?: boolean | null
          cod?: string | null
          created_at?: string | null
          datos_extra?: Json | null
          disponible?: boolean | null
          empresa_id?: string | null
          id?: string | null
          medida_cm?: number | null
          medida_mm?: number | null
          n_colmena?: string | null
          serial?: string | null
          tubo_raiz_id?: string | null
        }
        Update: {
          agregado_por_admin?: boolean | null
          cod?: string | null
          created_at?: string | null
          datos_extra?: Json | null
          disponible?: boolean | null
          empresa_id?: string | null
          id?: string | null
          medida_cm?: number | null
          medida_mm?: number | null
          n_colmena?: string | null
          serial?: string | null
          tubo_raiz_id?: string | null
        }
        Relationships: []
      }
      colmena_tubos_backup_20260720_reversa_3132: {
        Row: {
          agregado_por_admin: boolean | null
          cod: string | null
          created_at: string | null
          datos_extra: Json | null
          disponible: boolean | null
          empresa_id: string | null
          id: string | null
          medida_cm: number | null
          medida_mm: number | null
          n_colmena: string | null
          serial: string | null
          tubo_raiz_id: string | null
        }
        Insert: {
          agregado_por_admin?: boolean | null
          cod?: string | null
          created_at?: string | null
          datos_extra?: Json | null
          disponible?: boolean | null
          empresa_id?: string | null
          id?: string | null
          medida_cm?: number | null
          medida_mm?: number | null
          n_colmena?: string | null
          serial?: string | null
          tubo_raiz_id?: string | null
        }
        Update: {
          agregado_por_admin?: boolean | null
          cod?: string | null
          created_at?: string | null
          datos_extra?: Json | null
          disponible?: boolean | null
          empresa_id?: string | null
          id?: string | null
          medida_cm?: number | null
          medida_mm?: number | null
          n_colmena?: string | null
          serial?: string | null
          tubo_raiz_id?: string | null
        }
        Relationships: []
      }
      colmena_tubos_backup_20260722_reversa_4847: {
        Row: {
          agregado_por_admin: boolean | null
          cod: string | null
          created_at: string | null
          datos_extra: Json | null
          disponible: boolean | null
          empresa_id: string | null
          id: string | null
          medida_cm: number | null
          medida_mm: number | null
          n_colmena: string | null
          serial: string | null
          tubo_raiz_id: string | null
        }
        Insert: {
          agregado_por_admin?: boolean | null
          cod?: string | null
          created_at?: string | null
          datos_extra?: Json | null
          disponible?: boolean | null
          empresa_id?: string | null
          id?: string | null
          medida_cm?: number | null
          medida_mm?: number | null
          n_colmena?: string | null
          serial?: string | null
          tubo_raiz_id?: string | null
        }
        Update: {
          agregado_por_admin?: boolean | null
          cod?: string | null
          created_at?: string | null
          datos_extra?: Json | null
          disponible?: boolean | null
          empresa_id?: string | null
          id?: string | null
          medida_cm?: number | null
          medida_mm?: number | null
          n_colmena?: string | null
          serial?: string | null
          tubo_raiz_id?: string | null
        }
        Relationships: []
      }
      colmena_tubos_backup_20260723_reversa_3120: {
        Row: {
          agregado_por_admin: boolean | null
          cod: string | null
          created_at: string | null
          datos_extra: Json | null
          disponible: boolean | null
          empresa_id: string | null
          id: string | null
          medida_cm: number | null
          medida_mm: number | null
          n_colmena: string | null
          serial: string | null
          tubo_raiz_id: string | null
        }
        Insert: {
          agregado_por_admin?: boolean | null
          cod?: string | null
          created_at?: string | null
          datos_extra?: Json | null
          disponible?: boolean | null
          empresa_id?: string | null
          id?: string | null
          medida_cm?: number | null
          medida_mm?: number | null
          n_colmena?: string | null
          serial?: string | null
          tubo_raiz_id?: string | null
        }
        Update: {
          agregado_por_admin?: boolean | null
          cod?: string | null
          created_at?: string | null
          datos_extra?: Json | null
          disponible?: boolean | null
          empresa_id?: string | null
          id?: string | null
          medida_cm?: number | null
          medida_mm?: number | null
          n_colmena?: string | null
          serial?: string | null
          tubo_raiz_id?: string | null
        }
        Relationships: []
      }
      colmena_tubos_backup_20260723_reversa_47: {
        Row: {
          agregado_por_admin: boolean | null
          cod: string | null
          created_at: string | null
          datos_extra: Json | null
          disponible: boolean | null
          empresa_id: string | null
          id: string | null
          medida_cm: number | null
          medida_mm: number | null
          n_colmena: string | null
          serial: string | null
          tubo_raiz_id: string | null
        }
        Insert: {
          agregado_por_admin?: boolean | null
          cod?: string | null
          created_at?: string | null
          datos_extra?: Json | null
          disponible?: boolean | null
          empresa_id?: string | null
          id?: string | null
          medida_cm?: number | null
          medida_mm?: number | null
          n_colmena?: string | null
          serial?: string | null
          tubo_raiz_id?: string | null
        }
        Update: {
          agregado_por_admin?: boolean | null
          cod?: string | null
          created_at?: string | null
          datos_extra?: Json | null
          disponible?: boolean | null
          empresa_id?: string | null
          id?: string | null
          medida_cm?: number | null
          medida_mm?: number | null
          n_colmena?: string | null
          serial?: string | null
          tubo_raiz_id?: string | null
        }
        Relationships: []
      }
      colmena_tubos_backup_20260727_rieles: {
        Row: {
          agregado_por_admin: boolean | null
          cod: string | null
          created_at: string | null
          datos_extra: Json | null
          disponible: boolean | null
          empresa_id: string | null
          id: string | null
          medida_cm: number | null
          medida_mm: number | null
          n_colmena: string | null
          serial: string | null
          tubo_raiz_id: string | null
        }
        Insert: {
          agregado_por_admin?: boolean | null
          cod?: string | null
          created_at?: string | null
          datos_extra?: Json | null
          disponible?: boolean | null
          empresa_id?: string | null
          id?: string | null
          medida_cm?: number | null
          medida_mm?: number | null
          n_colmena?: string | null
          serial?: string | null
          tubo_raiz_id?: string | null
        }
        Update: {
          agregado_por_admin?: boolean | null
          cod?: string | null
          created_at?: string | null
          datos_extra?: Json | null
          disponible?: boolean | null
          empresa_id?: string | null
          id?: string | null
          medida_cm?: number | null
          medida_mm?: number | null
          n_colmena?: string | null
          serial?: string | null
          tubo_raiz_id?: string | null
        }
        Relationships: []
      }
      colmena_tubos_backup_20260806_reversa_corr50: {
        Row: {
          agregado_por_admin: boolean | null
          cod: string | null
          created_at: string | null
          datos_extra: Json | null
          disponible: boolean | null
          empresa_id: string | null
          id: string | null
          medida_cm: number | null
          medida_mm: number | null
          n_colmena: string | null
          serial: string | null
          tubo_raiz_id: string | null
        }
        Insert: {
          agregado_por_admin?: boolean | null
          cod?: string | null
          created_at?: string | null
          datos_extra?: Json | null
          disponible?: boolean | null
          empresa_id?: string | null
          id?: string | null
          medida_cm?: number | null
          medida_mm?: number | null
          n_colmena?: string | null
          serial?: string | null
          tubo_raiz_id?: string | null
        }
        Update: {
          agregado_por_admin?: boolean | null
          cod?: string | null
          created_at?: string | null
          datos_extra?: Json | null
          disponible?: boolean | null
          empresa_id?: string | null
          id?: string | null
          medida_cm?: number | null
          medida_mm?: number | null
          n_colmena?: string | null
          serial?: string | null
          tubo_raiz_id?: string | null
        }
        Relationships: []
      }
      colmena_tubos_backup_20260814_e78: {
        Row: {
          agregado_por_admin: boolean | null
          cod: string | null
          created_at: string | null
          datos_extra: Json | null
          disponible: boolean | null
          empresa_id: string | null
          id: string | null
          medida_cm: number | null
          medida_mm: number | null
          n_colmena: string | null
          serial: string | null
          tubo_raiz_id: string | null
        }
        Insert: {
          agregado_por_admin?: boolean | null
          cod?: string | null
          created_at?: string | null
          datos_extra?: Json | null
          disponible?: boolean | null
          empresa_id?: string | null
          id?: string | null
          medida_cm?: number | null
          medida_mm?: number | null
          n_colmena?: string | null
          serial?: string | null
          tubo_raiz_id?: string | null
        }
        Update: {
          agregado_por_admin?: boolean | null
          cod?: string | null
          created_at?: string | null
          datos_extra?: Json | null
          disponible?: boolean | null
          empresa_id?: string | null
          id?: string | null
          medida_cm?: number | null
          medida_mm?: number | null
          n_colmena?: string | null
          serial?: string | null
          tubo_raiz_id?: string | null
        }
        Relationships: []
      }
      configuracion: {
        Row: {
          clave: string
          empresa_id: string | null
          id: string
          valor: string | null
        }
        Insert: {
          clave: string
          empresa_id?: string | null
          id?: string
          valor?: string | null
        }
        Update: {
          clave?: string
          empresa_id?: string | null
          id?: string
          valor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "configuracion_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracion_backup_20260703_telas_depuradas: {
        Row: {
          clave: string | null
          empresa_id: string | null
          id: string | null
          valor: string | null
        }
        Insert: {
          clave?: string | null
          empresa_id?: string | null
          id?: string | null
          valor?: string | null
        }
        Update: {
          clave?: string | null
          empresa_id?: string | null
          id?: string | null
          valor?: string | null
        }
        Relationships: []
      }
      configuracion_backup_20260728_dom42: {
        Row: {
          clave: string | null
          empresa_id: string | null
          id: string | null
          valor: string | null
        }
        Insert: {
          clave?: string | null
          empresa_id?: string | null
          id?: string | null
          valor?: string | null
        }
        Update: {
          clave?: string | null
          empresa_id?: string | null
          id?: string | null
          valor?: string | null
        }
        Relationships: []
      }
      configuracion_backup_20260814_e78: {
        Row: {
          clave: string | null
          empresa_id: string | null
          id: string | null
          valor: string | null
        }
        Insert: {
          clave?: string | null
          empresa_id?: string | null
          id?: string | null
          valor?: string | null
        }
        Update: {
          clave?: string | null
          empresa_id?: string | null
          id?: string | null
          valor?: string | null
        }
        Relationships: []
      }
      configuracion_backup_20260817_inst_bb: {
        Row: {
          clave: string | null
          empresa_id: string | null
          id: string | null
          valor: string | null
        }
        Insert: {
          clave?: string | null
          empresa_id?: string | null
          id?: string | null
          valor?: string | null
        }
        Update: {
          clave?: string | null
          empresa_id?: string | null
          id?: string | null
          valor?: string | null
        }
        Relationships: []
      }
      configuracion_backup_20260818_sc_v: {
        Row: {
          clave: string | null
          empresa_id: string | null
          id: string | null
          valor: string | null
        }
        Insert: {
          clave?: string | null
          empresa_id?: string | null
          id?: string | null
          valor?: string | null
        }
        Update: {
          clave?: string | null
          empresa_id?: string | null
          id?: string | null
          valor?: string | null
        }
        Relationships: []
      }
      configuracion_backup_20260819_tela_bb: {
        Row: {
          clave: string | null
          empresa_id: string | null
          id: string | null
          valor: string | null
        }
        Insert: {
          clave?: string | null
          empresa_id?: string | null
          id?: string | null
          valor?: string | null
        }
        Update: {
          clave?: string | null
          empresa_id?: string | null
          id?: string | null
          valor?: string | null
        }
        Relationships: []
      }
      configuracion_backup_20260820_e66: {
        Row: {
          clave: string | null
          empresa_id: string | null
          id: string | null
          valor: string | null
        }
        Insert: {
          clave?: string | null
          empresa_id?: string | null
          id?: string | null
          valor?: string | null
        }
        Update: {
          clave?: string | null
          empresa_id?: string | null
          id?: string | null
          valor?: string | null
        }
        Relationships: []
      }
      configuracion_backup_20260821_bk83: {
        Row: {
          clave: string | null
          empresa_id: string | null
          id: string | null
          valor: string | null
        }
        Insert: {
          clave?: string | null
          empresa_id?: string | null
          id?: string | null
          valor?: string | null
        }
        Update: {
          clave?: string | null
          empresa_id?: string | null
          id?: string | null
          valor?: string | null
        }
        Relationships: []
      }
      configuracion_backup_20260904_motores: {
        Row: {
          clave: string | null
          empresa_id: string | null
          id: string | null
          valor: string | null
        }
        Insert: {
          clave?: string | null
          empresa_id?: string | null
          id?: string | null
          valor?: string | null
        }
        Update: {
          clave?: string | null
          empresa_id?: string | null
          id?: string | null
          valor?: string | null
        }
        Relationships: []
      }
      configuracion_backup_20260907_kit_b: {
        Row: {
          clave: string | null
          empresa_id: string | null
          id: string | null
          valor: string | null
        }
        Insert: {
          clave?: string | null
          empresa_id?: string | null
          id?: string | null
          valor?: string | null
        }
        Update: {
          clave?: string | null
          empresa_id?: string | null
          id?: string | null
          valor?: string | null
        }
        Relationships: []
      }
      configuracion_backup_e78_20260714: {
        Row: {
          clave: string | null
          empresa_id: string | null
          id: string | null
          valor: string | null
        }
        Insert: {
          clave?: string | null
          empresa_id?: string | null
          id?: string | null
          valor?: string | null
        }
        Update: {
          clave?: string | null
          empresa_id?: string | null
          id?: string | null
          valor?: string | null
        }
        Relationships: []
      }
      correcciones: {
        Row: {
          empresa_id: string
          id: string
          linea_idx: number | null
          nota: string | null
          nueva_medida: number | null
          nuevo_codigo: string | null
          plan_id: string | null
          timestamp: string | null
          tipo: string | null
          usuario_id: string | null
        }
        Insert: {
          empresa_id: string
          id?: string
          linea_idx?: number | null
          nota?: string | null
          nueva_medida?: number | null
          nuevo_codigo?: string | null
          plan_id?: string | null
          timestamp?: string | null
          tipo?: string | null
          usuario_id?: string | null
        }
        Update: {
          empresa_id?: string
          id?: string
          linea_idx?: number | null
          nota?: string | null
          nueva_medida?: number | null
          nuevo_codigo?: string | null
          plan_id?: string | null
          timestamp?: string | null
          tipo?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "correcciones_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correcciones_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "planes_corte"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correcciones_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cotizaciones_jefe: {
        Row: {
          actualizado_en: string
          cliente: Json
          correlativo: number
          creado_en: string
          creado_por: string | null
          descuento: number
          empresa_id: string
          estado: string
          id: string
          lineas: Json
          margen_real: number | null
          notas: string | null
          total_con_descuento: number
          total_lista_con_iva: number
          total_lista_sin_iva: number
        }
        Insert: {
          actualizado_en?: string
          cliente?: Json
          correlativo: number
          creado_en?: string
          creado_por?: string | null
          descuento?: number
          empresa_id: string
          estado?: string
          id?: string
          lineas?: Json
          margen_real?: number | null
          notas?: string | null
          total_con_descuento?: number
          total_lista_con_iva?: number
          total_lista_sin_iva?: number
        }
        Update: {
          actualizado_en?: string
          cliente?: Json
          correlativo?: number
          creado_en?: string
          creado_por?: string | null
          descuento?: number
          empresa_id?: string
          estado?: string
          id?: string
          lineas?: Json
          margen_real?: number | null
          notas?: string | null
          total_con_descuento?: number
          total_lista_con_iva?: number
          total_lista_sin_iva?: number
        }
        Relationships: [
          {
            foreignKeyName: "cotizaciones_jefe_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      cotizador_jefe_config: {
        Row: {
          actualizado_en: string
          actualizado_por: string | null
          data: Json
          empresa_id: string
        }
        Insert: {
          actualizado_en?: string
          actualizado_por?: string | null
          data: Json
          empresa_id: string
        }
        Update: {
          actualizado_en?: string
          actualizado_por?: string | null
          data?: Json
          empresa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cotizador_jefe_config_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      descuentos_modelo: {
        Row: {
          activo: boolean
          ancho_max_m: number
          codigos_tubo: string
          dcto_cenefa_cm: number
          dcto_cenefa_del_cm: number
          dcto_cenefa_tra_cm: number
          dcto_perfiles_cm: number
          dcto_tela_cm: number
          dcto_tubo_cm: number
          diametro_tubo_mm: number
          empresa_id: string
          id: string
          mecanismo: string
          notas: string
          origen: string
          peso_interno_duo_cm: number
          peso_u_duo_cm: number
          sistema: string
          suma_peso_cm: number
          tipo_rol: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          ancho_max_m?: number
          codigos_tubo?: string
          dcto_cenefa_cm?: number
          dcto_cenefa_del_cm?: number
          dcto_cenefa_tra_cm?: number
          dcto_perfiles_cm?: number
          dcto_tela_cm?: number
          dcto_tubo_cm?: number
          diametro_tubo_mm?: number
          empresa_id: string
          id?: string
          mecanismo?: string
          notas?: string
          origen?: string
          peso_interno_duo_cm?: number
          peso_u_duo_cm?: number
          sistema: string
          suma_peso_cm?: number
          tipo_rol: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          ancho_max_m?: number
          codigos_tubo?: string
          dcto_cenefa_cm?: number
          dcto_cenefa_del_cm?: number
          dcto_cenefa_tra_cm?: number
          dcto_perfiles_cm?: number
          dcto_tela_cm?: number
          dcto_tubo_cm?: number
          diametro_tubo_mm?: number
          empresa_id?: string
          id?: string
          mecanismo?: string
          notas?: string
          origen?: string
          peso_interno_duo_cm?: number
          peso_u_duo_cm?: number
          sistema?: string
          suma_peso_cm?: number
          tipo_rol?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "descuentos_modelo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      descuentos_modelo_backup_20260820_pletina_duo: {
        Row: {
          activo: boolean | null
          ancho_max_m: number | null
          codigos_tubo: string | null
          dcto_cenefa_cm: number | null
          dcto_cenefa_del_cm: number | null
          dcto_cenefa_tra_cm: number | null
          dcto_perfiles_cm: number | null
          dcto_tela_cm: number | null
          dcto_tubo_cm: number | null
          diametro_tubo_mm: number | null
          empresa_id: string | null
          id: string | null
          mecanismo: string | null
          notas: string | null
          origen: string | null
          peso_interno_duo_cm: number | null
          peso_u_duo_cm: number | null
          sistema: string | null
          suma_peso_cm: number | null
          tipo_rol: string | null
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          ancho_max_m?: number | null
          codigos_tubo?: string | null
          dcto_cenefa_cm?: number | null
          dcto_cenefa_del_cm?: number | null
          dcto_cenefa_tra_cm?: number | null
          dcto_perfiles_cm?: number | null
          dcto_tela_cm?: number | null
          dcto_tubo_cm?: number | null
          diametro_tubo_mm?: number | null
          empresa_id?: string | null
          id?: string | null
          mecanismo?: string | null
          notas?: string | null
          origen?: string | null
          peso_interno_duo_cm?: number | null
          peso_u_duo_cm?: number | null
          sistema?: string | null
          suma_peso_cm?: number | null
          tipo_rol?: string | null
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          ancho_max_m?: number | null
          codigos_tubo?: string | null
          dcto_cenefa_cm?: number | null
          dcto_cenefa_del_cm?: number | null
          dcto_cenefa_tra_cm?: number | null
          dcto_perfiles_cm?: number | null
          dcto_tela_cm?: number | null
          dcto_tubo_cm?: number | null
          diametro_tubo_mm?: number | null
          empresa_id?: string | null
          id?: string | null
          mecanismo?: string | null
          notas?: string | null
          origen?: string | null
          peso_interno_duo_cm?: number | null
          peso_u_duo_cm?: number | null
          sistema?: string | null
          suma_peso_cm?: number | null
          tipo_rol?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      descuentos_modelo_backup_20260908_b_e39: {
        Row: {
          activo: boolean | null
          ancho_max_m: number | null
          codigos_tubo: string | null
          dcto_cenefa_cm: number | null
          dcto_cenefa_del_cm: number | null
          dcto_cenefa_tra_cm: number | null
          dcto_perfiles_cm: number | null
          dcto_tela_cm: number | null
          dcto_tubo_cm: number | null
          diametro_tubo_mm: number | null
          empresa_id: string | null
          id: string | null
          mecanismo: string | null
          notas: string | null
          origen: string | null
          peso_interno_duo_cm: number | null
          peso_u_duo_cm: number | null
          sistema: string | null
          suma_peso_cm: number | null
          tipo_rol: string | null
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          ancho_max_m?: number | null
          codigos_tubo?: string | null
          dcto_cenefa_cm?: number | null
          dcto_cenefa_del_cm?: number | null
          dcto_cenefa_tra_cm?: number | null
          dcto_perfiles_cm?: number | null
          dcto_tela_cm?: number | null
          dcto_tubo_cm?: number | null
          diametro_tubo_mm?: number | null
          empresa_id?: string | null
          id?: string | null
          mecanismo?: string | null
          notas?: string | null
          origen?: string | null
          peso_interno_duo_cm?: number | null
          peso_u_duo_cm?: number | null
          sistema?: string | null
          suma_peso_cm?: number | null
          tipo_rol?: string | null
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          ancho_max_m?: number | null
          codigos_tubo?: string | null
          dcto_cenefa_cm?: number | null
          dcto_cenefa_del_cm?: number | null
          dcto_cenefa_tra_cm?: number | null
          dcto_perfiles_cm?: number | null
          dcto_tela_cm?: number | null
          dcto_tubo_cm?: number | null
          diametro_tubo_mm?: number | null
          empresa_id?: string | null
          id?: string | null
          mecanismo?: string | null
          notas?: string | null
          origen?: string | null
          peso_interno_duo_cm?: number | null
          peso_u_duo_cm?: number | null
          sistema?: string | null
          suma_peso_cm?: number | null
          tipo_rol?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      descuentos_modelo_backup_e78_20260714: {
        Row: {
          activo: boolean | null
          ancho_max_m: number | null
          codigos_tubo: string | null
          dcto_cenefa_cm: number | null
          dcto_cenefa_del_cm: number | null
          dcto_cenefa_tra_cm: number | null
          dcto_perfiles_cm: number | null
          dcto_tela_cm: number | null
          dcto_tubo_cm: number | null
          diametro_tubo_mm: number | null
          empresa_id: string | null
          id: string | null
          mecanismo: string | null
          notas: string | null
          peso_interno_duo_cm: number | null
          peso_u_duo_cm: number | null
          sistema: string | null
          suma_peso_cm: number | null
          tipo_rol: string | null
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          ancho_max_m?: number | null
          codigos_tubo?: string | null
          dcto_cenefa_cm?: number | null
          dcto_cenefa_del_cm?: number | null
          dcto_cenefa_tra_cm?: number | null
          dcto_perfiles_cm?: number | null
          dcto_tela_cm?: number | null
          dcto_tubo_cm?: number | null
          diametro_tubo_mm?: number | null
          empresa_id?: string | null
          id?: string | null
          mecanismo?: string | null
          notas?: string | null
          peso_interno_duo_cm?: number | null
          peso_u_duo_cm?: number | null
          sistema?: string | null
          suma_peso_cm?: number | null
          tipo_rol?: string | null
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          ancho_max_m?: number | null
          codigos_tubo?: string | null
          dcto_cenefa_cm?: number | null
          dcto_cenefa_del_cm?: number | null
          dcto_cenefa_tra_cm?: number | null
          dcto_perfiles_cm?: number | null
          dcto_tela_cm?: number | null
          dcto_tubo_cm?: number | null
          diametro_tubo_mm?: number | null
          empresa_id?: string | null
          id?: string | null
          mecanismo?: string | null
          notas?: string | null
          peso_interno_duo_cm?: number | null
          peso_u_duo_cm?: number | null
          sistema?: string | null
          suma_peso_cm?: number | null
          tipo_rol?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      descuentos_modelo_backup_ovalada_blanco_20260715: {
        Row: {
          activo: boolean | null
          ancho_max_m: number | null
          codigos_tubo: string | null
          dcto_cenefa_cm: number | null
          dcto_cenefa_del_cm: number | null
          dcto_cenefa_tra_cm: number | null
          dcto_perfiles_cm: number | null
          dcto_tela_cm: number | null
          dcto_tubo_cm: number | null
          diametro_tubo_mm: number | null
          empresa_id: string | null
          id: string | null
          mecanismo: string | null
          notas: string | null
          peso_interno_duo_cm: number | null
          peso_u_duo_cm: number | null
          sistema: string | null
          suma_peso_cm: number | null
          tipo_rol: string | null
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          ancho_max_m?: number | null
          codigos_tubo?: string | null
          dcto_cenefa_cm?: number | null
          dcto_cenefa_del_cm?: number | null
          dcto_cenefa_tra_cm?: number | null
          dcto_perfiles_cm?: number | null
          dcto_tela_cm?: number | null
          dcto_tubo_cm?: number | null
          diametro_tubo_mm?: number | null
          empresa_id?: string | null
          id?: string | null
          mecanismo?: string | null
          notas?: string | null
          peso_interno_duo_cm?: number | null
          peso_u_duo_cm?: number | null
          sistema?: string | null
          suma_peso_cm?: number | null
          tipo_rol?: string | null
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          ancho_max_m?: number | null
          codigos_tubo?: string | null
          dcto_cenefa_cm?: number | null
          dcto_cenefa_del_cm?: number | null
          dcto_cenefa_tra_cm?: number | null
          dcto_perfiles_cm?: number | null
          dcto_tela_cm?: number | null
          dcto_tubo_cm?: number | null
          diametro_tubo_mm?: number | null
          empresa_id?: string | null
          id?: string | null
          mecanismo?: string | null
          notas?: string | null
          peso_interno_duo_cm?: number | null
          peso_u_duo_cm?: number | null
          sistema?: string | null
          suma_peso_cm?: number | null
          tipo_rol?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      descuentos_modelo_backup_ovalada_duo_blanco_20260715: {
        Row: {
          activo: boolean | null
          ancho_max_m: number | null
          codigos_tubo: string | null
          dcto_cenefa_cm: number | null
          dcto_cenefa_del_cm: number | null
          dcto_cenefa_tra_cm: number | null
          dcto_perfiles_cm: number | null
          dcto_tela_cm: number | null
          dcto_tubo_cm: number | null
          diametro_tubo_mm: number | null
          empresa_id: string | null
          id: string | null
          mecanismo: string | null
          notas: string | null
          peso_interno_duo_cm: number | null
          peso_u_duo_cm: number | null
          sistema: string | null
          suma_peso_cm: number | null
          tipo_rol: string | null
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          ancho_max_m?: number | null
          codigos_tubo?: string | null
          dcto_cenefa_cm?: number | null
          dcto_cenefa_del_cm?: number | null
          dcto_cenefa_tra_cm?: number | null
          dcto_perfiles_cm?: number | null
          dcto_tela_cm?: number | null
          dcto_tubo_cm?: number | null
          diametro_tubo_mm?: number | null
          empresa_id?: string | null
          id?: string | null
          mecanismo?: string | null
          notas?: string | null
          peso_interno_duo_cm?: number | null
          peso_u_duo_cm?: number | null
          sistema?: string | null
          suma_peso_cm?: number | null
          tipo_rol?: string | null
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          ancho_max_m?: number | null
          codigos_tubo?: string | null
          dcto_cenefa_cm?: number | null
          dcto_cenefa_del_cm?: number | null
          dcto_cenefa_tra_cm?: number | null
          dcto_perfiles_cm?: number | null
          dcto_tela_cm?: number | null
          dcto_tubo_cm?: number | null
          diametro_tubo_mm?: number | null
          empresa_id?: string | null
          id?: string | null
          mecanismo?: string | null
          notas?: string | null
          peso_interno_duo_cm?: number | null
          peso_u_duo_cm?: number | null
          sistema?: string | null
          suma_peso_cm?: number | null
          tipo_rol?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      descuentos_modelo_foto_20260908_b_e39: {
        Row: {
          ancho_max_m: number | null
          codigos_tubo: string | null
          id: string | null
          notas: string | null
        }
        Insert: {
          ancho_max_m?: number | null
          codigos_tubo?: string | null
          id?: string | null
          notas?: string | null
        }
        Update: {
          ancho_max_m?: number | null
          codigos_tubo?: string | null
          id?: string | null
          notas?: string | null
        }
        Relationships: []
      }
      empresa_agente_config: {
        Row: {
          activo: boolean
          empresa_id: string
          horario_atencion: Json | null
          max_turnos_sin_derivar: number | null
          mensaje_fallback: string | null
          mensaje_fuera_horario: string | null
          modelo: string
          nombre_agente: string
          temperatura: number | null
          updated_at: string
          updated_by: string | null
          whatsapp_business_id: string | null
          whatsapp_phone_id: string | null
          whatsapp_token: string | null
          whatsapp_verify_token: string | null
        }
        Insert: {
          activo?: boolean
          empresa_id: string
          horario_atencion?: Json | null
          max_turnos_sin_derivar?: number | null
          mensaje_fallback?: string | null
          mensaje_fuera_horario?: string | null
          modelo?: string
          nombre_agente?: string
          temperatura?: number | null
          updated_at?: string
          updated_by?: string | null
          whatsapp_business_id?: string | null
          whatsapp_phone_id?: string | null
          whatsapp_token?: string | null
          whatsapp_verify_token?: string | null
        }
        Update: {
          activo?: boolean
          empresa_id?: string
          horario_atencion?: Json | null
          max_turnos_sin_derivar?: number | null
          mensaje_fallback?: string | null
          mensaje_fuera_horario?: string | null
          modelo?: string
          nombre_agente?: string
          temperatura?: number | null
          updated_at?: string
          updated_by?: string | null
          whatsapp_business_id?: string | null
          whatsapp_phone_id?: string | null
          whatsapp_token?: string | null
          whatsapp_verify_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "empresa_agente_config_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresa_agente_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_modulos: {
        Row: {
          activo: boolean | null
          empresa_id: string
          fecha_inicio: string | null
          fecha_vencimiento: string | null
          id: string
          modulo_id: string
        }
        Insert: {
          activo?: boolean | null
          empresa_id: string
          fecha_inicio?: string | null
          fecha_vencimiento?: string | null
          id?: string
          modulo_id: string
        }
        Update: {
          activo?: boolean | null
          empresa_id?: string
          fecha_inicio?: string | null
          fecha_vencimiento?: string | null
          id?: string
          modulo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresa_modulos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresa_modulos_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "modulos"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          activa: boolean | null
          email_contacto: string | null
          fecha_creacion: string | null
          fecha_vencimiento: string | null
          id: string
          nombre: string
          rut: string | null
          telefono: string | null
        }
        Insert: {
          activa?: boolean | null
          email_contacto?: string | null
          fecha_creacion?: string | null
          fecha_vencimiento?: string | null
          id?: string
          nombre: string
          rut?: string | null
          telefono?: string | null
        }
        Update: {
          activa?: boolean | null
          email_contacto?: string | null
          fecha_creacion?: string | null
          fecha_vencimiento?: string | null
          id?: string
          nombre?: string
          rut?: string | null
          telefono?: string | null
        }
        Relationships: []
      }
      errores_corte: {
        Row: {
          cod_original: string | null
          colmena_original: string | null
          color: string | null
          comentario: string | null
          created_at: string | null
          empresa_id: string
          id: string
          linea_idx: number
          medida_cm: number | null
          medida_origen_cm: number | null
          motivo: string
          ot: string | null
          plan_fecha: string | null
          plan_id: string | null
          reemplazo_cod: string | null
          reemplazo_colmena: string | null
          reemplazo_medida_cm: number | null
          registrado_por: string | null
          serial: string | null
          ubicacion: string | null
        }
        Insert: {
          cod_original?: string | null
          colmena_original?: string | null
          color?: string | null
          comentario?: string | null
          created_at?: string | null
          empresa_id: string
          id?: string
          linea_idx: number
          medida_cm?: number | null
          medida_origen_cm?: number | null
          motivo: string
          ot?: string | null
          plan_fecha?: string | null
          plan_id?: string | null
          reemplazo_cod?: string | null
          reemplazo_colmena?: string | null
          reemplazo_medida_cm?: number | null
          registrado_por?: string | null
          serial?: string | null
          ubicacion?: string | null
        }
        Update: {
          cod_original?: string | null
          colmena_original?: string | null
          color?: string | null
          comentario?: string | null
          created_at?: string | null
          empresa_id?: string
          id?: string
          linea_idx?: number
          medida_cm?: number | null
          medida_origen_cm?: number | null
          motivo?: string
          ot?: string | null
          plan_fecha?: string | null
          plan_id?: string | null
          reemplazo_cod?: string | null
          reemplazo_colmena?: string | null
          reemplazo_medida_cm?: number | null
          registrado_por?: string | null
          serial?: string | null
          ubicacion?: string | null
        }
        Relationships: []
      }
      familias_insumo: {
        Row: {
          activo: boolean
          actualizado_en: string
          categoria: string | null
          creado_en: string
          descripcion: string | null
          digitos: number
          empresa_id: string
          id: string
          nombre: string
          prefijo: string
          siguiente: number
          sub_categoria: string | null
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          categoria?: string | null
          creado_en?: string
          descripcion?: string | null
          digitos?: number
          empresa_id: string
          id?: string
          nombre: string
          prefijo: string
          siguiente?: number
          sub_categoria?: string | null
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          categoria?: string | null
          creado_en?: string
          descripcion?: string | null
          digitos?: number
          empresa_id?: string
          id?: string
          nombre?: string
          prefijo?: string
          siguiente?: number
          sub_categoria?: string | null
        }
        Relationships: []
      }
      insumos: {
        Row: {
          can_x_paquete: number | null
          categoria: string | null
          cod: string
          cod_proveedor: string | null
          color: string | null
          comentarios: string | null
          compra: string | null
          contenido_por_unidad: number | null
          costo: number | null
          costo_iva: number | null
          created_at: string | null
          descriptor_proveedor: string | null
          empresa_id: string
          estado_inventario: string | null
          foto_url: string | null
          id: string
          minimo: number | null
          nemotecnico: string | null
          producto: string | null
          proveedor: string | null
          status: string | null
          stock_liberado: number | null
          stock_maximo: number | null
          stock_mp: number | null
          stock_total: number | null
          sub_categoria: string | null
          ubicacion: string | null
          unidad: string
          updated_at: string | null
        }
        Insert: {
          can_x_paquete?: number | null
          categoria?: string | null
          cod: string
          cod_proveedor?: string | null
          color?: string | null
          comentarios?: string | null
          compra?: string | null
          contenido_por_unidad?: number | null
          costo?: number | null
          costo_iva?: number | null
          created_at?: string | null
          descriptor_proveedor?: string | null
          empresa_id?: string
          estado_inventario?: string | null
          foto_url?: string | null
          id?: string
          minimo?: number | null
          nemotecnico?: string | null
          producto?: string | null
          proveedor?: string | null
          status?: string | null
          stock_liberado?: number | null
          stock_maximo?: number | null
          stock_mp?: number | null
          stock_total?: number | null
          sub_categoria?: string | null
          ubicacion?: string | null
          unidad?: string
          updated_at?: string | null
        }
        Update: {
          can_x_paquete?: number | null
          categoria?: string | null
          cod?: string
          cod_proveedor?: string | null
          color?: string | null
          comentarios?: string | null
          compra?: string | null
          contenido_por_unidad?: number | null
          costo?: number | null
          costo_iva?: number | null
          created_at?: string | null
          descriptor_proveedor?: string | null
          empresa_id?: string
          estado_inventario?: string | null
          foto_url?: string | null
          id?: string
          minimo?: number | null
          nemotecnico?: string | null
          producto?: string | null
          proveedor?: string | null
          status?: string | null
          stock_liberado?: number | null
          stock_maximo?: number | null
          stock_mp?: number | null
          stock_total?: number | null
          sub_categoria?: string | null
          ubicacion?: string | null
          unidad?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insumos_unidad_fkey"
            columns: ["unidad"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["codigo"]
          },
        ]
      }
      insumos_backup_20260710: {
        Row: {
          can_x_paquete: number | null
          categoria: string | null
          cod: string | null
          cod_proveedor: string | null
          color: string | null
          comentarios: string | null
          compra: string | null
          costo: number | null
          costo_iva: number | null
          created_at: string | null
          descriptor_proveedor: string | null
          empresa_id: string | null
          estado_inventario: string | null
          foto_url: string | null
          id: string | null
          minimo: number | null
          nemotecnico: string | null
          producto: string | null
          proveedor: string | null
          status: string | null
          stock_liberado: number | null
          stock_mp: number | null
          stock_total: number | null
          sub_categoria: string | null
          ubicacion: string | null
          updated_at: string | null
        }
        Insert: {
          can_x_paquete?: number | null
          categoria?: string | null
          cod?: string | null
          cod_proveedor?: string | null
          color?: string | null
          comentarios?: string | null
          compra?: string | null
          costo?: number | null
          costo_iva?: number | null
          created_at?: string | null
          descriptor_proveedor?: string | null
          empresa_id?: string | null
          estado_inventario?: string | null
          foto_url?: string | null
          id?: string | null
          minimo?: number | null
          nemotecnico?: string | null
          producto?: string | null
          proveedor?: string | null
          status?: string | null
          stock_liberado?: number | null
          stock_mp?: number | null
          stock_total?: number | null
          sub_categoria?: string | null
          ubicacion?: string | null
          updated_at?: string | null
        }
        Update: {
          can_x_paquete?: number | null
          categoria?: string | null
          cod?: string | null
          cod_proveedor?: string | null
          color?: string | null
          comentarios?: string | null
          compra?: string | null
          costo?: number | null
          costo_iva?: number | null
          created_at?: string | null
          descriptor_proveedor?: string | null
          empresa_id?: string | null
          estado_inventario?: string | null
          foto_url?: string | null
          id?: string | null
          minimo?: number | null
          nemotecnico?: string | null
          producto?: string | null
          proveedor?: string | null
          status?: string | null
          stock_liberado?: number | null
          stock_mp?: number | null
          stock_total?: number | null
          sub_categoria?: string | null
          ubicacion?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      insumos_backup_20260814_e78: {
        Row: {
          can_x_paquete: number | null
          categoria: string | null
          cod: string | null
          cod_proveedor: string | null
          color: string | null
          comentarios: string | null
          compra: string | null
          costo: number | null
          costo_iva: number | null
          created_at: string | null
          descriptor_proveedor: string | null
          empresa_id: string | null
          estado_inventario: string | null
          foto_url: string | null
          id: string | null
          minimo: number | null
          nemotecnico: string | null
          producto: string | null
          proveedor: string | null
          status: string | null
          stock_liberado: number | null
          stock_mp: number | null
          stock_total: number | null
          sub_categoria: string | null
          ubicacion: string | null
          updated_at: string | null
        }
        Insert: {
          can_x_paquete?: number | null
          categoria?: string | null
          cod?: string | null
          cod_proveedor?: string | null
          color?: string | null
          comentarios?: string | null
          compra?: string | null
          costo?: number | null
          costo_iva?: number | null
          created_at?: string | null
          descriptor_proveedor?: string | null
          empresa_id?: string | null
          estado_inventario?: string | null
          foto_url?: string | null
          id?: string | null
          minimo?: number | null
          nemotecnico?: string | null
          producto?: string | null
          proveedor?: string | null
          status?: string | null
          stock_liberado?: number | null
          stock_mp?: number | null
          stock_total?: number | null
          sub_categoria?: string | null
          ubicacion?: string | null
          updated_at?: string | null
        }
        Update: {
          can_x_paquete?: number | null
          categoria?: string | null
          cod?: string | null
          cod_proveedor?: string | null
          color?: string | null
          comentarios?: string | null
          compra?: string | null
          costo?: number | null
          costo_iva?: number | null
          created_at?: string | null
          descriptor_proveedor?: string | null
          empresa_id?: string | null
          estado_inventario?: string | null
          foto_url?: string | null
          id?: string | null
          minimo?: number | null
          nemotecnico?: string | null
          producto?: string | null
          proveedor?: string | null
          status?: string | null
          stock_liberado?: number | null
          stock_mp?: number | null
          stock_total?: number | null
          sub_categoria?: string | null
          ubicacion?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      insumos_backup_20260828_topes: {
        Row: {
          can_x_paquete: number | null
          categoria: string | null
          cod: string | null
          cod_proveedor: string | null
          color: string | null
          comentarios: string | null
          compra: string | null
          costo: number | null
          costo_iva: number | null
          created_at: string | null
          descriptor_proveedor: string | null
          empresa_id: string | null
          estado_inventario: string | null
          foto_url: string | null
          id: string | null
          minimo: number | null
          nemotecnico: string | null
          producto: string | null
          proveedor: string | null
          status: string | null
          stock_liberado: number | null
          stock_mp: number | null
          stock_total: number | null
          sub_categoria: string | null
          ubicacion: string | null
          updated_at: string | null
        }
        Insert: {
          can_x_paquete?: number | null
          categoria?: string | null
          cod?: string | null
          cod_proveedor?: string | null
          color?: string | null
          comentarios?: string | null
          compra?: string | null
          costo?: number | null
          costo_iva?: number | null
          created_at?: string | null
          descriptor_proveedor?: string | null
          empresa_id?: string | null
          estado_inventario?: string | null
          foto_url?: string | null
          id?: string | null
          minimo?: number | null
          nemotecnico?: string | null
          producto?: string | null
          proveedor?: string | null
          status?: string | null
          stock_liberado?: number | null
          stock_mp?: number | null
          stock_total?: number | null
          sub_categoria?: string | null
          ubicacion?: string | null
          updated_at?: string | null
        }
        Update: {
          can_x_paquete?: number | null
          categoria?: string | null
          cod?: string | null
          cod_proveedor?: string | null
          color?: string | null
          comentarios?: string | null
          compra?: string | null
          costo?: number | null
          costo_iva?: number | null
          created_at?: string | null
          descriptor_proveedor?: string | null
          empresa_id?: string | null
          estado_inventario?: string | null
          foto_url?: string | null
          id?: string | null
          minimo?: number | null
          nemotecnico?: string | null
          producto?: string | null
          proveedor?: string | null
          status?: string | null
          stock_liberado?: number | null
          stock_mp?: number | null
          stock_total?: number | null
          sub_categoria?: string | null
          ubicacion?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      inv_camioneta_backup_kardex_20260908: {
        Row: {
          camioneta_id: string | null
          cantidad: number | null
          id: string | null
          insumo_id: string | null
        }
        Insert: {
          camioneta_id?: string | null
          cantidad?: number | null
          id?: string | null
          insumo_id?: string | null
        }
        Update: {
          camioneta_id?: string | null
          cantidad?: number | null
          id?: string | null
          insumo_id?: string | null
        }
        Relationships: []
      }
      inv_empresa_perfil: {
        Row: {
          banner_url: string | null
          direccion: string | null
          empresa_id: string
          instagram: string | null
          logo_url: string | null
          pagina_web: string | null
          razon_social: string
          rut: string | null
          updated_at: string
        }
        Insert: {
          banner_url?: string | null
          direccion?: string | null
          empresa_id: string
          instagram?: string | null
          logo_url?: string | null
          pagina_web?: string | null
          razon_social?: string
          rut?: string | null
          updated_at?: string
        }
        Update: {
          banner_url?: string | null
          direccion?: string | null
          empresa_id?: string
          instagram?: string | null
          logo_url?: string | null
          pagina_web?: string | null
          razon_social?: string
          rut?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inv_empresa_perfil_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      inv_movimientos: {
        Row: {
          anterior_metros: number | null
          anterior_rollos: number | null
          cantidad_metros: number | null
          comentario: string | null
          empresa_id: string
          fecha: string
          id: string
          nuevo_metros: number | null
          nuevo_rollos: number | null
          rollo_id: string
          tipo: string
          vendedor_email: string
        }
        Insert: {
          anterior_metros?: number | null
          anterior_rollos?: number | null
          cantidad_metros?: number | null
          comentario?: string | null
          empresa_id: string
          fecha?: string
          id?: string
          nuevo_metros?: number | null
          nuevo_rollos?: number | null
          rollo_id: string
          tipo: string
          vendedor_email: string
        }
        Update: {
          anterior_metros?: number | null
          anterior_rollos?: number | null
          cantidad_metros?: number | null
          comentario?: string | null
          empresa_id?: string
          fecha?: string
          id?: string
          nuevo_metros?: number | null
          nuevo_rollos?: number | null
          rollo_id?: string
          tipo?: string
          vendedor_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "inv_movimientos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inv_movimientos_rollo_id_fkey"
            columns: ["rollo_id"]
            isOneToOne: false
            referencedRelation: "inv_rollos"
            referencedColumns: ["id"]
          },
        ]
      }
      inv_permisos: {
        Row: {
          activo: boolean
          created_at: string
          email: string
          empresa_id: string
          id: string
          notas: string | null
          rol: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          email: string
          empresa_id: string
          id?: string
          notas?: string | null
          rol?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          email?: string
          empresa_id?: string
          id?: string
          notas?: string | null
          rol?: string
        }
        Relationships: [
          {
            foreignKeyName: "inv_permisos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      inv_rollos: {
        Row: {
          activo: boolean
          cod: string
          cod_int: string
          comentario: string | null
          created_at: string
          descripcion: string | null
          descuento_pct: number
          empresa_id: string
          id: string
          metros_originales: number | null
          metros_x_rollo: number
          producto: string
          proveedor: string | null
          rollos: number
          tela_verticales: string
          tipo: string | null
          total_metros: number
          updated_at: string
        }
        Insert: {
          activo?: boolean
          cod: string
          cod_int: string
          comentario?: string | null
          created_at?: string
          descripcion?: string | null
          descuento_pct?: number
          empresa_id: string
          id?: string
          metros_originales?: number | null
          metros_x_rollo?: number
          producto: string
          proveedor?: string | null
          rollos?: number
          tela_verticales?: string
          tipo?: string | null
          total_metros?: number
          updated_at?: string
        }
        Update: {
          activo?: boolean
          cod?: string
          cod_int?: string
          comentario?: string | null
          created_at?: string
          descripcion?: string | null
          descuento_pct?: number
          empresa_id?: string
          id?: string
          metros_originales?: number | null
          metros_x_rollo?: number
          producto?: string
          proveedor?: string | null
          rollos?: number
          tela_verticales?: string
          tipo?: string | null
          total_metros?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inv_rollos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      inv_saldos_backup_kardex_20260908: {
        Row: {
          codigo: string | null
          dominio: string | null
          empresa_id: string | null
          id: string | null
          stock_liberado: number | null
          stock_mp: number | null
          stock_total: number | null
        }
        Insert: {
          codigo?: string | null
          dominio?: string | null
          empresa_id?: string | null
          id?: string | null
          stock_liberado?: number | null
          stock_mp?: number | null
          stock_total?: number | null
        }
        Update: {
          codigo?: string | null
          dominio?: string | null
          empresa_id?: string | null
          id?: string | null
          stock_liberado?: number | null
          stock_mp?: number | null
          stock_total?: number | null
        }
        Relationships: []
      }
      inventario_camioneta: {
        Row: {
          camioneta_id: string
          cantidad: number
          empresa_id: string | null
          id: string
          insumo_id: string
        }
        Insert: {
          camioneta_id: string
          cantidad?: number
          empresa_id?: string | null
          id?: string
          insumo_id: string
        }
        Update: {
          camioneta_id?: string
          cantidad?: number
          empresa_id?: string | null
          id?: string
          insumo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventario_camioneta_camioneta_id_fkey"
            columns: ["camioneta_id"]
            isOneToOne: false
            referencedRelation: "camionetas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventario_camioneta_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
        ]
      }
      inventario_escrituras_directas_log: {
        Row: {
          antes: number | null
          columna: string
          despues: number | null
          empresa_id: string | null
          fecha: string
          fila_id: string | null
          id: string
          tabla: string
          usuario_email: string | null
        }
        Insert: {
          antes?: number | null
          columna: string
          despues?: number | null
          empresa_id?: string | null
          fecha?: string
          fila_id?: string | null
          id?: string
          tabla: string
          usuario_email?: string | null
        }
        Update: {
          antes?: number | null
          columna?: string
          despues?: number | null
          empresa_id?: string | null
          fecha?: string
          fila_id?: string | null
          id?: string
          tabla?: string
          usuario_email?: string | null
        }
        Relationships: []
      }
      inventario_movimientos: {
        Row: {
          almacen_destino_id: string | null
          almacen_origen_id: string | null
          area: string | null
          cantidad: number
          creado_en: string
          dominio: string
          empresa_id: string
          fecha: string
          id: string
          item_cod: string
          item_nombre: string | null
          legacy_id: string | null
          legacy_tabla: string | null
          lote_id: string | null
          motivo: string | null
          notas: string | null
          ot: string | null
          recibe: string | null
          referencia_id: string | null
          referencia_tipo: string | null
          responsable: string | null
          saldo_destino_post: number | null
          saldo_origen_post: number | null
          tipo: string
          unidad: string | null
          usuario_email: string | null
          usuario_id: string | null
        }
        Insert: {
          almacen_destino_id?: string | null
          almacen_origen_id?: string | null
          area?: string | null
          cantidad: number
          creado_en?: string
          dominio: string
          empresa_id: string
          fecha?: string
          id?: string
          item_cod: string
          item_nombre?: string | null
          legacy_id?: string | null
          legacy_tabla?: string | null
          lote_id?: string | null
          motivo?: string | null
          notas?: string | null
          ot?: string | null
          recibe?: string | null
          referencia_id?: string | null
          referencia_tipo?: string | null
          responsable?: string | null
          saldo_destino_post?: number | null
          saldo_origen_post?: number | null
          tipo: string
          unidad?: string | null
          usuario_email?: string | null
          usuario_id?: string | null
        }
        Update: {
          almacen_destino_id?: string | null
          almacen_origen_id?: string | null
          area?: string | null
          cantidad?: number
          creado_en?: string
          dominio?: string
          empresa_id?: string
          fecha?: string
          id?: string
          item_cod?: string
          item_nombre?: string | null
          legacy_id?: string | null
          legacy_tabla?: string | null
          lote_id?: string | null
          motivo?: string | null
          notas?: string | null
          ot?: string | null
          recibe?: string | null
          referencia_id?: string | null
          referencia_tipo?: string | null
          responsable?: string | null
          saldo_destino_post?: number | null
          saldo_origen_post?: number | null
          tipo?: string
          unidad?: string | null
          usuario_email?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventario_movimientos_almacen_destino_id_fkey"
            columns: ["almacen_destino_id"]
            isOneToOne: false
            referencedRelation: "almacenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventario_movimientos_almacen_origen_id_fkey"
            columns: ["almacen_origen_id"]
            isOneToOne: false
            referencedRelation: "almacenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventario_movimientos_unidad_fkey"
            columns: ["unidad"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["codigo"]
          },
        ]
      }
      inventario_tally: {
        Row: {
          contado_at: string
          conteo: number
          empresa_id: string
          id: string
          inventario_id: string
          n_colmena: string
          operario_email: string
          operario_id: string
        }
        Insert: {
          contado_at?: string
          conteo: number
          empresa_id: string
          id?: string
          inventario_id: string
          n_colmena: string
          operario_email: string
          operario_id: string
        }
        Update: {
          contado_at?: string
          conteo?: number
          empresa_id?: string
          id?: string
          inventario_id?: string
          n_colmena?: string
          operario_email?: string
          operario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventario_tally_inventario_id_fkey"
            columns: ["inventario_id"]
            isOneToOne: false
            referencedRelation: "inventarios"
            referencedColumns: ["id"]
          },
        ]
      }
      inventarios: {
        Row: {
          cerrado_at: string | null
          cerrado_por: string | null
          cerrado_por_email: string | null
          empresa_id: string
          estado: string
          firma_png: string | null
          id: string
          iniciado_at: string
          iniciado_por: string | null
          iniciado_por_email: string | null
          n_colmena: string | null
          notas: string | null
          tubos_count_post: number | null
          tubos_count_pre: number
        }
        Insert: {
          cerrado_at?: string | null
          cerrado_por?: string | null
          cerrado_por_email?: string | null
          empresa_id: string
          estado?: string
          firma_png?: string | null
          id?: string
          iniciado_at?: string
          iniciado_por?: string | null
          iniciado_por_email?: string | null
          n_colmena?: string | null
          notas?: string | null
          tubos_count_post?: number | null
          tubos_count_pre?: number
        }
        Update: {
          cerrado_at?: string | null
          cerrado_por?: string | null
          cerrado_por_email?: string | null
          empresa_id?: string
          estado?: string
          firma_png?: string | null
          id?: string
          iniciado_at?: string
          iniciado_por?: string | null
          iniciado_por_email?: string | null
          n_colmena?: string | null
          notas?: string | null
          tubos_count_post?: number | null
          tubos_count_pre?: number
        }
        Relationships: []
      }
      invitaciones: {
        Row: {
          codigo: string
          creado_por: string | null
          created_at: string
          email: string | null
          empresa_id: string
          expira_en: string
          id: string
          rol: string
          usado_en: string | null
          usado_por: string | null
        }
        Insert: {
          codigo: string
          creado_por?: string | null
          created_at?: string
          email?: string | null
          empresa_id: string
          expira_en?: string
          id?: string
          rol?: string
          usado_en?: string | null
          usado_por?: string | null
        }
        Update: {
          codigo?: string
          creado_por?: string | null
          created_at?: string
          email?: string | null
          empresa_id?: string
          expira_en?: string
          id?: string
          rol?: string
          usado_en?: string | null
          usado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitaciones_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitaciones_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_config: {
        Row: {
          canales: Json
          empresa_id: string
          meta_cierre_pct: number
          meta_visitas: number
          terreno: Json
          updated_at: string
          vendedoras: Json
        }
        Insert: {
          canales?: Json
          empresa_id: string
          meta_cierre_pct?: number
          meta_visitas?: number
          terreno?: Json
          updated_at?: string
          vendedoras?: Json
        }
        Update: {
          canales?: Json
          empresa_id?: string
          meta_cierre_pct?: number
          meta_visitas?: number
          terreno?: Json
          updated_at?: string
          vendedoras?: Json
        }
        Relationships: []
      }
      kpi_registros: {
        Row: {
          clave: string
          empresa_id: string
          fecha: string
          id: number
          updated_at: string
          valor: number
        }
        Insert: {
          clave: string
          empresa_id: string
          fecha: string
          id?: number
          updated_at?: string
          valor?: number
        }
        Update: {
          clave?: string
          empresa_id?: string
          fecha?: string
          id?: number
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      leads: {
        Row: {
          archivado: boolean
          asignado_a: string | null
          asignado_at: string | null
          cantidad_ventanas: number | null
          comentarios: string | null
          comuna: string | null
          created_at: string
          detalle_personal: string | null
          email: string | null
          empresa_id: string
          estado: string
          etapa_seguimiento: number
          fecha_archivado: string | null
          fecha_cierre: string | null
          fecha_cotizacion: string | null
          fuente: string
          id: string
          monto: number | null
          motivo_derivacion: string | null
          necesita_instalacion: boolean | null
          nombre: string | null
          ot_id: string | null
          presupuesto_rango: string | null
          prioridad: string
          producto_interes: string | null
          resumen_para_vendedor: string | null
          rut: string | null
          scoring: number | null
          seg1_fecha: string | null
          seg1_resultado: string | null
          seg2_fecha: string | null
          seg2_resultado: string | null
          seg3_fecha: string | null
          seg3_resultado: string | null
          tiene_medidas: boolean | null
          tomado_at: string | null
          ultima_actividad_at: string
          updated_at: string
          urgencia: string | null
          whatsapp_phone: string | null
          whatsapp_wa_id: string | null
        }
        Insert: {
          archivado?: boolean
          asignado_a?: string | null
          asignado_at?: string | null
          cantidad_ventanas?: number | null
          comentarios?: string | null
          comuna?: string | null
          created_at?: string
          detalle_personal?: string | null
          email?: string | null
          empresa_id: string
          estado?: string
          etapa_seguimiento?: number
          fecha_archivado?: string | null
          fecha_cierre?: string | null
          fecha_cotizacion?: string | null
          fuente?: string
          id?: string
          monto?: number | null
          motivo_derivacion?: string | null
          necesita_instalacion?: boolean | null
          nombre?: string | null
          ot_id?: string | null
          presupuesto_rango?: string | null
          prioridad?: string
          producto_interes?: string | null
          resumen_para_vendedor?: string | null
          rut?: string | null
          scoring?: number | null
          seg1_fecha?: string | null
          seg1_resultado?: string | null
          seg2_fecha?: string | null
          seg2_resultado?: string | null
          seg3_fecha?: string | null
          seg3_resultado?: string | null
          tiene_medidas?: boolean | null
          tomado_at?: string | null
          ultima_actividad_at?: string
          updated_at?: string
          urgencia?: string | null
          whatsapp_phone?: string | null
          whatsapp_wa_id?: string | null
        }
        Update: {
          archivado?: boolean
          asignado_a?: string | null
          asignado_at?: string | null
          cantidad_ventanas?: number | null
          comentarios?: string | null
          comuna?: string | null
          created_at?: string
          detalle_personal?: string | null
          email?: string | null
          empresa_id?: string
          estado?: string
          etapa_seguimiento?: number
          fecha_archivado?: string | null
          fecha_cierre?: string | null
          fecha_cotizacion?: string | null
          fuente?: string
          id?: string
          monto?: number | null
          motivo_derivacion?: string | null
          necesita_instalacion?: boolean | null
          nombre?: string | null
          ot_id?: string | null
          presupuesto_rango?: string | null
          prioridad?: string
          producto_interes?: string | null
          resumen_para_vendedor?: string | null
          rut?: string | null
          scoring?: number | null
          seg1_fecha?: string | null
          seg1_resultado?: string | null
          seg2_fecha?: string | null
          seg2_resultado?: string | null
          seg3_fecha?: string | null
          seg3_resultado?: string | null
          tiene_medidas?: boolean | null
          tomado_at?: string | null
          ultima_actividad_at?: string
          updated_at?: string
          urgencia?: string | null
          whatsapp_phone?: string | null
          whatsapp_wa_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_asignado_a_fkey"
            columns: ["asignado_a"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_ot_id_fkey"
            columns: ["ot_id"]
            isOneToOne: false
            referencedRelation: "ots"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_actividad: {
        Row: {
          created_at: string
          detalle: Json
          empresa_id: string
          id: string
          lead_id: string
          registrado_por: string | null
          tipo: string
        }
        Insert: {
          created_at?: string
          detalle?: Json
          empresa_id: string
          id?: string
          lead_id: string
          registrado_por?: string | null
          tipo: string
        }
        Update: {
          created_at?: string
          detalle?: Json
          empresa_id?: string
          id?: string
          lead_id?: string
          registrado_por?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_actividad_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_actividad_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_eventos: {
        Row: {
          creado_por: string | null
          created_at: string
          detalle: string | null
          empresa_id: string
          id: string
          lead_id: string
          metadata: Json | null
          tipo: string
        }
        Insert: {
          creado_por?: string | null
          created_at?: string
          detalle?: string | null
          empresa_id: string
          id?: string
          lead_id: string
          metadata?: Json | null
          tipo: string
        }
        Update: {
          creado_por?: string | null
          created_at?: string
          detalle?: string | null
          empresa_id?: string
          id?: string
          lead_id?: string
          metadata?: Json | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_eventos_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_mensajes: {
        Row: {
          contenido: string
          created_at: string
          empresa_id: string
          id: string
          lead_id: string
          metadata: Json | null
          rol: string
          whatsapp_message_id: string | null
        }
        Insert: {
          contenido: string
          created_at?: string
          empresa_id: string
          id?: string
          lead_id: string
          metadata?: Json | null
          rol: string
          whatsapp_message_id?: string | null
        }
        Update: {
          contenido?: string
          created_at?: string
          empresa_id?: string
          id?: string
          lead_id?: string
          metadata?: Json | null
          rol?: string
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_mensajes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lotes_produccion: {
        Row: {
          creado_en: string
          creado_por: string | null
          creado_por_id: string | null
          empresa_id: string
          id: string
          nombre: string
          ots: Json
        }
        Insert: {
          creado_en?: string
          creado_por?: string | null
          creado_por_id?: string | null
          empresa_id: string
          id?: string
          nombre: string
          ots?: Json
        }
        Update: {
          creado_en?: string
          creado_por?: string | null
          creado_por_id?: string | null
          empresa_id?: string
          id?: string
          nombre?: string
          ots?: Json
        }
        Relationships: []
      }
      metas_vendedora: {
        Row: {
          empresa_id: string
          id: string
          monto_meta: number
          periodo: string
          updated_at: string
          vendedora_id: string
        }
        Insert: {
          empresa_id: string
          id?: string
          monto_meta?: number
          periodo: string
          updated_at?: string
          vendedora_id: string
        }
        Update: {
          empresa_id?: string
          id?: string
          monto_meta?: number
          periodo?: string
          updated_at?: string
          vendedora_id?: string
        }
        Relationships: []
      }
      modulos: {
        Row: {
          descripcion: string | null
          id: string
          nombre: string
          precio_mensual: number | null
        }
        Insert: {
          descripcion?: string | null
          id?: string
          nombre: string
          precio_mensual?: number | null
        }
        Update: {
          descripcion?: string | null
          id?: string
          nombre?: string
          precio_mensual?: number | null
        }
        Relationships: []
      }
      movimientos_camioneta: {
        Row: {
          camioneta_id: string
          cantidad: number
          created_at: string | null
          empresa_id: string
          id: string
          insumo_id: string
          insumo_reemplazo_id: string | null
          motivo: string | null
          ot_id: string | null
          registrado_por: string | null
          tipo: string
        }
        Insert: {
          camioneta_id: string
          cantidad?: number
          created_at?: string | null
          empresa_id: string
          id?: string
          insumo_id: string
          insumo_reemplazo_id?: string | null
          motivo?: string | null
          ot_id?: string | null
          registrado_por?: string | null
          tipo: string
        }
        Update: {
          camioneta_id?: string
          cantidad?: number
          created_at?: string | null
          empresa_id?: string
          id?: string
          insumo_id?: string
          insumo_reemplazo_id?: string | null
          motivo?: string | null
          ot_id?: string | null
          registrado_por?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_camioneta_camioneta_id_fkey"
            columns: ["camioneta_id"]
            isOneToOne: false
            referencedRelation: "camionetas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_camioneta_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
        ]
      }
      movimientos_insumos: {
        Row: {
          almacen: string | null
          area: string | null
          bitacora: string | null
          cantidad: number
          codigo: string
          created_at: string | null
          created_by: string | null
          devolucion: string | null
          empresa_id: string
          entrega: string | null
          estado: string | null
          estatus: string | null
          fecha: string | null
          id: string
          mes: string | null
          n_folio: string | null
          nombre_cliente: string | null
          ot: string | null
          persona_verifica: string | null
          producto: string | null
          recepcion: string | null
          responsable_entrega: string | null
          tipo: string
          tipo_doc: string | null
          verificado: boolean | null
        }
        Insert: {
          almacen?: string | null
          area?: string | null
          bitacora?: string | null
          cantidad?: number
          codigo: string
          created_at?: string | null
          created_by?: string | null
          devolucion?: string | null
          empresa_id?: string
          entrega?: string | null
          estado?: string | null
          estatus?: string | null
          fecha?: string | null
          id?: string
          mes?: string | null
          n_folio?: string | null
          nombre_cliente?: string | null
          ot?: string | null
          persona_verifica?: string | null
          producto?: string | null
          recepcion?: string | null
          responsable_entrega?: string | null
          tipo: string
          tipo_doc?: string | null
          verificado?: boolean | null
        }
        Update: {
          almacen?: string | null
          area?: string | null
          bitacora?: string | null
          cantidad?: number
          codigo?: string
          created_at?: string | null
          created_by?: string | null
          devolucion?: string | null
          empresa_id?: string
          entrega?: string | null
          estado?: string | null
          estatus?: string | null
          fecha?: string | null
          id?: string
          mes?: string | null
          n_folio?: string | null
          nombre_cliente?: string | null
          ot?: string | null
          persona_verifica?: string | null
          producto?: string | null
          recepcion?: string | null
          responsable_entrega?: string | null
          tipo?: string
          tipo_doc?: string | null
          verificado?: boolean | null
        }
        Relationships: []
      }
      movimientos_telas: {
        Row: {
          almacen: string | null
          codigo: string
          empresa_id: string
          fecha: string | null
          id: string
          metros: number
          notas: string | null
          operario: string | null
          ot: string | null
          responsable: string | null
          tipo: string
        }
        Insert: {
          almacen?: string | null
          codigo: string
          empresa_id: string
          fecha?: string | null
          id?: string
          metros: number
          notas?: string | null
          operario?: string | null
          ot?: string | null
          responsable?: string | null
          tipo: string
        }
        Update: {
          almacen?: string | null
          codigo?: string
          empresa_id?: string
          fecha?: string | null
          id?: string
          metros?: number
          notas?: string | null
          operario?: string | null
          ot?: string | null
          responsable?: string | null
          tipo?: string
        }
        Relationships: []
      }
      orden_materiales: {
        Row: {
          cantidad_despachada: number | null
          cantidad_req: number | null
          categoria: string | null
          color: string | null
          creado_en: string | null
          descripcion: string | null
          empresa_id: string
          especificacion: string | null
          estado: string | null
          id: string
          orden: number | null
          ot_id: string
          unidad: string | null
        }
        Insert: {
          cantidad_despachada?: number | null
          cantidad_req?: number | null
          categoria?: string | null
          color?: string | null
          creado_en?: string | null
          descripcion?: string | null
          empresa_id: string
          especificacion?: string | null
          estado?: string | null
          id?: string
          orden?: number | null
          ot_id: string
          unidad?: string | null
        }
        Update: {
          cantidad_despachada?: number | null
          cantidad_req?: number | null
          categoria?: string | null
          color?: string | null
          creado_en?: string | null
          descripcion?: string | null
          empresa_id?: string
          especificacion?: string | null
          estado?: string | null
          id?: string
          orden?: number | null
          ot_id?: string
          unidad?: string | null
        }
        Relationships: []
      }
      ot_contadores: {
        Row: {
          empresa_id: string
          periodo: string
          ultimo_numero: number
        }
        Insert: {
          empresa_id: string
          periodo: string
          ultimo_numero?: number
        }
        Update: {
          empresa_id?: string
          periodo?: string
          ultimo_numero?: number
        }
        Relationships: []
      }
      ots: {
        Row: {
          cliente_id: string | null
          creado_por: string | null
          datos_generales: Json | null
          empresa_id: string
          estado: string | null
          fecha_creacion: string | null
          fecha_entrega: string | null
          fecha_modificacion: string | null
          id: string
          items: Json | null
          numero_ot: string | null
          total: number | null
        }
        Insert: {
          cliente_id?: string | null
          creado_por?: string | null
          datos_generales?: Json | null
          empresa_id: string
          estado?: string | null
          fecha_creacion?: string | null
          fecha_entrega?: string | null
          fecha_modificacion?: string | null
          id?: string
          items?: Json | null
          numero_ot?: string | null
          total?: number | null
        }
        Update: {
          cliente_id?: string | null
          creado_por?: string | null
          datos_generales?: Json | null
          empresa_id?: string
          estado?: string | null
          fecha_creacion?: string | null
          fecha_entrega?: string | null
          fecha_modificacion?: string | null
          id?: string
          items?: Json | null
          numero_ot?: string | null
          total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ots_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ots_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ots_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ots_backup_20260715_prueba_banda: {
        Row: {
          cliente_id: string | null
          creado_por: string | null
          datos_generales: Json | null
          empresa_id: string | null
          estado: string | null
          fecha_creacion: string | null
          fecha_entrega: string | null
          fecha_modificacion: string | null
          id: string | null
          items: Json | null
          numero_ot: string | null
          total: number | null
        }
        Insert: {
          cliente_id?: string | null
          creado_por?: string | null
          datos_generales?: Json | null
          empresa_id?: string | null
          estado?: string | null
          fecha_creacion?: string | null
          fecha_entrega?: string | null
          fecha_modificacion?: string | null
          id?: string | null
          items?: Json | null
          numero_ot?: string | null
          total?: number | null
        }
        Update: {
          cliente_id?: string | null
          creado_por?: string | null
          datos_generales?: Json | null
          empresa_id?: string | null
          estado?: string | null
          fecha_creacion?: string | null
          fecha_entrega?: string | null
          fecha_modificacion?: string | null
          id?: string | null
          items?: Json | null
          numero_ot?: string | null
          total?: number | null
        }
        Relationships: []
      }
      ots_backup_20260810_cenefas: {
        Row: {
          cliente_id: string | null
          creado_por: string | null
          datos_generales: Json | null
          empresa_id: string | null
          estado: string | null
          fecha_creacion: string | null
          fecha_entrega: string | null
          fecha_modificacion: string | null
          id: string | null
          items: Json | null
          numero_ot: string | null
          total: number | null
        }
        Insert: {
          cliente_id?: string | null
          creado_por?: string | null
          datos_generales?: Json | null
          empresa_id?: string | null
          estado?: string | null
          fecha_creacion?: string | null
          fecha_entrega?: string | null
          fecha_modificacion?: string | null
          id?: string | null
          items?: Json | null
          numero_ot?: string | null
          total?: number | null
        }
        Update: {
          cliente_id?: string | null
          creado_por?: string | null
          datos_generales?: Json | null
          empresa_id?: string | null
          estado?: string | null
          fecha_creacion?: string | null
          fecha_entrega?: string | null
          fecha_modificacion?: string | null
          id?: string | null
          items?: Json | null
          numero_ot?: string | null
          total?: number | null
        }
        Relationships: []
      }
      ots_backup_20260810_tira: {
        Row: {
          cliente_id: string | null
          creado_por: string | null
          datos_generales: Json | null
          empresa_id: string | null
          estado: string | null
          fecha_creacion: string | null
          fecha_entrega: string | null
          fecha_modificacion: string | null
          id: string | null
          items: Json | null
          numero_ot: string | null
          total: number | null
        }
        Insert: {
          cliente_id?: string | null
          creado_por?: string | null
          datos_generales?: Json | null
          empresa_id?: string | null
          estado?: string | null
          fecha_creacion?: string | null
          fecha_entrega?: string | null
          fecha_modificacion?: string | null
          id?: string | null
          items?: Json | null
          numero_ot?: string | null
          total?: number | null
        }
        Update: {
          cliente_id?: string | null
          creado_por?: string | null
          datos_generales?: Json | null
          empresa_id?: string | null
          estado?: string | null
          fecha_creacion?: string | null
          fecha_entrega?: string | null
          fecha_modificacion?: string | null
          id?: string | null
          items?: Json | null
          numero_ot?: string | null
          total?: number | null
        }
        Relationships: []
      }
      perfiles: {
        Row: {
          activo: boolean | null
          created_at: string | null
          dispositivo_id: string | null
          empresa_id: string | null
          id: string
          nombre: string
          rol: string
        }
        Insert: {
          activo?: boolean | null
          created_at?: string | null
          dispositivo_id?: string | null
          empresa_id?: string | null
          id: string
          nombre: string
          rol: string
        }
        Update: {
          activo?: boolean | null
          created_at?: string | null
          dispositivo_id?: string | null
          empresa_id?: string | null
          id?: string
          nombre?: string
          rol?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_perfiles_tenant"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfiles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      planes_corte: {
        Row: {
          empresa_id: string
          fecha: string | null
          fecha_correccion: string | null
          id: string
          optimizer_email: string | null
          ordenes: Json | null
          resultados: Json | null
          snapshot_inventario: Json | null
          snapshot_seriales: Json | null
          tipo: string | null
          usuario_id: string | null
        }
        Insert: {
          empresa_id: string
          fecha?: string | null
          fecha_correccion?: string | null
          id?: string
          optimizer_email?: string | null
          ordenes?: Json | null
          resultados?: Json | null
          snapshot_inventario?: Json | null
          snapshot_seriales?: Json | null
          tipo?: string | null
          usuario_id?: string | null
        }
        Update: {
          empresa_id?: string
          fecha?: string | null
          fecha_correccion?: string | null
          id?: string
          optimizer_email?: string | null
          ordenes?: Json | null
          resultados?: Json | null
          snapshot_inventario?: Json | null
          snapshot_seriales?: Json | null
          tipo?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "planes_corte_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planes_corte_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      planes_corte_backup_20260715_prueba_banda: {
        Row: {
          empresa_id: string | null
          fecha: string | null
          fecha_correccion: string | null
          id: string | null
          optimizer_email: string | null
          ordenes: Json | null
          resultados: Json | null
          snapshot_inventario: Json | null
          snapshot_seriales: Json | null
          tipo: string | null
          usuario_id: string | null
        }
        Insert: {
          empresa_id?: string | null
          fecha?: string | null
          fecha_correccion?: string | null
          id?: string | null
          optimizer_email?: string | null
          ordenes?: Json | null
          resultados?: Json | null
          snapshot_inventario?: Json | null
          snapshot_seriales?: Json | null
          tipo?: string | null
          usuario_id?: string | null
        }
        Update: {
          empresa_id?: string | null
          fecha?: string | null
          fecha_correccion?: string | null
          id?: string | null
          optimizer_email?: string | null
          ordenes?: Json | null
          resultados?: Json | null
          snapshot_inventario?: Json | null
          snapshot_seriales?: Json | null
          tipo?: string | null
          usuario_id?: string | null
        }
        Relationships: []
      }
      planes_corte_backup_20260720_reversa_3132: {
        Row: {
          empresa_id: string | null
          fecha: string | null
          fecha_correccion: string | null
          id: string | null
          optimizer_email: string | null
          ordenes: Json | null
          resultados: Json | null
          snapshot_inventario: Json | null
          snapshot_seriales: Json | null
          tipo: string | null
          usuario_id: string | null
        }
        Insert: {
          empresa_id?: string | null
          fecha?: string | null
          fecha_correccion?: string | null
          id?: string | null
          optimizer_email?: string | null
          ordenes?: Json | null
          resultados?: Json | null
          snapshot_inventario?: Json | null
          snapshot_seriales?: Json | null
          tipo?: string | null
          usuario_id?: string | null
        }
        Update: {
          empresa_id?: string | null
          fecha?: string | null
          fecha_correccion?: string | null
          id?: string | null
          optimizer_email?: string | null
          ordenes?: Json | null
          resultados?: Json | null
          snapshot_inventario?: Json | null
          snapshot_seriales?: Json | null
          tipo?: string | null
          usuario_id?: string | null
        }
        Relationships: []
      }
      planes_corte_backup_20260722_reversa_4847: {
        Row: {
          empresa_id: string | null
          fecha: string | null
          fecha_correccion: string | null
          id: string | null
          optimizer_email: string | null
          ordenes: Json | null
          resultados: Json | null
          snapshot_inventario: Json | null
          snapshot_seriales: Json | null
          tipo: string | null
          usuario_id: string | null
        }
        Insert: {
          empresa_id?: string | null
          fecha?: string | null
          fecha_correccion?: string | null
          id?: string | null
          optimizer_email?: string | null
          ordenes?: Json | null
          resultados?: Json | null
          snapshot_inventario?: Json | null
          snapshot_seriales?: Json | null
          tipo?: string | null
          usuario_id?: string | null
        }
        Update: {
          empresa_id?: string | null
          fecha?: string | null
          fecha_correccion?: string | null
          id?: string | null
          optimizer_email?: string | null
          ordenes?: Json | null
          resultados?: Json | null
          snapshot_inventario?: Json | null
          snapshot_seriales?: Json | null
          tipo?: string | null
          usuario_id?: string | null
        }
        Relationships: []
      }
      planes_corte_backup_20260723_reversa_3120: {
        Row: {
          empresa_id: string | null
          fecha: string | null
          fecha_correccion: string | null
          id: string | null
          optimizer_email: string | null
          ordenes: Json | null
          resultados: Json | null
          snapshot_inventario: Json | null
          snapshot_seriales: Json | null
          tipo: string | null
          usuario_id: string | null
        }
        Insert: {
          empresa_id?: string | null
          fecha?: string | null
          fecha_correccion?: string | null
          id?: string | null
          optimizer_email?: string | null
          ordenes?: Json | null
          resultados?: Json | null
          snapshot_inventario?: Json | null
          snapshot_seriales?: Json | null
          tipo?: string | null
          usuario_id?: string | null
        }
        Update: {
          empresa_id?: string | null
          fecha?: string | null
          fecha_correccion?: string | null
          id?: string | null
          optimizer_email?: string | null
          ordenes?: Json | null
          resultados?: Json | null
          snapshot_inventario?: Json | null
          snapshot_seriales?: Json | null
          tipo?: string | null
          usuario_id?: string | null
        }
        Relationships: []
      }
      planes_corte_backup_20260723_reversa_47: {
        Row: {
          empresa_id: string | null
          fecha: string | null
          fecha_correccion: string | null
          id: string | null
          optimizer_email: string | null
          ordenes: Json | null
          resultados: Json | null
          snapshot_inventario: Json | null
          snapshot_seriales: Json | null
          tipo: string | null
          usuario_id: string | null
        }
        Insert: {
          empresa_id?: string | null
          fecha?: string | null
          fecha_correccion?: string | null
          id?: string | null
          optimizer_email?: string | null
          ordenes?: Json | null
          resultados?: Json | null
          snapshot_inventario?: Json | null
          snapshot_seriales?: Json | null
          tipo?: string | null
          usuario_id?: string | null
        }
        Update: {
          empresa_id?: string | null
          fecha?: string | null
          fecha_correccion?: string | null
          id?: string | null
          optimizer_email?: string | null
          ordenes?: Json | null
          resultados?: Json | null
          snapshot_inventario?: Json | null
          snapshot_seriales?: Json | null
          tipo?: string | null
          usuario_id?: string | null
        }
        Relationships: []
      }
      planes_corte_backup_20260806_reversa_corr50: {
        Row: {
          empresa_id: string | null
          fecha: string | null
          fecha_correccion: string | null
          id: string | null
          optimizer_email: string | null
          ordenes: Json | null
          resultados: Json | null
          snapshot_inventario: Json | null
          snapshot_seriales: Json | null
          tipo: string | null
          usuario_id: string | null
        }
        Insert: {
          empresa_id?: string | null
          fecha?: string | null
          fecha_correccion?: string | null
          id?: string | null
          optimizer_email?: string | null
          ordenes?: Json | null
          resultados?: Json | null
          snapshot_inventario?: Json | null
          snapshot_seriales?: Json | null
          tipo?: string | null
          usuario_id?: string | null
        }
        Update: {
          empresa_id?: string | null
          fecha?: string | null
          fecha_correccion?: string | null
          id?: string | null
          optimizer_email?: string | null
          ordenes?: Json | null
          resultados?: Json | null
          snapshot_inventario?: Json | null
          snapshot_seriales?: Json | null
          tipo?: string | null
          usuario_id?: string | null
        }
        Relationships: []
      }
      planes_corte_backup_20260831_wipe: {
        Row: {
          empresa_id: string | null
          fecha: string | null
          fecha_correccion: string | null
          id: string | null
          optimizer_email: string | null
          ordenes: Json | null
          resultados: Json | null
          snapshot_inventario: Json | null
          snapshot_seriales: Json | null
          tipo: string | null
          usuario_id: string | null
        }
        Insert: {
          empresa_id?: string | null
          fecha?: string | null
          fecha_correccion?: string | null
          id?: string | null
          optimizer_email?: string | null
          ordenes?: Json | null
          resultados?: Json | null
          snapshot_inventario?: Json | null
          snapshot_seriales?: Json | null
          tipo?: string | null
          usuario_id?: string | null
        }
        Update: {
          empresa_id?: string | null
          fecha?: string | null
          fecha_correccion?: string | null
          id?: string | null
          optimizer_email?: string | null
          ordenes?: Json | null
          resultados?: Json | null
          snapshot_inventario?: Json | null
          snapshot_seriales?: Json | null
          tipo?: string | null
          usuario_id?: string | null
        }
        Relationships: []
      }
      portal_accesos: {
        Row: {
          activo: boolean | null
          cliente_id: string
          email: string
          id: string
          ultimo_acceso: string | null
        }
        Insert: {
          activo?: boolean | null
          cliente_id: string
          email: string
          id?: string
          ultimo_acceso?: string | null
        }
        Update: {
          activo?: boolean | null
          cliente_id?: string
          email?: string
          id?: string
          ultimo_acceso?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_accesos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      presencia: {
        Row: {
          actividad: string | null
          activo: boolean | null
          dispositivo_id: string | null
          empresa_id: string
          id: string
          nombre_operario: string | null
          seccion: string | null
          timestamp: string | null
          usuario_id: string | null
        }
        Insert: {
          actividad?: string | null
          activo?: boolean | null
          dispositivo_id?: string | null
          empresa_id: string
          id?: string
          nombre_operario?: string | null
          seccion?: string | null
          timestamp?: string | null
          usuario_id?: string | null
        }
        Update: {
          actividad?: string | null
          activo?: boolean | null
          dispositivo_id?: string | null
          empresa_id?: string
          id?: string
          nombre_operario?: string | null
          seccion?: string | null
          timestamp?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "presencia_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencia_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      produccion_checks: {
        Row: {
          area: string
          clave: string
          empresa_id: string
          hecho: boolean
          hecho_en: string
          hecho_por: string | null
          hecho_por_id: string | null
          id: string
          nota: string | null
          ot: string
          ref: string
        }
        Insert: {
          area: string
          clave: string
          empresa_id: string
          hecho?: boolean
          hecho_en?: string
          hecho_por?: string | null
          hecho_por_id?: string | null
          id?: string
          nota?: string | null
          ot: string
          ref?: string
        }
        Update: {
          area?: string
          clave?: string
          empresa_id?: string
          hecho?: boolean
          hecho_en?: string
          hecho_por?: string | null
          hecho_por_id?: string | null
          id?: string
          nota?: string | null
          ot?: string
          ref?: string
        }
        Relationships: []
      }
      reversas_planes_corte: {
        Row: {
          actor: string | null
          created_at: string
          empresa_id: string
          id: string
          nota: string | null
          ots: string | null
          paquete: Json
          plan_fecha: string | null
          plan_id: string
          resumen: Json
        }
        Insert: {
          actor?: string | null
          created_at?: string
          empresa_id: string
          id?: string
          nota?: string | null
          ots?: string | null
          paquete: Json
          plan_fecha?: string | null
          plan_id: string
          resumen: Json
        }
        Update: {
          actor?: string | null
          created_at?: string
          empresa_id?: string
          id?: string
          nota?: string | null
          ots?: string | null
          paquete?: Json
          plan_fecha?: string | null
          plan_id?: string
          resumen?: Json
        }
        Relationships: []
      }
      telas: {
        Row: {
          activa: boolean | null
          alerta_minimo: number | null
          ancho_m: number | null
          codigo: string
          color: string | null
          empresa_id: string
          fecha_actualizacion: string | null
          id: string
          metros_disponibles: number | null
          nombre: string | null
          precio_metro: number | null
          stock_metros: number | null
          tipo: string | null
        }
        Insert: {
          activa?: boolean | null
          alerta_minimo?: number | null
          ancho_m?: number | null
          codigo: string
          color?: string | null
          empresa_id: string
          fecha_actualizacion?: string | null
          id?: string
          metros_disponibles?: number | null
          nombre?: string | null
          precio_metro?: number | null
          stock_metros?: number | null
          tipo?: string | null
        }
        Update: {
          activa?: boolean | null
          alerta_minimo?: number | null
          ancho_m?: number | null
          codigo?: string
          color?: string | null
          empresa_id?: string
          fecha_actualizacion?: string | null
          id?: string
          metros_disponibles?: number | null
          nombre?: string | null
          precio_metro?: number | null
          stock_metros?: number | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      telas_catalogo: {
        Row: {
          almacen: string | null
          ancho: number | null
          calidad: string | null
          cod_ext: string | null
          codigo: string
          created_at: string | null
          descriptor: string | null
          empresa_id: string
          estado: string | null
          foto_url: string | null
          grupo: string | null
          id: string
          metros_rollo: number | null
          nemotecnico: string | null
          observaciones: string | null
          posicion: string | null
          proveedor: string | null
          proveedor_codigo: string | null
          responsable: string | null
          status_stock: string | null
          stock_liberado: number | null
          stock_maximo: number | null
          stock_minimo: number | null
          stock_mp: number | null
          stock_total: number | null
          tipo: string | null
          updated_at: string | null
        }
        Insert: {
          almacen?: string | null
          ancho?: number | null
          calidad?: string | null
          cod_ext?: string | null
          codigo: string
          created_at?: string | null
          descriptor?: string | null
          empresa_id: string
          estado?: string | null
          foto_url?: string | null
          grupo?: string | null
          id?: string
          metros_rollo?: number | null
          nemotecnico?: string | null
          observaciones?: string | null
          posicion?: string | null
          proveedor?: string | null
          proveedor_codigo?: string | null
          responsable?: string | null
          status_stock?: string | null
          stock_liberado?: number | null
          stock_maximo?: number | null
          stock_minimo?: number | null
          stock_mp?: number | null
          stock_total?: number | null
          tipo?: string | null
          updated_at?: string | null
        }
        Update: {
          almacen?: string | null
          ancho?: number | null
          calidad?: string | null
          cod_ext?: string | null
          codigo?: string
          created_at?: string | null
          descriptor?: string | null
          empresa_id?: string
          estado?: string | null
          foto_url?: string | null
          grupo?: string | null
          id?: string
          metros_rollo?: number | null
          nemotecnico?: string | null
          observaciones?: string | null
          posicion?: string | null
          proveedor?: string | null
          proveedor_codigo?: string | null
          responsable?: string | null
          status_stock?: string | null
          stock_liberado?: number | null
          stock_maximo?: number | null
          stock_minimo?: number | null
          stock_mp?: number | null
          stock_total?: number | null
          tipo?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      telas_fallas: {
        Row: {
          alto: number | null
          ancho: number | null
          codigo: string
          created_at: string | null
          empresa_id: string
          fecha_reporte: string | null
          fecha_resolucion: string | null
          grupo: string | null
          id: string
          informado: string | null
          metraje: number | null
          nemotecnico: string | null
          observaciones: string | null
          proveedor: string | null
          responsable: string | null
          resuelto: string | null
          solucion: string | null
          tipo: string | null
          tipo_falla: string | null
        }
        Insert: {
          alto?: number | null
          ancho?: number | null
          codigo: string
          created_at?: string | null
          empresa_id: string
          fecha_reporte?: string | null
          fecha_resolucion?: string | null
          grupo?: string | null
          id?: string
          informado?: string | null
          metraje?: number | null
          nemotecnico?: string | null
          observaciones?: string | null
          proveedor?: string | null
          responsable?: string | null
          resuelto?: string | null
          solucion?: string | null
          tipo?: string | null
          tipo_falla?: string | null
        }
        Update: {
          alto?: number | null
          ancho?: number | null
          codigo?: string
          created_at?: string | null
          empresa_id?: string
          fecha_reporte?: string | null
          fecha_resolucion?: string | null
          grupo?: string | null
          id?: string
          informado?: string | null
          metraje?: number | null
          nemotecnico?: string | null
          observaciones?: string | null
          proveedor?: string | null
          responsable?: string | null
          resuelto?: string | null
          solucion?: string | null
          tipo?: string | null
          tipo_falla?: string | null
        }
        Relationships: []
      }
      telas_fallas_backup_20260626: {
        Row: {
          alto: number | null
          ancho: number | null
          codigo: string | null
          created_at: string | null
          empresa_id: string | null
          fecha_reporte: string | null
          fecha_resolucion: string | null
          grupo: string | null
          id: string | null
          informado: string | null
          metraje: number | null
          nemotecnico: string | null
          observaciones: string | null
          proveedor: string | null
          responsable: string | null
          resuelto: string | null
          solucion: string | null
          tipo: string | null
          tipo_falla: string | null
        }
        Insert: {
          alto?: number | null
          ancho?: number | null
          codigo?: string | null
          created_at?: string | null
          empresa_id?: string | null
          fecha_reporte?: string | null
          fecha_resolucion?: string | null
          grupo?: string | null
          id?: string | null
          informado?: string | null
          metraje?: number | null
          nemotecnico?: string | null
          observaciones?: string | null
          proveedor?: string | null
          responsable?: string | null
          resuelto?: string | null
          solucion?: string | null
          tipo?: string | null
          tipo_falla?: string | null
        }
        Update: {
          alto?: number | null
          ancho?: number | null
          codigo?: string | null
          created_at?: string | null
          empresa_id?: string | null
          fecha_reporte?: string | null
          fecha_resolucion?: string | null
          grupo?: string | null
          id?: string | null
          informado?: string | null
          metraje?: number | null
          nemotecnico?: string | null
          observaciones?: string | null
          proveedor?: string | null
          responsable?: string | null
          resuelto?: string | null
          solucion?: string | null
          tipo?: string | null
          tipo_falla?: string | null
        }
        Relationships: []
      }
      telas_mermas: {
        Row: {
          codigo: string | null
          colmena_origen_id: string | null
          created_at: string | null
          empresa_id: string
          fecha: string | null
          id: string
          medida_alto: number | null
          medida_ancho: number | null
          motivo: string | null
          ot_origen: string | null
        }
        Insert: {
          codigo?: string | null
          colmena_origen_id?: string | null
          created_at?: string | null
          empresa_id: string
          fecha?: string | null
          id?: string
          medida_alto?: number | null
          medida_ancho?: number | null
          motivo?: string | null
          ot_origen?: string | null
        }
        Update: {
          codigo?: string | null
          colmena_origen_id?: string | null
          created_at?: string | null
          empresa_id?: string
          fecha?: string | null
          id?: string
          medida_alto?: number | null
          medida_ancho?: number | null
          motivo?: string | null
          ot_origen?: string | null
        }
        Relationships: []
      }
      telas_slots: {
        Row: {
          almacen: string | null
          almacen_id: string | null
          codigo: string | null
          empresa_id: string
          posicion: string
        }
        Insert: {
          almacen?: string | null
          almacen_id?: string | null
          codigo?: string | null
          empresa_id: string
          posicion: string
        }
        Update: {
          almacen?: string | null
          almacen_id?: string | null
          codigo?: string | null
          empresa_id?: string
          posicion?: string
        }
        Relationships: [
          {
            foreignKeyName: "telas_slots_almacen_id_fkey"
            columns: ["almacen_id"]
            isOneToOne: false
            referencedRelation: "almacenes"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          activo_hasta: string | null
          configuracion_json: Json | null
          estado: string
          exenta: boolean
          fecha_creacion: string
          id: string
          nombre: string
          plan: string
          slug: string
          trial_termina_en: string | null
        }
        Insert: {
          activo_hasta?: string | null
          configuracion_json?: Json | null
          estado?: string
          exenta?: boolean
          fecha_creacion?: string
          id?: string
          nombre: string
          plan?: string
          slug: string
          trial_termina_en?: string | null
        }
        Update: {
          activo_hasta?: string | null
          configuracion_json?: Json | null
          estado?: string
          exenta?: boolean
          fecha_creacion?: string
          id?: string
          nombre?: string
          plan?: string
          slug?: string
          trial_termina_en?: string | null
        }
        Relationships: []
      }
      tubos_historial: {
        Row: {
          cod: string | null
          created_at: string | null
          empresa_id: string
          evento: string
          fuente: string | null
          id: string
          linea_idx: number | null
          medida_cm: number | null
          medida_resultado_cm: number | null
          n_colmena: string | null
          notas: string | null
          ot: string | null
          plan_id: string | null
          registrado_por: string | null
          tubo_raiz_id: string | null
        }
        Insert: {
          cod?: string | null
          created_at?: string | null
          empresa_id: string
          evento: string
          fuente?: string | null
          id?: string
          linea_idx?: number | null
          medida_cm?: number | null
          medida_resultado_cm?: number | null
          n_colmena?: string | null
          notas?: string | null
          ot?: string | null
          plan_id?: string | null
          registrado_por?: string | null
          tubo_raiz_id?: string | null
        }
        Update: {
          cod?: string | null
          created_at?: string | null
          empresa_id?: string
          evento?: string
          fuente?: string | null
          id?: string
          linea_idx?: number | null
          medida_cm?: number | null
          medida_resultado_cm?: number | null
          n_colmena?: string | null
          notas?: string | null
          ot?: string | null
          plan_id?: string | null
          registrado_por?: string | null
          tubo_raiz_id?: string | null
        }
        Relationships: []
      }
      tubos_historial_backup_20260715_prueba_banda: {
        Row: {
          cod: string | null
          created_at: string | null
          empresa_id: string | null
          evento: string | null
          fuente: string | null
          id: string | null
          linea_idx: number | null
          medida_cm: number | null
          medida_resultado_cm: number | null
          n_colmena: string | null
          notas: string | null
          ot: string | null
          plan_id: string | null
          registrado_por: string | null
          tubo_raiz_id: string | null
        }
        Insert: {
          cod?: string | null
          created_at?: string | null
          empresa_id?: string | null
          evento?: string | null
          fuente?: string | null
          id?: string | null
          linea_idx?: number | null
          medida_cm?: number | null
          medida_resultado_cm?: number | null
          n_colmena?: string | null
          notas?: string | null
          ot?: string | null
          plan_id?: string | null
          registrado_por?: string | null
          tubo_raiz_id?: string | null
        }
        Update: {
          cod?: string | null
          created_at?: string | null
          empresa_id?: string | null
          evento?: string | null
          fuente?: string | null
          id?: string | null
          linea_idx?: number | null
          medida_cm?: number | null
          medida_resultado_cm?: number | null
          n_colmena?: string | null
          notas?: string | null
          ot?: string | null
          plan_id?: string | null
          registrado_por?: string | null
          tubo_raiz_id?: string | null
        }
        Relationships: []
      }
      tubos_historial_backup_20260720_reversa_3132: {
        Row: {
          cod: string | null
          created_at: string | null
          empresa_id: string | null
          evento: string | null
          fuente: string | null
          id: string | null
          linea_idx: number | null
          medida_cm: number | null
          medida_resultado_cm: number | null
          n_colmena: string | null
          notas: string | null
          ot: string | null
          plan_id: string | null
          registrado_por: string | null
          tubo_raiz_id: string | null
        }
        Insert: {
          cod?: string | null
          created_at?: string | null
          empresa_id?: string | null
          evento?: string | null
          fuente?: string | null
          id?: string | null
          linea_idx?: number | null
          medida_cm?: number | null
          medida_resultado_cm?: number | null
          n_colmena?: string | null
          notas?: string | null
          ot?: string | null
          plan_id?: string | null
          registrado_por?: string | null
          tubo_raiz_id?: string | null
        }
        Update: {
          cod?: string | null
          created_at?: string | null
          empresa_id?: string | null
          evento?: string | null
          fuente?: string | null
          id?: string | null
          linea_idx?: number | null
          medida_cm?: number | null
          medida_resultado_cm?: number | null
          n_colmena?: string | null
          notas?: string | null
          ot?: string | null
          plan_id?: string | null
          registrado_por?: string | null
          tubo_raiz_id?: string | null
        }
        Relationships: []
      }
      tubos_historial_backup_20260722_reversa_4847: {
        Row: {
          cod: string | null
          created_at: string | null
          empresa_id: string | null
          evento: string | null
          fuente: string | null
          id: string | null
          linea_idx: number | null
          medida_cm: number | null
          medida_resultado_cm: number | null
          n_colmena: string | null
          notas: string | null
          ot: string | null
          plan_id: string | null
          registrado_por: string | null
          tubo_raiz_id: string | null
        }
        Insert: {
          cod?: string | null
          created_at?: string | null
          empresa_id?: string | null
          evento?: string | null
          fuente?: string | null
          id?: string | null
          linea_idx?: number | null
          medida_cm?: number | null
          medida_resultado_cm?: number | null
          n_colmena?: string | null
          notas?: string | null
          ot?: string | null
          plan_id?: string | null
          registrado_por?: string | null
          tubo_raiz_id?: string | null
        }
        Update: {
          cod?: string | null
          created_at?: string | null
          empresa_id?: string | null
          evento?: string | null
          fuente?: string | null
          id?: string | null
          linea_idx?: number | null
          medida_cm?: number | null
          medida_resultado_cm?: number | null
          n_colmena?: string | null
          notas?: string | null
          ot?: string | null
          plan_id?: string | null
          registrado_por?: string | null
          tubo_raiz_id?: string | null
        }
        Relationships: []
      }
      tubos_historial_backup_20260723_reversa_3120: {
        Row: {
          cod: string | null
          created_at: string | null
          empresa_id: string | null
          evento: string | null
          fuente: string | null
          id: string | null
          linea_idx: number | null
          medida_cm: number | null
          medida_resultado_cm: number | null
          n_colmena: string | null
          notas: string | null
          ot: string | null
          plan_id: string | null
          registrado_por: string | null
          tubo_raiz_id: string | null
        }
        Insert: {
          cod?: string | null
          created_at?: string | null
          empresa_id?: string | null
          evento?: string | null
          fuente?: string | null
          id?: string | null
          linea_idx?: number | null
          medida_cm?: number | null
          medida_resultado_cm?: number | null
          n_colmena?: string | null
          notas?: string | null
          ot?: string | null
          plan_id?: string | null
          registrado_por?: string | null
          tubo_raiz_id?: string | null
        }
        Update: {
          cod?: string | null
          created_at?: string | null
          empresa_id?: string | null
          evento?: string | null
          fuente?: string | null
          id?: string | null
          linea_idx?: number | null
          medida_cm?: number | null
          medida_resultado_cm?: number | null
          n_colmena?: string | null
          notas?: string | null
          ot?: string | null
          plan_id?: string | null
          registrado_por?: string | null
          tubo_raiz_id?: string | null
        }
        Relationships: []
      }
      tubos_historial_backup_20260723_reversa_47: {
        Row: {
          cod: string | null
          created_at: string | null
          empresa_id: string | null
          evento: string | null
          fuente: string | null
          id: string | null
          linea_idx: number | null
          medida_cm: number | null
          medida_resultado_cm: number | null
          n_colmena: string | null
          notas: string | null
          ot: string | null
          plan_id: string | null
          registrado_por: string | null
          tubo_raiz_id: string | null
        }
        Insert: {
          cod?: string | null
          created_at?: string | null
          empresa_id?: string | null
          evento?: string | null
          fuente?: string | null
          id?: string | null
          linea_idx?: number | null
          medida_cm?: number | null
          medida_resultado_cm?: number | null
          n_colmena?: string | null
          notas?: string | null
          ot?: string | null
          plan_id?: string | null
          registrado_por?: string | null
          tubo_raiz_id?: string | null
        }
        Update: {
          cod?: string | null
          created_at?: string | null
          empresa_id?: string | null
          evento?: string | null
          fuente?: string | null
          id?: string | null
          linea_idx?: number | null
          medida_cm?: number | null
          medida_resultado_cm?: number | null
          n_colmena?: string | null
          notas?: string | null
          ot?: string | null
          plan_id?: string | null
          registrado_por?: string | null
          tubo_raiz_id?: string | null
        }
        Relationships: []
      }
      tubos_historial_backup_20260728_backfill: {
        Row: {
          cod: string | null
          created_at: string | null
          empresa_id: string | null
          evento: string | null
          fuente: string | null
          id: string | null
          linea_idx: number | null
          medida_cm: number | null
          medida_resultado_cm: number | null
          n_colmena: string | null
          notas: string | null
          ot: string | null
          plan_id: string | null
          registrado_por: string | null
          tubo_raiz_id: string | null
        }
        Insert: {
          cod?: string | null
          created_at?: string | null
          empresa_id?: string | null
          evento?: string | null
          fuente?: string | null
          id?: string | null
          linea_idx?: number | null
          medida_cm?: number | null
          medida_resultado_cm?: number | null
          n_colmena?: string | null
          notas?: string | null
          ot?: string | null
          plan_id?: string | null
          registrado_por?: string | null
          tubo_raiz_id?: string | null
        }
        Update: {
          cod?: string | null
          created_at?: string | null
          empresa_id?: string | null
          evento?: string | null
          fuente?: string | null
          id?: string | null
          linea_idx?: number | null
          medida_cm?: number | null
          medida_resultado_cm?: number | null
          n_colmena?: string | null
          notas?: string | null
          ot?: string | null
          plan_id?: string | null
          registrado_por?: string | null
          tubo_raiz_id?: string | null
        }
        Relationships: []
      }
      tubos_historial_backup_20260806_reversa_corr50: {
        Row: {
          cod: string | null
          created_at: string | null
          empresa_id: string | null
          evento: string | null
          fuente: string | null
          id: string | null
          linea_idx: number | null
          medida_cm: number | null
          medida_resultado_cm: number | null
          n_colmena: string | null
          notas: string | null
          ot: string | null
          plan_id: string | null
          registrado_por: string | null
          tubo_raiz_id: string | null
        }
        Insert: {
          cod?: string | null
          created_at?: string | null
          empresa_id?: string | null
          evento?: string | null
          fuente?: string | null
          id?: string | null
          linea_idx?: number | null
          medida_cm?: number | null
          medida_resultado_cm?: number | null
          n_colmena?: string | null
          notas?: string | null
          ot?: string | null
          plan_id?: string | null
          registrado_por?: string | null
          tubo_raiz_id?: string | null
        }
        Update: {
          cod?: string | null
          created_at?: string | null
          empresa_id?: string | null
          evento?: string | null
          fuente?: string | null
          id?: string | null
          linea_idx?: number | null
          medida_cm?: number | null
          medida_resultado_cm?: number | null
          n_colmena?: string | null
          notas?: string | null
          ot?: string | null
          plan_id?: string | null
          registrado_por?: string | null
          tubo_raiz_id?: string | null
        }
        Relationships: []
      }
      tubos_historial_backup_20260814_e78: {
        Row: {
          cod: string | null
          created_at: string | null
          empresa_id: string | null
          evento: string | null
          fuente: string | null
          id: string | null
          linea_idx: number | null
          medida_cm: number | null
          medida_resultado_cm: number | null
          n_colmena: string | null
          notas: string | null
          ot: string | null
          plan_id: string | null
          registrado_por: string | null
          tubo_raiz_id: string | null
        }
        Insert: {
          cod?: string | null
          created_at?: string | null
          empresa_id?: string | null
          evento?: string | null
          fuente?: string | null
          id?: string | null
          linea_idx?: number | null
          medida_cm?: number | null
          medida_resultado_cm?: number | null
          n_colmena?: string | null
          notas?: string | null
          ot?: string | null
          plan_id?: string | null
          registrado_por?: string | null
          tubo_raiz_id?: string | null
        }
        Update: {
          cod?: string | null
          created_at?: string | null
          empresa_id?: string | null
          evento?: string | null
          fuente?: string | null
          id?: string | null
          linea_idx?: number | null
          medida_cm?: number | null
          medida_resultado_cm?: number | null
          n_colmena?: string | null
          notas?: string | null
          ot?: string | null
          plan_id?: string | null
          registrado_por?: string | null
          tubo_raiz_id?: string | null
        }
        Relationships: []
      }
      tubos_historial_backup_20260827_fantasmas: {
        Row: {
          cod: string | null
          created_at: string | null
          empresa_id: string | null
          evento: string | null
          fuente: string | null
          id: string | null
          linea_idx: number | null
          medida_cm: number | null
          medida_resultado_cm: number | null
          n_colmena: string | null
          notas: string | null
          ot: string | null
          plan_id: string | null
          registrado_por: string | null
          tubo_raiz_id: string | null
        }
        Insert: {
          cod?: string | null
          created_at?: string | null
          empresa_id?: string | null
          evento?: string | null
          fuente?: string | null
          id?: string | null
          linea_idx?: number | null
          medida_cm?: number | null
          medida_resultado_cm?: number | null
          n_colmena?: string | null
          notas?: string | null
          ot?: string | null
          plan_id?: string | null
          registrado_por?: string | null
          tubo_raiz_id?: string | null
        }
        Update: {
          cod?: string | null
          created_at?: string | null
          empresa_id?: string | null
          evento?: string | null
          fuente?: string | null
          id?: string | null
          linea_idx?: number | null
          medida_cm?: number | null
          medida_resultado_cm?: number | null
          n_colmena?: string | null
          notas?: string | null
          ot?: string | null
          plan_id?: string | null
          registrado_por?: string | null
          tubo_raiz_id?: string | null
        }
        Relationships: []
      }
      tubos_inventario_snapshot: {
        Row: {
          agregado_por_admin: boolean | null
          cod: string | null
          created_at_original: string | null
          datos_extra: Json | null
          disponible: boolean | null
          empresa_id: string
          id: string
          inventario_id: string
          medida_cm: number | null
          medida_mm: number | null
          n_colmena: string | null
          serial: string | null
          snapshot_at: string
          tubo_id_original: string
          tubo_raiz_id: string | null
        }
        Insert: {
          agregado_por_admin?: boolean | null
          cod?: string | null
          created_at_original?: string | null
          datos_extra?: Json | null
          disponible?: boolean | null
          empresa_id: string
          id?: string
          inventario_id: string
          medida_cm?: number | null
          medida_mm?: number | null
          n_colmena?: string | null
          serial?: string | null
          snapshot_at?: string
          tubo_id_original: string
          tubo_raiz_id?: string | null
        }
        Update: {
          agregado_por_admin?: boolean | null
          cod?: string | null
          created_at_original?: string | null
          datos_extra?: Json | null
          disponible?: boolean | null
          empresa_id?: string
          id?: string
          inventario_id?: string
          medida_cm?: number | null
          medida_mm?: number | null
          n_colmena?: string | null
          serial?: string | null
          snapshot_at?: string
          tubo_id_original?: string
          tubo_raiz_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tubos_inventario_snapshot_inventario_id_fkey"
            columns: ["inventario_id"]
            isOneToOne: false
            referencedRelation: "inventarios"
            referencedColumns: ["id"]
          },
        ]
      }
      ubicaciones_rack: {
        Row: {
          almacen: string
          almacen_id: string | null
          codigo_insumo: string | null
          columna: string
          empresa_id: string
          estado: string | null
          fila: number
          id: string
          notas: string | null
          rack: string
          updated_at: string | null
        }
        Insert: {
          almacen: string
          almacen_id?: string | null
          codigo_insumo?: string | null
          columna: string
          empresa_id?: string
          estado?: string | null
          fila: number
          id?: string
          notas?: string | null
          rack: string
          updated_at?: string | null
        }
        Update: {
          almacen?: string
          almacen_id?: string | null
          codigo_insumo?: string | null
          columna?: string
          empresa_id?: string
          estado?: string | null
          fila?: number
          id?: string
          notas?: string | null
          rack?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ubicaciones_rack_almacen_id_fkey"
            columns: ["almacen_id"]
            isOneToOne: false
            referencedRelation: "almacenes"
            referencedColumns: ["id"]
          },
        ]
      }
      unidades: {
        Row: {
          codigo: string
          creado_en: string
          decimales: number
          nombre: string
        }
        Insert: {
          codigo: string
          creado_en?: string
          decimales?: number
          nombre: string
        }
        Update: {
          codigo?: string
          creado_en?: string
          decimales?: number
          nombre?: string
        }
        Relationships: []
      }
      validadores_insumos: {
        Row: {
          activo: boolean | null
          campo: string
          empresa_id: string
          id: string
          orden: number | null
          valor: string
        }
        Insert: {
          activo?: boolean | null
          campo: string
          empresa_id?: string
          id?: string
          orden?: number | null
          valor: string
        }
        Update: {
          activo?: boolean | null
          campo?: string
          empresa_id?: string
          id?: string
          orden?: number | null
          valor?: string
        }
        Relationships: []
      }
      validadores_telas: {
        Row: {
          campo: string
          empresa_id: string
          id: string
          orden: number | null
          valor: string
        }
        Insert: {
          campo: string
          empresa_id: string
          id?: string
          orden?: number | null
          valor: string
        }
        Update: {
          campo?: string
          empresa_id?: string
          id?: string
          orden?: number | null
          valor?: string
        }
        Relationships: []
      }
      vendedoras_activas: {
        Row: {
          activa: boolean
          empresa_id: string
          leads_asignados_acumulado: number
          perfil_id: string
          peso: number
          ultima_asignacion: string | null
        }
        Insert: {
          activa?: boolean
          empresa_id: string
          leads_asignados_acumulado?: number
          perfil_id: string
          peso?: number
          ultima_asignacion?: string | null
        }
        Update: {
          activa?: boolean
          empresa_id?: string
          leads_asignados_acumulado?: number
          perfil_id?: string
          peso?: number
          ultima_asignacion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendedoras_activas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendedoras_activas_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_inventario_saldos_kardex: {
        Row: {
          diferencia: number | null
          dominio: string | null
          empresa_id: string | null
          item_cod: string | null
          lib_articulo: number | null
          lib_libro: number | null
          mp_articulo: number | null
          mp_libro: number | null
        }
        Relationships: []
      }
      v_kardex_historico: {
        Row: {
          cantidad: number | null
          cantidad_texto: string | null
          destino: string | null
          dominio: string | null
          editable: boolean | null
          empresa_id: string | null
          fecha: string | null
          fuente: string | null
          id: string | null
          item_cod: string | null
          item_nombre: string | null
          lote_id: string | null
          notas: string | null
          origen: string | null
          ot: string | null
          quien: string | null
          referencia: string | null
          saldo_post: number | null
          tipo: string | null
          unidad: string | null
        }
        Relationships: []
      }
      v_merma_mensual: {
        Row: {
          cantidad_eventos: number | null
          cod: string | null
          empresa_id: string | null
          mes: string | null
          total_cm_merma: number | null
          total_metros_merma: number | null
        }
        Relationships: []
      }
      v_stock_por_almacen: {
        Row: {
          almacen: string | null
          dominio: string | null
          empresa_id: string | null
          item_cod: string | null
          saldo: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      aceptar_invitacion: {
        Args: {
          p_codigo: string
          p_user_email: string
          p_user_id: string
          p_user_nombre: string
        }
        Returns: string
      }
      aplicar_correccion_retroactiva: {
        Args: {
          p_linea_idx: number
          p_nota?: string
          p_plan_id: string
          p_tipo: string
        }
        Returns: Json
      }
      archivar_seguimientos_vencidos: {
        Args: { p_empresa_id: string }
        Returns: number
      }
      buscar_tubos: {
        Args: {
          p_cod?: string
          p_colmena?: string
          p_limit?: number
          p_medida?: number
          p_ot?: string
        }
        Returns: Json
      }
      cargar_inventario_baseline: { Args: { p_tubos: Json }; Returns: Json }
      cerrar_inventario: {
        Args: {
          p_firma_png?: string
          p_inventario_id: string
          p_notas?: string
        }
        Returns: undefined
      }
      detectar_planes_huerfanos:
        | { Args: never; Returns: number }
        | {
            Args: { p_dias?: number; p_empresa_id: string }
            Returns: {
              age_hours: number
              fecha: string
              n_resultados: number
              optimizer_email: string
              ots: string[]
              plan_id: string
            }[]
          }
      estado_suscripcion: { Args: never; Returns: Json }
      ficha_tubo: { Args: { p_tubo_raiz_id: string }; Returns: Json }
      generar_numero_ot: { Args: { p_empresa_id: string }; Returns: string }
      get_my_empresa_id: { Args: never; Returns: string }
      get_user_empresa_id: { Args: never; Returns: string }
      guardar_plan_atomico: {
        Args: {
          p_empresa_id: string
          p_eventos?: Json
          p_expected_sync_at?: string
          p_plan_payload?: Json
          p_tubos: Json
        }
        Returns: Json
      }
      has_role: { Args: { roles: string[] }; Returns: boolean }
      importar_descuentos_modelo: { Args: { p_filas: Json }; Returns: Json }
      importar_descuentos_modelo_v2: { Args: { p_filas: Json }; Returns: Json }
      info_invitacion: { Args: { p_codigo: string }; Returns: Json }
      iniciar_inventario: {
        Args: { p_n_colmena?: string; p_notas?: string }
        Returns: string
      }
      insumo_crear: {
        Args: { p_cod_manual?: string; p_datos?: Json; p_prefijo: string }
        Returns: Json
      }
      insumo_siguiente_codigo: { Args: { p_prefijo: string }; Returns: string }
      inventario_ajuste_sql: {
        Args: {
          p_almacen: string
          p_delta: number
          p_dominio: string
          p_empresa_id: string
          p_item_cod: string
          p_motivo: string
        }
        Returns: string
      }
      inventario_diff: {
        Args: { p_inventario_id: string }
        Returns: {
          cod_post: string
          cod_pre: string
          medida_cm_post: number
          medida_cm_pre: number
          n_colmena_post: string
          n_colmena_pre: string
          serial_post: string
          serial_pre: string
          tipo: string
          tubo_raiz_id: string
        }[]
      }
      inventario_flag: {
        Args: { p_empresa_id: string; p_flag: string }
        Returns: boolean
      }
      inventario_registrar: {
        Args: { p_lineas: Json; p_opciones?: Json }
        Returns: Json
      }
      is_admin: { Args: never; Returns: boolean }
      lead_agregar_comentario: {
        Args: { p_lead_id: string; p_texto: string }
        Returns: {
          created_at: string
          detalle: Json
          empresa_id: string
          id: string
          lead_id: string
          registrado_por: string | null
          tipo: string
        }
        SetofOptions: {
          from: "*"
          to: "leads_actividad"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      lead_cambiar_estado: {
        Args: {
          p_comentario?: string
          p_lead_id: string
          p_motivo?: string
          p_nuevo_estado: string
        }
        Returns: {
          archivado: boolean
          asignado_a: string | null
          asignado_at: string | null
          cantidad_ventanas: number | null
          comentarios: string | null
          comuna: string | null
          created_at: string
          detalle_personal: string | null
          email: string | null
          empresa_id: string
          estado: string
          etapa_seguimiento: number
          fecha_archivado: string | null
          fecha_cierre: string | null
          fecha_cotizacion: string | null
          fuente: string
          id: string
          monto: number | null
          motivo_derivacion: string | null
          necesita_instalacion: boolean | null
          nombre: string | null
          ot_id: string | null
          presupuesto_rango: string | null
          prioridad: string
          producto_interes: string | null
          resumen_para_vendedor: string | null
          rut: string | null
          scoring: number | null
          seg1_fecha: string | null
          seg1_resultado: string | null
          seg2_fecha: string | null
          seg2_resultado: string | null
          seg3_fecha: string | null
          seg3_resultado: string | null
          tiene_medidas: boolean | null
          tomado_at: string | null
          ultima_actividad_at: string
          updated_at: string
          urgencia: string | null
          whatsapp_phone: string | null
          whatsapp_wa_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "leads"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      lead_vincular_ot: {
        Args: { p_lead_id: string; p_ot_id: string }
        Returns: {
          archivado: boolean
          asignado_a: string | null
          asignado_at: string | null
          cantidad_ventanas: number | null
          comentarios: string | null
          comuna: string | null
          created_at: string
          detalle_personal: string | null
          email: string | null
          empresa_id: string
          estado: string
          etapa_seguimiento: number
          fecha_archivado: string | null
          fecha_cierre: string | null
          fecha_cotizacion: string | null
          fuente: string
          id: string
          monto: number | null
          motivo_derivacion: string | null
          necesita_instalacion: boolean | null
          nombre: string | null
          ot_id: string | null
          presupuesto_rango: string | null
          prioridad: string
          producto_interes: string | null
          resumen_para_vendedor: string | null
          rut: string | null
          scoring: number | null
          seg1_fecha: string | null
          seg1_resultado: string | null
          seg2_fecha: string | null
          seg2_resultado: string | null
          seg3_fecha: string | null
          seg3_resultado: string | null
          tiene_medidas: boolean | null
          tomado_at: string | null
          ultima_actividad_at: string
          updated_at: string
          urgencia: string | null
          whatsapp_phone: string | null
          whatsapp_wa_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "leads"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      limpiar_zombies_colmena: {
        Args: { p_dry_run?: boolean }
        Returns: {
          accion: string
          detalle: Json
          n_zombies: number
        }[]
      }
      marcar_sobrante_inexistente: {
        Args: {
          p_comentario?: string
          p_fuente?: string
          p_linea_idx: number
          p_plan_id: string
          p_responsable: string
        }
        Returns: Json
      }
      mi_empresa_id: { Args: never; Returns: string }
      normalizar_almacen: { Args: { p_texto: string }; Returns: string }
      obtener_reconciliacion_inventario: {
        Args: { p_dias_tendencia?: number; p_limite_anomalias?: number }
        Returns: Json
      }
      registrar_error_corte: {
        Args: {
          p_cod_original: string
          p_colmena_original: string
          p_color: string
          p_comentario: string
          p_destino_original: string
          p_linea_idx: number
          p_med_recuperar: number
          p_medida_cm: number
          p_medida_origen_cm: number
          p_motivo: string
          p_ot: string
          p_plan_fecha: string
          p_plan_id: string
          p_reemplazo_id: string
          p_responsable: string
          p_serial: string
          p_sobrante_cm: number
          p_tubo_nuevo_cod?: string
          p_tubo_nuevo_colmena?: string
          p_tubo_nuevo_medida_cm?: number
          p_ubicacion: string
        }
        Returns: Json
      }
      registrar_seguimiento: {
        Args: { p_lead_id: string; p_nota?: string; p_resultado: string }
        Returns: {
          archivado: boolean
          asignado_a: string | null
          asignado_at: string | null
          cantidad_ventanas: number | null
          comentarios: string | null
          comuna: string | null
          created_at: string
          detalle_personal: string | null
          email: string | null
          empresa_id: string
          estado: string
          etapa_seguimiento: number
          fecha_archivado: string | null
          fecha_cierre: string | null
          fecha_cotizacion: string | null
          fuente: string
          id: string
          monto: number | null
          motivo_derivacion: string | null
          necesita_instalacion: boolean | null
          nombre: string | null
          ot_id: string | null
          presupuesto_rango: string | null
          prioridad: string
          producto_interes: string | null
          resumen_para_vendedor: string | null
          rut: string | null
          scoring: number | null
          seg1_fecha: string | null
          seg1_resultado: string | null
          seg2_fecha: string | null
          seg2_resultado: string | null
          seg3_fecha: string | null
          seg3_resultado: string | null
          tiene_medidas: boolean | null
          tomado_at: string | null
          ultima_actividad_at: string
          updated_at: string
          urgencia: string | null
          whatsapp_phone: string | null
          whatsapp_wa_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "leads"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      registrar_tenant: {
        Args: {
          p_nombre_empresa: string
          p_user_email: string
          p_user_id: string
          p_user_nombre: string
        }
        Returns: string
      }
      restaurar_plan_de_corte: {
        Args: { p_email: string; p_plan_id: string }
        Returns: Json
      }
      revertir_inventario: {
        Args: { p_inventario_id: string; p_motivo: string }
        Returns: undefined
      }
      revertir_plan_corte: {
        Args: { p_nota?: string; p_plan_id: string }
        Returns: Json
      }
      sync_colmena_tubos: {
        Args: {
          p_empresa_id: string
          p_eventos?: Json
          p_expected_sync_at?: string
          p_tubos: Json
        }
        Returns: undefined
      }
      tally_set: {
        Args: { p_conteo: number; p_inventario_id: string; p_n_colmena: string }
        Returns: undefined
      }
      verificar_eventos_recientes_ot: {
        Args: {
          p_empresa_id: string
          p_minutos_atras?: number
          p_ots: string[]
        }
        Returns: number
      }
      verificar_salud_colmena: {
        Args: { p_empresa_id?: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
