export interface Database {
  public: {
    Tables: {
      user_preferences: {
        Row: {
          user_id: string;
          default_preference: "fastest" | "cheapest" | "balanced";
          passenger_type: "regular" | "student" | "senior" | "pwd";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          default_preference: "fastest" | "cheapest" | "balanced";
          passenger_type: "regular" | "student" | "senior" | "pwd";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          default_preference?: "fastest" | "cheapest" | "balanced";
          passenger_type?: "regular" | "student" | "senior" | "pwd";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
