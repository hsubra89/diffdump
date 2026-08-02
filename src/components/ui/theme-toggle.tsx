import { useEffect, useState } from 'react'
import { IconColorAuto, IconMoon, IconSun } from '@pierre/icons'

import { IconButton } from './button'
import { toggleTheme, useResolvedTheme } from '../../lib/theme'

type ThemeToggleProps = {
  className?: string
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const resolvedTheme = useResolvedTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <IconButton
      className={className}
      label={
        mounted && resolvedTheme === 'dark'
          ? 'Switch to light theme'
          : 'Switch to dark theme'
      }
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
    >
      {mounted ? (
        resolvedTheme === 'dark' ? (
          <IconMoon aria-hidden="true" />
        ) : (
          <IconSun aria-hidden="true" />
        )
      ) : (
        <IconColorAuto aria-hidden="true" />
      )}
    </IconButton>
  )
}
