/**
 * 固定 9 关关卡数据（不可编辑、不可增删）
 * 第 n 关牌数 = n × 9（第 1 关 9 张 … 第 9 关 81 张）
 * 所有牌集中在桌面中央 **单堆** 叠放，不超出棋盘。
 */
(function (root) {
  "use strict";

  const MAX_LEVEL = 9;
  const BOARD_W = 480;
  const BOARD_H = 440;
  const TILE = 48;
  /** 与 sheep.js 中 drawBoardBg 内缘一致 */
  const BOARD_INSET = 8;

  const LEVEL_TAGS = [
    "入门",
    "叠层",
    "深叠",
    "密叠",
    "层叠",
    "高叠",
    "厚叠",
    "重叠",
    "终极",
  ];

  /** 第 n 关（1-based）牌数 */
  function tileCountForLevel(levelNum) {
    return levelNum * 9;
  }

  /** 每种图案 3 张一组，共 n 张 */
  function triplets(n, typeOffset) {
    const out = [];
    for (let i = 0; i < n / 3; i++) {
      const t = (typeOffset + i) % 10;
      out.push(t, t, t);
    }
    return out;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * 单堆布局：牌在桌面中央成簇铺开，半叠半散；牌数越多铺展略增，但不超出棋盘。
   */
  function buildSinglePile(n, seed) {
    const types = triplets(n, seed);
    const minX = BOARD_INSET + 4;
    const minY = BOARD_INSET + 4;
    const maxX = BOARD_W - BOARD_INSET - TILE - 4;
    const maxY = BOARD_H - BOARD_INSET - TILE - 4;

    const levelFactor = Math.sqrt(n / 9);
    const grid = Math.min(5, Math.max(3, Math.round(3 + levelFactor * 0.6)));
    const step = clamp(Math.round(24 + levelFactor * 4), 26, 34);

    const footprintW = (grid - 1) * step;
    const footprintH = (grid - 1) * step;
    const baseX = (BOARD_W - TILE) / 2 - footprintW / 2;
    const baseY = (BOARD_H - TILE) / 2 - footprintH / 2;

    const slots = [];
    for (let r = 0; r < grid; r++) {
      for (let c = 0; c < grid; c++) {
        slots.push({
          x: baseX + c * step,
          y: baseY + r * step,
        });
      }
    }

    const tiles = [];
    for (let i = 0; i < n; i++) {
      const slot = slots[i % slots.length];
      const layer = Math.floor(i / slots.length);
      const jx = ((i * 7 + seed * 3) % 13) - 6;
      const jy = ((i * 11 + seed * 5) % 13) - 6;
      const lx = (layer % 3) * 4;
      const ly = (Math.floor(layer / 3) % 3) * 3;
      tiles.push({
        type: types[i],
        layer,
        x: clamp(Math.round(slot.x + jx + lx), minX, maxX),
        y: clamp(Math.round(slot.y + jy + ly), minY, maxY),
      });
    }
    return tiles;
  }

  const LEVELS = LEVEL_TAGS.map((tag, index) => {
    const levelNum = index + 1;
    const count = tileCountForLevel(levelNum);
    return {
      name: `第 ${levelNum} 关 · ${tag}`,
      tileCount: count,
      tiles: buildSinglePile(count, index),
    };
  });

  function getLevel(index) {
    if (index < 0 || index >= MAX_LEVEL) return null;
    return LEVELS[index];
  }

  root.SheepLevels = Object.freeze({
    MAX_LEVEL,
    tileCountForLevel,
    LEVELS: Object.freeze(LEVELS),
    getLevel,
  });
})(typeof globalThis !== "undefined" ? globalThis : window);
