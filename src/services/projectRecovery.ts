import type { ProjectLayerData, ProjectProjection } from '@/types/project';
import { parseProjectJSON } from '@/domain/layers';

const DRAFT_KEY = 'geochase_unassigned_work';

export interface RecoverySource {
  key: string;
  name: string;
  data: ProjectLayerData;
  projection: ProjectProjection;
}

/** Read known historical formats without modifying or deleting their source. */
export function getRecoverySources(): RecoverySource[] {
  const sources: RecoverySource[] = [];
  function add(key: string, value: unknown) {
    try {
      const parsed = parseProjectJSON(JSON.stringify(value));
      const name =
        typeof (value as { name?: unknown })?.name === 'string'
          ? (value as { name: string }).name
          : '';
      sources.push({ key, name, ...parsed });
    } catch {
      // An unreadable source remains untouched, including when others are recoverable.
    }
  }
  const draft = localStorage.getItem(DRAFT_KEY);
  if (draft) {
    try {
      add(DRAFT_KEY, JSON.parse(draft));
    } catch {
      /* Preserve the raw source. */
    }
    if (sources.length > 0) return sources;
  }
  for (const key of ['geochase_projects', 'geosketch_projects']) {
    try {
      const projects: unknown = JSON.parse(localStorage.getItem(key) || '[]');
      if (Array.isArray(projects))
        for (const [index, project] of projects.entries()) add(`${key}:${index}`, project);
    } catch {
      /* Preserve the raw source. */
    }
  }
  try {
    const coordinates: unknown = JSON.parse(
      localStorage.getItem('geosketch_savedCoordinates') || '[]'
    );
    if (Array.isArray(coordinates) && coordinates.length > 0) {
      add('geosketch_savedCoordinates', { savedCoordinates: coordinates });
    }
  } catch {
    /* Preserve the raw source. */
  }
  return sources;
}

export function saveUnassignedWork(data: ProjectLayerData, projection: ProjectProjection): void {
  localStorage.setItem(DRAFT_KEY, JSON.stringify({ data, projection }));
}

export function clearUnassignedWork(): void {
  localStorage.removeItem(DRAFT_KEY);
}

/** Keep the original bytes, even for malformed data the current reader cannot parse. */
export function backupRecoverySources(): void {
  const backupKey = 'geochase_recovery_backup_v1';
  if (localStorage.getItem(backupKey)) return;
  const backup: Record<string, string> = {};
  for (const key of [
    'geochase_projects',
    'geosketch_projects',
    'geosketch_savedCoordinates',
    DRAFT_KEY,
  ]) {
    const raw = localStorage.getItem(key);
    if (raw !== null) backup[key] = raw;
  }
  if (Object.keys(backup).length > 0) localStorage.setItem(backupKey, JSON.stringify(backup));
}
