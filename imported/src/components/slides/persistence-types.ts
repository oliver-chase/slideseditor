import type { SlideCanvas, SlideComponent, SlideDocument } from '@/components/slides/types'

export interface SlideRecord {
  id: string
  owner_user_id: string
  title: string
  canvas: SlideCanvas
  components: SlideComponent[]
  metadata: Record<string, unknown>
  revision: number
  source: 'import' | 'template' | 'manual'
  source_template_id?: string | null
  created_at: string
  updated_at: string
  last_edited_at: string
}

export interface SlideTemplateRecord {
  id: string
  owner_user_id: string | null
  name: string
  description: string
  is_shared: boolean
  is_archived?: boolean
  canvas: SlideCanvas
  components: SlideComponent[]
  locked_element_ids?: string[]
  editable_zone_ids?: string[]
  layout_blocks?: SlideTemplateLayoutBlock[]
  preview?: SlideTemplatePreview | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface SlideTemplateLayoutBlock {
  id: string
  label: string
  component_ids: string[]
}

export interface SlideTemplatePreview {
  asset_key: string
  asset_url: string
  fingerprint: string
  generated_at: string
  generated_by_user_id: string | null
  status: 'ready' | 'missing'
  version: number
  visible_component_count: number
}

export type SlidePptxExportJobStatus = 'queued' | 'running' | 'succeeded' | 'failed'

export interface SlidePptxExportWarning {
  code: string
  message: string
  slide_id: string
  component_id: string
  component_type: string
}

export interface SlidePptxExportObject {
  slide_id: string
  component_id: string
  component_type: string
  native_kind: 'text' | 'shape' | 'image'
  editable: boolean
}

export interface SlidePptxExportFontManifestEntry {
  family: string
  weight: number
  style: 'normal' | 'italic'
  src_url: string
}

export interface SlidePptxExportUsedFontEntry {
  family: string
  weight: number
  style: 'normal' | 'italic'
}

export interface SlidePptxExportAnimationEntry {
  slide_id: string
  component_id: string
  component_type: string
  native_kind: 'text' | 'shape' | 'image'
  sequence: number
  fragment_order: number
  effect: 'fade' | 'fly-in' | 'appear'
}

export interface SlidePptxDashboardSurfaceEntry {
  slide_id: string
  component_id: string
  component_type: string
  surface_type: 'svg' | 'table' | 'canvas' | 'canvas-chart'
  native_kind: 'text' | 'shape' | 'image' | null
  export_strategy: 'vector-image' | 'native-table' | 'raster-image' | 'static-fallback'
  editable: boolean
}

export interface SlidePptxExportJob {
  id: string
  requested_by_user_id: string
  requested_by_email: string | null
  status: SlidePptxExportJobStatus
  slide_ids: string[]
  options: {
    filename_prefix: string
    include_hidden: boolean
    animation_profile?: 'default' | 'conservative' | 'disabled'
  }
  attempts: number
  max_attempts: number
  warning_count: number
  warnings: SlidePptxExportWarning[]
  native_objects: SlidePptxExportObject[]
  font_manifest?: {
    embedded_fonts: SlidePptxExportFontManifestEntry[]
    used_fonts: SlidePptxExportUsedFontEntry[]
  }
  animation_manifest?: {
    profile: 'default' | 'conservative' | 'disabled'
    animations: SlidePptxExportAnimationEntry[]
  }
  dashboard_surface_manifest?: {
    surfaces: SlidePptxDashboardSurfaceEntry[]
  }
  artifact: {
    file_name: string
    expires_at: string
    download_token: string
  } | null
  requested_at: string
  started_at: string | null
  completed_at: string | null
  updated_at: string
  error_message: string | null
  idempotency_key: string | null
}

export interface SlideActor {
  user_id: string
  user_email?: string
  role?: string
}

export interface SlideSaveInput {
  id?: string
  title: string
  canvas: SlideCanvas
  components: SlideComponent[]
  document?: SlideDocument
  metadata?: Record<string, unknown>
  revision?: number
  autosave?: boolean
  overwrite?: boolean
}

export interface SlideSaveResponse {
  slide: SlideRecord
}
