import { afterEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import {
  clientScenariosForAuthorizationServer,
  getClientScenarioForAuthorizationServer
} from '../scenarios';
import { ConformanceCheck } from '../types';
import { runAuthorizationServerConformanceTest } from './authorization-server';

const options = {
  url: 'https://auth.example.com',
  clientId: 'test-client',
  port: 3000
};

function check(
  id: string,
  status: ConformanceCheck['status'],
  details?: Record<string, unknown>
): ConformanceCheck {
  return {
    id,
    name: id,
    description: id,
    status,
    timestamp: new Date().toISOString(),
    details
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe.each([
  [
    '2025-11-25',
    'authorization-code-grant',
    'authorization-server-metadata-endpoint'
  ],
  [
    '2026-07-28',
    'authorization-code-grant-2026-07-28',
    'authorization-server-metadata-endpoint-2026-07-28'
  ]
] as const)(
  'authorization runner at %s',
  (version, grantName, metadataName) => {
    it('fetches matching metadata for a standalone grant and reports prerequisite warnings', async () => {
      const metadata = getClientScenarioForAuthorizationServer(metadataName)!;
      const grant = getClientScenarioForAuthorizationServer(grantName)!;
      const metadataDetails = { body: { issuer: options.url } };
      const metadataRun = vi
        .spyOn(metadata, 'run')
        .mockResolvedValue([
          check('authorization-server-metadata', 'SUCCESS', metadataDetails),
          check('authorization-server-metadata-cimd', 'WARNING')
        ]);
      const grantRun = vi
        .spyOn(grant, 'run')
        .mockImplementation(async (_options, details) => {
          expect(details[metadataName]).toEqual(metadataDetails);
          return [check('authorization-code-grant', 'SUCCESS')];
        });
      const result = await runAuthorizationServerConformanceTest(
        options,
        grantName,
        {},
        undefined,
        version
      );
      expect(metadataRun).toHaveBeenCalledOnce();
      expect(grantRun).toHaveBeenCalledOnce();
      expect(result.checks.map((c) => [c.id, c.status])).toEqual([
        ['authorization-server-metadata', 'SUCCESS'],
        ['authorization-server-metadata-cimd', 'WARNING'],
        ['authorization-code-grant', 'SUCCESS']
      ]);
    });

    it('reuses metadata from a suite run without fetching it again', async () => {
      const metadata = getClientScenarioForAuthorizationServer(metadataName)!;
      const grant = getClientScenarioForAuthorizationServer(grantName)!;
      const metadataRun = vi.spyOn(metadata, 'run');
      vi.spyOn(grant, 'run').mockResolvedValue([
        check('authorization-code-grant', 'SUCCESS')
      ]);
      const result = await runAuthorizationServerConformanceTest(
        options,
        grantName,
        { [metadataName]: { body: {} } },
        undefined,
        version
      );
      expect(metadataRun).not.toHaveBeenCalled();
      expect(result.checks).toHaveLength(1);
    });

    it('reports failed metadata as a missing prerequisite, without starting an OAuth callback', async () => {
      const metadata = getClientScenarioForAuthorizationServer(metadataName)!;
      vi.spyOn(metadata, 'run').mockResolvedValue([
        check('authorization-server-metadata', 'FAILURE')
      ]);
      const result = await runAuthorizationServerConformanceTest(
        options,
        grantName,
        {},
        undefined,
        version
      );
      expect(result.checks).toHaveLength(2);
      expect(result.checks[1].status).toBe('FAILURE');
      expect(result.checks[1].errorMessage).toContain(metadataName);
      expect(result.checks[1].details?.untestable).toBe(true);
    });

    it('persists check IDs and statuses for the selected scenario', async () => {
      const metadata = getClientScenarioForAuthorizationServer(metadataName)!;
      const checks = [
        check('authorization-server-metadata', 'SUCCESS', { body: {} })
      ];
      vi.spyOn(metadata, 'run').mockResolvedValue(checks);
      const outputDir = await fs.mkdtemp(
        path.join(os.tmpdir(), 'authz-conformance-')
      );
      try {
        const result = await runAuthorizationServerConformanceTest(
          options,
          metadataName,
          {},
          outputDir,
          version
        );
        const saved = JSON.parse(
          await fs.readFile(
            path.join(result.resultDir!, 'checks.json'),
            'utf-8'
          )
        );
        expect(saved).toEqual(checks);
        expect(result.resultDir).toContain(metadataName);
      } finally {
        await fs.rm(outputDir, { recursive: true, force: true });
      }
    });
  }
);

it.each([
  ['authorization-code-grant', '2026-07-28'],
  ['authorization-code-grant-2026-07-28', '2025-11-25']
] as const)(
  'rejects %s at %s before running the scenario',
  async (name, version) => {
    const run = vi.spyOn(
      clientScenariosForAuthorizationServer.get(name)!,
      'run'
    );
    await expect(
      runAuthorizationServerConformanceTest(
        options,
        name,
        {},
        undefined,
        version
      )
    ).rejects.toThrow('not applicable');
    expect(run).not.toHaveBeenCalled();
  }
);
