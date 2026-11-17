
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "audit_log": {
                  Row: {
                    "action": string,"actor": string | null,"created_at": string,"entity_id": string | null,"entity_type": string,"id": number,"meta": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor"?: string | null,"created_at"?: string,"entity_id"?: string | null,"entity_type": string,"id"?: never,"meta"?: NonNullable<Json>
                  }
                  Update: {
                    "action"?: string,"actor"?: string | null,"created_at"?: string,"entity_id"?: string | null,"entity_type"?: string,"id"?: never,"meta"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"categories": {
                  Row: {
                    "description": NonNullable<Json>,"key": string,"name": NonNullable<Json>,"position": number
                  }
                  ComputedFields: never
                  Insert: {
                    "description"?: NonNullable<Json>,"key": string,"name": NonNullable<Json>,"position": number
                  }
                  Update: {
                    "description"?: NonNullable<Json>,"key"?: string,"name"?: NonNullable<Json>,"position"?: number
                  }
                  Relationships: [
                    
                  ]
                },"document_versions": {
                  Row: {
                    "created_at": string,"created_by": string | null,"doc": NonNullable<Json>,"document_id": string,"id": string,"kind": string,"meta": NonNullable<Json>,"note": string | null,"review_status": Database["public"]['Enums']["review_status"],"version_no": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"doc": NonNullable<Json>,"document_id": string,"id"?: string,"kind": string,"meta"?: NonNullable<Json>,"note"?: string | null,"review_status": Database["public"]['Enums']["review_status"],"version_no": number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"doc"?: NonNullable<Json>,"document_id"?: string,"id"?: string,"kind"?: string,"meta"?: NonNullable<Json>,"note"?: string | null,"review_status"?: Database["public"]['Enums']["review_status"],"version_no"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "document_versions_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    }
                  ]
                },"documents": {
                  Row: {
                    "category_key": string | null,"created_at": string,"created_by": string | null,"draft": NonNullable<Json>,"id": string,"level_key": string | null,"review_status": Database["public"]['Enums']["review_status"],"revision": number,"skill_keys": (string)[],"slug": string,"sort_weight": number,"type": Database["public"]['Enums']["doc_type"],"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "category_key"?: string | null,"created_at"?: string,"created_by"?: string | null,"draft"?: NonNullable<Json>,"id"?: string,"level_key"?: string | null,"review_status"?: Database["public"]['Enums']["review_status"],"revision"?: number,"skill_keys"?: (string)[],"slug": string,"sort_weight"?: number,"type": Database["public"]['Enums']["doc_type"],"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "category_key"?: string | null,"created_at"?: string,"created_by"?: string | null,"draft"?: NonNullable<Json>,"id"?: string,"level_key"?: string | null,"review_status"?: Database["public"]['Enums']["review_status"],"revision"?: number,"skill_keys"?: (string)[],"slug"?: string,"sort_weight"?: number,"type"?: Database["public"]['Enums']["doc_type"],"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "documents_category_key_fkey"
      columns: ["category_key"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "documents_level_key_fkey"
      columns: ["level_key"]
isOneToOne: false
      referencedRelation: "levels"
      referencedColumns: ["key"]
    }
                  ]
                },"favorites": {
                  Row: {
                    "created_at": string,"pose_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"pose_id": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"pose_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "favorites_pose_id_fkey"
      columns: ["pose_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    }
                  ]
                },"goals": {
                  Row: {
                    "achieved_at": string | null,"created_at": string,"id": string,"pose_id": string | null,"target_date": string | null,"title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "achieved_at"?: string | null,"created_at"?: string,"id"?: string,"pose_id"?: string | null,"target_date"?: string | null,"title": string,"user_id"?: string
                  }
                  Update: {
                    "achieved_at"?: string | null,"created_at"?: string,"id"?: string,"pose_id"?: string | null,"target_date"?: string | null,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "goals_pose_id_fkey"
      columns: ["pose_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    }
                  ]
                },"levels": {
                  Row: {
                    "description": NonNullable<Json>,"key": string,"label": NonNullable<Json>,"position": number,"rank": number
                  }
                  ComputedFields: never
                  Insert: {
                    "description"?: NonNullable<Json>,"key": string,"label": NonNullable<Json>,"position": number,"rank": number
                  }
                  Update: {
                    "description"?: NonNullable<Json>,"key"?: string,"label"?: NonNullable<Json>,"position"?: number,"rank"?: number
                  }
                  Relationships: [
                    
                  ]
                },"media_assets": {
                  Row: {
                    "alt": NonNullable<Json>,"bytes": number | null,"check_status": string,"created_at": string,"created_by": string | null,"document_id": string | null,"duration_ms": number | null,"fps": number | null,"frame_count": number | null,"height": number | null,"id": string,"kind": string,"meta": NonNullable<Json>,"mime": string,"position": number,"sha256": string | null,"storage_path": string | null,"url": string,"version": number,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "alt"?: NonNullable<Json>,"bytes"?: number | null,"check_status"?: string,"created_at"?: string,"created_by"?: string | null,"document_id"?: string | null,"duration_ms"?: number | null,"fps"?: number | null,"frame_count"?: number | null,"height"?: number | null,"id"?: string,"kind": string,"meta"?: NonNullable<Json>,"mime": string,"position"?: number,"sha256"?: string | null,"storage_path"?: string | null,"url": string,"version"?: number,"width"?: number | null
                  }
                  Update: {
                    "alt"?: NonNullable<Json>,"bytes"?: number | null,"check_status"?: string,"created_at"?: string,"created_by"?: string | null,"document_id"?: string | null,"duration_ms"?: number | null,"fps"?: number | null,"frame_count"?: number | null,"height"?: number | null,"id"?: string,"kind"?: string,"meta"?: NonNullable<Json>,"mime"?: string,"position"?: number,"sha256"?: string | null,"storage_path"?: string | null,"url"?: string,"version"?: number,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "media_assets_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    }
                  ]
                },"pose_progress": {
                  Row: {
                    "pose_id": string,"status": Database["public"]['Enums']["practice_status"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "pose_id": string,"status": Database["public"]['Enums']["practice_status"],"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "pose_id"?: string,"status"?: Database["public"]['Enums']["practice_status"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pose_progress_pose_id_fkey"
      columns: ["pose_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    }
                  ]
                },"practice_log": {
                  Row: {
                    "created_at": string,"duration_min": number | null,"id": string,"note": string | null,"pose_id": string | null,"practiced_on": string,"program_id": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"duration_min"?: number | null,"id"?: string,"note"?: string | null,"pose_id"?: string | null,"practiced_on"?: string,"program_id"?: string | null,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"duration_min"?: number | null,"id"?: string,"note"?: string | null,"pose_id"?: string | null,"practiced_on"?: string,"program_id"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "practice_log_pose_id_fkey"
      columns: ["pose_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "practice_log_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string | null,"id": string,"locale": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name"?: string | null,"id": string,"locale"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string | null,"id"?: string,"locale"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"publications": {
                  Row: {
                    "category_key": string | null,"doc": NonNullable<Json>,"document_id": string,"expert_approved": boolean,"level_key": string | null,"published_at": string,"published_by": string | null,"skill_keys": (string)[],"slug": string,"sort_weight": number,"source_revision": number,"type": Database["public"]['Enums']["doc_type"],"version_no": number
                  }
                  ComputedFields: never
                  Insert: {
                    "category_key"?: string | null,"doc": NonNullable<Json>,"document_id": string,"expert_approved": boolean,"level_key"?: string | null,"published_at"?: string,"published_by"?: string | null,"skill_keys"?: (string)[],"slug": string,"sort_weight"?: number,"source_revision": number,"type": Database["public"]['Enums']["doc_type"],"version_no": number
                  }
                  Update: {
                    "category_key"?: string | null,"doc"?: NonNullable<Json>,"document_id"?: string,"expert_approved"?: boolean,"level_key"?: string | null,"published_at"?: string,"published_by"?: string | null,"skill_keys"?: (string)[],"slug"?: string,"sort_weight"?: number,"source_revision"?: number,"type"?: Database["public"]['Enums']["doc_type"],"version_no"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "publications_document_id_fkey"
      columns: ["document_id"]
isOneToOne: true
      referencedRelation: "documents"
      referencedColumns: ["id"]
    }
                  ]
                },"reviews": {
                  Row: {
                    "checklist": NonNullable<Json>,"comment": string | null,"created_at": string,"decision": string,"document_id": string,"id": string,"kind": string,"reviewer_id": string,"revision": number
                  }
                  ComputedFields: never
                  Insert: {
                    "checklist"?: NonNullable<Json>,"comment"?: string | null,"created_at"?: string,"decision": string,"document_id": string,"id"?: string,"kind": string,"reviewer_id": string,"revision": number
                  }
                  Update: {
                    "checklist"?: NonNullable<Json>,"comment"?: string | null,"created_at"?: string,"decision"?: string,"document_id"?: string,"id"?: string,"kind"?: string,"reviewer_id"?: string,"revision"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "reviews_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    }
                  ]
                },"site_settings": {
                  Row: {
                    "allow_unreviewed_publish": boolean,"data": NonNullable<Json>,"id": number,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "allow_unreviewed_publish"?: boolean,"data"?: NonNullable<Json>,"id"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "allow_unreviewed_publish"?: boolean,"data"?: NonNullable<Json>,"id"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"skills": {
                  Row: {
                    "key": string,"name": NonNullable<Json>,"position": number,"quick_filter": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"name": NonNullable<Json>,"position": number,"quick_filter"?: boolean
                  }
                  Update: {
                    "key"?: string,"name"?: NonNullable<Json>,"position"?: number,"quick_filter"?: boolean
                  }
                  Relationships: [
                    
                  ]
                },"step_completions": {
                  Row: {
                    "completed_at": string,"program_id": string,"step_key": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string,"program_id": string,"step_key": string,"user_id"?: string
                  }
                  Update: {
                    "completed_at"?: string,"program_id"?: string,"step_key"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "step_completions_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    }
                  ]
                },"user_roles": {
                  Row: {
                    "granted_at": string,"granted_by": string | null,"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "granted_at"?: string,"granted_by"?: string | null,"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  Update: {
                    "granted_at"?: string,"granted_by"?: string | null,"role"?: Database["public"]['Enums']["app_role"],"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "can_edit":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"can_review":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"has_role":
{ Args: { "p_role": Database["public"]['Enums']["app_role"] }; Returns: boolean
                           },
"is_owner":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"next_version_no":
{ Args: { "p_document_id": string }; Returns: number
                           },
"program_step_keys":
{ Args: { "p_doc": Json }; Returns: (string)[]
                           },
"publish_document":
{ Args: { "p_document_id": string,"p_note"?: string }; Returns: number
                           },
"restore_version":
{ Args: { "p_document_id": string,"p_version_no": number }; Returns: undefined
                           },
"set_review_status":
{ Args: { "p_comment"?: string,"p_document_id": string,"p_status": Database["public"]['Enums']["review_status"] }; Returns: Database["public"]['Enums']["review_status"]
                           },
"step_completion_counts":
{ Args: { "p_program_id": string }; Returns: {
              "completions": number,"step_key": string
            }[]
                           },
"unpublish_document":
{ Args: { "p_document_id": string,"p_note"?: string }; Returns: undefined
                           },
"write_audit":
{ Args: { "p_action": string,"p_entity_id": string,"p_entity_type": string,"p_meta": Json }; Returns: undefined
                           }
          }
          Enums: {
            "app_role": "member"|"reviewer"|"editor"|"owner","doc_type": "pose"|"program"|"exercise"|"page","practice_status": "not_started"|"in_progress"|"learned","review_status": "draft"|"editorial_review"|"expert_review"|"approved"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "app_role": ["member", "reviewer", "editor", "owner"],"doc_type": ["pose", "program", "exercise", "page"],"practice_status": ["not_started", "in_progress", "learned"],"review_status": ["draft", "editorial_review", "expert_review", "approved"]
          }
        }
} as const
