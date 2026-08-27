import localVersion from '@/public/version.json';
import { requireAuth } from '@/lib/auth';
import { compareVersions, VERSION_PATTERN } from '@/lib/version';

const REPOSITORY_URL = 'https://github.com/01121531/zahngdan';
const REMOTE_MANIFEST_URL = 'https://raw.githubusercontent.com/01121531/zahngdan/main/public/version.json';

type VersionManifest = { version: string; publishedAt?: string; summary?: string };

export async function GET(request: Request) {
  const unauthorized = await requireAuth(request);
  if (unauthorized) return unauthorized;

  let latest: VersionManifest | null = null;
  try {
    const response = await fetch(REMOTE_MANIFEST_URL, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    if (response.ok) {
      const candidate = await response.json() as VersionManifest;
      if (VERSION_PATTERN.test(candidate.version)) latest = candidate;
    }
  } catch {
    latest = null;
  }

  return Response.json({
    currentVersion: localVersion.version,
    latestVersion: latest?.version ?? null,
    publishedAt: latest?.publishedAt ?? null,
    summary: latest?.summary ?? null,
    updateAvailable: latest ? compareVersions(latest.version, localVersion.version) > 0 : false,
    repositoryUrl: REPOSITORY_URL,
  });
}
