import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LocalLibraryItem, Project, RenderJob } from './types';

const KEYS = {
  library: 'sunodown:v24react:library',
  projects: 'sunodown:v24react:projects',
  jobs: 'sunodown:v24react:jobs',
  preset: 'sunodown:v24react:preset',
};

async function read<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function write<T>(key: string, value: T) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export const storage = {
  getLibrary: () => read<LocalLibraryItem[]>(KEYS.library, []),
  setLibrary: (value: LocalLibraryItem[]) => write(KEYS.library, value),
  getProjects: () => read<Project[]>(KEYS.projects, []),
  setProjects: (value: Project[]) => write(KEYS.projects, value),
  getJobs: () => read<RenderJob[]>(KEYS.jobs, []),
  setJobs: (value: RenderJob[]) => write(KEYS.jobs, value),
  getPreset: () => read<string>(KEYS.preset, 'cinematic'),
  setPreset: (value: string) => write(KEYS.preset, value),
};
