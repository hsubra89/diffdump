import { registerCustomTheme, type ThemeRegistration } from '@pierre/diffs'

const themeNames = {
  dark: 'diffdump-neutral-graphite-dark',
  light: 'diffdump-neutral-graphite-light',
} as const

interface GitHubSyntaxPalette {
  accent: string
  constant: string
  foreground: string
  type: string
}

interface DiffPalette {
  addition: string
  additionLine: string
  additionText: string
  background: string
  border: string
  canvas: string
  deletion: string
  deletionLine: string
  deletionText: string
  focus: string
  foreground: string
  lineHighlight: string
  muted: string
  selection: string
  syntax: GitHubSyntaxPalette
}

/* The TSX grammar re-suffixes every TypeScript scope with `.tsx`, and
   TextMate selectors match per dot-segment, so `.ts` rules never apply to
   `.tsx` tokens. Emit both variants for each scope. */
function tsAndTsx(...scopes: string[]): string[] {
  return scopes.flatMap((scope) => [scope, scope.replace(/\.ts\b/g, '.tsx')])
}

function githubWebTokenColors({
  accent,
  constant,
  foreground,
  type,
}: GitHubSyntaxPalette): NonNullable<ThemeRegistration['tokenColors']> {
  return [
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
  palette: DiffPalette,
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
    tokenColors: [
      ...(baseTheme.tokenColors ?? []),
      ...githubWebTokenColors(palette.syntax),
    ],
  }
}

registerCustomTheme(themeNames.light, async () => {
  const { default: baseTheme } =
    await import('@shikijs/themes/github-light-default')

  return extendTheme(baseTheme, themeNames.light, {
    addition: '#15803d',
    additionLine: '#15803d0d',
    additionText: '#15803d24',
    background: '#ffffff',
    border: '#e4e4e7',
    canvas: '#f7f7f8',
    deletion: '#b91c1c',
    deletionLine: '#b91c1c0d',
    deletionText: '#b91c1c24',
    focus: '#71717a',
    foreground: '#27272a',
    lineHighlight: '#f4f4f580',
    muted: '#a1a1aa',
    selection: '#18181b14',
    syntax: {
      accent: '#0969da',
      constant: '#0550ae',
      foreground: '#1f2328',
      type: '#953800',
    },
  })
})

registerCustomTheme(themeNames.dark, async () => {
  const { default: baseTheme } =
    await import('@shikijs/themes/github-dark-default')

  return extendTheme(baseTheme, themeNames.dark, {
    addition: '#4ade80',
    additionLine: '#4ade8014',
    additionText: '#4ade8030',
    background: '#18181b',
    border: '#27272a',
    canvas: '#09090b',
    deletion: '#f87171',
    deletionLine: '#f8717114',
    deletionText: '#f8717130',
    focus: '#d4d4d8',
    foreground: '#e4e4e7',
    lineHighlight: '#27272a80',
    muted: '#71717a',
    selection: '#fafafa1a',
    syntax: {
      accent: '#2f81f7',
      constant: '#79c0ff',
      foreground: '#e6edf3',
      type: '#ffa657',
    },
  })
})

export const diffThemes = themeNames
