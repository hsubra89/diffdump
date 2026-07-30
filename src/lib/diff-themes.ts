import { registerCustomTheme, type ThemeRegistration } from '@pierre/diffs'

const themeNames = {
  dark: 'diffdump-neutral-graphite-dark',
  light: 'diffdump-neutral-graphite-light',
} as const

interface DiffSyntaxPalette {
  accent: string
  addition: string
  additionLine: string
  additionText: string
  background: string
  border: string
  canvas: string
  constant: string
  deletion: string
  deletionLine: string
  deletionText: string
  focus: string
  foreground: string
  lineHighlight: string
  muted: string
  selection: string
  type: string
}

/* The TSX grammar re-suffixes every TypeScript scope with `.tsx`, and
   TextMate selectors match per dot-segment, so `.ts` rules never apply to
   `.tsx` tokens. Emit both variants for each scope. */
function tsAndTsx(...scopes: string[]): string[] {
  return scopes.flatMap((scope) => [scope, scope.replace(/\.ts\b/g, '.tsx')])
}

function restrainedTokenColors({
  accent,
  addition,
  constant,
  deletion,
  foreground,
  muted,
  type,
}: DiffSyntaxPalette): NonNullable<ThemeRegistration['tokenColors']> {
  return [
    {
      settings: { foreground },
    },
    {
      scope: ['comment', 'punctuation.definition.comment', 'string.comment'],
      settings: { fontStyle: 'italic', foreground: muted },
    },
    {
      scope: [
        'string',
        'string.quoted',
        'string.template',
        'string.regexp',
        'markup.inline.raw',
      ],
      settings: { foreground: constant },
    },
    {
      scope: [
        'constant',
        'constant.numeric',
        'constant.language',
        'variable.language',
        'support.constant',
      ],
      settings: { foreground: constant },
    },
    {
      scope: [
        'keyword',
        'storage',
        'storage.type',
        'storage.modifier',
        'punctuation.definition.template-expression',
      ],
      settings: { foreground: accent },
    },
    {
      scope: [
        'entity.name.function',
        'entity.name.type',
        'entity.name.class',
        'support.function',
        'support.type',
      ],
      settings: { foreground: type },
    },
    {
      scope: ['invalid', 'message.error', 'markup.deleted'],
      settings: { foreground: deletion },
    },
    {
      scope: ['markup.inserted'],
      settings: { foreground: addition },
    },
    {
      scope: ['meta.link.inline.markdown', 'markup.underline.link'],
      settings: { fontStyle: 'underline', foreground: accent },
    },
    {
      scope: tsAndTsx('entity.name.label.ts', 'meta.object-literal.key.ts'),
      settings: { foreground: accent },
    },
    {
      scope: tsAndTsx('punctuation.separator.key-value.ts'),
      settings: { foreground },
    },
    {
      scope: tsAndTsx(
        'meta.function-call.ts variable.other.object.ts',
        'meta.object.member.ts variable.other.readwrite.ts',
      ),
      settings: { foreground: type },
    },
    {
      scope: tsAndTsx('variable.parameter.ts'),
      settings: { foreground },
    },
    {
      scope: tsAndTsx('storage.type.function.arrow.ts'),
      settings: { foreground: accent },
    },
    {
      scope: tsAndTsx('meta.template.expression.ts variable.other.object.ts'),
      settings: { foreground },
    },
    {
      scope: tsAndTsx('meta.template.expression.ts variable.other.property.ts'),
      settings: { foreground: constant },
    },
    {
      scope: tsAndTsx(
        'punctuation.definition.template-expression.begin.ts',
        'punctuation.definition.template-expression.end.ts',
        'meta.template.expression.ts punctuation.accessor.ts',
        'meta.template.expression.ts meta.brace.round.ts',
      ),
      settings: { foreground },
    },
  ]
}

function extendTheme(
  baseTheme: ThemeRegistration,
  name: string,
  palette: DiffSyntaxPalette,
): ThemeRegistration {
  return {
    ...baseTheme,
    name,
    colors: {
      ...baseTheme.colors,
      'diffEditor.insertedLineBackground': palette.additionLine,
      'diffEditor.insertedTextBackground': palette.additionText,
      'diffEditor.removedLineBackground': palette.deletionLine,
      'diffEditor.removedTextBackground': palette.deletionText,
      'editor.background': palette.background,
      'editor.foreground': palette.foreground,
      'editor.lineHighlightBackground': palette.lineHighlight,
      'editor.selectionHighlightBackground': palette.selection,
      'editorCursor.foreground': palette.focus,
      'editorGroup.border': palette.border,
      'editorGroupHeader.tabsBackground': palette.canvas,
      'editorGroupHeader.tabsBorder': palette.border,
      'editorGutter.addedBackground': palette.additionText,
      'editorGutter.deletedBackground': palette.deletionText,
      'editorLineNumber.activeForeground': palette.foreground,
      'editorLineNumber.foreground': palette.muted,
      focusBorder: palette.focus,
      foreground: palette.foreground,
    },
    tokenColors: [...restrainedTokenColors(palette)],
  }
}

registerCustomTheme(themeNames.light, async () => {
  const { default: baseTheme } =
    await import('@shikijs/themes/github-light-default')

  return extendTheme(baseTheme, themeNames.light, {
    accent: '#3f3f46',
    addition: '#15803d',
    additionLine: '#15803d0d',
    additionText: '#15803d24',
    background: '#ffffff',
    border: '#e4e4e7',
    canvas: '#f7f7f8',
    constant: '#52525b',
    deletion: '#b91c1c',
    deletionLine: '#b91c1c0d',
    deletionText: '#b91c1c24',
    focus: '#71717a',
    foreground: '#27272a',
    lineHighlight: '#f4f4f580',
    muted: '#a1a1aa',
    selection: '#18181b14',
    type: '#52525b',
  })
})

registerCustomTheme(themeNames.dark, async () => {
  const { default: baseTheme } =
    await import('@shikijs/themes/github-dark-default')

  return extendTheme(baseTheme, themeNames.dark, {
    accent: '#d4d4d8',
    addition: '#4ade80',
    additionLine: '#4ade8014',
    additionText: '#4ade8030',
    background: '#18181b',
    border: '#27272a',
    canvas: '#09090b',
    constant: '#a1a1aa',
    deletion: '#f87171',
    deletionLine: '#f8717114',
    deletionText: '#f8717130',
    focus: '#d4d4d8',
    foreground: '#e4e4e7',
    lineHighlight: '#27272a80',
    muted: '#71717a',
    selection: '#fafafa1a',
    type: '#d4d4d8',
  })
})

export const diffThemes = themeNames
