/**
 * 羊了个羊 — 固定 9 关闯关（无关卡编辑）
 */
(function () {
  "use strict";

  const { MAX_LEVEL, getLevel } = window.SheepLevels;

  const TILE_W = 48;
  const TILE_H = 48;
  const SLOT_MAX = 7;
  const BOARD_W = 480;
  const BOARD_H = 440;
  const PROGRESS_KEY = "yang_sheep_progress";

  const TYPE_DEFS = [
    { icon: "🐑", color: "#f5e6a8" },
    { icon: "🌿", color: "#8fd48a" },
    { icon: "🥕", color: "#f0a060" },
    { icon: "🪣", color: "#8eb4e8" },
    { icon: "🧶", color: "#e8a0c8" },
    { icon: "🔔", color: "#f0d060" },
    { icon: "🌽", color: "#f5d040" },
    { icon: "🪨", color: "#a8a8b8" },
    { icon: "✂️", color: "#c0c0d0" },
    { icon: "🧤", color: "#d8a878" },
  ];

  let nextTileId = 1;

  function cloneTiles(raw) {
    return raw.map((t) => ({
      id: nextTileId++,
      type: t.type,
      layer: t.layer ?? 0,
      x: t.x,
      y: t.y,
      removed: false,
    }));
  }

  function rectsOverlap(a, b) {
    return (
      a.x < b.x + TILE_W &&
      a.x + TILE_W > b.x &&
      a.y < b.y + TILE_H &&
      a.y + TILE_H > b.y
    );
  }

  function activeTiles(tiles) {
    return tiles.filter((t) => !t.removed);
  }

  function isClickable(tile, tiles) {
    if (tile.removed) return false;
    for (const other of tiles) {
      if (other.removed || other.id === tile.id) continue;
      if (other.layer > tile.layer && rectsOverlap(tile, other)) return false;
    }
    return true;
  }

  function tileAtPoint(tiles, px, py) {
    const hits = activeTiles(tiles)
      .filter((t) => px >= t.x && px < t.x + TILE_W && py >= t.y && py < t.y + TILE_H)
      .sort((a, b) => b.layer - a.layer);
    for (const t of hits) {
      if (isClickable(t, tiles)) return t;
    }
    return null;
  }

  function insertSlot(slot, type) {
    let at = slot.length;
    for (let i = slot.length - 1; i >= 0; i--) {
      if (slot[i] === type) {
        at = i + 1;
        break;
      }
    }
    slot.splice(at, 0, type);
  }

  function resolveMatches(slot) {
    let changed = true;
    while (changed) {
      changed = false;
      const bucket = {};
      slot.forEach((t, i) => {
        (bucket[t] ||= []).push(i);
      });
      for (const type of Object.keys(bucket)) {
        if (bucket[type].length >= 3) {
          const drop = new Set(bucket[type].slice(0, 3));
          for (let i = slot.length - 1; i >= 0; i--) {
            if (drop.has(i)) slot.splice(i, 1);
          }
          changed = true;
          break;
        }
      }
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawBoardBg(ctx) {
    ctx.fillStyle = "#3d6b4f";
    roundRect(ctx, 8, 8, BOARD_W - 16, BOARD_H - 16, 12);
    ctx.fill();
  }

  /** 裁剪到桌面内缘，防止牌画出界 */
  function clipToBoard(ctx) {
    ctx.save();
    roundRect(ctx, 8, 8, BOARD_W - 16, BOARD_H - 16, 12);
    ctx.clip();
  }

  function drawTile(ctx, tile, dim) {
    const def = TYPE_DEFS[tile.type % TYPE_DEFS.length];
    ctx.save();
    if (dim) ctx.globalAlpha = 0.42;
    ctx.fillStyle = def.color;
    ctx.strokeStyle = "#2a2a3a";
    ctx.lineWidth = 2;
    roundRect(ctx, tile.x + 2, tile.y + 2, TILE_W - 4, TILE_H - 4, 8);
    ctx.fill();
    ctx.stroke();
    ctx.font = "26px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#1a1a24";
    ctx.fillText(def.icon, tile.x + TILE_W / 2, tile.y + TILE_H / 2 + 1);
    ctx.restore();
  }

  function loadProgress() {
    try {
      const n = parseInt(localStorage.getItem(PROGRESS_KEY), 10);
      if (Number.isFinite(n) && n >= 0 && n < MAX_LEVEL) return n;
    } catch {
      /* ignore */
    }
    return 0;
  }

  function saveProgress(index) {
    try {
      localStorage.setItem(PROGRESS_KEY, String(index));
    } catch {
      /* ignore */
    }
  }

  class SheepGame {
    constructor(canvas, slotEl, statusEl, levelEl) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.slotEl = slotEl;
      this.statusEl = statusEl;
      this.levelEl = levelEl;
      this.canvas.width = BOARD_W;
      this.canvas.height = BOARD_H;
      this.levelIndex = 0;
      this.tiles = [];
      this.slot = [];
      this.state = "playing";
      this._sortedCache = null;
      this._cacheDirty = true;
    }

    loadLevelIndex(index) {
      const data = getLevel(index);
      if (!data) return;
      this.levelIndex = index;
      nextTileId = 1;
      this.tiles = cloneTiles(data.tiles);
      this.slot = [];
      this.state = "playing";
      this._cacheDirty = true;
      if (this.levelEl) {
        const total = data.tileCount ?? data.tiles.length;
        this.levelEl.textContent = `${data.name} · ${total} 张（${index + 1}/${MAX_LEVEL}）`;
      }
      this.setStatus("点选未被压住的牌");
      this.renderSlot();
    }

    setStatus(msg) {
      if (this.statusEl) this.statusEl.textContent = msg;
    }

    markDirty() {
      this._cacheDirty = true;
    }

    getSortedTiles() {
      if (this._cacheDirty) {
        this._sortedCache = activeTiles(this.tiles).sort((a, b) => a.layer - b.layer);
        this._cacheDirty = false;
      }
      return this._sortedCache;
    }

    onClick(px, py) {
      if (this.state !== "playing") return;
      const tile = tileAtPoint(this.tiles, px, py);
      if (!tile) return;

      tile.removed = true;
      this.markDirty();
      insertSlot(this.slot, tile.type);
      resolveMatches(this.slot);

      const left = activeTiles(this.tiles).length;
      if (this.slot.length >= SLOT_MAX) {
        this.state = "lost";
        this.setStatus("槽位已满 — 点击重试本关");
      } else if (left === 0) {
        if (this.levelIndex >= MAX_LEVEL - 1) {
          this.state = "cleared";
          saveProgress(0);
          this.setStatus("恭喜通关全部 9 关！");
        } else {
          this.state = "level_clear";
          const next = this.levelIndex + 1;
          saveProgress(next);
          this.setStatus(`第 ${this.levelIndex + 1} 关通过！点击「下一关」`);
        }
      } else {
        this.setStatus(`剩余 ${left} 张 · 槽位 ${this.slot.length}/${SLOT_MAX}`);
      }
      this.renderSlot();
    }

    nextLevel() {
      if (this.state === "level_clear" && this.levelIndex < MAX_LEVEL - 1) {
        this.loadLevelIndex(this.levelIndex + 1);
      }
    }

    retry() {
      this.loadLevelIndex(this.levelIndex);
    }

    resetCampaign() {
      saveProgress(0);
      this.loadLevelIndex(0);
    }

    renderSlot() {
      if (!this.slotEl) return;
      const frag = document.createDocumentFragment();
      for (let i = 0; i < SLOT_MAX; i++) {
        const cell = document.createElement("div");
        cell.className = "slot-cell";
        if (i < this.slot.length) {
          const def = TYPE_DEFS[this.slot[i] % TYPE_DEFS.length];
          cell.style.background = def.color;
          cell.textContent = def.icon;
        }
        frag.appendChild(cell);
      }
      this.slotEl.replaceChildren(frag);
    }

    draw() {
      const { ctx } = this;
      ctx.clearRect(0, 0, BOARD_W, BOARD_H);
      drawBoardBg(ctx);
      clipToBoard(ctx);

      for (const tile of this.getSortedTiles()) {
        drawTile(ctx, tile, !isClickable(tile, this.tiles));
      }
      ctx.restore();

      if (this.state === "lost" || this.state === "level_clear" || this.state === "cleared") {
        ctx.fillStyle = "rgba(0,0,0,0.58)";
        ctx.fillRect(0, 0, BOARD_W, BOARD_H);
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.font = "bold 26px system-ui";
        let title = "失败";
        let hint = "点击「重试本关」";
        if (this.state === "level_clear") {
          title = "过关！";
          hint = this.levelIndex < MAX_LEVEL - 1 ? "点击「下一关」" : "已完成";
        } else if (this.state === "cleared") {
          title = "全部通关";
          hint = "点击「从头开始」";
        }
        ctx.fillText(title, BOARD_W / 2, BOARD_H / 2 - 14);
        ctx.font = "15px system-ui";
        ctx.fillText(hint, BOARD_W / 2, BOARD_H / 2 + 18);
        ctx.textAlign = "left";
      }
    }
  }

  function initSheep() {
    const canvas = document.getElementById("game-canvas");
    const slotBar = document.getElementById("slot-bar");
    const status = document.getElementById("game-status");
    const levelLabel = document.getElementById("level-label");
    const btnRetry = document.getElementById("btn-retry");
    const btnNext = document.getElementById("btn-next");
    const btnReset = document.getElementById("btn-reset");

    const game = new SheepGame(canvas, slotBar, status, levelLabel);
    game.loadLevelIndex(loadProgress());

    canvas.addEventListener("click", (e) => {
      const rect = canvas.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width) * BOARD_W;
      const py = ((e.clientY - rect.top) / rect.height) * BOARD_H;
      game.onClick(px, py);
    });

    btnRetry.addEventListener("click", () => game.retry());
    btnNext.addEventListener("click", () => game.nextLevel());
    btnReset.addEventListener("click", () => {
      if (confirm("确定从第 1 关重新开始？进度将清零。")) game.resetCampaign();
    });

    function loop() {
      game.draw();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSheep);
  } else {
    initSheep();
  }
})();
