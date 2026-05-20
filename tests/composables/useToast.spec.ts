import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useToast } from '@/composables/useToast';

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    const { messages, dismiss } = useToast();
    for (const m of [...messages.value]) dismiss(m.id);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('show adds a message and auto-removes it after the default duration', () => {
    const { messages, show } = useToast();
    show('Hello');
    expect(messages.value.map((m) => m.text)).toEqual(['Hello']);
    vi.advanceTimersByTime(3000);
    expect(messages.value).toEqual([]);
  });

  it('show respects a custom duration', () => {
    const { messages, show } = useToast();
    show('Hi', 500);
    vi.advanceTimersByTime(499);
    expect(messages.value).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(messages.value).toEqual([]);
  });

  it('caps the stack to 3 messages (oldest evicted)', () => {
    const { messages, show } = useToast();
    show('a');
    show('b');
    show('c');
    show('d');
    expect(messages.value.map((m) => m.text)).toEqual(['b', 'c', 'd']);
  });

  it('dismiss removes the message before the timeout fires', () => {
    const { messages, show, dismiss } = useToast();
    const id = show('to-be-killed', 5000);
    dismiss(id);
    expect(messages.value).toEqual([]);
    vi.advanceTimersByTime(5000);
    expect(messages.value).toEqual([]);
  });
});
