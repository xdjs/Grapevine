import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useNetworkData } from './use-network-data';
import { NetworkData } from '@/types/network';

const baseData: NetworkData = {
  nodes: [
    { id: 'Main', name: 'Main', type: 'artist', size: 30 },
    { id: 'A', name: 'A', type: 'artist', size: 20 },
  ],
  links: [
    { source: 'Main', target: 'A' },
  ],
};

function mockNetworkResponse(forId: string, neighbors: string[]): NetworkData {
  const nodes = [{ id: forId, name: forId, type: 'artist', size: 20 }].concat(
    neighbors.map(n => ({ id: n, name: n, type: 'artist', size: 16 }))
  );
  const links = neighbors.map(n => ({ source: forId, target: n }));
  return { nodes, links };
}

describe('useNetworkData expandNodeNetwork', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('adds up to three neighbors and only links to the clicked node', async () => {
    // Mock fetch to return a collaborator network with many neighbors
    vi.spyOn(global, 'fetch' as any).mockResolvedValue({
      ok: true,
      json: async () => mockNetworkResponse('A', ['B', 'C', 'D', 'E']),
    } as any);

    const { result } = renderHook(() => useNetworkData({ data: baseData }));

    await act(async () => {
      await result.current.expandNodeNetwork('A', 'A');
    });

    const full = result.current.fullNetworkData!;
    // A, B, C, D at minimum (E ignored to cap at 3)
    expect(full.nodes.some(n => n.id === 'B')).toBe(true);
    expect(full.nodes.some(n => n.id === 'C')).toBe(true);
    expect(full.nodes.some(n => n.id === 'D')).toBe(true);
    expect(full.nodes.some(n => n.id === 'E')).toBe(false);

    // Links only between A and the selected neighbors
    expect(full.links.every(l => (l.source === 'A' && ['B', 'C', 'D'].includes(l.target as string)) ||
                                 (l.target === 'A' && ['B', 'C', 'D'].includes(l.source as string)))).toBe(true);
  });

  it('prevents duplicate expansions via concurrency guard', async () => {
    // Delay to simulate in-flight request
    let resolveFn: (() => void) | null = null;
    vi.spyOn(global, 'fetch' as any).mockReturnValue(new Promise(resolve => {
      resolveFn = () => resolve({ ok: true, json: async () => mockNetworkResponse('A', ['B']) } as any);
    }));

    const { result } = renderHook(() => useNetworkData({ data: baseData }));

    // Fire two expansions rapidly
    const p1 = result.current.expandNodeNetwork('A', 'A');
    const p2 = result.current.expandNodeNetwork('A', 'A');

    resolveFn && resolveFn();
    await act(async () => { await Promise.all([p1, p2]); });

    const full = result.current.fullNetworkData!;
    // Only one neighbor added
    expect(full.nodes.some(n => n.id === 'B')).toBe(true);
  });

  it('does not duplicate links after repeated expansions', async () => {
    const fetchMock = vi.spyOn(global, 'fetch' as any);
    // First expansion returns neighbors B, C, D
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => mockNetworkResponse('A', ['B', 'C', 'D'])
    } as any);
    // Second expansion returns neighbors C, D, E (overlap with previous)
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => mockNetworkResponse('A', ['C', 'D', 'E'])
    } as any);

    const { result } = renderHook(() => useNetworkData({ data: baseData }));

    await act(async () => {
      await result.current.expandNodeNetwork('A', 'A');
    });
    const afterFirst = result.current.fullNetworkData!;
    const linkKeysAfterFirst = new Set(
      afterFirst.links.map(l => {
        const s = typeof l.source === 'string' ? l.source : (l.source as any).id;
        const t = typeof l.target === 'string' ? l.target : (l.target as any).id;
        const a = s.toLowerCase();
        const b = t.toLowerCase();
        return a < b ? `${a}|${b}` : `${b}|${a}`;
      })
    );

    await act(async () => {
      await result.current.expandNodeNetwork('A', 'A');
    });
    const afterSecond = result.current.fullNetworkData!;
    const linkKeysAfterSecond = new Set(
      afterSecond.links.map(l => {
        const s = typeof l.source === 'string' ? l.source : (l.source as any).id;
        const t = typeof l.target === 'string' ? l.target : (l.target as any).id;
        const a = s.toLowerCase();
        const b = t.toLowerCase();
        return a < b ? `${a}|${b}` : `${b}|${a}`;
      })
    );

    // No duplicates: size should be equal to number of links stored
    expect(linkKeysAfterSecond.size).toBe(afterSecond.links.length);
    // E should be added after second expansion
    expect(afterSecond.nodes.some(n => n.id === 'E')).toBe(true);
  });

  it('expanding the same node twice sequentially does not add extra neighbors beyond available', async () => {
    const fetchMock = vi.spyOn(global, 'fetch' as any);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => mockNetworkResponse('A', ['B', 'C'])
    } as any);

    const { result } = renderHook(() => useNetworkData({ data: baseData }));

    await act(async () => {
      await result.current.expandNodeNetwork('A', 'A');
    });
    const afterFirst = result.current.fullNetworkData!;

    await act(async () => {
      await result.current.expandNodeNetwork('A', 'A');
    });
    const afterSecond = result.current.fullNetworkData!;

    // No new nodes added on second call (since only B and C are available)
    expect(afterSecond.nodes.length).toBe(afterFirst.nodes.length);
    expect(afterSecond.links.length).toBe(afterFirst.links.length);
  });

  it('should reset to first degree network when resetToFirstDegree is called', async () => {
    const { result } = renderHook(() => useNetworkData({ data: baseData }));

    // Initially should be in first-degree mode
    expect(result.current.isExpandedMode).toBe(false);
    expect(result.current.fullNetworkData).toBeNull();

    // Expand a node
    await result.current.expandNodeNetwork('A', 'A');
    
    // Should now be in expanded mode
    expect(result.current.isExpandedMode).toBe(true);
    expect(result.current.fullNetworkData).not.toBeNull();

    // Reset to first degree
    result.current.resetToFirstDegree();

    // Should be back to first-degree mode
    expect(result.current.isExpandedMode).toBe(false);
    expect(result.current.fullNetworkData).toBeNull();
    expect(result.current.expandedNodes.size).toBe(0);
  });
});


