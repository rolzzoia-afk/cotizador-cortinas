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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
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
          tubo_raiz_id: string | null
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
          tubo_raiz_id?: string | null
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
          tubo_raiz_id?: string | null
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
      colmena_tubos_backup_20260422: {
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
      colmena_tubos_backup_20260422_v2: {
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
      insumos: {
        Row: {
          can_x_paquete: number | null
          categoria: string | null
          cod: string
          cod_proveedor: string | null
          color: string | null
          comentarios: string | null
          compra: string | null
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
          stock_mp: number | null
          stock_total: number | null
          sub_categoria: string | null
          ubicacion: string | null
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
          stock_mp?: number | null
          stock_total?: number | null
          sub_categoria?: string | null
          ubicacion?: string | null
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
          stock_mp?: number | null
          stock_total?: number | null
          sub_categoria?: string | null
          ubicacion?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      inventario_camioneta: {
        Row: {
          camioneta_id: string
          cantidad: number
          id: string
          insumo_id: string
        }
        Insert: {
          camioneta_id: string
          cantidad?: number
          id?: string
          insumo_id: string
        }
        Update: {
          camioneta_id?: string
          cantidad?: number
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
      telas_slots: {
        Row: {
          almacen: string | null
          codigo: string | null
          empresa_id: string
          posicion: string
        }
        Insert: {
          almacen?: string | null
          codigo?: string | null
          empresa_id: string
          posicion: string
        }
        Update: {
          almacen?: string | null
          codigo?: string | null
          empresa_id?: string
          posicion?: string
        }
        Relationships: []
      }
      tenants: {
        Row: {
          configuracion_json: Json | null
          estado: string
          fecha_creacion: string
          id: string
          nombre: string
          plan: string
          slug: string
        }
        Insert: {
          configuracion_json?: Json | null
          estado?: string
          fecha_creacion?: string
          id?: string
          nombre: string
          plan?: string
          slug: string
        }
        Update: {
          configuracion_json?: Json | null
          estado?: string
          fecha_creacion?: string
          id?: string
          nombre?: string
          plan?: string
          slug?: string
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
          tubo_raiz_id: string
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
          tubo_raiz_id: string
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
          tubo_raiz_id?: string
        }
        Relationships: []
      }
      tubos_historial_backup_20260422: {
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
      ubicaciones_rack: {
        Row: {
          almacen: string
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
    }
    Views: {
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
    }
    Functions: {
      get_my_empresa_id: { Args: never; Returns: string }
      get_user_empresa_id: { Args: never; Returns: string }
      has_role: { Args: { roles: string[] }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      mi_empresa_id: { Args: never; Returns: string }
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
          p_tubo_nuevo_cod?: string | null
          p_tubo_nuevo_colmena?: string | null
          p_tubo_nuevo_medida_cm?: number | null
          p_ubicacion: string
        }
        Returns: Json
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
      sync_colmena_tubos: {
        Args: { p_empresa_id: string; p_tubos: Json }
        Returns: undefined
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
