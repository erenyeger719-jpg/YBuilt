const fs = require('fs');
const path = require('path');

const COVERAGE_THRESHOLD = 80;

try {
  const summaryPath = path.join(process.cwd(), 'coverage/coverage-summary.json');
  
  if (!fs.existsSync(summaryPath)) {
    console.error('Coverage summary not found at:', summaryPath);
    process.exit(1);
  }
  
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  const total = summary.total;
  
  const metrics = {
    statements: total.statements.pct,
    branches: total.branches.pct,
    functions: total.functions.pct,
    lines: total.lines.pct
  };
  
  console.log('Coverage Summary:');
  console.log(`  Statements: ${metrics.statements}%`);
  console.log(`  Branches: ${metrics.branches}%`);
  console.log(`  Functions: ${metrics.functions}%`);
  console.log(`  Lines: ${metrics.lines}%`);
  
  const failedMetrics = Object.entries(metrics).filter(([_, pct]) => pct < COVERAGE_THRESHOLD);
  
  if (failedMetrics.length > 0) {
    console.error(`\n❌ Coverage check failed! Threshold: ${COVERAGE_THRESHOLD}%`);
    failedMetrics.forEach(([metric, pct]) => {
      console.error(`  ${metric}: ${pct}% < ${COVERAGE_THRESHOLD}%`);
    });
    process.exit(1);
  }
  
  console.log(`\n✅ Coverage check passed! All metrics >= ${COVERAGE_THRESHOLD}%`);
  process.exit(0);
} catch (error) {
  console.error('Error checking coverage:', error.message);
  process.exit(1);
}
