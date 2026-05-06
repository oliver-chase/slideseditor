import type { SlideComponent } from '@/components/slides/types'

export function cloneComponents(components: SlideComponent[]): SlideComponent[] {
  return components.map((component) => ({
    ...component,
    style: { ...component.style },
    ...(component.layoutConstraint ? { layoutConstraint: { ...component.layoutConstraint } } : {}),
  }))
}

export function areComponentsEqual(a: SlideComponent[], b: SlideComponent[]): boolean {
  if (a.length !== b.length) return false
  for (let index = 0; index < a.length; index += 1) {
    const left = a[index]
    const right = b[index]
    if (
      left.id !== right.id ||
      left.type !== right.type ||
      left.x !== right.x ||
      left.y !== right.y ||
      left.width !== right.width ||
      left.height !== right.height ||
      left.content !== right.content ||
      left.locked !== right.locked ||
      left.visible !== right.visible ||
      left.sourceLabel !== right.sourceLabel ||
      JSON.stringify(left.layoutConstraint || null) !== JSON.stringify(right.layoutConstraint || null) ||
      left.themeRole !== right.themeRole ||
      left.themeLinked !== right.themeLinked
    ) {
      return false
    }
    const leftStyle = left.style || {}
    const rightStyle = right.style || {}
    if (
      leftStyle.fontSize !== rightStyle.fontSize ||
      leftStyle.fontWeight !== rightStyle.fontWeight ||
      leftStyle.fontFamily !== rightStyle.fontFamily ||
      leftStyle.color !== rightStyle.color ||
      leftStyle.backgroundFill !== rightStyle.backgroundFill ||
      leftStyle.backgroundColor !== rightStyle.backgroundColor ||
      leftStyle.borderColor !== rightStyle.borderColor ||
      leftStyle.borderWidth !== rightStyle.borderWidth ||
      leftStyle.borderStyle !== rightStyle.borderStyle ||
      leftStyle.borderRadius !== rightStyle.borderRadius ||
      leftStyle.boxShadow !== rightStyle.boxShadow ||
      leftStyle.fontStyle !== rightStyle.fontStyle ||
      leftStyle.lineHeight !== rightStyle.lineHeight ||
      leftStyle.textAlign !== rightStyle.textAlign ||
      leftStyle.textAutoSize !== rightStyle.textAutoSize
    ) {
      return false
    }
  }
  return true
}

export function normalizeComponentsForPersistence(
  components: SlideComponent[],
  minFontSize: number,
): SlideComponent[] {
  return components.map((component) => ({
    ...component,
    style: {
      ...component.style,
      ...(component.style.fontSize
        ? { fontSize: Math.max(minFontSize, component.style.fontSize) }
        : {}),
    },
  }))
}
