/**
 * src/persistence/saveSchemaLoader.js — fail-soft подгрузка assets/saveSchema.json в Game.SaveSchema.
 *
 * Читает schema через fetch (file:// и http://) и публикует её на window.Game.SaveSchema.
 * storage.loadGame() сам по себе вызывает Game.SaveSchemaValidator.validatePayload(data, Game.SaveSchema)
 * только если оба объекта присутствуют — отсутствие schema не блокирует загрузку (fail-soft).
 */
(function (global) {
  'use strict';
  global.Game = global.Game || {};
  if (!global.fetch) return;
  try {
    global.fetch('assets/saveSchema.json', { cache: 'force-cache' })
      .then(function (resp) { return resp.ok ? resp.json() : null; })
      .then(function (schema) {
        if (schema && typeof schema === 'object') {
          global.Game.SaveSchema = schema;
        }
      })
      .catch(function () { /* fail-soft */ });
  } catch (_) { /* fail-soft */ }
}(typeof window !== 'undefined' ? window : globalThis));
