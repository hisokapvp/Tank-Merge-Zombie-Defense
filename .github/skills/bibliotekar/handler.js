#!/usr/bin/env node
/**
 * handler.js — валидатор JSON-ответов "Библиотекаря" по JSON Schema.
 *
 * Usage:
 *   node handler.js path/to/output.json
 *   node handler.js path/to/output.json --schema references/schema-output.json
 *   node handler.js path/to/output.json --report json
 *
 * Exit codes:
 *   0 - валидно
 *   1 - невалидно / ошибка чтения
 */
const fs = require("fs");
const path = require("path");
const Ajv = require("ajv");

function parseArgs(argv) {
  const args = { jsonPath: null, schemaPath: "references/schema-output.json", report: "text" };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (!args.jsonPath && !a.startsWith("--")) {
      args.jsonPath = a;
      continue;
    }
    if (a === "--schema") {
      args.schemaPath = rest[i + 1];
      i++;
      continue;
    }
    if (a === "--report") {
      args.report = rest[i + 1] || "text";
      i++;
      continue;
    }
  }
  return args;
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.jsonPath) {
    console.error("Usage: node handler.js <output.json> [--schema <schema.json>] [--report text|json]");
    process.exit(1);
  }

  const absJson = path.resolve(process.cwd(), args.jsonPath);
  const absSchema = path.resolve(process.cwd(), args.schemaPath);

  let data;
  let schema;
  try {
    data = readJson(absJson);
  } catch (e) {
    console.error("Failed to read/parse JSON:", absJson);
    console.error(String(e));
    process.exit(1);
  }

  try {
    schema = readJson(absSchema);
  } catch (e) {
    console.error("Failed to read/parse schema:", absSchema);
    console.error(String(e));
    process.exit(1);
  }

  const ajv = new Ajv({ allErrors: true, strict: true, allowUnionTypes: true });
  const validate = ajv.compile(schema);
  const ok = validate(data);

  if (ok) {
    if (args.report !== "json") console.log("OK");
    process.exit(0);
  }

  if (args.report === "json") {
    console.log(JSON.stringify({ ok: false, errors: validate.errors }, null, 2));
  } else {
    console.error("INVALID");
    (validate.errors || []).forEach((err) => {
      const where = err.instancePath ? `at ${err.instancePath}` : "at <root>";
      console.error(`- ${where}: ${err.message}`);
      if (err.params) console.error(`  params: ${JSON.stringify(err.params)}`);
    });
  }
  process.exit(1);
}

main();
