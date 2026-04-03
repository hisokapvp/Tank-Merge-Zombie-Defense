(function (global) {
  'use strict';

  var ENERGY_CARD_SELECTOR = '.chipCraftSlotCard';
  var INGREDIENT_SELECTOR = '.chipCraftIngredientRow .chipCraftSlot--assembleIngredient';
  var RESULT_SELECTOR = '.chipCraftAssemblyResult .chipCraftResultChip, .chipCraftAssemblyResult .chipCraftSlot--resultSlot';

  function resolveCardAnchorHost(host) {
    if (!host || typeof host.querySelector !== 'function') return host;
    return host.querySelector(ENERGY_CARD_SELECTOR) || host;
  }

  function resolveResultAnchor(railRect, resultHost) {
    var resultAnchor = resolveCardAnchorHost(resultHost);
    if (!resultAnchor || typeof resultAnchor.getBoundingClientRect !== 'function') return null;
    var resultRect = resultAnchor.getBoundingClientRect();
    return {
      x: resultRect.left + resultRect.width * 0.5 - railRect.left,
      y: resultRect.top - railRect.top,
    };
  }

  function resolveIngredientAnchor(railRect, ingredientHost) {
    var ingredientAnchor = resolveCardAnchorHost(ingredientHost);
    if (!ingredientAnchor || typeof ingredientAnchor.getBoundingClientRect !== 'function') return null;
    var ingredientRect = ingredientAnchor.getBoundingClientRect();
    return {
      x: ingredientRect.left + ingredientRect.width * 0.5 - railRect.left,
      y: ingredientRect.bottom - railRect.top,
    };
  }

  function buildPathDef(startX, startY, endX, endY) {
    var deltaY = endY - startY;
    var controlA = startY + Math.max(12, deltaY * 0.28);
    var controlB = endY - Math.max(12, deltaY * 0.34);
    return 'M' + startX + ' ' + startY
      + ' C' + startX + ' ' + controlA + ',' + endX + ' ' + controlB + ',' + endX + ' ' + endY;
  }

  function buildEnergyRailLayout(panel) {
    if (!panel || typeof panel.querySelector !== 'function') return null;
    var rail = panel.querySelector('.chipCraftEnergyRail');
    var svg = rail ? rail.querySelector('.chipCraftEnergySvg') : null;
    if (!rail || !svg || typeof rail.getBoundingClientRect !== 'function') return null;

    var ingredientHosts = panel.querySelectorAll(INGREDIENT_SELECTOR);
    var resultHost = panel.querySelector(RESULT_SELECTOR);
    if (ingredientHosts.length < 3 || !resultHost) return null;

    var railRect = rail.getBoundingClientRect();
    if (!railRect.width) return null;

    var resultAnchor = resolveResultAnchor(railRect, resultHost);
    if (!resultAnchor) return null;

    var minY = Math.min(0, resultAnchor.y);
    var maxY = Math.max(railRect.height, resultAnchor.y);
    var lineLayouts = [];
    var index;
    for (index = 0; index < ingredientHosts.length; index++) {
      var ingredientAnchor = resolveIngredientAnchor(railRect, ingredientHosts[index]);
      if (!ingredientAnchor) continue;
      minY = Math.min(minY, ingredientAnchor.y);
      maxY = Math.max(maxY, ingredientAnchor.y);
      lineLayouts.push({
        startX: ingredientAnchor.x,
        startY: ingredientAnchor.y,
        endX: resultAnchor.x,
        endY: resultAnchor.y,
        pathDef: buildPathDef(ingredientAnchor.x, ingredientAnchor.y, resultAnchor.x, resultAnchor.y),
      });
    }
    if (!lineLayouts.length) return null;

    var viewBoxTop = Math.floor(minY - 6);
    return {
      railWidth: Math.ceil(railRect.width),
      viewBoxTop: viewBoxTop,
      viewBoxHeight: Math.max(1, Math.ceil(maxY - viewBoxTop + 8)),
      lines: lineLayouts,
    };
  }

  global.Game = global.Game || {};
  global.Game.ChipCraftLayout = {
    buildEnergyRailLayout: buildEnergyRailLayout,
  };
}(window));