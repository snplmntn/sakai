export interface Database {
  public: {
    Tables: {
      area_updates: {
        Row: {
          id: string;
          external_id: string;
          source: string;
          source_url: string;
          alert_type: string;
          location: string;
          direction: string | null;
          involved: string | null;
          reported_time_text: string | null;
          lane_status: string | null;
          traffic_status: string | null;
          raw_text: string;
          scraped_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          external_id: string;
          source: string;
          source_url: string;
          alert_type: string;
          location: string;
          direction?: string | null;
          involved?: string | null;
          reported_time_text?: string | null;
          lane_status?: string | null;
          traffic_status?: string | null;
          raw_text: string;
          scraped_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          external_id?: string;
          source?: string;
          source_url?: string;
          alert_type?: string;
          location?: string;
          direction?: string | null;
          involved?: string | null;
          reported_time_text?: string | null;
          lane_status?: string | null;
          traffic_status?: string | null;
          raw_text?: string;
          scraped_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      courses: {
        Row: {
          id: string;
          code: string;
          title: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          title: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          title?: string;
          description?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
