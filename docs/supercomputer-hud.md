# Supercomputer HUD

Документ описывает HUD-элементы, привязанные к supercomputer в screen-space: группу boost-иконок и плавающую кнопку `#supercomputerBtn`.

## Конфиг `boostIcons` (`assets/supercomputer.json`)

```json
{
  "boostIcons": {
    "anchor": "top",
    "offsetX": 0,
    "offsetY": -10,
    "maxPerRow": 4,
    "gapX": 6,
    "gapY": 6
  }
}
```

Поля:
- `anchor`: базовая сторона спрайта supercomputer (`top` или `bottom`).
- `offsetX`: смещение группы иконок по X (px до масштабирования).
- `offsetY`: смещение группы иконок по Y (px до масштабирования).
- `maxPerRow`: максимум иконок в одном ряду.
- `gapX`: горизонтальный зазор между иконками.
- `gapY`: вертикальный зазор между рядами.

## Layout boost-иконок (rows + group centering)

Рендер выполняется в `game.js` (`drawSupercomputerBoostIcons`) рядом со спрайтом supercomputer:

1. Собираются активные бусты.
2. Массив делится на ряды по `maxPerRow`.
3. Для каждого ряда считается ширина:
   - `rowWidth = iconsInRow * iconW + (iconsInRow - 1) * gapX`
   - `x0 = -rowWidth / 2` (центрирование ряда относительно группы)
4. Высота группы:
   - `groupHeight = rowsCount * iconH + (rowsCount - 1) * gapY`
5. База привязывается к спрайту supercomputer (`anchor`, `offsetX`, `offsetY`), после чего группа рисуется сверху и растёт вниз по рядам.

### Кеширование layout

В hot path не пересоздаются структуры layout на каждый кадр. Пересчёт происходит только если изменился хотя бы один из факторов:
- набор активных бустов,
- позиция/размер спрайта supercomputer,
- масштаб (`balScale`),
- параметры `boostIcons`.

## Позиция `#supercomputerBtn`

`#supercomputerBtn` вынесена из правого HUD-списка в общий слой `stageCanvas` и позиционируется в screen-space:
- `x = spriteCenterX + spriteHalfW + btnMargin`
- `y = spriteCenterY - btnH / 2`
- `btnMargin = 10px`
- применение через `transform: translate3d(x, y, 0)`

### Safeguard от пересечения

Если bbox кнопки пересекается с bbox boost-группы, кнопка смещается вниз на `iconH + gapY`.

## Template-иконки tiles

Подключены PNG-шаблоны:
- `assets/computer_icons/hangar_mods_template.png`
- `assets/computer_icons/tank_wall_mods_template.png`
- `assets/computer_icons/talent_tree_template.png`

В `style.css` они привязаны к tiles по ID:
- `#supercomputerOpenHangarMods .scRootTile__icon`
- `#supercomputerOpenTankWallMods .scRootTile__icon`
- `#supercomputerOpenTalents .scRootTile__icon`

Пользователь может заменить PNG-файл на диске, и иконка сразу изменится без правок кода.

## Ожидаемое расположение (текстовый скрин)

- Спрайт supercomputer — внизу центральной зоны ангара.
- Boost-иконки — над спрайтом, сгруппированы и центрированы по горизонтали относительно спрайта.
- `#supercomputerBtn` — справа от спрайта, по вертикальному центру спрайта, с небольшим отступом.
- При конфликте с boost-группой кнопка автоматически смещается ниже.
