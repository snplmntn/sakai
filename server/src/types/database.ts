type RoutePreference = "fastest" | "cheapest" | "balanced";
type PassengerType = "regular" | "student" | "senior" | "pwd";
type SavedPlaceLabelKind = "preset" | "custom";
type SavedPlaceLabelPreset = "home" | "office" | "school";
type PlaceKind = "landmark" | "station" | "area" | "campus" | "mall" | "terminal";
type RideMode = "jeepney" | "uv" | "mrt3" | "lrt1" | "lrt2" | "tricycle" | "car";
type StopMode = RideMode | "walk_anchor";
type RouteTrustLevel = "trusted_seed" | "community_reviewed" | "demo_fallback";
type RouteLifecycleStatus = "active" | "deprecated" | "superseded";
type FareRuleMode = RideMode | "car";
type FareRuleVersionTrustLevel = "official" | "estimated" | "demo_fallback";
type FareProductMode = "jeepney" | "uv" | "tricycle" | "car";
type FarePricingStrategy = "minimum_plus_succeeding" | "per_km";
type CommunityJson = Record<string, unknown>;
type SubmissionType =
  | "missing_route"
  | "route_correction"
  | "fare_update"
  | "route_note"
  | "route_create"
  | "route_update"
  | "route_deprecate"
  | "route_reactivate"
  | "stop_correction"
  | "transfer_correction";
type SubmissionStatus = "pending" | "under_review" | "approved" | "rejected" | "published";
type CommunityProposalType =
  | "route_create"
  | "route_update"
  | "route_deprecate"
  | "route_reactivate"
  | "stop_correction"
  | "transfer_correction"
  | "fare_update"
  | "route_note";
type CommunityProposalSourceKind = "direct_submission" | "promoted_answer";
type CommunityAnswerPromotionStatus = "not_reviewed" | "promoted" | "published";
type CommunityAiConfidence = "high" | "medium" | "low";
type CommunityPublicationAction =
  | "route_create"
  | "route_update"
  | "route_deprecate"
  | "route_reactivate"
  | "stop_correction"
  | "transfer_correction"
  | "fare_update"
  | "route_note";

export interface Database {
  public: {
    Tables: {
      community_submissions: {
        Row: {
          id: string;
          user_id: string;
          submission_type: SubmissionType;
          status: SubmissionStatus;
          title: string;
          payload: CommunityJson;
          source_context: CommunityJson | null;
          route_id: string | null;
          route_variant_id: string | null;
          review_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          submission_type: SubmissionType;
          status?: SubmissionStatus;
          title: string;
          payload: CommunityJson;
          source_context?: CommunityJson | null;
          route_id?: string | null;
          route_variant_id?: string | null;
          review_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          submission_type?: SubmissionType;
          status?: SubmissionStatus;
          title?: string;
          payload?: CommunityJson;
          source_context?: CommunityJson | null;
          route_id?: string | null;
          route_variant_id?: string | null;
          review_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "community_submissions_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_submissions_route_id_fkey";
            columns: ["route_id"];
            referencedRelation: "routes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_submissions_route_variant_id_fkey";
            columns: ["route_variant_id"];
            referencedRelation: "route_variants";
            referencedColumns: ["id"];
          }
        ];
      };
      community_questions: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          body: string;
          origin_label: string;
          destination_label: string;
          origin_place_id: string | null;
          destination_place_id: string | null;
          route_query_text: string | null;
          preference: RoutePreference | null;
          passenger_type: PassengerType | null;
          source_context: Record<string, unknown> | null;
          reply_count: number;
          last_answered_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          body: string;
          origin_label: string;
          destination_label: string;
          origin_place_id?: string | null;
          destination_place_id?: string | null;
          route_query_text?: string | null;
          preference?: RoutePreference | null;
          passenger_type?: PassengerType | null;
          source_context?: Record<string, unknown> | null;
          reply_count?: number;
          last_answered_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          body?: string;
          origin_label?: string;
          destination_label?: string;
          origin_place_id?: string | null;
          destination_place_id?: string | null;
          route_query_text?: string | null;
          preference?: RoutePreference | null;
          passenger_type?: PassengerType | null;
          source_context?: Record<string, unknown> | null;
          reply_count?: number;
          last_answered_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "community_questions_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      community_question_answers: {
        Row: {
          id: string;
          question_id: string;
          user_id: string;
          body: string;
          helpful_count: number;
          promotion_status: CommunityAnswerPromotionStatus;
          linked_route_id: string | null;
          linked_route_variant_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          question_id: string;
          user_id: string;
          body: string;
          helpful_count?: number;
          promotion_status?: CommunityAnswerPromotionStatus;
          linked_route_id?: string | null;
          linked_route_variant_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          question_id?: string;
          user_id?: string;
          body?: string;
          helpful_count?: number;
          promotion_status?: CommunityAnswerPromotionStatus;
          linked_route_id?: string | null;
          linked_route_variant_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "community_question_answers_question_id_fkey";
            columns: ["question_id"];
            referencedRelation: "community_questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_question_answers_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_question_answers_linked_route_id_fkey";
            columns: ["linked_route_id"];
            referencedRelation: "routes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_question_answers_linked_route_variant_id_fkey";
            columns: ["linked_route_variant_id"];
            referencedRelation: "route_variants";
            referencedColumns: ["id"];
          }
        ];
      };
      community_route_learning_proposals: {
        Row: {
          id: string;
          source_kind: CommunityProposalSourceKind;
          source_submission_id: string | null;
          source_question_id: string | null;
          source_answer_id: string | null;
          created_by_user_id: string;
          proposal_type: CommunityProposalType;
          review_status: SubmissionStatus;
          title: string;
          summary: string | null;
          route_id: string | null;
          route_variant_id: string | null;
          target_stop_ids: string[];
          target_transfer_point_ids: string[];
          proposed_lifecycle_status: RouteLifecycleStatus | null;
          payload: CommunityJson;
          reviewed_change_set: CommunityJson;
          evidence_note: string | null;
          review_notes: string | null;
          reviewed_by_user_id: string | null;
          reviewed_at: string | null;
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          source_kind: CommunityProposalSourceKind;
          source_submission_id?: string | null;
          source_question_id?: string | null;
          source_answer_id?: string | null;
          created_by_user_id: string;
          proposal_type: CommunityProposalType;
          review_status?: SubmissionStatus;
          title: string;
          summary?: string | null;
          route_id?: string | null;
          route_variant_id?: string | null;
          target_stop_ids?: string[];
          target_transfer_point_ids?: string[];
          proposed_lifecycle_status?: RouteLifecycleStatus | null;
          payload?: CommunityJson;
          reviewed_change_set?: CommunityJson;
          evidence_note?: string | null;
          review_notes?: string | null;
          reviewed_by_user_id?: string | null;
          reviewed_at?: string | null;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          source_kind?: CommunityProposalSourceKind;
          source_submission_id?: string | null;
          source_question_id?: string | null;
          source_answer_id?: string | null;
          created_by_user_id?: string;
          proposal_type?: CommunityProposalType;
          review_status?: SubmissionStatus;
          title?: string;
          summary?: string | null;
          route_id?: string | null;
          route_variant_id?: string | null;
          target_stop_ids?: string[];
          target_transfer_point_ids?: string[];
          proposed_lifecycle_status?: RouteLifecycleStatus | null;
          payload?: CommunityJson;
          reviewed_change_set?: CommunityJson;
          evidence_note?: string | null;
          review_notes?: string | null;
          reviewed_by_user_id?: string | null;
          reviewed_at?: string | null;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "community_route_learning_proposals_created_by_user_id_fkey";
            columns: ["created_by_user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_route_learning_proposals_reviewed_by_user_id_fkey";
            columns: ["reviewed_by_user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_route_learning_proposals_route_id_fkey";
            columns: ["route_id"];
            referencedRelation: "routes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_route_learning_proposals_route_variant_id_fkey";
            columns: ["route_variant_id"];
            referencedRelation: "route_variants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_route_learning_proposals_source_answer_id_fkey";
            columns: ["source_answer_id"];
            referencedRelation: "community_question_answers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_route_learning_proposals_source_question_id_fkey";
            columns: ["source_question_id"];
            referencedRelation: "community_questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_route_learning_proposals_source_submission_id_fkey";
            columns: ["source_submission_id"];
            referencedRelation: "community_submissions";
            referencedColumns: ["id"];
          }
        ];
      };
      community_route_ai_suggestions: {
        Row: {
          id: string;
          proposal_id: string | null;
          source_submission_id: string | null;
          source_question_id: string | null;
          source_answer_id: string | null;
          model_name: string;
          confidence: CommunityAiConfidence;
          duplicate_key: string | null;
          suggestion: CommunityJson;
          created_at: string;
        };
        Insert: {
          id?: string;
          proposal_id?: string | null;
          source_submission_id?: string | null;
          source_question_id?: string | null;
          source_answer_id?: string | null;
          model_name: string;
          confidence: CommunityAiConfidence;
          duplicate_key?: string | null;
          suggestion?: CommunityJson;
          created_at?: string;
        };
        Update: {
          id?: string;
          proposal_id?: string | null;
          source_submission_id?: string | null;
          source_question_id?: string | null;
          source_answer_id?: string | null;
          model_name?: string;
          confidence?: CommunityAiConfidence;
          duplicate_key?: string | null;
          suggestion?: CommunityJson;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "community_route_ai_suggestions_proposal_id_fkey";
            columns: ["proposal_id"];
            referencedRelation: "community_route_learning_proposals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_route_ai_suggestions_source_submission_id_fkey";
            columns: ["source_submission_id"];
            referencedRelation: "community_submissions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_route_ai_suggestions_source_question_id_fkey";
            columns: ["source_question_id"];
            referencedRelation: "community_questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_route_ai_suggestions_source_answer_id_fkey";
            columns: ["source_answer_id"];
            referencedRelation: "community_question_answers";
            referencedColumns: ["id"];
          }
        ];
      };
      community_route_publications: {
        Row: {
          id: string;
          proposal_id: string;
          reviewer_user_id: string;
          route_id: string | null;
          route_variant_id: string | null;
          publication_action: CommunityPublicationAction;
          change_summary: string;
          published_snapshot: CommunityJson;
          created_at: string;
        };
        Insert: {
          id?: string;
          proposal_id: string;
          reviewer_user_id: string;
          route_id?: string | null;
          route_variant_id?: string | null;
          publication_action: CommunityPublicationAction;
          change_summary: string;
          published_snapshot?: CommunityJson;
          created_at?: string;
        };
        Update: {
          id?: string;
          proposal_id?: string;
          reviewer_user_id?: string;
          route_id?: string | null;
          route_variant_id?: string | null;
          publication_action?: CommunityPublicationAction;
          change_summary?: string;
          published_snapshot?: CommunityJson;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "community_route_publications_proposal_id_fkey";
            columns: ["proposal_id"];
            referencedRelation: "community_route_learning_proposals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_route_publications_reviewer_user_id_fkey";
            columns: ["reviewer_user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_route_publications_route_id_fkey";
            columns: ["route_id"];
            referencedRelation: "routes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_route_publications_route_variant_id_fkey";
            columns: ["route_variant_id"];
            referencedRelation: "route_variants";
            referencedColumns: ["id"];
          }
        ];
      };
      community_route_notes: {
        Row: {
          id: string;
          publication_id: string;
          route_id: string | null;
          route_variant_id: string | null;
          note: string;
          is_active: boolean;
          starts_at: string | null;
          ends_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          publication_id: string;
          route_id?: string | null;
          route_variant_id?: string | null;
          note: string;
          is_active?: boolean;
          starts_at?: string | null;
          ends_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          publication_id?: string;
          route_id?: string | null;
          route_variant_id?: string | null;
          note?: string;
          is_active?: boolean;
          starts_at?: string | null;
          ends_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "community_route_notes_publication_id_fkey";
            columns: ["publication_id"];
            referencedRelation: "community_route_publications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_route_notes_route_id_fkey";
            columns: ["route_id"];
            referencedRelation: "routes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_route_notes_route_variant_id_fkey";
            columns: ["route_variant_id"];
            referencedRelation: "route_variants";
            referencedColumns: ["id"];
          }
        ];
      };
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
      user_saved_places: {
        Row: {
          id: string;
          user_id: string;
          address: string;
          label_kind: SavedPlaceLabelKind;
          preset_label: SavedPlaceLabelPreset | null;
          custom_label: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          address: string;
          label_kind: SavedPlaceLabelKind;
          preset_label?: SavedPlaceLabelPreset | null;
          custom_label?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          address?: string;
          label_kind?: SavedPlaceLabelKind;
          preset_label?: SavedPlaceLabelPreset | null;
          custom_label?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_saved_places_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
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
          severity: "low" | "medium" | "high";
          summary: string;
          corridor_tags: string[];
          normalized_location: string;
          display_until: string;
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
          severity: "low" | "medium" | "high";
          summary: string;
          corridor_tags: string[];
          normalized_location: string;
          display_until: string;
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
          severity?: "low" | "medium" | "high";
          summary?: string;
          corridor_tags?: string[];
          normalized_location?: string;
          display_until?: string;
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
      route_stop_import_rows: {
        Row: {
          id: string;
          import_batch: string;
          route_code: string;
          variant_code: string;
          direction_label: string;
          sequence: number;
          external_stop_code: string;
          stop_name: string;
          latitude: number | null;
          longitude: number | null;
          source_name: string;
          source_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          import_batch: string;
          route_code: string;
          variant_code: string;
          direction_label: string;
          sequence: number;
          external_stop_code: string;
          stop_name: string;
          latitude?: number | null;
          longitude?: number | null;
          source_name: string;
          source_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          import_batch?: string;
          route_code?: string;
          variant_code?: string;
          direction_label?: string;
          sequence?: number;
          external_stop_code?: string;
          stop_name?: string;
          latitude?: number | null;
          longitude?: number | null;
          source_name?: string;
          source_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      stops: {
        Row: {
          id: string;
          place_id: string | null;
          external_stop_code: string | null;
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
          external_stop_code?: string | null;
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
          external_stop_code?: string | null;
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
          lifecycle_status: RouteLifecycleStatus;
          superseded_by_route_id: string | null;
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
          lifecycle_status?: RouteLifecycleStatus;
          superseded_by_route_id?: string | null;
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
          lifecycle_status?: RouteLifecycleStatus;
          superseded_by_route_id?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      route_variants: {
        Row: {
          id: string;
          route_id: string;
          code: string;
          display_name: string;
          direction_label: string;
          origin_place_id: string | null;
          destination_place_id: string | null;
          lifecycle_status: RouteLifecycleStatus;
          superseded_by_variant_id: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          route_id: string;
          code: string;
          display_name: string;
          direction_label: string;
          origin_place_id?: string | null;
          destination_place_id?: string | null;
          lifecycle_status?: RouteLifecycleStatus;
          superseded_by_variant_id?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          route_id?: string;
          code?: string;
          display_name?: string;
          direction_label?: string;
          origin_place_id?: string | null;
          destination_place_id?: string | null;
          lifecycle_status?: RouteLifecycleStatus;
          superseded_by_variant_id?: string | null;
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
      transit_stops: {
        Row: {
          stop_id: string;
          stop_name: string;
          normalized_name: string;
          lat: number;
          lon: number;
          mode: string;
          line: string;
          all_modes: string;
          all_lines: string;
          is_multimodal: boolean;
          line_count: number;
          created_at: string;
        };
        Insert: {
          stop_id: string;
          stop_name: string;
          normalized_name: string;
          lat: number;
          lon: number;
          mode: string;
          line: string;
          all_modes: string;
          all_lines: string;
          is_multimodal?: boolean;
          line_count?: number;
          created_at?: string;
        };
        Update: {
          stop_id?: string;
          stop_name?: string;
          normalized_name?: string;
          lat?: number;
          lon?: number;
          mode?: string;
          line?: string;
          all_modes?: string;
          all_lines?: string;
          is_multimodal?: boolean;
          line_count?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      transit_stop_edges: {
        Row: {
          source_stop_id: string;
          target_stop_id: string;
          weight: number;
          mode: string;
          line: string;
          route_short_name: string | null;
          route_long_name: string | null;
          transfer: boolean;
          distance_meters: number;
          estimated_time_min: number;
          data_source: string;
          created_at: string;
        };
        Insert: {
          source_stop_id: string;
          target_stop_id: string;
          weight: number;
          mode: string;
          line: string;
          route_short_name?: string | null;
          route_long_name?: string | null;
          transfer?: boolean;
          distance_meters: number;
          estimated_time_min: number;
          data_source: string;
          created_at?: string;
        };
        Update: {
          source_stop_id?: string;
          target_stop_id?: string;
          weight?: number;
          mode?: string;
          line?: string;
          route_short_name?: string | null;
          route_long_name?: string | null;
          transfer?: boolean;
          distance_meters?: number;
          estimated_time_min?: number;
          data_source?: string;
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
    Functions: {
      create_community_submission_with_proposal: {
        Args: {
          p_user_id: string;
          p_submission_type: string;
          p_title: string;
          p_payload: CommunityJson;
          p_source_context?: CommunityJson | null;
          p_route_id?: string | null;
          p_route_variant_id?: string | null;
        };
        Returns: Database["public"]["Tables"]["community_submissions"]["Row"];
      };
      increment_community_question_reply_count: {
        Args: {
          question_id_input: string;
        };
        Returns: undefined;
      };
      publish_community_route_proposal: {
        Args: {
          p_proposal_id: string;
          p_reviewer_user_id: string;
          p_change_summary: string;
          p_review_notes?: string | null;
          p_note?: string | null;
          p_reviewed_change_set?: CommunityJson | null;
        };
        Returns: Database["public"]["Tables"]["community_route_learning_proposals"]["Row"];
      };
      promote_community_answer_to_proposal: {
        Args: {
          p_question_id: string;
          p_answer_id: string;
          p_reviewer_user_id: string;
          p_proposal_type: string;
          p_title: string;
          p_summary?: string | null;
          p_route_id?: string | null;
          p_route_variant_id?: string | null;
          p_target_stop_ids?: string[] | null;
          p_target_transfer_point_ids?: string[] | null;
          p_proposed_lifecycle_status?: string | null;
          p_evidence_note?: string | null;
          p_payload?: CommunityJson | null;
          p_reviewed_change_set?: CommunityJson | null;
        };
        Returns: Database["public"]["Tables"]["community_route_learning_proposals"]["Row"];
      };
      reject_community_route_proposal: {
        Args: {
          p_proposal_id: string;
          p_reviewer_user_id: string;
          p_review_notes: string;
        };
        Returns: Database["public"]["Tables"]["community_route_learning_proposals"]["Row"];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
