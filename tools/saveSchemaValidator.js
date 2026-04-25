/**
 * tools/saveSchemaValidator.js — zero-dependency validator для assets/saveSchema.json.
 *
 * Поддерживает подмножество JSON Schema 2020-12, достаточное для текущей save-схемы:
 *   type (включая массивы типов), required, properties, additionalProperties (true|false|schema),
 *   items, minimum, maximum, minLength, pattern, enum, oneOf, additionalProperties=schema.
 *
 * Используется как:
 *   - CI-скрипт ci/check_save_schema.sh (см. main()).
 *   - Fail-soft hook в src/persistence/storage.js (см. validatePayload()).
 *   - Внешний save-inspector (можно node-load и звать validatePayload(payload, schema)).
 *
 * Не тянет ajv / любые npm-зависимости — TMZD остаётся no-bundler / no-npm проектом.
 */
'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SaveSchemaValidator = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {

  function isPlainObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }

  function typeOf(v) {
    if (v === null) return 'null';
    if (Array.isArray(v)) return 'array';
    if (Number.isInteger(v)) return 'integer';
    if (typeof v === 'number') return 'number';
    return typeof v;
  }

  function matchesType(typeSpec, value) {
    if (typeSpec == null) return true;
    var t = typeOf(value);
    if (Array.isArray(typeSpec)) {
      for (var i = 0; i < typeSpec.length; i++) {
        if (matchesSingleType(typeSpec[i], value, t)) return true;
      }
      return false;
    }
    return matchesSingleType(typeSpec, value, t);
  }

  function matchesSingleType(typeName, value, t) {
    if (typeName === 'integer') return t === 'integer';
    if (typeName === 'number') return t === 'number' || t === 'integer';
    if (typeName === 'object') return t === 'object';
    if (typeName === 'array') return t === 'array';
    if (typeName === 'string') return t === 'string';
    if (typeName === 'boolean') return t === 'boolean';
    if (typeName === 'null') return value === null;
    return false;
  }

  function pushErr(errors, path, message) {
    errors.push({ path: path || '$', message: message });
  }

  function validateValue(value, schema, path, errors) {
    if (!schema || typeof schema !== 'object') return;

    if (schema.type != null && !matchesType(schema.type, value)) {
      pushErr(errors, path, 'expected type ' + JSON.stringify(schema.type) + ', got ' + typeOf(value));
      return;
    }

    if (Array.isArray(schema.enum)) {
      var matched = false;
      for (var i = 0; i < schema.enum.length; i++) {
        if (schema.enum[i] === value) { matched = true; break; }
      }
      if (!matched) pushErr(errors, path, 'value not in enum');
    }

    if (Array.isArray(schema.oneOf)) {
      var passes = 0;
      for (var k = 0; k < schema.oneOf.length; k++) {
        var subErrs = [];
        validateValue(value, schema.oneOf[k], path, subErrs);
        if (subErrs.length === 0) passes++;
      }
      if (passes !== 1) pushErr(errors, path, 'expected exactly one oneOf branch, got ' + passes);
    }

    var t = typeOf(value);

    if (t === 'number' || t === 'integer') {
      if (typeof schema.minimum === 'number' && value < schema.minimum) pushErr(errors, path, 'below minimum ' + schema.minimum);
      if (typeof schema.maximum === 'number' && value > schema.maximum) pushErr(errors, path, 'above maximum ' + schema.maximum);
    }

    if (t === 'string') {
      if (typeof schema.minLength === 'number' && value.length < schema.minLength) pushErr(errors, path, 'below minLength ' + schema.minLength);
      if (typeof schema.pattern === 'string') {
        try {
          if (!new RegExp(schema.pattern).test(value)) pushErr(errors, path, 'does not match pattern ' + schema.pattern);
        } catch (_) { /* invalid regex in schema — ignore */ }
      }
    }

    if (t === 'array' && schema.items) {
      for (var ai = 0; ai < value.length; ai++) {
        validateValue(value[ai], schema.items, path + '[' + ai + ']', errors);
      }
    }

    if (t === 'object') {
      if (Array.isArray(schema.required)) {
        for (var ri = 0; ri < schema.required.length; ri++) {
          var key = schema.required[ri];
          if (!Object.prototype.hasOwnProperty.call(value, key)) {
            pushErr(errors, path, 'missing required property "' + key + '"');
          }
        }
      }
      var props = isPlainObject(schema.properties) ? schema.properties : {};
      var keys = Object.keys(value);
      for (var ki = 0; ki < keys.length; ki++) {
        var pkey = keys[ki];
        var subSchema = props[pkey];
        var subPath = path + '.' + pkey;
        if (subSchema) {
          validateValue(value[pkey], subSchema, subPath, errors);
        } else if (schema.additionalProperties === false) {
          pushErr(errors, path, 'additional property "' + pkey + '" is not allowed');
        } else if (isPlainObject(schema.additionalProperties)) {
          validateValue(value[pkey], schema.additionalProperties, subPath, errors);
        }
      }
    }
  }

  function validatePayload(payload, schema) {
    var errors = [];
    validateValue(payload, schema, '$', errors);
    return { ok: errors.length === 0, errors: errors };
  }

  function loadSchemaSync(schemaPath) {
    if (typeof require !== 'function') {
      throw new Error('loadSchemaSync requires Node.js');
    }
    var fs = require('fs');
    var raw = fs.readFileSync(schemaPath, 'utf-8');
    return JSON.parse(raw);
  }

  function main(argv) {
    if (typeof require !== 'function') return 0;
    var fs = require('fs');
    var path = require('path');
    var args = argv.slice(2);
    var schemaPath = path.resolve(__dirname, '..', 'assets', 'saveSchema.json');
    var payloads = [];
    for (var i = 0; i < args.length; i++) {
      if (args[i] === '--schema' && args[i + 1]) { schemaPath = args[i + 1]; i++; }
      else if (args[i] === '--payload' && args[i + 1]) { payloads.push(args[i + 1]); i++; }
      else if (!args[i].startsWith('-')) { payloads.push(args[i]); }
    }
    var schema = loadSchemaSync(schemaPath);
    if (payloads.length === 0) {
      // Self-test: build a minimal valid skeleton, validate it; ensure schema parses & reports clean.
      var skeleton = {
        version: 2, coins: 0, kills: 0, fenceLevel: 1,
        cells: [], supercomputer: {}, player: {}, buyCounts: {}, buyPrices: {},
        achievements: { unlocked: {}, rewarded: {}, popupQueue: [] },
        stats: { tanksMergedCount: 0, tanksBoughtCount: 0 },
      };
      var res = validatePayload(skeleton, schema);
      if (!res.ok) {
        process.stderr.write('save-schema self-test FAILED:\n' + JSON.stringify(res.errors, null, 2) + '\n');
        return 2;
      }
      process.stdout.write('save-schema self-test OK (' + Object.keys(schema.properties || {}).length + ' top-level props)\n');
      return 0;
    }
    var failed = 0;
    for (var pi = 0; pi < payloads.length; pi++) {
      var p = payloads[pi];
      var raw = fs.readFileSync(p, 'utf-8');
      var data = JSON.parse(raw);
      var r = validatePayload(data, schema);
      if (r.ok) {
        process.stdout.write('OK  ' + p + '\n');
      } else {
        failed++;
        process.stderr.write('FAIL ' + p + '\n');
        for (var ei = 0; ei < r.errors.length; ei++) {
          process.stderr.write('  - ' + r.errors[ei].path + ': ' + r.errors[ei].message + '\n');
        }
      }
    }
    return failed === 0 ? 0 : 1;
  }

  var api = {
    validatePayload: validatePayload,
    loadSchemaSync: loadSchemaSync,
    main: main,
  };

  if (typeof require === 'function' && typeof module === 'object' && require.main === module) {
    process.exit(main(process.argv));
  }

  return api;
}));
