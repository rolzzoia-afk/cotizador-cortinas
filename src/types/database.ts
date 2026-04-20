// Placeholder — reemplazar con tipos generados:
//   npm run types:gen
// (requiere Supabase CLI: https://supabase.com/docs/guides/cli)
//
// Mientras tanto, esto permite que el código compile sin tipos fuertes.
// TODO: correr el comando y commitear el archivo generado.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: Record<
      string,
      {
        Row: Record<string, Json>;
        Insert: Record<string, Json>;
        Update: Record<string, Json>;
        Relationships: [];
      }
    >;
    Views: Record<string, { Row: Record<string, Json> }>;
    Functions: Record<
      string,
      { Args: Record<string, Json>; Returns: Json }
    >;
    Enums: Record<string, string>;
    CompositeTypes: Record<string, Record<string, Json>>;
  };
};
