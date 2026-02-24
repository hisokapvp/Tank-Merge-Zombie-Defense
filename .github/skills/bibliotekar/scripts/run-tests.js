#!/usr/bin/env node
/**
 * scripts/run-tests.js — регрессионный прогон fixtures.
 *
 * Ожидания:
 *   fixtures/valid_*.json   -> должны валидироваться
 *   fixtures/invalid_*.json -> должны НЕ валидироваться
 */
const fs = require("fs");
const path = require("path");
const Ajv = require("ajv");

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function main() {
  const repoRoot = path.resolve(__dirname, "..");
  const schemaPath = path.join(repoRoot, "references", "schema-output.json");
  const fixtureDir = path.join(repoRoot, "fixtures");

  const schema = readJson(schemaPath);
  const ajv = new Ajv({ allErrors: true, strict: true, allowUnionTypes: true });
  const validate = ajv.compile(schema);

  const files = fs.readdirSync(fixtureDir).filter((f) => f.endsWith(".json")).sort();
  if (files.length === 0) {
    console.error("No fixtures found.");
    process.exit(1);
  }

  let pass = 0;
  let fail = 0;

  for (const f of files) {
    const full = path.join(fixtureDir, f);
    const data = readJson(full);
    const expectedValid = f.startsWith("valid_");
    const ok = validate(data);

    const good = expectedValid ? ok : !ok;
    if (good) {
      pass++;
      console.log(`PASS ${f}`);
    } else {
      fail++;
      console.error(`FAIL ${f} (expected ${expectedValid ? "valid" : "invalid"})`);
      if (validate.errors) console.error(JSON.stringify(validate.errors, null, 2));
    }
  }

  console.log(`\nSummary: pass=${pass}, fail=${fail}`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
