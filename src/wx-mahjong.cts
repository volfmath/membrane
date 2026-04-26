declare const module: any;
declare const require: any;
declare const wx: any;
declare const globalThis: any;

import { WebGLDevice } from './renderer/webgl-device';
import { SpriteBatcher } from './renderer/sprite-batcher';
import { getAttributeLocations, getUniformLocations } from './renderer/shader-utils';
import { Mesh, type VertexAttrib } from './renderer/mesh';
import { Camera3D } from './renderer/camera3d';
import { Mat4 } from './math/mat4';
import { TILE_UV } from './mahjong/tile-atlas-data';
import { LevelConfs, LevelLoopMin, buildTilePool, shuffle, ILevelConfig } from './mahjong/level-configs';
import { TILE_VERTS, TILE_INDICES } from './mahjong/tile-mesh-data';
import type { CompiledSceneData, CompiledFixtureData, CompiledSpriteFrame } from './canonical/loader-types';

(function mahjongGame(): void {
  const TAG = '[MJ]';
  const log = (...a: any[]) => { a.unshift(TAG); console.info.apply(console, a); };
  const warn = (...a: any[]) => { a.unshift(TAG); console.warn.apply(console, a); };

  // ─── Constants ────────────────────────────────────────────────────────────
  const MAX_SLOT = 7;
  const TILE_W = 64;
  const TILE_H = 86;
  const TILE_SHADOW = 4;
  const GRID_COLS = 5;
  const GRID_ROWS = 7;

  // 3D world spacing (tile half-extents: x=1.5, y=1.0, z=2.0)
  const TSPACE_X = 3.2;
  const TSPACE_Z = 4.2;
  const TSPACE_Y = 2.2;
  const SPAWN_Y = 16;

  function packABGR(r: number, g: number, b: number, a: number): number {
    return ((a & 0xFF) << 24 | (b & 0xFF) << 16 | (g & 0xFF) << 8 | (r & 0xFF)) >>> 0;
  }
  const WHITE   = packABGR(255, 255, 255, 255);
  const SHADOW  = packABGR(0,   0,   0,   120);
  const OVERLAY = packABGR(0,   0,   0,   200);
  const GREEN   = packABGR(34,  197, 94,  255);
  const RED     = packABGR(239, 68,  68,  255);
  const YELLOW  = packABGR(234, 179, 8,   255);
  const GRAY    = packABGR(71,  85,  105, 255);
  const SLOT_BG = packABGR(30,  41,  59,  255);

  // ─── Scene ────────────────────────────────────────────────────────────────
  type Scene = 'loading' | 'home' | 'game' | 'pass' | 'lose';

  // ─── 3D Shaders ───────────────────────────────────────────────────────────
  // vertex: pos+norm+uv → clip space; fragment: Lambertian body + atlas-sampled face
  const VERT_3D = `attribute vec3 a_pos;attribute vec3 a_norm;attribute vec2 a_uv;uniform mat4 u_mvp;varying mediump vec3 v_norm;varying mediump vec2 v_uv;void main(){gl_Position=u_mvp*vec4(a_pos,1.0);v_norm=a_norm;v_uv=a_uv;}`;
  const FRAG_3D = `precision mediump float;varying vec3 v_norm;varying vec2 v_uv;uniform sampler2D u_tex;uniform vec4 u_uv_rect;uniform float u_dim;void main(){vec3 L=normalize(vec3(0.3,1.0,0.5));float ndl=max(0.0,dot(normalize(v_norm),L));float isFace=step(0.0005,v_uv.x+v_uv.y);vec4 col;if(isFace>0.5){vec2 auv=u_uv_rect.xy+v_uv*(u_uv_rect.zw-u_uv_rect.xy);col=texture2D(u_tex,auv);}else{float lit=0.3+0.7*ndl;col=vec4(vec3(0.92,0.87,0.72)*lit,1.0);}gl_FragColor=vec4(col.rgb*u_dim,col.a);}`;

  // ─── 3D Renderer State ────────────────────────────────────────────────────
  let prog3d: WebGLProgram | null = null;
  let tileMesh: Mesh | null = null;
  let camera3d = new Camera3D();
  let aPos3 = 0, aNorm3 = 0, aUV3 = 0;
  let uMVP3: WebGLUniformLocation | null = null;
  let uTex3: WebGLUniformLocation | null = null;
  let uUVR3: WebGLUniformLocation | null = null;
  let uDim3: WebGLUniformLocation | null = null;

  // ─── Canvas & 2D renderer ─────────────────────────────────────────────────
  let canvas: any = null;
  let W = 390, H = 844;
  let device: WebGLDevice;
  let batcher: SpriteBatcher;
  let proj: Mat4;
  let whiteTex: WebGLTexture;
  let tileTex: WebGLTexture | null = null;
  let digitTex: WebGLTexture | null = null;
  const DIGIT_W = 14;
  const DIGIT_H = 20;
  let lblStart:  WebGLTexture | null = null;
  let lblNext:   WebGLTexture | null = null;
  let lblRetry:  WebGLTexture | null = null;
  const lblProp: (WebGLTexture | null)[] = [null, null, null, null];
  interface LoadedSpriteTexture {
    texture: WebGLTexture;
    width: number;
    height: number;
  }

  let fixtureData: CompiledFixtureData | null = null;
  let spriteFrameMap: Record<string, CompiledSpriteFrame> = {};
  const spriteTexCache = new Map<string, LoadedSpriteTexture | null>();

  // ─── 3D Setup ─────────────────────────────────────────────────────────────
  function computeVP(): void {
    const fovH = 20 * Math.PI / 180;
    const fovY = 2 * Math.atan(Math.tan(fovH * 0.5) / (W / H));
    camera3d.setLookAt([0, 35, 45], [0, 5, 0], [0, 1, 0]);
    camera3d.setPerspective(fovY, W / H, 1, 1000);
  }

  function setup3D(): boolean {
    const gl = device.gl;
    try {
      prog3d = device.createProgram(VERT_3D, FRAG_3D);
      const attrs = getAttributeLocations(gl, prog3d, ['a_pos', 'a_norm', 'a_uv']);
      const unifs = getUniformLocations(gl, prog3d, ['u_mvp', 'u_tex', 'u_uv_rect', 'u_dim']);
      aPos3 = attrs['a_pos']; aNorm3 = attrs['a_norm']; aUV3 = attrs['a_uv'];
      uMVP3 = unifs['u_mvp']; uTex3 = unifs['u_tex']; uUVR3 = unifs['u_uv_rect']; uDim3 = unifs['u_dim'];
      tileMesh = new Mesh(device, TILE_VERTS, TILE_INDICES, 32);
      computeVP();
      log('3D ok');
      return true;
    } catch (e: any) { warn('3D fail', e?.message ?? e); return false; }
  }

  // ─── Text Label Texture Helper ────────────────────────────────────────────
  function makeTextTex(text: string, w: number, h: number, fontSize: number): WebGLTexture | null {
    try {
      const off = wx.createCanvas();
      off.width = w; off.height = h;
      const ctx = off.getContext('2d');
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, w / 2, h / 2);
      const imgData = ctx.getImageData(0, 0, w, h);
      const gl = device.gl;
      const tex = device.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(imgData.data.buffer));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return tex;
    } catch (e) { warn('makeTextTex', e); return null; }
  }

  // ─── Renderer Setup ───────────────────────────────────────────────────────
  function setupRenderer(): boolean {
    try {
      canvas = wx.createCanvas();
      W = canvas.width || 390;
      H = canvas.height || 844;
      device = new WebGLDevice(canvas, { alpha: false, antialias: false });
      batcher = new SpriteBatcher(device);
      proj = new Mat4();
      Mat4.ortho(0, W, H, 0, -1, 1, proj);

      const gl = device.gl;
      whiteTex = device.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, whiteTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255,255,255,255]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

      try {
        const off = wx.createCanvas();
        off.width = 140; off.height = 20;
        const offCtx = off.getContext('2d');
        offCtx.fillStyle = '#000000'; offCtx.fillRect(0,0,140,20);
        offCtx.fillStyle = '#ffffff'; offCtx.font = 'bold 16px monospace';
        offCtx.textAlign = 'left'; offCtx.textBaseline = 'top';
        for (let i = 0; i <= 9; i++) offCtx.fillText(String(i), i*14+1, 2);
        const imgData = offCtx.getImageData(0,0,140,20);
        digitTex = device.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, digitTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 140, 20, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(imgData.data.buffer));
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      } catch (e) { warn('digit tex', e); }

      lblStart   = makeTextTex('开始',  140, 40, 28);
      lblNext    = makeTextTex('下一关', 160, 40, 26);
      lblRetry   = makeTextTex('重试',  140, 40, 28);
      lblProp[0] = makeTextTex('洗牌',   52, 20, 14);
      lblProp[1] = makeTextTex('移出',   52, 20, 14);
      lblProp[2] = makeTextTex('消除',   52, 20, 14);
      lblProp[3] = makeTextTex('+时间',  52, 20, 14);

      setup3D();
      log('renderer ok', W+'x'+H);
      return true;
    } catch (e: any) { warn('renderer fail', e?.message ?? e); return false; }
  }

  // ─── Tile Atlas Loading ───────────────────────────────────────────────────
  let tileTexReady = false;

  function loadTileAtlas(cb: () => void): void {
    if (typeof wx.createImage !== 'function') { cb(); return; }
    const img = wx.createImage();
    img.onload = () => {
      const gl = device.gl;
      tileTex = device.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tileTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      tileTexReady = true;
      log('tile atlas ok');
      cb();
    };
    img.onerror = (e: any) => { warn('tile atlas err', e); cb(); };
    img.src = 'assets/11.png';
  }

  // ─── Audio ────────────────────────────────────────────────────────────────
  function createAudio(src: string): any {
    if (typeof wx.createInnerAudioContext !== 'function') return null;
    const a = wx.createInnerAudioContext();
    a.src = src; a.volume = 1.0;
    a.onError((e: any) => warn('audio', src, e?.errMsg));
    return a;
  }
  let sndClick: any, sndCombie: any, sndFail: any, sndWin: any;
  function setupAudio(): void {
    sndClick  = createAudio('assets/audio/click.mp3');
    sndCombie = createAudio('assets/audio/combie.mp3');
    sndFail   = createAudio('assets/audio/fail.mp3');
    sndWin    = createAudio('assets/audio/win.mp3');
  }
  function play(snd: any): void {
    if (!snd) return;
    try { snd.stop(); snd.play(); } catch (e) {}
  }

  // ─── Game State ───────────────────────────────────────────────────────────
  interface WorldTile {
    id: number;
    col: number; row: number; layer: number;
    wx: number; wy: number; wz: number;   // current world position
    twx: number; twy: number; twz: number; // target world position
    sx: number; sy: number;               // projected screen center (top face)
    animating: boolean;
    animT: number;
    depth: number;     // layer*1000 + row*GRID_COLS + col  (higher = renders on top)
    blocked: boolean;
    removing: boolean;
    removeT: number;
  }

  interface SlotTile {
    id: number;
    x: number; y: number;
    tx: number; ty: number;
    animating: boolean;
    animT: number;
    removing: boolean;
    removeT: number;
  }

  interface RuntimeSceneEntity {
    id: string;
    name: string;
    parent: string | null;
    enabled: boolean;
    components: Record<string, Record<string, unknown>> & {
      Transform?: Record<string, unknown>;
      Sprite?: { atlas?: string; frame?: string; color?: string };
      Label?: { text?: string; color?: string };
      Button?: Record<string, unknown>;
      ProgressBar?: { progress?: number };
    };
  }

  interface RuntimeSceneView {
    sceneId: string;
    entities: RuntimeSceneEntity[];
    byName: Map<string, RuntimeSceneEntity[]>;
    byPath: Map<string, RuntimeSceneEntity>;
  }

  let scene: Scene = 'loading';
  let currentLevel = 1;
  let cfg: ILevelConfig;
  let worldTiles: WorldTile[] = [];
  let slotTiles: SlotTile[] = [];
  let timerSec = 0;
  let timerAccum = 0;
  let matchedGroups = 0;
  let totalGroups = 0;
  let gameEnded = false;
  let tapEnabled = true;
  let fixtureScenes: CompiledSceneData[] = [];
  let homeScene: RuntimeSceneView | null = null;
  let loadingScene: RuntimeSceneView | null = null;
  let mainGameScene: RuntimeSceneView | null = null;
  let loadingProgress = 0.12;

  const props = { xiPai: 1, yiChu: 1, xiaochu: 1, shiZhong: 1 };

  function loadFixtureScenes(): void {
    try {
      const fixture = require('../assets/scene-data') as CompiledFixtureData;
      fixtureData = fixture;
      fixtureScenes = Array.isArray(fixture?.scenes) ? fixture.scenes : [];
      spriteFrameMap = fixture?.spriteFrames ?? {};
      homeScene = buildRuntimeSceneView('Home');
      loadingScene = buildRuntimeSceneView('Loading');
      mainGameScene = buildRuntimeSceneView('MainGame');
      log('fixture scenes', fixtureScenes.length, 'sprites=', Object.keys(spriteFrameMap).length, 'home=', !!homeScene, 'loading=', !!loadingScene, 'game=', !!mainGameScene);
    } catch (e: any) {
      warn('fixture load failed', e?.message ?? e);
      fixtureData = null;
      fixtureScenes = [];
      spriteFrameMap = {};
      homeScene = null;
      loadingScene = null;
      mainGameScene = null;
    }
  }

  function buildRuntimeSceneView(sceneId: string): RuntimeSceneView | null {
    const raw = fixtureScenes.find((s) => s.sceneId === sceneId);
    if (!raw) return null;
    const entities = raw.entities as RuntimeSceneEntity[];
    const byName = new Map<string, RuntimeSceneEntity[]>();
    const byPath = new Map<string, RuntimeSceneEntity>();
    for (const entity of entities) {
      const list = byName.get(entity.name) ?? [];
      list.push(entity);
      byName.set(entity.name, list);
      const path = entity.parent ? `${entity.parent}/${entity.name}` : entity.name;
      byPath.set(path, entity);
    }
    return { sceneId, entities, byName, byPath };
  }

  function getSceneEntities(view: RuntimeSceneView | null, name: string): RuntimeSceneEntity[] {
    return view?.byName.get(name) ?? [];
  }

  function getScenePathEntity(view: RuntimeSceneView | null, path: string): RuntimeSceneEntity | null {
    return view?.byPath.get(path) ?? null;
  }

  function getVisibleScenePathEntity(view: RuntimeSceneView | null, path: string): RuntimeSceneEntity | null {
    const entity = getScenePathEntity(view, path);
    return entity && isSceneEntityVisible(view, entity) ? entity : null;
  }

  function getSceneEntity(view: RuntimeSceneView | null, name: string): RuntimeSceneEntity | null {
    const list = getSceneEntities(view, name);
    return list.find((entity) => isSceneEntityVisible(view, entity)) ?? null;
  }

  function getSceneWorldTransform(view: RuntimeSceneView | null, entity: RuntimeSceneEntity | null): { x: number; y: number } {
    if (!view || !entity) return { x: 0, y: 0 };
    let x = getTransformNumber(entity, 'x');
    let y = getTransformNumber(entity, 'y');
    let parentPath = entity.parent;
    while (parentPath) {
      const parent = getScenePathEntity(view, parentPath);
      if (!parent) break;
      x += getTransformNumber(parent, 'x');
      y += getTransformNumber(parent, 'y');
      parentPath = parent.parent;
    }
    return { x, y };
  }

  function getTransformNumber(entity: RuntimeSceneEntity | null, key: string, fallback = 0): number {
    const value = entity?.components?.Transform?.[key];
    return typeof value === 'number' ? value : fallback;
  }

  function isSceneEntityVisible(view: RuntimeSceneView | null, entity: RuntimeSceneEntity | null): boolean {
    if (!view || !entity) return false;
    if (entity.enabled === false) return false;
    let parentPath = entity.parent;
    while (parentPath) {
      const parent = getScenePathEntity(view, parentPath);
      if (!parent) break;
      if (parent.enabled === false) return false;
      parentPath = parent.parent;
    }
    return true;
  }

  function getSceneSize(entity: RuntimeSceneEntity | null): { width: number; height: number } {
    return {
      width: getTransformNumber(entity, 'width'),
      height: getTransformNumber(entity, 'height'),
    };
  }

  function uiSizeToScreenWidth(width: number): number {
    return (width / UI_DESIGN_W) * W;
  }

  function uiSizeToScreenHeight(height: number): number {
    return (height / UI_DESIGN_H) * H;
  }

  function getSceneScreenSize(entity: RuntimeSceneEntity | null): { width: number; height: number } {
    const size = getSceneSize(entity);
    return {
      width: uiSizeToScreenWidth(size.width),
      height: uiSizeToScreenHeight(size.height),
    };
  }

  function getSceneButtonRect(entity: RuntimeSceneEntity | null, fallbackWidth: number, fallbackHeight: number): { width: number; height: number } {
    const size = getSceneScreenSize(entity);
    return {
      width: size.width || fallbackWidth,
      height: size.height || fallbackHeight,
    };
  }

  function getLabelText(entity: RuntimeSceneEntity | null, fallback = ''): string {
    const value = entity?.components?.Label?.text;
    return typeof value === 'string' ? value : fallback;
  }

  const UI_DESIGN_W = 720;
  const UI_DESIGN_H = 1280;

  function uiToScreenX(x: number): number {
    return (x / UI_DESIGN_W) * W;
  }

  function uiToScreenY(y: number): number {
    return ((UI_DESIGN_H - y) / UI_DESIGN_H) * H;
  }

  function parseHexColor(hex: string | undefined, fallback: number): number {
    if (!hex || !/^#[0-9A-Fa-f]{8}$/.test(hex)) return fallback;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const a = parseInt(hex.slice(7, 9), 16);
    return packABGR(r, g, b, a);
  }

  function getSpriteFrame(entity: RuntimeSceneEntity | null): CompiledSpriteFrame | null {
    const atlas = entity?.components?.Sprite?.atlas;
    const frame = entity?.components?.Sprite?.frame;
    if (!atlas || !frame || atlas === 'unknown' || frame === 'unknown') return null;
    return spriteFrameMap[`${atlas}@${frame}`] ?? null;
  }

  function ensureSpriteTexture(imagePath: string): LoadedSpriteTexture | null {
    const cached = spriteTexCache.get(imagePath);
    if (cached !== undefined) return cached;
    try {
      const img = wx.createImage();
      const tex = device.createTexture();
      const loaded: LoadedSpriteTexture = { texture: tex, width: 1, height: 1 };
      img.onload = () => {
        const gl = device.gl;
        loaded.width = img.width || 1;
        loaded.height = img.height || 1;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      };
      img.onerror = (e: any) => warn('sprite image err', imagePath, e?.errMsg ?? e);
      img.src = imagePath;
      spriteTexCache.set(imagePath, loaded);
      return loaded;
    } catch (e) {
      warn('sprite texture fail', imagePath, e);
      spriteTexCache.set(imagePath, null);
      return null;
    }
  }

  function drawSceneSprite(entity: RuntimeSceneEntity | null, x: number, y: number, opts?: { width?: number; height?: number; tint?: number }): void {
    if (!entity) return;
    const frame = getSpriteFrame(entity);
    if (!frame) return;
    const loaded = ensureSpriteTexture(frame.image);
    if (!loaded) return;
    const scaleX = Math.abs(getTransformNumber(entity, 'scaleX', 1)) || 1;
    const scaleY = Math.abs(getTransformNumber(entity, 'scaleY', 1)) || 1;
    const size = getSceneScreenSize(entity);
    const importedWidth = size.width > 0 ? size.width * scaleX : 0;
    const importedHeight = size.height > 0 ? size.height * scaleY : 0;
    const w = opts?.width ?? (importedWidth || frame.originalSize.width * scaleX);
    const h = opts?.height ?? (importedHeight || frame.originalSize.height * scaleY);
    const tint = opts?.tint ?? parseHexColor(entity.components.Sprite?.color, WHITE);
    const texW = Math.max(1, loaded.width);
    const texH = Math.max(1, loaded.height);
    const u0 = frame.rect.x / texW;
    const v0 = frame.rect.y / texH;
    const u1 = (frame.rect.x + frame.rect.width) / texW;
    const v1 = (frame.rect.y + frame.rect.height) / texH;
    batcher.draw(loaded.texture, x - w * 0.5, y - h * 0.5, w, h, 0, u0, v0, u1, v1, tint);
  }

  function drawSceneEntitySprite(view: RuntimeSceneView | null, name: string, opts?: { width?: number; height?: number; tint?: number; fallbackX?: number; fallbackY?: number }): void {
    const entity = getSceneEntity(view, name);
    if (!entity || !isSceneEntityVisible(view, entity)) return;
    const pos = getSceneWorldTransform(view, entity);
    const rawX = pos.x || opts?.fallbackX || 0;
    const rawY = pos.y || opts?.fallbackY || 0;
    drawSceneSprite(
      entity,
      uiToScreenX(rawX),
      uiToScreenY(rawY),
      opts,
    );
  }

  function getChildSceneEntity(view: RuntimeSceneView | null, parentSuffix: string, name: string): RuntimeSceneEntity | null {
    return getSceneEntities(view, name).find((entity) => entity.parent?.endsWith(parentSuffix) && isSceneEntityVisible(view, entity)) ?? null;
  }

  function drawSceneText(text: string, cx: number, cy: number, w: number, h: number, size: number, color = WHITE): void {
    drawLabel(makeTextTex(text, Math.max(32, Math.ceil(w)), Math.max(20, Math.ceil(h)), size), cx, cy, w, h, color);
  }

  function formatTimerLabel(sec: number): string {
    const total = Math.max(0, Math.floor(sec));
    const min = Math.floor(total / 60);
    const remain = total % 60;
    return `${String(min).padStart(2, '0')}:${String(remain).padStart(2, '0')}`;
  }

  function saveLevel(): void {
    try { if (wx.setStorageSync) wx.setStorageSync('mj_level', currentLevel); } catch (e) {}
  }
  function loadLevel(): void {
    try { if (wx.getStorageSync) { const v = wx.getStorageSync('mj_level'); if (v) currentLevel = Math.max(1, Number(v)); } } catch (e) {}
  }

  // ─── Layout Helpers ───────────────────────────────────────────────────────
  const HUD_H = 64;
  const SLOT_H = 90;
  const SLOT_Y = () => H - SLOT_H + 10;
  const PLAY_BOT = () => H - SLOT_H;

  function getSlotAnchor(i: number): { x: number; y: number } {
    const tileFrames = getSceneEntities(mainGameScene, 'TileIn');
    const frame = tileFrames[i] ?? null;
    if (frame) {
      const pos = getSceneWorldTransform(mainGameScene, frame);
      return { x: uiToScreenX(pos.x), y: uiToScreenY(pos.y) };
    }
    return { x: (W / (MAX_SLOT + 1)) * (i + 1), y: SLOT_Y() + TILE_H / 2 };
  }

  function slotTargetX(i: number): number { return getSlotAnchor(i).x; }
  function slotTargetY(i = 0): number { return getSlotAnchor(i).y; }

  // ─── 3D Grid Helpers ──────────────────────────────────────────────────────
  interface GridPos { col: number; row: number; layer: number; }

  function tileWorldPos(col: number, row: number, layer: number): { twx: number; twy: number; twz: number } {
    return {
      twx: (col - (GRID_COLS - 1) * 0.5) * TSPACE_X,
      twy:  layer * TSPACE_Y,
      twz: (row - (GRID_ROWS - 1) * 0.5) * TSPACE_Z,
    };
  }

  function generateStackedLayout(count: number): GridPos[] {
    const result: GridPos[] = [];
    const occupied = new Set<string>();
    let l = 0;
    while (result.length < count && l < 12) {
      const valid: GridPos[] = [];
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          if (l === 0 || occupied.has(`${c},${r},${l-1}`)) {
            if (!occupied.has(`${c},${r},${l}`)) valid.push({ col:c, row:r, layer:l });
          }
        }
      }
      for (const p of shuffle(valid)) {
        if (result.length >= count) break;
        result.push(p);
        occupied.add(`${p.col},${p.row},${p.layer}`);
      }
      l++;
    }
    return result;
  }

  function computeBlocked(tiles: WorldTile[]): void {
    const pos = new Set<string>();
    for (const t of tiles) if (!t.removing) pos.add(`${t.col},${t.row},${t.layer}`);
    for (const t of tiles) t.blocked = !t.removing && pos.has(`${t.col},${t.row},${t.layer+1}`);
  }

  function makeWorldTile(id: number, pos: GridPos): WorldTile {
    const { twx, twy, twz } = tileWorldPos(pos.col, pos.row, pos.layer);
    const sc = camera3d.worldToScreen(twx, twy + 1, twz, W, H) ?? { x: W/2, y: H/2 };
    return {
      id, col: pos.col, row: pos.row, layer: pos.layer,
      wx: twx, wy: SPAWN_Y, wz: twz,
      twx, twy, twz,
      sx: sc.x, sy: sc.y,
      animating: true, animT: 0,
      depth: pos.layer * 1000 + pos.row * GRID_COLS + pos.col,
      blocked: false, removing: false, removeT: 0,
    };
  }

  // ─── Build Level ──────────────────────────────────────────────────────────
  function startGame(level: number): void {
    const lv = Math.max(1, Math.min(level, LevelConfs.length));
    const loopLv = lv > LevelConfs.length
      ? ((lv - LevelLoopMin) % (LevelConfs.length - LevelLoopMin) + LevelLoopMin)
      : lv;
    cfg = LevelConfs[loopLv - 1];

    const pool = buildTilePool(cfg);
    totalGroups = cfg.CombieCount;
    matchedGroups = 0;
    timerSec = cfg.Time;
    timerAccum = 0;
    gameEnded = false;
    tapEnabled = true;

    worldTiles = [];
    slotTiles = [];

    const layout = generateStackedLayout(pool.length);
    worldTiles = layout.map((pos, i) => makeWorldTile(pool[i], pos));
    computeBlocked(worldTiles);

    scene = 'game';
    log('level', level, 'tiles', pool.length, 'groups', totalGroups);
  }

  // ─── Slot Insertion ───────────────────────────────────────────────────────
  function insertToSlot(id: number, fromX: number, fromY: number): boolean {
    if (slotTiles.length >= MAX_SLOT) return false;

    let pos = slotTiles.length;
    for (let i = 0; i < slotTiles.length; i++) {
      if (slotTiles[i].id > id) { pos = i; break; }
    }
    while (pos < slotTiles.length && slotTiles[pos].id === id) pos++;

    slotTiles.splice(pos, 0, {
      id, x: fromX, y: fromY,
      tx: slotTargetX(pos), ty: slotTargetY(pos),
      animating: true, animT: 0,
      removing: false, removeT: 0,
    });

    for (let i = 0; i < slotTiles.length; i++) {
      slotTiles[i].tx = slotTargetX(i);
      slotTiles[i].ty = slotTargetY(i);
    }
    return true;
  }

  // ─── Match Detection ──────────────────────────────────────────────────────
  function checkMatch(): boolean {
    let s = 0, e = 0;
    const arr = slotTiles;
    while (e < arr.length) {
      if (e - s === 3) return doMatch(s);
      if (arr[s].id === arr[e].id) { e++; }
      else { s++; e++; }
    }
    if (e - s === 3) return doMatch(s);
    return false;
  }

  function doMatch(s: number): boolean {
    play(sndCombie);
    for (let i = s; i < s+3; i++) slotTiles[i].removing = true;
    matchedGroups++;
    setTimeout(() => {
      slotTiles = slotTiles.filter(t => !t.removing);
      for (let i = 0; i < slotTiles.length; i++) {
        slotTiles[i].tx = slotTargetX(i);
        slotTiles[i].ty = slotTargetY(i);
        slotTiles[i].animating = true;
      }
      checkWin();
    }, 300);
    return true;
  }

  function checkMatchPossible(): boolean {
    let s = 0, e = 0;
    while (e < slotTiles.length) {
      if (e - s === 3) return true;
      if (slotTiles[s].id === slotTiles[e].id) { e++; }
      else { s++; e++; }
    }
    return e - s === 3;
  }

  function checkLose(): void {
    if (gameEnded) return;
    if (slotTiles.length >= MAX_SLOT && !checkMatchPossible()) triggerLose();
  }

  function checkWin(): void {
    if (gameEnded) return;
    if (matchedGroups >= totalGroups) triggerWin();
    else if (worldTiles.length === 0 && slotTiles.every(t => !t.removing)) checkLose();
  }

  function triggerWin(): void {
    gameEnded = true; tapEnabled = false;
    play(sndWin); currentLevel++; saveLevel();
    setTimeout(() => { scene = 'pass'; }, 600);
  }

  function triggerLose(): void {
    if (gameEnded) return;
    gameEnded = true; tapEnabled = false;
    play(sndFail);
    setTimeout(() => { scene = 'lose'; }, 600);
  }

  // ─── Props ────────────────────────────────────────────────────────────────
  function propXiPai(): void {
    if (props.xiPai <= 0 || gameEnded) return;
    props.xiPai--;
    const allIds: number[] = [];
    for (const t of worldTiles) allIds.push(t.id);
    for (const t of slotTiles) allIds.push(t.id);
    slotTiles = [];
    const shuffledIds = shuffle(allIds);
    const layout = generateStackedLayout(shuffledIds.length);
    worldTiles = layout.map((pos, i) => makeWorldTile(shuffledIds[i], pos));
    computeBlocked(worldTiles);
  }

  function propYiChu(): void {
    if (props.yiChu <= 0 || gameEnded || slotTiles.length === 0) return;
    props.yiChu--;
    const returned = slotTiles.splice(0, slotTiles.length);
    for (let i = 0; i < slotTiles.length; i++) {
      slotTiles[i].tx = slotTargetX(i);
      slotTiles[i].ty = slotTargetY(i);
      slotTiles[i].animating = true;
    }
    const stackTop: Record<string, number> = {};
    for (const t of worldTiles) {
      if (t.removing) continue;
      const k = `${t.col},${t.row}`;
      stackTop[k] = Math.max(stackTop[k] ?? -1, t.layer);
    }
    const emptyCells: string[] = [];
    for (let r = 0; r < GRID_ROWS; r++)
      for (let c = 0; c < GRID_COLS; c++)
        if (!((`${c},${r}`) in stackTop)) emptyCells.push(`${c},${r}`);
    const candidates = shuffle([...emptyCells, ...Object.keys(stackTop)]);

    for (let i = 0; i < returned.length; i++) {
      const st = returned[i];
      const key = candidates[i % candidates.length];
      const [c, r] = key.split(',').map(Number);
      const layer = (stackTop[key] ?? -1) + 1;
      stackTop[key] = layer;
      worldTiles.push(makeWorldTile(st.id, { col: c, row: r, layer }));
    }
    computeBlocked(worldTiles);
  }

  function propXiaoChu(): void {
    if (props.xiaochu <= 0 || gameEnded || worldTiles.length < 3) return;
    props.xiaochu--;
    const counts: Record<number, number[]> = {};
    for (let i = 0; i < worldTiles.length; i++) {
      const t = worldTiles[i];
      if (!counts[t.id]) counts[t.id] = [];
      counts[t.id].push(i);
    }
    const target = Object.keys(counts).find(k => counts[Number(k)].length >= 3);
    if (!target) return;
    const idxs = counts[Number(target)].slice(0, 3);
    for (const idx of idxs.sort((a,b) => b-a)) {
      worldTiles[idx].removing = true;
      worldTiles[idx].removeT = 0;
    }
    matchedGroups++;
    setTimeout(() => {
      worldTiles = worldTiles.filter(t => !t.removing);
      computeBlocked(worldTiles);
      play(sndCombie);
      checkWin();
    }, 400);
  }

  function propShiZhong(): void {
    if (props.shiZhong <= 0 || gameEnded) return;
    props.shiZhong--;
    timerSec = Math.min(timerSec + 120, cfg.Time);
  }

  // ─── Hit Testing (3D → screen AABB) ──────────────────────────────────────
  let lastTapX = -1, lastTapY = -1;
  let touchDown = false, touchDownX = 0, touchDownY = 0;

  function hitTestWorld(tx: number, ty: number): number {
    let best = -1, bestDepth = -1;
    for (let i = 0; i < worldTiles.length; i++) {
      const t = worldTiles[i];
      if (t.removing || t.blocked) continue;
      // Project top-face corners to screen and form AABB
      const y1 = t.wy + 1;
      const dx = 1.2, dz = 1.7;
      let mnX = Infinity, mxX = -Infinity, mnY = Infinity, mxY = -Infinity;
      const corners = [
        camera3d.worldToScreen(t.wx-dx, y1, t.wz-dz, W, H),
        camera3d.worldToScreen(t.wx-dx, y1, t.wz+dz, W, H),
        camera3d.worldToScreen(t.wx+dx, y1, t.wz+dz, W, H),
        camera3d.worldToScreen(t.wx+dx, y1, t.wz-dz, W, H),
      ];
      for (const c of corners) {
        if (!c) continue;
        if (c.x < mnX) mnX = c.x; if (c.x > mxX) mxX = c.x;
        if (c.y < mnY) mnY = c.y; if (c.y > mxY) mxY = c.y;
      }
      if (tx >= mnX && tx <= mxX && ty >= mnY && ty <= mxY) {
        if (t.depth > bestDepth) { bestDepth = t.depth; best = i; }
      }
    }
    return best;
  }

  // ─── Prop Button Layout ───────────────────────────────────────────────────
  const PROP_BTN_W = 52, PROP_BTN_H = 36;
  const PROP_BTNS = [
    { key: 'xiPai',    label: '洗牌', x: 0 },
    { key: 'yiChu',    label: '移出', x: 1 },
    { key: 'xiaochu',  label: '消除', x: 2 },
    { key: 'shiZhong', label: '+时间', x: 3 },
  ];
  function propBtnAnchor(i: number): { x: number; y: number } {
    const names = ['b1', 'b3', 'b4', 'b2'];
    const entity = getSceneEntity(mainGameScene, names[i]);
    if (entity) {
      const pos = getSceneWorldTransform(mainGameScene, entity);
      return {
        x: uiToScreenX(pos.x),
        y: uiToScreenY(pos.y),
      };
    }
    return { x: 30 + PROP_BTN_W * 0.5 + i * 92, y: H - SLOT_H - PROP_BTN_H - 22 };
  }
  function propBtnX(i: number): number { return propBtnAnchor(i).x - PROP_BTN_W * 0.5; }
  function propBtnY(i = 0): number { return propBtnAnchor(i).y - PROP_BTN_H * 0.5; }

  function hitTestPropBtn(tx: number, ty: number): string | null {
    for (let i = 0; i < PROP_BTNS.length; i++) {
      const bx = propBtnX(i);
      const by = propBtnY(i);
      if (tx >= bx && tx <= bx + PROP_BTN_W && ty >= by && ty <= by + PROP_BTN_H) return PROP_BTNS[i].key;
    }
    return null;
  }

  // ─── UI Buttons ───────────────────────────────────────────────────────────
  interface Btn { x: number; y: number; w: number; h: number; id: string; }
  let uiButtons: Btn[] = [];

  function hitBtn(tx: number, ty: number): string | null {
    for (const b of uiButtons) {
      if (tx >= b.x && tx <= b.x+b.w && ty >= b.y && ty <= b.y+b.h) return b.id;
    }
    return null;
  }

  // ─── Touch Setup ──────────────────────────────────────────────────────────
  function setupTouch(): void {
    if (typeof wx.onTouchStart !== 'function') return;

    wx.onTouchStart((e: any) => {
      const t = e.touches?.[0] || e.changedTouches?.[0];
      if (!t) return;
      touchDown = true;
      touchDownX = t.clientX;
      touchDownY = t.clientY;
    });

    wx.onTouchEnd((e: any) => {
      if (!touchDown) return;
      touchDown = false;
      const t = e.changedTouches?.[0];
      if (!t) return;
      const tx = t.clientX, ty = t.clientY;
      if (Math.abs(tx - touchDownX) > 12 || Math.abs(ty - touchDownY) > 12) return;

      lastTapX = tx; lastTapY = ty;

      const btn = hitBtn(tx, ty);
      if (btn) { handleBtnTap(btn); return; }

      if (scene === 'game' && tapEnabled) {
        const prop = hitTestPropBtn(tx, ty);
        if (prop) { handlePropTap(prop); return; }

        const idx = hitTestWorld(tx, ty);
        if (idx >= 0) {
          const t2 = worldTiles[idx];
          play(sndClick);
          worldTiles.splice(idx, 1);
          computeBlocked(worldTiles);
          const ok = insertToSlot(t2.id, t2.sx, t2.sy);
          if (!ok) {
            worldTiles.push({ ...t2, animating: false });
            return;
          }
          checkMatch();
          setTimeout(() => { checkLose(); }, 350);
        }
      }
    });
  }

  function handleBtnTap(id: string): void {
    if (id === 'start' || id === 'retry') { startGame(currentLevel); }
    else if (id === 'next') { startGame(currentLevel); }
  }

  function handlePropTap(key: string): void {
    if (key === 'xiPai') propXiPai();
    else if (key === 'yiChu') propYiChu();
    else if (key === 'xiaochu') propXiaoChu();
    else if (key === 'shiZhong') propShiZhong();
  }

  // ─── 2D Render Helpers ────────────────────────────────────────────────────
  function drawRect(x: number, y: number, w: number, h: number, color: number): void {
    batcher.draw(whiteTex, x, y, w, h, 0, 0, 0, 1, 1, color);
  }

  function drawTile(id: number, cx: number, cy: number, alpha01: number, rot: number, scale = 1): void {
    const uv = TILE_UV[id];
    const tex = tileTexReady && tileTex ? tileTex : whiteTex;
    const tileColor = tileTexReady ? packABGR(255,255,255,Math.round(alpha01*255))
                                   : packABGR(200,160,80,Math.round(alpha01*255));
    const tw = TILE_W*scale, th = TILE_H*scale;
    if (tileTexReady && uv) {
      batcher.draw(tex, cx-tw/2, cy-th/2, tw, th, rot, uv.u0, uv.v0, uv.u1, uv.v1, tileColor);
    } else {
      const hue = (id*37)%360;
      const fallback = hsvToRGB(hue, 0.7, 0.8, Math.round(alpha01*255));
      batcher.draw(whiteTex, cx-tw/2, cy-th/2, tw, th, rot, 0, 0, 1, 1, fallback);
    }
  }

  function hsvToRGB(h: number, s: number, v: number, a: number): number {
    const c = v*s, x = c*(1-Math.abs((h/60)%2-1)), m = v-c;
    let r = 0, g = 0, b = 0;
    if (h<60){r=c;g=x;} else if (h<120){r=x;g=c;} else if (h<180){g=c;b=x;}
    else if (h<240){g=x;b=c;} else if (h<300){r=x;b=c;} else {r=c;b=x;}
    return packABGR(Math.round((r+m)*255), Math.round((g+m)*255), Math.round((b+m)*255), a);
  }

  function drawNumber(n: number, cx: number, cy: number, charH: number, color: number): void {
    const str = String(Math.max(0, Math.floor(n)));
    const charW = charH*(DIGIT_W/DIGIT_H), totalW = str.length*charW;
    const startX = cx - totalW/2;
    for (let i = 0; i < str.length; i++) {
      const d = parseInt(str[i]);
      const u0 = d/10, u1 = (d+1)/10;
      if (digitTex) {
        batcher.draw(digitTex, startX+i*charW, cy-charH/2, charW, charH, 0, u0, 0, u1, 1, color);
      } else {
        batcher.draw(whiteTex, startX+i*charW, cy-charH/2, charW-1, charH, 0, 0, 0, 1, 1, color);
      }
    }
  }

  function drawLabel(tex: WebGLTexture | null, cx: number, cy: number, w: number, h: number, color: number): void {
    if (!tex) return;
    batcher.draw(tex, cx - w/2, cy - h/2, w, h, 0, 0, 0, 1, 1, color);
  }

  // ─── 3D World Tile Renderer ───────────────────────────────────────────────
  function renderWorldTiles3D(): void {
    if (!prog3d || !tileMesh) return;
    const gl = device.gl;
    gl.clear(gl.DEPTH_BUFFER_BIT);
    device.setDepthState(true, true, gl.LESS);
    device.setCullFace(true, gl.BACK);
    device.useProgram(prog3d!);
    const attribs: VertexAttrib[] = [
      { location: aPos3,  components: 3, offset:  0 },
      { location: aNorm3, components: 3, offset: 12 },
      { location: aUV3,   components: 2, offset: 24 },
    ];
    tileMesh.bind(gl, attribs);
    device.bindTexture(0, tileTexReady && tileTex ? tileTex : whiteTex);
    gl.uniform1i(uTex3, 0);
    for (const t of worldTiles) {
      if (t.removing && t.removeT >= 1) continue;
      gl.uniformMatrix4fv(uMVP3, false, camera3d.buildMVP(t.wx, t.wy, t.wz));
      const uv = TILE_UV[t.id];
      gl.uniform4f(uUVR3, uv?.u0 ?? 0, uv?.v0 ?? 0, uv?.u1 ?? 1, uv?.v1 ?? 1);
      const removeFade = t.removing ? Math.max(0, 1 - t.removeT * 2) : 1;
      gl.uniform1f(uDim3, (t.blocked ? 0.55 : 1.0) * removeFade);
      tileMesh.draw(gl);
    }
    tileMesh.unbind(gl, attribs);
    device.setDepthState(false);
    device.setCullFace(false);
  }

  // ─── FPS Tracking ─────────────────────────────────────────────────────────
  let lastT = 0, fps = 0, fpsAcc = 0, fpsN = 0;

  // ─── Render ───────────────────────────────────────────────────────────────
  function render(ts: number): void {
    const dt = lastT ? Math.min(0.05, (ts - lastT) / 1000) : 0;
    lastT = ts;
    fpsAcc += dt; fpsN++;
    if (fpsAcc >= 1) { fps = fpsN/fpsAcc; fpsAcc = 0; fpsN = 0; }

    if (scene === 'game' && !gameEnded) {
      timerAccum += dt;
      if (timerAccum >= 1) { timerSec = Math.max(0, timerSec-1); timerAccum -= 1; }
      if (timerSec <= 0 && !gameEnded) triggerLose();
    }

    // Animate world tiles (3D)
    for (const t of worldTiles) {
      if (t.removing) {
        t.removeT = Math.min(1, t.removeT + dt * 4);
      } else if (t.animating) {
        t.animT = Math.min(1, t.animT + dt * 6);
        const ease = 1 - Math.pow(1 - t.animT, 3);
        t.wx = t.twx;
        t.wy = SPAWN_Y + (t.twy - SPAWN_Y) * ease;
        t.wz = t.twz;
        if (t.animT >= 1) { t.wy = t.twy; t.animating = false; }
      }
      // Update screen projection for hit testing
      const sc = camera3d.worldToScreen(t.wx, t.wy + 1, t.wz, W, H);
      if (sc) { t.sx = sc.x; t.sy = sc.y; }
    }

    // Animate slot tiles (2D)
    for (const t of slotTiles) {
      if (t.removing) {
        t.removeT = Math.min(1, t.removeT + dt * 5);
      } else {
        const dx = t.tx - t.x, dy = t.ty - t.y, spd = dt * 12;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) { t.x = t.tx; t.y = t.ty; t.animating = false; }
        else { t.x += dx * Math.min(1, spd); t.y += dy * Math.min(1, spd); }
      }
    }

    device.setViewport(0, 0, W, H);
    device.clear(0.06, 0.09, 0.16, 1);

    uiButtons = [];

    if (scene === 'loading') { renderLoading(); }
    else if (scene === 'home') { renderHome(); }
    else if (scene === 'game') { renderGame(dt); }
    else if (scene === 'pass') { renderPass(); }
    else if (scene === 'lose') { renderLose(); }

    requestFrame(render);
  }

  function renderLoading(): void {
    batcher.begin(proj);
    drawRect(0, 0, W, H, packABGR(8, 15, 30, 255));
    drawSceneSprite(getSceneEntity(loadingScene, 'mjbg.png'), W * 0.5, H * 0.5, { width: W, height: H });
    drawSceneEntitySprite(loadingScene, '4a2996d24d5de3a7489e8fbcec34cb3', { fallbackY: 343.25199999999995 });

    const progressRoot = getSceneEntity(loadingScene, 'ProgressBar');
    const progressX = uiToScreenX(getTransformNumber(progressRoot, 'x'));
    const progressY = uiToScreenY(getTransformNumber(progressRoot, 'y', -491.172));
    drawSceneSprite(progressRoot, progressX, progressY);

    const fillW = Math.max(16, Math.round(292 * loadingProgress));
    drawSceneEntitySprite(loadingScene, 'Bar', { width: fillW, height: 16, fallbackX: -300.972, fallbackY: -500.329 });
    drawSceneText(`${Math.round(loadingProgress * 100)}%`, progressX, progressY - 28, 72, 22, 16, WHITE);

    const legal = getSceneEntity(loadingScene, '抵制不良游戏，拒绝盗版游戏。      注意自我保护，谨防受骗上当。       适度游戏益脑，沉迷游戏伤身。      合理');
    drawSceneText(getLabelText(legal, '健康游戏提示'), W * 0.5, H - 42, W - 48, 18, 10, packABGR(226, 232, 240, 220));
    drawSceneText('8+', W * 0.5, H - 22, 24, 18, 12, packABGR(251, 191, 36, 255));
    batcher.end();
  }

  // ─── Home Screen ──────────────────────────────────────────────────────────
  function renderHome(): void {
    batcher.begin(proj);

    drawRect(0, 0, W, H, packABGR(8, 15, 30, 255));
    drawSceneSprite(getSceneEntity(homeScene, 'mjbg.png'), W * 0.5, H * 0.5, { width: W, height: H });
    drawSceneEntitySprite(homeScene, 'Logo', { fallbackY: 293.905 });
    drawSceneEntitySprite(homeScene, 'btnSetting', { fallbackX: -291.454, fallbackY: 512.71 });

    const sideSpriteNames = ['btnMission', 'btnLuckilyBox', 'btnSaveGold', 'btnDailyChallenge', 'btnGameClub', 'btnRank', 'btnInvateFriend'];
    for (const name of sideSpriteNames) {
      const entity = getSceneEntity(homeScene, name);
      if (!entity) continue;
      const pos = getSceneWorldTransform(homeScene, entity);
      drawSceneSprite(entity, uiToScreenX(pos.x), uiToScreenY(pos.y));
    }
    const dailyDot = getChildSceneEntity(homeScene, '/btnDailyChallenge', '红点');
    if (dailyDot) {
      const pos = getSceneWorldTransform(homeScene, dailyDot);
      drawSceneSprite(dailyDot, uiToScreenX(pos.x), uiToScreenY(pos.y));
    }

    const goldRoot = getVisibleScenePathEntity(homeScene, 'Canvas/GoldNum');
    const fatigueRoot = getVisibleScenePathEntity(homeScene, 'Canvas/FatigueNum');
    const goldFrame = getChildSceneEntity(homeScene, '/GoldNum', '体力金币框');
    const goldIcon = getChildSceneEntity(homeScene, '/GoldNum', '金币');
    const goldAdd = getChildSceneEntity(homeScene, '/GoldNum', 'btnGoldAdd');
    const goldLabel = getChildSceneEntity(homeScene, '/GoldNum', 'goldNumLabel');
    const fatigueFrame = getChildSceneEntity(homeScene, '/FatigueNum', '体力金币框');
    const fatigueIcon = getChildSceneEntity(homeScene, '/FatigueNum', '金币');
    const fatigueAdd = getChildSceneEntity(homeScene, '/FatigueNum', 'btnFatigueAdd');
    const fatigueLabel = getChildSceneEntity(homeScene, '/FatigueNum', 'ftNumLabel');

    if (goldRoot) {
      const rootPos = getSceneWorldTransform(homeScene, goldRoot);
      drawSceneSprite(goldFrame, uiToScreenX(rootPos.x), uiToScreenY(rootPos.y));
      if (goldIcon) {
        const pos = getSceneWorldTransform(homeScene, goldIcon);
        drawSceneSprite(goldIcon, uiToScreenX(pos.x), uiToScreenY(pos.y));
      }
      if (goldAdd) {
        const pos = getSceneWorldTransform(homeScene, goldAdd);
        drawSceneSprite(goldAdd, uiToScreenX(pos.x), uiToScreenY(pos.y));
      }
      if (goldLabel) {
        const pos = getSceneWorldTransform(homeScene, goldLabel);
        drawSceneText(getLabelText(goldLabel, '0'), uiToScreenX(pos.x), uiToScreenY(pos.y), 36, 18, 14, WHITE);
      }
    }
    if (fatigueRoot) {
      const rootPos = getSceneWorldTransform(homeScene, fatigueRoot);
      drawSceneSprite(fatigueFrame, uiToScreenX(rootPos.x), uiToScreenY(rootPos.y));
      if (fatigueIcon) {
        const pos = getSceneWorldTransform(homeScene, fatigueIcon);
        drawSceneSprite(fatigueIcon, uiToScreenX(pos.x), uiToScreenY(pos.y));
      }
      if (fatigueAdd) {
        const pos = getSceneWorldTransform(homeScene, fatigueAdd);
        drawSceneSprite(fatigueAdd, uiToScreenX(pos.x), uiToScreenY(pos.y));
      }
      if (fatigueLabel) {
        const pos = getSceneWorldTransform(homeScene, fatigueLabel);
        drawSceneText(getLabelText(fatigueLabel, '0'), uiToScreenX(pos.x), uiToScreenY(pos.y), 36, 18, 14, WHITE);
      }
    }

    const starChest = getSceneEntity(homeScene, 'btnHomeBoxStar');
    const starChestLeft = getChildSceneEntity(homeScene, '/btnHomeBoxStar', '星星宝箱-2');
    const starChestMain = getChildSceneEntity(homeScene, '/btnHomeBoxStar', '星星宝箱');
    const starProgress = getChildSceneEntity(homeScene, '/btnHomeBoxStar', '进度框2');
    const starTips = getChildSceneEntity(homeScene, '/btnHomeBoxStar', 'tips');
    const starNum = getChildSceneEntity(homeScene, '/btnHomeBoxStar', 'starNum');
    const levelChest = getSceneEntity(homeScene, 'btnHomeBoxLevel');
    const levelChestLeft = getChildSceneEntity(homeScene, '/btnHomeBoxLevel', '关卡宝箱-2');
    const levelChestMain = getChildSceneEntity(homeScene, '/btnHomeBoxLevel', '关卡宝箱');
    const levelProgress = getChildSceneEntity(homeScene, '/btnHomeBoxLevel', '进度框1');
    const levelTips = getChildSceneEntity(homeScene, '/btnHomeBoxLevel', 'tips');
    const levelNum = getChildSceneEntity(homeScene, '/btnHomeBoxLevel', 'levelNum');

    for (const entity of [starChest, levelChest]) {
      if (!entity) continue;
      const pos = getSceneWorldTransform(homeScene, entity);
      drawSceneSprite(entity, uiToScreenX(pos.x), uiToScreenY(pos.y));
    }
    for (const entity of [starChestLeft, starChestMain, levelChestLeft, levelChestMain]) {
      if (!entity) continue;
      const pos = getSceneWorldTransform(homeScene, entity);
      drawSceneSprite(entity, uiToScreenX(pos.x), uiToScreenY(pos.y));
    }
    for (const entity of [starProgress, levelProgress]) {
      if (!entity) continue;
      const pos = getSceneWorldTransform(homeScene, entity);
      drawSceneSprite(entity, uiToScreenX(pos.x), uiToScreenY(pos.y));
    }
    for (const entity of [starTips, levelTips]) {
      if (!entity) continue;
      const pos = getSceneWorldTransform(homeScene, entity);
      drawSceneSprite(entity, uiToScreenX(pos.x), uiToScreenY(pos.y));
    }
    const starItem1Icon = getVisibleScenePathEntity(homeScene, 'Canvas/btnHomeBoxStar/tips/Node-001/starItem1/Sprite');
    const starItem1Label = getVisibleScenePathEntity(homeScene, 'Canvas/btnHomeBoxStar/tips/Node-001/starItem1/Label');
    const starItem2Icon = getVisibleScenePathEntity(homeScene, 'Canvas/btnHomeBoxStar/tips/Node-001/starItem2/Sprite');
    const starItem2Label = getVisibleScenePathEntity(homeScene, 'Canvas/btnHomeBoxStar/tips/Node-001/starItem2/Label');
    const levelItem1Icon = getVisibleScenePathEntity(homeScene, 'Canvas/btnHomeBoxLevel/tips/Node/levelItem1/Sprite');
    const levelItem1Label = getVisibleScenePathEntity(homeScene, 'Canvas/btnHomeBoxLevel/tips/Node/levelItem1/Label');
    const levelItem2Icon = getVisibleScenePathEntity(homeScene, 'Canvas/btnHomeBoxLevel/tips/Node/levelItem2/Sprite');
    const levelItem2Label = getVisibleScenePathEntity(homeScene, 'Canvas/btnHomeBoxLevel/tips/Node/levelItem2/Label');
    for (const entity of [starItem1Icon, starItem2Icon, levelItem1Icon, levelItem2Icon]) {
      if (!entity) continue;
      const pos = getSceneWorldTransform(homeScene, entity);
      drawSceneSprite(entity, uiToScreenX(pos.x), uiToScreenY(pos.y));
    }
    for (const entity of [starItem1Label, starItem2Label, levelItem1Label, levelItem2Label]) {
      if (!entity) continue;
      const pos = getSceneWorldTransform(homeScene, entity);
      drawSceneText(getLabelText(entity, '100'), uiToScreenX(pos.x), uiToScreenY(pos.y), 20, 12, 10, packABGR(32, 32, 32, 255));
    }
    if (starNum) {
      const pos = getSceneWorldTransform(homeScene, starNum);
      drawSceneText(getLabelText(starNum, '0/500'), uiToScreenX(pos.x), uiToScreenY(pos.y), 70, 16, 12, WHITE);
    }
    if (levelNum) {
      const pos = getSceneWorldTransform(homeScene, levelNum);
      drawSceneText(`0/${currentLevel}`, uiToScreenX(pos.x), uiToScreenY(pos.y), 70, 16, 12, WHITE);
    }

    drawSceneEntitySprite(homeScene, 'btnPropShop', { fallbackX: -305.913, fallbackY: -489.43 });
    drawSceneEntitySprite(homeScene, 'btnShare', { fallbackX: 312.626, fallbackY: -488.216 });
    const shopLabel = getChildSceneEntity(homeScene, '/btnPropShop', 'SHANGDIANa');
    const shareLabel = getChildSceneEntity(homeScene, '/btnShare', '分享');
    if (shopLabel) {
      const pos = getSceneWorldTransform(homeScene, shopLabel);
      drawSceneText(getLabelText(shopLabel, '商店'), uiToScreenX(pos.x), uiToScreenY(pos.y), 40, 18, 14, WHITE);
    }
    if (shareLabel) {
      const pos = getSceneWorldTransform(homeScene, shareLabel);
      drawSceneText(getLabelText(shareLabel, '分享'), uiToScreenX(pos.x), uiToScreenY(pos.y), 40, 18, 14, WHITE);
    }

    const startRoot = getSceneEntity(homeScene, 'btnStartMainGame');
    const levelShow = getChildSceneEntity(homeScene, '/btnStartMainGame', 'LevelShow');
    const levelShowLabel = getChildSceneEntity(homeScene, '/btnStartMainGame/LevelShow', 'Label');
    const startBtnSprite = getChildSceneEntity(homeScene, '/btnStartMainGame', 'Btn');
    const startTextNode = getChildSceneEntity(homeScene, '/btnStartMainGame/Btn', 'txt');
    const startSubTextNode = getChildSceneEntity(homeScene, '/btnStartMainGame/Btn/txt', 'txt-001');
    const shareTag = getChildSceneEntity(homeScene, '/btnStartMainGame/Btn', 'shareTag');
    const shipinTag = getChildSceneEntity(homeScene, '/btnStartMainGame/Btn', 'shipinTag2');
    const startPos = getSceneWorldTransform(homeScene, startRoot);
    const startCenterX = uiToScreenX(startPos.x);
    const startCenterY = uiToScreenY(startPos.y || -370.17);
    const startBtnSize = getSceneButtonRect(startBtnSprite, 208, 68);
    const startBtn: Btn = { x: startCenterX - startBtnSize.width * 0.5, y: startCenterY - startBtnSize.height * 0.5, w: startBtnSize.width, h: startBtnSize.height, id: 'start' };
    uiButtons.push(startBtn);
    if (levelShow) {
      const pos = getSceneWorldTransform(homeScene, levelShow);
      drawSceneSprite(levelShow, uiToScreenX(pos.x), uiToScreenY(pos.y));
    }
    if (levelShowLabel) {
      const pos = getSceneWorldTransform(homeScene, levelShowLabel);
      drawSceneText(`第${currentLevel}关`, uiToScreenX(pos.x), uiToScreenY(pos.y), 76, 18, 14, packABGR(32, 32, 32, 255));
    }
    if (startBtnSprite) {
      const pos = getSceneWorldTransform(homeScene, startBtnSprite);
      drawSceneSprite(startBtnSprite, uiToScreenX(pos.x), uiToScreenY(pos.y));
    }
    if (shareTag) {
      const pos = getSceneWorldTransform(homeScene, shareTag);
      drawSceneSprite(shareTag, uiToScreenX(pos.x), uiToScreenY(pos.y));
    }
    if (shipinTag) {
      const pos = getSceneWorldTransform(homeScene, shipinTag);
      drawSceneSprite(shipinTag, uiToScreenX(pos.x), uiToScreenY(pos.y));
    }
    if (startTextNode) {
      const pos = getSceneWorldTransform(homeScene, startTextNode);
      drawSceneText(getLabelText(startTextNode, '开始游戏'), uiToScreenX(pos.x), uiToScreenY(pos.y), 110, 24, 18, WHITE);
    }
    if (startSubTextNode) {
      const pos = getSceneWorldTransform(homeScene, startSubTextNode);
      drawSceneText(getLabelText(startSubTextNode, '今日次数（3/3）'), uiToScreenX(pos.x), uiToScreenY(pos.y), 130, 18, 12, WHITE);
    }

    drawNumber(Math.round(fps), W - 24, 18, 14, GRAY);
    batcher.end();
  }

  // ─── Game Screen ──────────────────────────────────────────────────────────
  function renderGame(_dt: number): void {
    // 3D pass: world tiles
    renderWorldTiles3D();

    // 2D pass: slot, HUD, prop buttons
    batcher.begin(proj);

    const playBot = PLAY_BOT();

    const bottomRoot = getSceneEntity(mainGameScene, 'bottom');
    const bottomY = uiToScreenY(getTransformNumber(bottomRoot, 'y', -582));

    // Slot area background
    drawRect(0, playBot, W, SLOT_H, SLOT_BG);
    drawRect(0, playBot, W, 2, packABGR(71,85,105,255));

    // Slot markers
    for (let i = 0; i < MAX_SLOT; i++) {
      const frame = getSceneEntities(mainGameScene, 'TileIn')[i] ?? null;
      const sx = slotTargetX(i) - TILE_W/2;
      const sy = slotTargetY(i) - TILE_H/2;
      if (frame) {
        drawSceneSprite(frame, slotTargetX(i), slotTargetY(i));
        const ring0 = getVisibleScenePathEntity(mainGameScene, `Canvas/select/TileIn${i === 0 ? '' : `:${i}`}/e${i}/ring0`) ?? getVisibleScenePathEntity(mainGameScene, `Canvas/select/TileIn/e${i}/ring0`);
        if (ring0) drawSceneSprite(ring0, slotTargetX(i), slotTargetY(i), { tint: packABGR(180, 190, 210, 120) });
      } else {
        drawRect(sx-2, sy-2, TILE_W+4, TILE_H+4, packABGR(51,65,85,255));
        drawRect(sx, sy, TILE_W, TILE_H, packABGR(24,34,52,255));
      }
    }

    // Slot tiles
    for (const t of slotTiles) {
      const alpha = t.removing ? (1 - t.removeT) : 1;
      const scale = t.removing ? (1 + t.removeT * 0.4) : 1;
      drawRect(t.x-TILE_W/2+TILE_SHADOW*0.5, t.y-TILE_H/2+TILE_SHADOW*0.5,
               TILE_W*scale, TILE_H*scale, packABGR(0,0,0,Math.round(alpha*60)));
      drawTile(t.id, t.x, t.y, alpha, 0, scale);
    }

    // Imported bottom bar and prop buttons
    drawRect(0, bottomY - 54, W, 108, packABGR(5, 10, 18, 220));
    for (let i = 0; i < PROP_BTNS.length; i++) {
      const buttonName = ['b1', 'b3', 'b4', 'b2'][i];
      const buttonEntity = getSceneEntity(mainGameScene, buttonName);
      const iconEntity = getChildSceneEntity(mainGameScene, `/bottom/${buttonName}`, 'Icon');
      const labelEntity = getChildSceneEntity(mainGameScene, `/bottom/${buttonName}`, 'Label');
      const counterFrame = getChildSceneEntity(mainGameScene, `/bottom/${buttonName}`, '道具计数框');
      const counterLabel = getChildSceneEntity(mainGameScene, `/bottom/${buttonName}`, `PropNum${i + 1}`);
      const anchor = propBtnAnchor(i);
      const count = (props as any)[PROP_BTNS[i].key] as number;
      const tint = count > 0 ? WHITE : packABGR(140, 148, 163, 190);
      drawSceneSprite(buttonEntity, anchor.x, anchor.y, { tint });
      drawSceneSprite(iconEntity, anchor.x - 40, anchor.y + 10, { tint });
      drawSceneText(getLabelText(labelEntity, PROP_BTNS[i].label), anchor.x + 22, anchor.y + 10, 44, 18, 14, WHITE);
      drawSceneSprite(counterFrame, anchor.x + 34, anchor.y + 24);
      const addEntity = getChildSceneEntity(mainGameScene, `/bottom/${buttonName}`, `add${i + 1}`);
      if (addEntity) drawSceneSprite(addEntity, anchor.x + 35, anchor.y + 24);
      drawSceneText(String(count), anchor.x + 34, anchor.y + 24, 20, 16, 12, YELLOW);
    }

    // Imported top HUD
    drawRect(0, 0, W, HUD_H + 8, packABGR(10, 18, 34, 210));
    drawSceneEntitySprite(mainGameScene, 'btnMainGamePause', { fallbackX: -293, fallbackY: 510 });
    drawSceneEntitySprite(mainGameScene, 'LevelTimer', { fallbackY: 509.3395 });

    const levelLabel = getVisibleScenePathEntity(mainGameScene, 'Canvas/LevelTimer/Node/curretLevelLabel') ?? getSceneEntity(mainGameScene, 'curretLevelLabel');
    const timerNum = getVisibleScenePathEntity(mainGameScene, 'Canvas/LevelTimer/Node/timer/TimerNum') ?? getSceneEntity(mainGameScene, 'TimerNum');
    const remainLabel = getVisibleScenePathEntity(mainGameScene, 'Canvas/LevelTimer/remain') ?? getSceneEntity(mainGameScene, 'remain');
    const startIcon = getVisibleScenePathEntity(mainGameScene, 'Canvas/Start/StartIcon') ?? getSceneEntity(mainGameScene, 'StartIcon');
    const startNum = getVisibleScenePathEntity(mainGameScene, 'Canvas/Start/StartNum') ?? getSceneEntity(mainGameScene, 'StartNum');
    const tipButton = getVisibleScenePathEntity(mainGameScene, 'Canvas/tipNode/yellow_button11') ?? getSceneEntity(mainGameScene, 'yellow_button11');
    const tipText = getVisibleScenePathEntity(mainGameScene, 'Canvas/tipNode/txt') ?? getSceneEntity(mainGameScene, 'txt');
    const tipFinger = getVisibleScenePathEntity(mainGameScene, 'Canvas/tipNode/figer') ?? getSceneEntity(mainGameScene, 'figer');
    const timerCenterX = W * 0.5;
    const timerCenterY = 36;

    const levelLabelPos = getSceneWorldTransform(mainGameScene, levelLabel);
    const timerNumPos = getSceneWorldTransform(mainGameScene, timerNum);
    const remainLabelPos = getSceneWorldTransform(mainGameScene, remainLabel);
    drawSceneText(`第${currentLevel}关`, uiToScreenX(levelLabelPos.x), uiToScreenY(levelLabelPos.y), 60, 18, 14, WHITE);
    drawSceneText(formatTimerLabel(timerSec), uiToScreenX(timerNumPos.x), uiToScreenY(timerNumPos.y), 72, 22, 18, timerSec > 30 ? WHITE : timerSec > 10 ? YELLOW : RED);

    const remainCount = worldTiles.length;
    drawSceneText(`剩余：${remainCount}`, uiToScreenX(remainLabelPos.x), uiToScreenY(remainLabelPos.y), 84, 18, 12, packABGR(226, 232, 240, 255));

    const timerRatio = cfg ? timerSec / cfg.Time : 1;
    const barColor = timerSec > 30 ? GREEN : timerSec > 10 ? YELLOW : RED;
    drawRect(timerCenterX - 86, 62, 172, 4, packABGR(30,41,59,255));
    drawRect(timerCenterX - 86, 62, Math.round(172 * timerRatio), 4, barColor);

    const startIconPos = getSceneWorldTransform(mainGameScene, startIcon);
    const startNumPos = getSceneWorldTransform(mainGameScene, startNum);
    drawSceneSprite(startIcon, uiToScreenX(startIconPos.x), uiToScreenY(startIconPos.y));
    drawSceneText(String(Math.max(0, totalGroups - matchedGroups)), uiToScreenX(startNumPos.x), uiToScreenY(startNumPos.y), 24, 18, 12, YELLOW);

    if (slotTiles.length === 0 && !gameEnded && tipButton && tipText && tipFinger) {
      const buttonPos = getSceneWorldTransform(mainGameScene, tipButton);
      const textPos = getSceneWorldTransform(mainGameScene, tipText);
      const fingerPos = getSceneWorldTransform(mainGameScene, tipFinger);
      drawSceneSprite(tipButton, uiToScreenX(buttonPos.x), uiToScreenY(buttonPos.y));
      drawSceneText(getLabelText(tipText, '点击三张相同的牌进行消除'), uiToScreenX(textPos.x), uiToScreenY(textPos.y), 220, 20, 12, WHITE);
      drawSceneSprite(tipFinger, uiToScreenX(fingerPos.x), uiToScreenY(fingerPos.y));
    }

    batcher.end();
  }

  // ─── Level Pass Screen ────────────────────────────────────────────────────
  function renderPass(): void {
    renderGame(0);

    batcher.begin(proj);
    drawRect(0, 0, W, H, packABGR(0, 0, 0, 170));

    const mask = getVisibleScenePathEntity(mainGameScene, 'Canvas/propTip/mask');
    const viewRoot = getVisibleScenePathEntity(mainGameScene, 'Canvas/propTip/View');
    const cardRoot = getVisibleScenePathEntity(mainGameScene, 'Canvas/propTip/View/card');
    const panelBg = getVisibleScenePathEntity(mainGameScene, 'Canvas/propTip/View/card/bg');
    const panelIcon = getVisibleScenePathEntity(mainGameScene, 'Canvas/propTip/View/card/icon');
    const panelTitle = getVisibleScenePathEntity(mainGameScene, 'Canvas/propTip/View/card/title');
    const panelDesc = getVisibleScenePathEntity(mainGameScene, 'Canvas/propTip/View/card/desc');
    const closeX = getVisibleScenePathEntity(mainGameScene, 'Canvas/propTip/View/card/Node/x');
    const adBtnSprite = getVisibleScenePathEntity(mainGameScene, 'Canvas/propTip/View/ad');
    const shareBtnSprite = getVisibleScenePathEntity(mainGameScene, 'Canvas/propTip/View/share');
    const viewPos = getSceneWorldTransform(mainGameScene, viewRoot);
    const cardPos = getSceneWorldTransform(mainGameScene, cardRoot);

    if (mask) drawSceneSprite(mask, W * 0.5, H * 0.5, { width: W, height: H });
    if (panelBg) drawSceneSprite(panelBg, uiToScreenX(cardPos.x), uiToScreenY(cardPos.y));
    if (panelIcon) {
      const pos = getSceneWorldTransform(mainGameScene, panelIcon);
      drawSceneSprite(panelIcon, uiToScreenX(pos.x), uiToScreenY(pos.y));
    }
    if (panelTitle) {
      const pos = getSceneWorldTransform(mainGameScene, panelTitle);
      drawSceneText('过关成功', uiToScreenX(pos.x), uiToScreenY(pos.y), 120, 28, 22, WHITE);
    }
    if (panelDesc) {
      const pos = getSceneWorldTransform(mainGameScene, panelDesc);
      drawSceneText(`第${currentLevel - 1}关完成`, uiToScreenX(pos.x), uiToScreenY(pos.y), 180, 42, 16, packABGR(226, 232, 240, 255));
    }
    if (closeX) {
      const pos = getSceneWorldTransform(mainGameScene, closeX);
      drawSceneSprite(closeX, uiToScreenX(pos.x), uiToScreenY(pos.y));
    }

    const nextBtnPos = getSceneWorldTransform(mainGameScene, adBtnSprite);
    const nextBtnSize = getSceneButtonRect(adBtnSprite, 204, 56);
    const nextBtn: Btn = { x: uiToScreenX(nextBtnPos.x) - nextBtnSize.width * 0.5, y: uiToScreenY(nextBtnPos.y) - nextBtnSize.height * 0.5, w: nextBtnSize.width, h: nextBtnSize.height, id: 'next' };
    uiButtons.push(nextBtn);
    if (adBtnSprite) drawSceneSprite(adBtnSprite, uiToScreenX(nextBtnPos.x), uiToScreenY(nextBtnPos.y));
    if (shareBtnSprite) {
      const pos = getSceneWorldTransform(mainGameScene, shareBtnSprite);
      drawSceneSprite(shareBtnSprite, uiToScreenX(pos.x), uiToScreenY(pos.y), { tint: packABGR(148, 163, 184, 220) });
    }
    drawSceneText('下一关', uiToScreenX(nextBtnPos.x), uiToScreenY(nextBtnPos.y), 110, 24, 18, WHITE);

    batcher.end();
  }

  // ─── Lose Screen ──────────────────────────────────────────────────────────
  function renderLose(): void {
    renderGame(0);

    batcher.begin(proj);
    drawRect(0, 0, W, H, packABGR(0, 0, 0, 170));

    const mask = getVisibleScenePathEntity(mainGameScene, 'Canvas/propTip/mask');
    const viewRoot = getVisibleScenePathEntity(mainGameScene, 'Canvas/propTip/View');
    const cardRoot = getVisibleScenePathEntity(mainGameScene, 'Canvas/propTip/View/card');
    const panelBg = getVisibleScenePathEntity(mainGameScene, 'Canvas/propTip/View/card/bg');
    const panelTitle = getVisibleScenePathEntity(mainGameScene, 'Canvas/propTip/View/card/title');
    const panelDesc = getVisibleScenePathEntity(mainGameScene, 'Canvas/propTip/View/card/desc');
    const closeX = getVisibleScenePathEntity(mainGameScene, 'Canvas/propTip/View/card/Node/x');
    const shareBtnSprite = getVisibleScenePathEntity(mainGameScene, 'Canvas/propTip/View/share');
    const cardPos = getSceneWorldTransform(mainGameScene, cardRoot);

    if (mask) drawSceneSprite(mask, W * 0.5, H * 0.5, { width: W, height: H });
    if (panelBg) drawSceneSprite(panelBg, uiToScreenX(cardPos.x), uiToScreenY(cardPos.y), { tint: packABGR(255, 180, 180, 255) });
    if (panelTitle) {
      const pos = getSceneWorldTransform(mainGameScene, panelTitle);
      drawSceneText('挑战失败', uiToScreenX(pos.x), uiToScreenY(pos.y), 120, 28, 22, WHITE);
    }
    if (panelDesc) {
      const pos = getSceneWorldTransform(mainGameScene, panelDesc);
      drawSceneText(`第${currentLevel}关未完成`, uiToScreenX(pos.x), uiToScreenY(pos.y), 200, 42, 16, packABGR(254, 226, 226, 255));
    }
    if (closeX) {
      const pos = getSceneWorldTransform(mainGameScene, closeX);
      drawSceneSprite(closeX, uiToScreenX(pos.x), uiToScreenY(pos.y));
    }

    const retryBtnPos = getSceneWorldTransform(mainGameScene, shareBtnSprite);
    const retryBtnSize = getSceneButtonRect(shareBtnSprite, 204, 56);
    const retryBtn: Btn = { x: uiToScreenX(retryBtnPos.x) - retryBtnSize.width * 0.5, y: uiToScreenY(retryBtnPos.y) - retryBtnSize.height * 0.5, w: retryBtnSize.width, h: retryBtnSize.height, id: 'retry' };
    uiButtons.push(retryBtn);
    if (shareBtnSprite) drawSceneSprite(shareBtnSprite, uiToScreenX(retryBtnPos.x), uiToScreenY(retryBtnPos.y), { tint: packABGR(248, 113, 113, 255) });
    drawSceneText('重试', uiToScreenX(retryBtnPos.x), uiToScreenY(retryBtnPos.y), 96, 24, 18, WHITE);

    batcher.end();
  }

  // ─── RAF ──────────────────────────────────────────────────────────────────
  function requestFrame(cb: (t: number) => void): void {
    if (canvas && typeof canvas.requestAnimationFrame === 'function') canvas.requestAnimationFrame(cb);
    else if (typeof requestAnimationFrame === 'function') requestAnimationFrame(cb);
    else setTimeout(() => cb(Date.now()), 16);
  }

  // ─── Boot ─────────────────────────────────────────────────────────────────
  const state: any = { caseId: 'mahjong-3d', hasWx: typeof wx !== 'undefined', summary: 'booting' };

  log('start');
  if (state.hasWx && typeof wx.onError === 'function') wx.onError((m: string) => console.error(TAG, m));

  if (!setupRenderer()) {
    state.summary = 'fail';
  } else {
    loadFixtureScenes();
    loadLevel();
    setupAudio();
    loadTileAtlas(() => {
      loadingProgress = 0.35;
      setupTouch();
      requestFrame(render);
      state.summary = 'running';
      log('game running, level=', currentLevel);
      loadingProgress = 1;
      scene = 'home';
    });
  }

  if (typeof globalThis !== 'undefined') globalThis.__MJ_GAME__ = state;
  module.exports = state;
})();
