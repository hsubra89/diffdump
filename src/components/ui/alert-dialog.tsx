import type { ComponentProps } from 'react'
import { AlertDialog as AlertDialogPrimitive } from '@base-ui/react/alert-dialog'

import { Button } from './button'
import { cn } from '../../lib/cn'

export type AlertDialogHandle<Payload> = NonNullable<
  AlertDialogPrimitive.Root.Props<Payload>['handle']
>

export function createAlertDialogHandle<Payload>() {
  return AlertDialogPrimitive.createHandle<Payload>()
}

export function AlertDialog<Payload = unknown>(
  props: AlertDialogPrimitive.Root.Props<Payload>,
) {
  return <AlertDialogPrimitive.Root {...props} />
}

export function AlertDialogTrigger<Payload = unknown>(
  props: AlertDialogPrimitive.Trigger.Props<Payload>,
) {
  return (
    <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
  )
}

export function AlertDialogContent({
  className,
  children,
  ...props
}: AlertDialogPrimitive.Popup.Props) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Backdrop
        data-slot="alert-dialog-overlay"
        className="fixed inset-0 z-50 min-h-dvh bg-black/50 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-[-webkit-touch-callout:none]:absolute"
      />
      <AlertDialogPrimitive.Popup
        data-slot="alert-dialog-content"
        className={cn(
          'fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-panel border border-border bg-popover p-5 text-popover-foreground shadow-float outline-none',
          'transition-[opacity,scale] duration-150 ease-out data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0',
          className,
        )}
        {...props}
      >
        {children}
      </AlertDialogPrimitive.Popup>
    </AlertDialogPrimitive.Portal>
  )
}

export function AlertDialogHeader({
  className,
  ...props
}: ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn('flex flex-col gap-1.5', className)}
      {...props}
    />
  )
}

export function AlertDialogFooter({
  className,
  ...props
}: ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    />
  )
}

export function AlertDialogTitle({
  className,
  ...props
}: AlertDialogPrimitive.Title.Props) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn('text-sm font-semibold text-foreground', className)}
      {...props}
    />
  )
}

export function AlertDialogDescription({
  className,
  ...props
}: AlertDialogPrimitive.Description.Props) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn('text-xs leading-relaxed text-muted-foreground', className)}
      {...props}
    />
  )
}

export function AlertDialogCancel(props: AlertDialogPrimitive.Close.Props) {
  return (
    <AlertDialogPrimitive.Close
      data-slot="alert-dialog-cancel"
      render={<Button variant="outline" size="sm" />}
      {...props}
    />
  )
}

export function AlertDialogAction(props: AlertDialogPrimitive.Close.Props) {
  return (
    <AlertDialogPrimitive.Close
      data-slot="alert-dialog-action"
      render={<Button variant="destructive" size="sm" />}
      {...props}
    />
  )
}
