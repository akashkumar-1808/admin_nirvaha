#!/usr/bin/env node

/**
 * Nirvaha Admin E2E Test Suite Runner
 * Executes Tier 1-4 opaque-box tests covering Events, Experiences, and Bookings.
 * Run directly via: node tests/e2e/runner.mjs
 */

import { runTier1Tests } from './tier1_feature_coverage.test.mjs';
import { runTier2Tests } from './tier2_boundary_corner.test.mjs';
import { runTier3Tests } from './tier3_cross_feature.test.mjs';
import { runTier4Tests } from './tier4_real_world_scenarios.test.mjs';

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m'
};

class TestReporter {
  constructor() {
    this.currentSuite = '';
    this.passed = 0;
    this.failed = 0;
    this.failures = [];
    this.suiteStats = [];
    this.startTime = Date.now();
  }

  suite(name) {
    this.currentSuite = name;
    this.suiteStats.push({ name, passed: 0, failed: 0 });
    console.log(`\n${colors.bold}${colors.cyan}=== ${name} ===${colors.reset}\n`);
  }

  log(msg) {
    console.log(`${colors.gray}${msg}${colors.reset}`);
  }

  async test(name, fn) {
    const activeSuite = this.suiteStats[this.suiteStats.length - 1];
    const t0 = Date.now();
    try {
      await fn();
      const duration = Date.now() - t0;
      this.passed += 1;
      if (activeSuite) activeSuite.passed += 1;
      console.log(`  ${colors.green}✔ PASS${colors.reset} ${name} ${colors.dim}(${duration}ms)${colors.reset}`);
    } catch (err) {
      const duration = Date.now() - t0;
      this.failed += 1;
      if (activeSuite) activeSuite.failed += 1;
      this.failures.push({ suite: this.currentSuite, test: name, error: err, duration });
      console.log(`  ${colors.red}✖ FAIL${colors.reset} ${name} ${colors.dim}(${duration}ms)${colors.reset}`);
      console.log(`    ${colors.red}${err.message}${colors.reset}`);
      if (err.stack) {
        const stackLines = err.stack.split('\n').slice(1, 4).join('\n');
        console.log(`    ${colors.gray}${stackLines}${colors.reset}`);
      }
    }
  }

  summary() {
    const totalTime = Date.now() - this.startTime;
    console.log(`\n${colors.bold}====================================================${colors.reset}`);
    console.log(`${colors.bold}              NIRVAHA E2E TEST SUMMARY              ${colors.reset}`);
    console.log(`${colors.bold}====================================================${colors.reset}\n`);

    console.log(`${colors.bold}Tier Breakdown:${colors.reset}`);
    for (const s of this.suiteStats) {
      const statusColor = s.failed === 0 ? colors.green : colors.red;
      console.log(`  ${s.name.padEnd(55)} ${statusColor}${s.passed} passed, ${s.failed} failed${colors.reset}`);
    }

    console.log(`\n${colors.bold}Total Execution Time:${colors.reset} ${totalTime}ms`);
    console.log(`${colors.bold}Total Tests Run:${colors.reset}      ${this.passed + this.failed}`);
    console.log(`${colors.bold}Passed:${colors.reset}              ${colors.green}${this.passed}${colors.reset}`);
    console.log(`${colors.bold}Failed:${colors.reset}              ${this.failed === 0 ? colors.green + '0' : colors.red + this.failed}${colors.reset}\n`);

    if (this.failures.length > 0) {
      console.log(`${colors.red}${colors.bold}Failures (${this.failures.length}):${colors.reset}`);
      this.failures.forEach((f, idx) => {
        console.log(`  ${idx + 1}) [${f.suite}] ${f.test}`);
        console.log(`     Error: ${f.error.message}\n`);
      });
      return false;
    } else {
      console.log(`${colors.green}${colors.bold}🎉 ALL E2E TEST SUITES PASSED CLEANLY (100% SUCCESS)${colors.reset}\n`);
      return true;
    }
  }
}

async function main() {
  const reporter = new TestReporter();
  const args = process.argv.slice(2);
  const tierFilter = args.find(a => a.startsWith('--tier='));
  const tier = tierFilter ? tierFilter.split('=')[1] : null;

  console.log(`${colors.bold}${colors.magenta}Starting Nirvaha E2E Test Suite Execution...${colors.reset}`);
  console.log(`${colors.dim}Target: Events, Experiences & Bookings Management Modules${colors.reset}`);

  try {
    if (!tier || tier === '1') {
      await runTier1Tests(reporter);
    }
    if (!tier || tier === '2') {
      await runTier2Tests(reporter);
    }
    if (!tier || tier === '3') {
      await runTier3Tests(reporter);
    }
    if (!tier || tier === '4') {
      await runTier4Tests(reporter);
    }

    const success = reporter.summary();
    process.exit(success ? 0 : 1);
  } catch (fatal) {
    console.error(`\n${colors.red}${colors.bold}FATAL ERROR IN TEST RUNNER:${colors.reset}`, fatal);
    process.exit(1);
  }
}

main();
