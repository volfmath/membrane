export enum TouchPhase {
  Began = 0,
  Moved = 1,
  Held = 2,
  Ended = 3,
  Cancelled = 4,
}

export interface TouchPoint {
  id: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  deltaX: number;
  deltaY: number;
  phase: TouchPhase;
  timestamp: number;
}

export interface InputConfig {
  tapMaxDuration?: number;
  tapMaxDistance?: number;
  swipeMinDistance?: number;
  swipeMaxDuration?: number;
}

const MAX_TOUCH_POINTS = 10;

const enum EventType {
  Start = 0,
  Move = 1,
  End = 2,
  Cancel = 3,
}

interface PendingEvent {
  type: EventType;
  id: number;
  x: number;
  y: number;
  timestamp: number;
}

export class InputManager {
  private touches: TouchPoint[] = [];
  private touchMap = new Map<number, TouchPoint>();
  private pool: TouchPoint[] = [];
  private pending: PendingEvent[] = [];

  private _justPressed = false;
  private _justReleased = false;
  private _isTap = false;
  private _isSwipe = false;
  private _swipeDirection: 'up' | 'down' | 'left' | 'right' | null = null;

  private readonly tapMaxDuration: number;
  private readonly tapMaxDistance: number;
  private readonly swipeMinDistance: number;
  private readonly swipeMaxDuration: number;

  constructor(config?: InputConfig) {
    this.tapMaxDuration = config?.tapMaxDuration ?? 200;
    this.tapMaxDistance = config?.tapMaxDistance ?? 10;
    this.swipeMinDistance = config?.swipeMinDistance ?? 50;
    this.swipeMaxDuration = config?.swipeMaxDuration ?? 300;

    for (let i = 0; i < MAX_TOUCH_POINTS; i++) {
      this.pool.push({
        id: 0, x: 0, y: 0,
        startX: 0, startY: 0,
        deltaX: 0, deltaY: 0,
        phase: TouchPhase.Ended,
        timestamp: 0,
      });
    }
  }

  handleTouchStart(id: number, x: number, y: number, timestamp: number): void {
    this.pending.push({ type: EventType.Start, id, x, y, timestamp });
  }

  handleTouchMove(id: number, x: number, y: number, timestamp: number): void {
    this.pending.push({ type: EventType.Move, id, x, y, timestamp });
  }

  handleTouchEnd(id: number, x: number, y: number, timestamp: number): void {
    this.pending.push({ type: EventType.End, id, x, y, timestamp });
  }

  handleTouchCancel(id: number, x: number, y: number, timestamp: number): void {
    this.pending.push({ type: EventType.Cancel, id, x, y, timestamp });
  }

  update(): void {
    this._justPressed = false;
    this._justReleased = false;
    this._isTap = false;
    this._isSwipe = false;
    this._swipeDirection = null;

    for (let i = this.touches.length - 1; i >= 0; i--) {
      const tp = this.touches[i];
      if (tp.phase === TouchPhase.Ended || tp.phase === TouchPhase.Cancelled) {
        this.touchMap.delete(tp.id);
        this.touches.splice(i, 1);
        this.pool.push(tp);
      } else {
        tp.deltaX = 0;
        tp.deltaY = 0;
        if (tp.phase === TouchPhase.Began) {
          tp.phase = TouchPhase.Held;
        } else if (tp.phase === TouchPhase.Moved) {
          tp.phase = TouchPhase.Held;
        }
      }
    }

    for (let i = 0; i < this.pending.length; i++) {
      const evt = this.pending[i];

      switch (evt.type) {
        case EventType.Start: {
          if (this.touches.length >= MAX_TOUCH_POINTS) break;
          if (this.touchMap.has(evt.id)) break;
          const tp = this.pool.pop();
          if (!tp) break;
          tp.id = evt.id;
          tp.x = evt.x;
          tp.y = evt.y;
          tp.startX = evt.x;
          tp.startY = evt.y;
          tp.deltaX = 0;
          tp.deltaY = 0;
          tp.phase = TouchPhase.Began;
          tp.timestamp = evt.timestamp;
          this.touches.push(tp);
          this.touchMap.set(evt.id, tp);
          this._justPressed = true;
          break;
        }
        case EventType.Move: {
          const tp = this.touchMap.get(evt.id);
          if (!tp) break;
          tp.deltaX += evt.x - tp.x;
          tp.deltaY += evt.y - tp.y;
          tp.x = evt.x;
          tp.y = evt.y;
          if (tp.phase !== TouchPhase.Began) {
            tp.phase = TouchPhase.Moved;
          }
          break;
        }
        case EventType.End: {
          const tp = this.touchMap.get(evt.id);
          if (!tp) break;
          tp.deltaX += evt.x - tp.x;
          tp.deltaY += evt.y - tp.y;
          tp.x = evt.x;
          tp.y = evt.y;
          tp.phase = TouchPhase.Ended;
          this._justReleased = true;
          this.detectGestures(tp, evt.timestamp);
          break;
        }
        case EventType.Cancel: {
          const tp = this.touchMap.get(evt.id);
          if (!tp) break;
          tp.phase = TouchPhase.Cancelled;
          this._justReleased = true;
          break;
        }
      }
    }
    this.pending.length = 0;
  }

  private detectGestures(tp: TouchPoint, endTimestamp: number): void {
    const dx = tp.x - tp.startX;
    const dy = tp.y - tp.startY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const duration = endTimestamp - tp.timestamp;

    if (duration <= this.tapMaxDuration && dist <= this.tapMaxDistance) {
      this._isTap = true;
    }

    if (dist >= this.swipeMinDistance && duration <= this.swipeMaxDuration) {
      this._isSwipe = true;
      if (Math.abs(dx) >= Math.abs(dy)) {
        this._swipeDirection = dx > 0 ? 'right' : 'left';
      } else {
        this._swipeDirection = dy > 0 ? 'down' : 'up';
      }
    }
  }

  get touchCount(): number { return this.touches.length; }

  getTouch(index: number): TouchPoint | null {
    return this.touches[index] ?? null;
  }

  getTouchById(id: number): TouchPoint | null {
    return this.touchMap.get(id) ?? null;
  }

  get justPressed(): boolean { return this._justPressed; }
  get justReleased(): boolean { return this._justReleased; }

  get isPressed(): boolean {
    return this.touches.length > 0 &&
      this.touches.some(t => t.phase !== TouchPhase.Ended && t.phase !== TouchPhase.Cancelled);
  }

  get position(): { x: number; y: number } | null {
    if (this.touches.length === 0) return null;
    return { x: this.touches[0].x, y: this.touches[0].y };
  }

  get delta(): { x: number; y: number } {
    if (this.touches.length === 0) return { x: 0, y: 0 };
    return { x: this.touches[0].deltaX, y: this.touches[0].deltaY };
  }

  get isTap(): boolean { return this._isTap; }
  get isSwipe(): boolean { return this._isSwipe; }
  get swipeDirection(): 'up' | 'down' | 'left' | 'right' | null { return this._swipeDirection; }

  dispose(): void {
    this.touches.length = 0;
    this.touchMap.clear();
    this.pending.length = 0;
  }
}
