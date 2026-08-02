// @vitest-environment happy-dom

import { useState } from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Popover, PopoverContent, PopoverTrigger } from './popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from './sheet'
import { Switch } from './switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs'
import { ToggleGroup, ToggleGroupItem } from './toggle-group'

vi.mock('@pierre/icons', () => ({
  IconCheck: () => null,
  IconChevronSm: () => null,
}))

afterEach(cleanup)

describe('Base UI primitives', () => {
  it('activates tabs with arrow-key navigation', async () => {
    const user = userEvent.setup()

    render(
      <Tabs defaultValue="github">
        <TabsList aria-label="Diff source" activateOnFocus>
          <TabsTrigger value="github">GitHub</TabsTrigger>
          <TabsTrigger value="paste">Paste</TabsTrigger>
        </TabsList>
        <TabsContent value="github">GitHub panel</TabsContent>
        <TabsContent value="paste">Paste panel</TabsContent>
      </Tabs>,
    )

    const githubTab = screen.getByRole('tab', { name: 'GitHub' })
    const pasteTab = screen.getByRole('tab', { name: 'Paste' })

    githubTab.focus()
    await user.keyboard('{ArrowRight}')

    expect(pasteTab.getAttribute('aria-selected')).toBe('true')
    expect(githubTab.getAttribute('aria-selected')).toBe('false')
    expect(screen.getByRole('tabpanel').textContent).toBe('Paste panel')
  })

  it('dismisses a popover with Escape and restores trigger focus', async () => {
    const user = userEvent.setup()

    render(
      <Popover>
        <PopoverTrigger render={<button type="button" aria-label="View" />}>
          View
        </PopoverTrigger>
        <PopoverContent aria-label="View options">
          <button type="button">Option</button>
        </PopoverContent>
      </Popover>,
    )

    const trigger = screen.getByRole('button', { name: 'View' })
    await user.click(trigger)

    expect(screen.getByRole('dialog', { name: 'View options' })).not.toBeNull()

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'View options' })).toBeNull()
    })
    expect(document.activeElement).toBe(trigger)
  })

  it('dismisses a popover after an outside press', async () => {
    const user = userEvent.setup()

    render(
      <div>
        <Popover>
          <PopoverTrigger render={<button type="button" aria-label="Review" />}>
            Review
          </PopoverTrigger>
          <PopoverContent aria-label="Submit review">
            Review form
          </PopoverContent>
        </Popover>
        <button type="button">Outside</button>
      </div>,
    )

    await user.click(screen.getByRole('button', { name: 'Review' }))
    expect(screen.getByRole('dialog', { name: 'Submit review' })).not.toBeNull()

    await user.click(screen.getByRole('button', { name: 'Outside' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Submit review' })).toBeNull()
    })
  })

  it('traps sheet focus and restores it after Escape', async () => {
    const user = userEvent.setup()

    render(
      <div>
        <button type="button">Before</button>
        <Sheet>
          <SheetTrigger
            render={<button type="button" aria-label="Open files" />}
          >
            Files
          </SheetTrigger>
          <SheetContent side="left">
            <SheetTitle>Changed files</SheetTitle>
            <button type="button">First action</button>
            <button type="button">Last action</button>
          </SheetContent>
        </Sheet>
        <button type="button">After</button>
      </div>,
    )

    const trigger = screen.getByRole('button', { name: 'Open files' })
    await user.click(trigger)

    const dialog = screen.getByRole('dialog', { name: 'Changed files' })
    await waitFor(() =>
      expect(dialog.contains(document.activeElement)).toBe(true),
    )

    for (let index = 0; index < 4; index += 1) {
      await user.tab()
      expect(dialog.contains(document.activeElement)).toBe(true)
    }

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Changed files' })).toBeNull()
    })
    expect(document.activeElement).toBe(trigger)
  })

  it('dismisses a sheet from its backdrop', async () => {
    const user = userEvent.setup()

    render(
      <Sheet>
        <SheetTrigger
          render={<button type="button" aria-label="Open navigation" />}
        >
          Navigation
        </SheetTrigger>
        <SheetContent side="left">
          <SheetTitle>Navigation</SheetTitle>
        </SheetContent>
      </Sheet>,
    )

    await user.click(screen.getByRole('button', { name: 'Open navigation' }))
    expect(screen.getByRole('dialog', { name: 'Navigation' })).not.toBeNull()

    const backdrop = document.querySelector<HTMLElement>(
      '[data-slot="sheet-overlay"]',
    )
    expect(backdrop).not.toBeNull()
    await user.click(backdrop!)

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Navigation' })).toBeNull()
    })
  })

  it('keeps an exclusive toggle group selected', async () => {
    const user = userEvent.setup()

    function FileOrderControl() {
      const [value, setValue] = useState(['patch'])

      return (
        <ToggleGroup
          aria-label="File order"
          value={value}
          onValueChange={(nextValue) => {
            if (nextValue[0]) setValue(nextValue)
          }}
        >
          <ToggleGroupItem value="patch">Patch</ToggleGroupItem>
          <ToggleGroupItem value="category">Category</ToggleGroupItem>
        </ToggleGroup>
      )
    }

    render(<FileOrderControl />)

    const patch = screen.getByRole('button', { name: 'Patch' })
    const category = screen.getByRole('button', { name: 'Category' })

    await user.click(category)
    expect(category.getAttribute('aria-pressed')).toBe('true')
    expect(patch.getAttribute('aria-pressed')).toBe('false')

    await user.click(category)
    expect(category.getAttribute('aria-pressed')).toBe('true')
  })

  it('reports switch state through its accessible contract', async () => {
    const user = userEvent.setup()

    function WrapLinesControl() {
      const [checked, setChecked] = useState(false)

      return (
        <label htmlFor="wrap-lines">
          Wrap lines
          <Switch
            id="wrap-lines"
            checked={checked}
            onCheckedChange={setChecked}
          />
          <output>{checked ? 'enabled' : 'disabled'}</output>
        </label>
      )
    }

    render(<WrapLinesControl />)

    const wrapLines = screen.getByRole('switch', { name: 'Wrap lines' })
    expect(wrapLines.getAttribute('aria-checked')).toBe('false')

    await user.click(wrapLines)

    expect(wrapLines.getAttribute('aria-checked')).toBe('true')
    expect(screen.getByText('enabled')).not.toBeNull()
  })

  it('selects an option with the keyboard and restores trigger focus', async () => {
    const user = userEvent.setup()
    const pulls = [
      { label: 'Pull request #101', value: '101' },
      { label: 'Pull request #102', value: '102' },
    ]

    function PullSelector() {
      const [value, setValue] = useState('101')

      return (
        <Select
          items={pulls}
          value={value}
          onValueChange={(nextValue) => {
            if (nextValue) setValue(nextValue)
          }}
        >
          <SelectTrigger aria-label="Pull request">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pulls.map((pull) => (
              <SelectItem key={pull.value} value={pull.value}>
                {pull.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    }

    render(<PullSelector />)

    const trigger = screen.getByRole('combobox', { name: 'Pull request' })
    await user.click(trigger)

    expect(screen.getByRole('listbox')).not.toBeNull()
    expect(
      screen
        .getByRole('option', { name: 'Pull request #101' })
        .getAttribute('aria-selected'),
    ).toBe('true')

    await user.keyboard('{ArrowDown}{Enter}')

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).toBeNull()
    })
    expect(trigger.textContent).toContain('Pull request #102')
    expect(document.activeElement).toBe(trigger)
  })
})
