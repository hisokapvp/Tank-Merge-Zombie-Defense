(function (global) {
  'use strict';

  function emit(event, payload) {
    if (!event) return;
    if (global.Game && global.Game.TelemetryLogger && typeof global.Game.TelemetryLogger.log === 'function') {
      global.Game.TelemetryLogger.log(event, payload);
    }
    if (global.Game && global.Game.AnalyticsCollector && typeof global.Game.AnalyticsCollector.track === 'function') {
      global.Game.AnalyticsCollector.track(event, payload);
    }
  }

  global.Game = global.Game || {};
  global.Game.EventTelemetry = {
    emit: emit,
  };
})(typeof window !== 'undefined' ? window : this);
