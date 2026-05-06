import type { SlideComponent, SlideTheme, SlideThemeRole } from '@/components/slides/types'
import type { SlideTemplateRecord } from '@/components/slides/persistence-types'

export function cloneSlideTheme(theme: SlideTheme): SlideTheme {
  return {
    fonts: { ...theme.fonts },
    colors: { ...theme.colors },
    spacingScale: { ...theme.spacingScale },
  }
}

export function inferThemeRole(component: SlideComponent): SlideThemeRole | null {
  if (component.type === 'heading' || component.type === 'subheading') return 'heading'
  if (component.type === 'stat' || component.type === 'tag-line' || component.type === 'logo') return 'accent'
  if (component.type === 'card' || component.type === 'panel' || component.type === 'row') return 'surface'
  if (component.type === 'text') return 'body'
  return null
}

export function applyThemeToComponent(component: SlideComponent, theme: SlideTheme, convertUnlinked: boolean): SlideComponent {
  const inferredRole = component.themeRole || inferThemeRole(component)
  const shouldLink = component.themeLinked || convertUnlinked
  if (!inferredRole || !shouldLink) return component

  const nextStyle = { ...component.style }
  if (inferredRole === 'heading') {
    nextStyle.fontFamily = theme.fonts.heading
    nextStyle.color = theme.colors.primary
  } else if (inferredRole === 'body') {
    nextStyle.fontFamily = theme.fonts.body
    nextStyle.color = theme.colors.secondary
  } else if (inferredRole === 'accent') {
    nextStyle.fontFamily = component.type === 'logo' ? component.style.fontFamily : theme.fonts.heading
    nextStyle.color = theme.colors.accent
  } else if (inferredRole === 'surface') {
    nextStyle.fontFamily = theme.fonts.body
    nextStyle.color = component.style.color || theme.colors.secondary
    nextStyle.backgroundColor = theme.colors.background
  }

  return {
    ...component,
    style: nextStyle,
    themeRole: inferredRole,
    themeLinked: true,
  }
}

export function getTemplatePreviewFingerprint(template: SlideTemplateRecord): string {
  return [
    template.id,
    String(template.canvas?.width || 0),
    String(template.canvas?.height || 0),
    ...template.components
      .filter((component) => component.visible !== false)
      .map((component) => `${component.id}:${component.type}:${component.x}:${component.y}:${component.width}:${component.height}:${component.content || ''}`),
  ]
    .join('|')
}

export function getTemplateStructureSummary(template: SlideTemplateRecord): string {
  const lockedCount = template.locked_element_ids?.length ?? template.components.filter((component) => component.locked).length
  const editableCount = template.editable_zone_ids?.length ?? template.components.filter((component) => !component.locked && component.visible !== false).length
  const blockCount = template.layout_blocks?.length ?? template.components.filter((component) => component.visible !== false).length
  return `${lockedCount} locked · ${editableCount} editable zones · ${blockCount} blocks`
}

export function getTemplatePreviewScale(
  canvas: { width: number; height: number },
  maxWidth: number,
  maxHeight: number,
): number {
  const width = canvas.width > 0 ? canvas.width : 1
  const height = canvas.height > 0 ? canvas.height : 1
  return Math.min(maxWidth / width, maxHeight / height)
}

export function normalizeTemplateSearchText(value: string | null | undefined): string {
  return (value || '').toLowerCase().trim()
}

export function buildTemplateContentSearchCorpus(template: SlideTemplateRecord): string {
  return template.components
    .slice(0, 24)
    .map((component) => {
      const plainContent = (component.content || '').replace(/<[^>]+>/g, ' ')
      return [component.type, component.sourceLabel || '', plainContent].join(' ')
    })
    .join(' ')
    .toLowerCase()
}

export function rankTemplateForSearch(template: SlideTemplateRecord, query: string): {
  score: number
  matchSignals: string[]
} {
  const normalizedQuery = normalizeTemplateSearchText(query)
  if (!normalizedQuery) return { score: 0, matchSignals: [] }

  const name = normalizeTemplateSearchText(template.name)
  const description = normalizeTemplateSearchText(template.description)
  const owner = normalizeTemplateSearchText(template.owner_user_id)
  const contentCorpus = buildTemplateContentSearchCorpus(template)

  const signals = new Set<string>()
  let score = 0

  if (name === normalizedQuery) {
    score += 200
    signals.add('Exact Name')
  } else if (name.startsWith(normalizedQuery)) {
    score += 140
    signals.add('Name Prefix')
  } else if (name.includes(normalizedQuery)) {
    score += 110
    signals.add('Name')
  }

  if (description.includes(normalizedQuery)) {
    score += 80
    signals.add('Description')
  }

  if (owner.includes(normalizedQuery)) {
    score += 40
    signals.add('Owner')
  }

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean)
  let tokenHitCount = 0
  for (const token of tokens) {
    let tokenMatched = false
    if (name.includes(token)) {
      score += 24
      tokenMatched = true
      signals.add('Name')
    }
    if (description.includes(token)) {
      score += 14
      tokenMatched = true
      signals.add('Description')
    }
    if (owner.includes(token)) {
      score += 8
      tokenMatched = true
      signals.add('Owner')
    }
    if (contentCorpus.includes(token)) {
      score += 6
      tokenMatched = true
      signals.add('Content')
    }
    if (tokenMatched) tokenHitCount += 1
  }

  if (tokens.length > 1 && tokenHitCount === tokens.length) {
    score += 30
    signals.add('All Tokens')
  }

  if (signals.size === 0) return { score: 0, matchSignals: [] }
  return { score, matchSignals: Array.from(signals) }
}
