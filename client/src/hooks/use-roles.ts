import { useCallback, useMemo, useRef, useState } from 'react';
import { NetworkNode } from '@/types/network';

type Role = 'artist' | 'producer' | 'songwriter';

export interface RolesMap {
  [name: string]: Role[];
}

interface UseRolesOptions {
  autoFetch?: boolean;
}

interface UseRolesReturn {
  isLoading: boolean;
  roles: RolesMap;
  error: string | null;
  fetchRolesForNodes: (nodes: NetworkNode[]) => Promise<RolesMap>;
}

export function useRoles(options: UseRolesOptions = {}): UseRolesReturn {
  const { autoFetch = true } = options;
  const [isLoading, setIsLoading] = useState(false);
  const [roles, setRoles] = useState<RolesMap>({});
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef<Promise<RolesMap> | null>(null);

  const fetchRolesForNodes = useCallback(async (nodes: NetworkNode[]): Promise<RolesMap> => {
    const names = Array.from(
      new Set(
        nodes
          .filter(n => !Array.isArray(n.types) || n.types.length === 0)
          .map(n => n.name)
          .filter(Boolean)
      )
    );

    if (names.length === 0) {
      return roles;
    }

    // Prevent duplicate concurrent requests
    if (inFlightRef.current) return inFlightRef.current;

    setIsLoading(true);
    setError(null);

    const promise = (async () => {
      try {
        const resp = await fetch('/api/network-roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ names }),
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data: { roles: RolesMap } = await resp.json();
        const next = { ...roles, ...(data.roles || {}) };
        setRoles(next);
        return next;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        setError(msg);
        return roles;
      } finally {
        setIsLoading(false);
        inFlightRef.current = null;
      }
    })();

    inFlightRef.current = promise;
    return promise;
  }, [roles]);

  return { isLoading, roles, error, fetchRolesForNodes };
}


