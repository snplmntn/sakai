type RoutePreference = "fastest" | "cheapest" | "balanced";
type PassengerType = "regular" | "student" | "senior" | "pwd";
type PlaceKind = "landmark" | "station" | "area" | "campus" | "mall" | "terminal";
type RideMode = "jeepney" | "uv" | "mrt3" | "lrt1" | "lrt2";
type StopMode = RideMode | "walk_anchor";
type RouteTrustLevel = "trusted_seed" | "community_reviewed" | "demo_fallback";
type FareRuleMode = RideMode | "car";
type FareRuleVersionTrustLevel = "official" | "estimated" | "demo_fallback";
type FareProductMode = "jeepney" | "uv" | "car";
type FarePricingStrategy = "minimum_plus_succeeding" | "per_km";

export interface Database {
  public: {
    Tables: {
      user_preferences: {
        Row: {
          user_id: string;
          default_preference: RoutePreference;
          passenger_type: PassengerType;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          default_preference: RoutePreference;
          passenger_type: PassengerType;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          default_preference?: RoutePreference;
          passenger_type?: PassengerType;
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
      places: {
        Row: {
          id: string;
          canonical_name: string;
          city: string;
          kind: PlaceKind;
          latitude: number;
          longitude: number;
          google_place_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          canonical_name: string;
          city: string;
          kind: PlaceKind;
          latitude: number;
          longitude: number;
          google_place_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          canonical_name?: string;
          city?: string;
          kind?: PlaceKind;
          latitude?: number;
          longitude?: number;
          google_place_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      place_aliases: {
        Row: {
          id: string;
          place_id: string;
          alias: string;
          normalized_alias: string;
        };
        Insert: {
          id?: string;
          place_id: string;
          alias: string;
          normalized_alias: string;
        };
        Update: {
          id?: string;
          place_id?: string;
          alias?: string;
          normalized_alias?: string;
        };
        Relationships: [];
      };
      stops: {
        Row: {
          id: string;
          place_id: string | null;
          stop_name: string;
          mode: StopMode;
          area: string;
          latitude: number;
          longitude: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          place_id?: string | null;
          stop_name: string;
          mode: StopMode;
          area: string;
          latitude: number;
          longitude: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          place_id?: string | null;
          stop_name?: string;
          mode?: StopMode;
          area?: string;
          latitude?: number;
          longitude?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      routes: {
        Row: {
          id: string;
          code: string;
          display_name: string;
          primary_mode: RideMode;
          operator_name: string | null;
          source_name: string;
          source_url: string | null;
          trust_level: RouteTrustLevel;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          display_name: string;
          primary_mode: RideMode;
          operator_name?: string | null;
          source_name: string;
          source_url?: string | null;
          trust_level: RouteTrustLevel;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          display_name?: string;
          primary_mode?: RideMode;
          operator_name?: string | null;
          source_name?: string;
          source_url?: string | null;
          trust_level?: RouteTrustLevel;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      route_variants: {
        Row: {
          id: string;
          route_id: string;
          display_name: string;
          direction_label: string;
          origin_place_id: string | null;
          destination_place_id: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          route_id: string;
          display_name: string;
          direction_label: string;
          origin_place_id?: string | null;
          destination_place_id?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          route_id?: string;
          display_name?: string;
          direction_label?: string;
          origin_place_id?: string | null;
          destination_place_id?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      route_legs: {
        Row: {
          id: string;
          route_variant_id: string;
          sequence: number;
          mode: RideMode;
          from_stop_id: string;
          to_stop_id: string;
          route_label: string;
          distance_km: number;
          duration_minutes: number;
          fare_product_code: string | null;
          corridor_tag: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          route_variant_id: string;
          sequence: number;
          mode: RideMode;
          from_stop_id: string;
          to_stop_id: string;
          route_label: string;
          distance_km: number;
          duration_minutes: number;
          fare_product_code?: string | null;
          corridor_tag: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          route_variant_id?: string;
          sequence?: number;
          mode?: RideMode;
          from_stop_id?: string;
          to_stop_id?: string;
          route_label?: string;
          distance_km?: number;
          duration_minutes?: number;
          fare_product_code?: string | null;
          corridor_tag?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      transfer_points: {
        Row: {
          id: string;
          from_stop_id: string;
          to_stop_id: string;
          walking_distance_m: number;
          walking_duration_minutes: number;
          is_accessible: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          from_stop_id: string;
          to_stop_id: string;
          walking_distance_m: number;
          walking_duration_minutes: number;
          is_accessible?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          from_stop_id?: string;
          to_stop_id?: string;
          walking_distance_m?: number;
          walking_duration_minutes?: number;
          is_accessible?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      fare_rule_versions: {
        Row: {
          id: string;
          mode: FareRuleMode;
          version_name: string;
          source_name: string;
          source_url: string;
          effectivity_date: string;
          verified_at: string;
          is_active: boolean;
          trust_level: FareRuleVersionTrustLevel;
          created_at: string;
        };
        Insert: {
          id?: string;
          mode: FareRuleMode;
          version_name: string;
          source_name: string;
          source_url: string;
          effectivity_date: string;
          verified_at: string;
          is_active?: boolean;
          trust_level: FareRuleVersionTrustLevel;
          created_at?: string;
        };
        Update: {
          id?: string;
          mode?: FareRuleMode;
          version_name?: string;
          source_name?: string;
          source_url?: string;
          effectivity_date?: string;
          verified_at?: string;
          is_active?: boolean;
          trust_level?: FareRuleVersionTrustLevel;
          created_at?: string;
        };
        Relationships: [];
      };
      fare_products: {
        Row: {
          id: string;
          fare_rule_version_id: string;
          product_code: string;
          mode: FareProductMode;
          pricing_strategy: FarePricingStrategy;
          vehicle_class: string;
          minimum_distance_km: number;
          minimum_fare_regular: number;
          minimum_fare_discounted: number | null;
          succeeding_distance_km: number;
          succeeding_fare_regular: number;
          succeeding_fare_discounted: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          fare_rule_version_id: string;
          product_code: string;
          mode: FareProductMode;
          pricing_strategy: FarePricingStrategy;
          vehicle_class: string;
          minimum_distance_km: number;
          minimum_fare_regular: number;
          minimum_fare_discounted?: number | null;
          succeeding_distance_km: number;
          succeeding_fare_regular: number;
          succeeding_fare_discounted?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          fare_rule_version_id?: string;
          product_code?: string;
          mode?: FareProductMode;
          pricing_strategy?: FarePricingStrategy;
          vehicle_class?: string;
          minimum_distance_km?: number;
          minimum_fare_regular?: number;
          minimum_fare_discounted?: number | null;
          succeeding_distance_km?: number;
          succeeding_fare_regular?: number;
          succeeding_fare_discounted?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      train_station_fares: {
        Row: {
          id: string;
          fare_rule_version_id: string;
          origin_stop_id: string;
          destination_stop_id: string;
          regular_fare: number;
          discounted_fare: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          fare_rule_version_id: string;
          origin_stop_id: string;
          destination_stop_id: string;
          regular_fare: number;
          discounted_fare: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          fare_rule_version_id?: string;
          origin_stop_id?: string;
          destination_stop_id?: string;
          regular_fare?: number;
          discounted_fare?: number;
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
