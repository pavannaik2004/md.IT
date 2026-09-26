import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback } from 'react';
import { listDocuments } from './documents';
import { listFolders } from './folders';
import { getProject, listProjectSummaries } from './projects';
import { getSetting, setSetting } from './settings';

export function useProjectSummaries() {
  return useLiveQuery(() => listProjectSummaries(), []);
}

/** undefined while loading; null when the project is not stored in this browser. */
export function useProject(id: string | undefined) {
  return useLiveQuery(async () => (id ? getProject(id) : null), [id]);
}

export function useFolders(projectId: string) {
  return useLiveQuery(() => listFolders(projectId), [projectId]);
}

export function useDocuments(projectId: string) {
  return useLiveQuery(() => listDocuments(projectId), [projectId]);
}

/** Pass primitive fallbacks only; the fallback is not a dependency of the query. */
export function useSetting<T>(key: string, fallback: T): T | undefined {
  return useLiveQuery(() => getSetting(key, fallback), [key]);
}

export function useSettingState<T>(key: string, fallback: T): [T, (value: T) => void] {
  const value = useSetting(key, fallback);
  const set = useCallback((next: T) => {
    void setSetting(key, next);
  }, [key]);
  return [value ?? fallback, set];
}
