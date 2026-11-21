import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { Json, KeyValues } from './Code';
import { CopyButton } from './CopyButton';
import { Header } from './Header';
import { ThemeToggle } from './ThemeToggle';
import { Toast, Toasts } from './Toast';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Json', () => {
  it('writes a value out as indented lines', () => {
    const { container } = render(
      <Json value={{ data: { id: 'abc', count: 2, tags: [], auth0: null } }} />,
    );
    const lines = [...container.querySelectorAll('.json-line')].map((line) => line.textContent);
    expect(lines).toEqual([
      '{',
      '"data": {',
      '"id": "abc",',
      '"count": 2,',
      '"tags": [],',
      '"auth0": null',
      '}',
      '}',
    ]);
  });

  it('escapes strings the way JSON does', () => {
    render(<Json value={{ name: 'a "quoted" name' }} />);
    expect(screen.getByText('"a \\"quoted\\" name"')).toBeInTheDocument();
  });
});

describe('KeyValues', () => {
  it('leaves out a row that has no value', () => {
    render(<KeyValues rows={[['provider', 'oidc'], ['email', undefined]]} />);
    expect(screen.getByText('provider')).toBeInTheDocument();
    expect(screen.queryByText('email')).not.toBeInTheDocument();
  });
});

describe('Toast', () => {
  it('closes after its duration and not before', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(
      <Toasts>
        <Toast actionLabel="Undo" onAction={vi.fn()} onClose={onClose} duration={5000}>
          Deleted
        </Toast>
      </Toasts>,
    );

    act(() => void vi.advanceTimersByTime(4999));
    expect(onClose).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(1));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stops the clock while the pointer is on it', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(
      <Toast actionLabel="Undo" onAction={vi.fn()} onClose={onClose} duration={5000}>
        Deleted
      </Toast>,
    );
    const toast = screen.getByText('Deleted').parentElement!;

    fireEvent.mouseEnter(toast);
    act(() => void vi.advanceTimersByTime(20000));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.mouseLeave(toast);
    act(() => void vi.advanceTimersByTime(5000));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('runs its action', () => {
    const onAction = vi.fn();
    render(
      <Toast actionLabel="Undo" onAction={onAction} onClose={vi.fn()}>
        Deleted
      </Toast>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});

describe('CopyButton', () => {
  it('writes the value to the clipboard and says so', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    render(<CopyButton value="TENANT#demo" label="Copy the key" />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy the key' }));

    expect(writeText).toHaveBeenCalledWith('TENANT#demo');
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });
});

describe('ThemeToggle', () => {
  it('names the theme a press will switch to and follows data-theme', async () => {
    const { unmount } = render(<ThemeToggle />);
    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument();

    // The observer reports on a microtask, so the change is made inside act.
    await act(async () => {
      document.documentElement.setAttribute('data-theme', 'dark');
      await Promise.resolve();
    });
    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument();

    unmount();
    document.documentElement.removeAttribute('data-theme');
  });
});

describe('Header', () => {
  it('marks the current site and opens documentation links in a new tab', () => {
    render(
      <Header
        sites={[
          { label: '603.nz', href: 'https://603.nz' },
          { label: 'Reference Architecture', href: '/', current: true },
        ]}
        links={[{ label: 'GitHub', href: 'https://github.com/jch254/reference-architecture', external: true }]}
      />,
    );
    expect(screen.getByRole('link', { name: 'Reference Architecture' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('link', { name: '603.nz' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'GitHub' })).toHaveAttribute('target', '_blank');
  });
});
