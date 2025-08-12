import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock image imports used by the component
vi.mock('@assets/Grapevine Logo_1752103516040.png', () => ({ default: 'mock-logo.png' }), { virtual: true });

import SearchInterface from '@/components/search-interface';

// Helpers
const flushTimers = async () => {
  await act(async () => {
    vi.advanceTimersByTime(200);
  });
};

const flushMicrotasks = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe('SearchInterface bio Read more toggle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Minimal wouter location stub used inside component
    (global as any).location = { pathname: '/' };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows Read more and expands/collapses bio without selecting the artist', async () => {
    const longBio = 'Taylor Swift is a highly acclaimed singer-songwriter known for her versatile music that spans multiple genres. She began her career in country and evolved into pop and indie folk, earning widespread recognition and numerous awards along the way.';

    const fakeResults = [
      { id: 'tswift', artistId: '123', name: 'Taylor Swift', bio: longBio }
    ];

    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => fakeResults,
    })) as any);

    const onNetworkData = vi.fn();

    render(
      <SearchInterface
        onNetworkData={onNetworkData}
        showNetworkView={false}
      />
    );

    const [homeInput] = screen.getAllByPlaceholderText('Search any artist to explore their network...');
    await userEvent.type(homeInput, 'Taylor');
    await flushTimers();
    await flushMicrotasks();
    await act(async () => { vi.runOnlyPendingTimers(); });

    // Wait for result item to appear
    await screen.findByText('Taylor Swift');

    // Should show result card with truncated bio and Read more
    const readMore = await screen.findByRole('button', { name: /read more/i });
    expect(readMore).toBeInTheDocument();

    // Click Read more should not trigger selection/network fetch
    await userEvent.click(readMore);
    expect(onNetworkData).not.toHaveBeenCalled();

    // Now button should toggle to Show less
    const showLess = await screen.findByRole('button', { name: /show less/i });
    expect(showLess).toBeInTheDocument();

    // Collapse again
    await userEvent.click(showLess);
    expect(onNetworkData).not.toHaveBeenCalled();
  }, 10000);
});


