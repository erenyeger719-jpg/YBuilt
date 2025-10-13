/** @type {import('@stryker-mutator/core').PartialStrykerOptions} */
const config = {
  packageManager: "npm",
  reporters: ["html", "clear-text", "progress"],
  testRunner: "command",
  commandRunner: {
    command: "npm run test:unit"
  },
  coverageAnalysis: "perTest",
  mutate: [
    "server/**/*.ts",
    "!server/**/*.test.ts",
    "!server/**/index.ts"
  ]
};
export default config;
