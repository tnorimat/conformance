import { promises as fs } from 'fs';
import path from 'path';
import { ConformanceCheck, SpecVersion } from '../types';
import {
  getClientScenarioForAuthorizationServer,
  matchesSpecVersion
} from '../scenarios';
import { createResultDir, formatPrettyChecks } from './utils';
import { AuthorizationServerOptions } from '../schemas';

export async function runAuthorizationServerConformanceTest(
  options: AuthorizationServerOptions,
  scenarioName: string,
  details: Record<string, unknown>,
  outputDir?: string,
  specVersion?: SpecVersion
): Promise<{
  checks: ConformanceCheck[];
  resultDir?: string;
  scenarioDescription: string;
}> {
  const scenario = getClientScenarioForAuthorizationServer(scenarioName);
  if (!scenario) {
    throw new Error(`Unknown authorization server scenario '${scenarioName}'`);
  }
  if (specVersion && !matchesSpecVersion(scenario.source, specVersion)) {
    throw new Error(
      `Authorization server scenario '${scenarioName}' is not applicable at ${specVersion}. Select a matching scenario or omit --spec-version.`
    );
  }

  let resultDir: string | undefined;

  if (outputDir) {
    resultDir = createResultDir(
      outputDir,
      scenarioName,
      'authorization-server'
    );
    await fs.mkdir(resultDir, { recursive: true });
  }

  let prerequisiteChecks: ConformanceCheck[] = [];
  if (
    options.clientId &&
    scenario.metadataScenario &&
    !details[scenario.metadataScenario]
  ) {
    const prerequisite = await runAuthorizationServerConformanceTest(
      options,
      scenario.metadataScenario,
      details,
      outputDir,
      specVersion
    );
    prerequisiteChecks = prerequisite.checks;
  }

  console.log(
    `Running client scenario for authorization server '${scenarioName}' against server: ${options.url}`
  );

  const checks = await scenario.run(options, details);
  const filtered = specVersion
    ? checks.filter(
        (c) => !c.source || matchesSpecVersion(c.source, specVersion)
      )
    : checks;

  if (filtered[0]?.status === 'SUCCESS' && filtered[0].details) {
    details[scenarioName] = filtered[0].details;
  }

  const reportedChecks = [...prerequisiteChecks, ...filtered];
  if (resultDir) {
    await fs.writeFile(
      path.join(resultDir, 'checks.json'),
      JSON.stringify(reportedChecks, null, 2)
    );

    console.log(`Results saved to ${resultDir}`);
  }

  return {
    checks: reportedChecks,
    resultDir,
    scenarioDescription: scenario.description
  };
}

export function printAuthorizationServerResults(
  checks: ConformanceCheck[],
  scenarioDescription: string,
  verbose: boolean = false
): {
  passed: number;
  failed: number;
  denominator: number;
  warnings: number;
} {
  const denominator = checks.filter(
    (c) => c.status === 'SUCCESS' || c.status === 'FAILURE'
  ).length;
  const passed = checks.filter((c) => c.status === 'SUCCESS').length;
  const failed = checks.filter((c) => c.status === 'FAILURE').length;
  const warnings = checks.filter((c) => c.status === 'WARNING').length;

  if (verbose) {
    console.log(JSON.stringify(checks, null, 2));
  } else {
    console.log(`Checks:\n${formatPrettyChecks(checks)}`);
  }

  console.log(`\nTest Results:`);
  console.log(
    `Passed: ${passed}/${denominator}, ${failed} failed, ${warnings} warnings`
  );

  if (failed > 0) {
    console.log('\n=== Failed Checks ===');
    checks
      .filter((c) => c.status === 'FAILURE')
      .forEach((c) => {
        console.log(`\n  - ${c.name}: ${c.description}`);
        if (c.errorMessage) {
          console.log(`    Error: ${c.errorMessage}`);
        }
      });
  }

  return { passed, failed, denominator, warnings };
}

export function printAuthorizationServerSummary(
  allResults: { scenario: string; checks: ConformanceCheck[] }[]
): { totalPassed: number; totalFailed: number } {
  console.log('\n\n=== SUMMARY ===');
  let totalPassed = 0;
  let totalFailed = 0;

  for (const result of allResults) {
    const passed = result.checks.filter((c) => c.status === 'SUCCESS').length;
    const failed = result.checks.filter((c) => c.status === 'FAILURE').length;
    totalPassed += passed;
    totalFailed += failed;

    const status = failed === 0 ? '✓' : '✗';
    console.log(
      `${status} ${result.scenario}: ${passed} passed, ${failed} failed`
    );
  }

  console.log(`\nTotal: ${totalPassed} passed, ${totalFailed} failed`);

  return { totalPassed, totalFailed };
}
