import {
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
} from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '../../lib/cn'

export const buttonVariants = cva(
  [
    'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap',
    'rounded-control border text-xs font-semibold',
    'transition-[color,background-color,border-color,transform,box-shadow] duration-150',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text',
    'disabled:pointer-events-none disabled:opacity-55',
  ],
  {
    variants: {
      variant: {
        primary:
          'border-accent bg-accent text-accent-ink hover:border-accent-strong hover:bg-accent-strong active:translate-y-px',
        secondary:
          'border-line bg-surface text-muted-bright hover:border-line-bright hover:bg-surface-raised hover:text-foreground active:translate-y-px',
        outline:
          'border-line bg-transparent text-muted-bright hover:border-line-bright hover:bg-surface-raised hover:text-foreground active:translate-y-px',
        ghost:
          'border-transparent bg-transparent text-muted hover:bg-surface-raised hover:text-foreground',
      },
      size: {
        xs: 'h-7 px-2.5',
        sm: 'h-8 px-3',
        iconXs: 'size-7 p-0 text-sm',
        iconSm: 'size-8 p-0 text-sm',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'sm',
    },
  },
)

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
)

Button.displayName = 'Button'

type IconButtonProps = Omit<ButtonProps, 'size'> & {
  label: string
  size?: 'xs' | 'sm'
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, size = 'sm', ...props }, ref) => (
    <Button
      ref={ref}
      size={size === 'xs' ? 'iconXs' : 'iconSm'}
      aria-label={label}
      title={props.title ?? label}
      {...props}
    />
  ),
)

IconButton.displayName = 'IconButton'

export function ButtonGroup({
  className,
  ...props
}: HTMLAttributes<HTMLFieldSetElement>) {
  return (
    <fieldset
      className={cn(
        'inline-flex items-center overflow-hidden rounded-control border border-line bg-canvas p-0.5',
        '[&>*]:rounded-[5px]',
        className,
      )}
      {...props}
    />
  )
}
