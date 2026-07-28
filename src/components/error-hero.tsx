import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'

import { buttonVariants } from './ui/button'
import { eyebrowClassName } from './ui/surfaces'
import { cn } from '../lib/cn'

type ErrorHeroProps = {
  eyebrow: string
  title: string
  description: string
  actionLabel: string
  actionHash?: string
  className?: string
  children?: ReactNode
}

export function ErrorHero({
  eyebrow,
  title,
  description,
  actionLabel,
  actionHash,
  className,
  children,
}: ErrorHeroProps) {
  return (
    <section
      className={cn(
        'flex w-[min(580px,calc(100%-40px))] flex-col items-start justify-center',
        className,
      )}
    >
      {children}
      <p className={cn(eyebrowClassName, 'mb-5 text-muted-bright')}>
        {eyebrow}
      </p>
      <h1 className="mb-3.5 text-[clamp(38px,7vw,62px)] font-semibold leading-[0.98] tracking-[-0.04em]">
        {title}
      </h1>
      <p className="mb-7 leading-relaxed text-muted-bright">{description}</p>
      <Link
        className={buttonVariants({ variant: 'primary', size: 'sm' })}
        to="/"
        hash={actionHash}
      >
        {actionLabel}
      </Link>
    </section>
  )
}
