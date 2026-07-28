import { registerCustomTheme, type ThemeRegistration } from '@pierre/diffs'

const themeNames = {
  dark: 'diffdump-github-dark',
  light: 'diffdump-github-light',
} as const

interface GitHubSyntaxPalette {
  accent: string
  constant: string
  foreground: string
  type: string
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
  palette: GitHubSyntaxPalette,
): ThemeRegistration {
  return {
    ...baseTheme,
    name,
    tokenColors: [
      ...(baseTheme.tokenColors ?? []),
      ...githubWebTokenColors(palette),
    ],
  }
}

registerCustomTheme(themeNames.light, async () => {
  const { default: baseTheme } =
    await import('@shikijs/themes/github-light-default')

  return extendTheme(baseTheme, themeNames.light, {
    accent: '#0969da',
    constant: '#0550ae',
    foreground: '#1f2328',
    type: '#953800',
  })
})

registerCustomTheme(themeNames.dark, async () => {
  const { default: baseTheme } =
    await import('@shikijs/themes/github-dark-default')

  return extendTheme(baseTheme, themeNames.dark, {
    accent: '#2f81f7',
    constant: '#79c0ff',
    foreground: '#e6edf3',
    type: '#ffa657',
  })
})

export const diffThemes = themeNames
