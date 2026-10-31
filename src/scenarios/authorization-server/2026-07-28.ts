import { ScenarioSource } from '../../types';
import { AuthorizationServerMetadataEndpointScenario } from './authorization-server-metadata';
import { AuthorizationCodeGrantScenario } from './authorization-code-grant';

export class AuthorizationServerMetadata20260728Scenario extends AuthorizationServerMetadataEndpointScenario {
  override name = 'authorization-server-metadata-endpoint-2026-07-28';
  override readonly source: ScenarioSource = {
    introducedIn: '2026-07-28'
  };
  constructor() {
    super();
    this.description =
      'WIP MCP 2026-07-28 authorization-server metadata scenario. Reuses the existing 2025-11-25 checks unchanged; does not yet validate new 2026-07-28 requirements.\n\n' +
      this.description;
  }
}

export class AuthorizationCodeGrant20260728Scenario extends AuthorizationCodeGrantScenario {
  override name = 'authorization-code-grant-2026-07-28';
  override readonly source: ScenarioSource = {
    introducedIn: '2026-07-28'
  };
  override readonly metadataScenario =
    'authorization-server-metadata-endpoint-2026-07-28';
  constructor() {
    super();
    this.description =
      'WIP MCP 2026-07-28 authorization-code-grant scenario. Reuses the existing 2025-11-25 checks unchanged; does not yet validate new 2026-07-28 requirements.\n\n' +
      this.description;
  }
}
