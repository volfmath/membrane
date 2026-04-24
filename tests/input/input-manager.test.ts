import { describe, it, expect } from 'vitest';
import { InputManager, TouchPhase } from '../../src/input/input-manager';

describe('InputManager', () => {
  describe('touch lifecycle', () => {
    it('starts with no touches', () => {
      const input = new InputManager();
      expect(input.touchCount).toBe(0);
      expect(input.justPressed).toBe(false);
      expect(input.isPressed).toBe(false);
      expect(input.position).toBeNull();
    });

    it('registers touch start after update', () => {
      const input = new InputManager();
      input.handleTouchStart(0, 100, 200, 0);
      input.update();

      expect(input.touchCount).toBe(1);
      expect(input.justPressed).toBe(true);
      expect(input.isPressed).toBe(true);

      const tp = input.getTouch(0)!;
      expect(tp.id).toBe(0);
      expect(tp.x).toBe(100);
      expect(tp.y).toBe(200);
      expect(tp.startX).toBe(100);
      expect(tp.startY).toBe(200);
      expect(tp.phase).toBe(TouchPhase.Began);
    });

    it('transitions Began → Held on next update', () => {
      const input = new InputManager();
      input.handleTouchStart(0, 100, 200, 0);
      input.update();

      input.update();
      const tp = input.getTouch(0)!;
      expect(tp.phase).toBe(TouchPhase.Held);
      expect(input.justPressed).toBe(false);
      expect(input.isPressed).toBe(true);
    });

    it('handles touch move', () => {
      const input = new InputManager();
      input.handleTouchStart(0, 100, 200, 0);
      input.update();
      input.update();

      input.handleTouchMove(0, 120, 230, 16);
      input.update();

      const tp = input.getTouch(0)!;
      expect(tp.x).toBe(120);
      expect(tp.y).toBe(230);
      expect(tp.deltaX).toBe(20);
      expect(tp.deltaY).toBe(30);
      expect(tp.phase).toBe(TouchPhase.Moved);
    });

    it('handles touch end', () => {
      const input = new InputManager();
      input.handleTouchStart(0, 100, 200, 0);
      input.update();

      input.handleTouchEnd(0, 100, 200, 100);
      input.update();

      expect(input.justReleased).toBe(true);
      const tp = input.getTouch(0)!;
      expect(tp.phase).toBe(TouchPhase.Ended);
    });

    it('removes ended touch on next update', () => {
      const input = new InputManager();
      input.handleTouchStart(0, 100, 200, 0);
      input.update();
      input.handleTouchEnd(0, 100, 200, 100);
      input.update();

      input.update();
      expect(input.touchCount).toBe(0);
      expect(input.justReleased).toBe(false);
      expect(input.isPressed).toBe(false);
    });

    it('handles touch cancel', () => {
      const input = new InputManager();
      input.handleTouchStart(0, 100, 200, 0);
      input.update();

      input.handleTouchCancel(0, 100, 200, 50);
      input.update();

      const tp = input.getTouch(0)!;
      expect(tp.phase).toBe(TouchPhase.Cancelled);
      expect(input.justReleased).toBe(true);
    });
  });

  describe('multi-touch', () => {
    it('tracks multiple touches', () => {
      const input = new InputManager();
      input.handleTouchStart(0, 100, 200, 0);
      input.handleTouchStart(1, 300, 400, 0);
      input.update();

      expect(input.touchCount).toBe(2);
      expect(input.getTouch(0)!.id).toBe(0);
      expect(input.getTouch(1)!.id).toBe(1);
    });

    it('getTouchById finds by id', () => {
      const input = new InputManager();
      input.handleTouchStart(5, 100, 200, 0);
      input.handleTouchStart(8, 300, 400, 0);
      input.update();

      const tp = input.getTouchById(8)!;
      expect(tp.x).toBe(300);
      expect(tp.y).toBe(400);
      expect(input.getTouchById(99)).toBeNull();
    });

    it('ignores touches beyond max', () => {
      const input = new InputManager();
      for (let i = 0; i < 12; i++) {
        input.handleTouchStart(i, i * 10, i * 10, 0);
      }
      input.update();
      expect(input.touchCount).toBe(10);
    });
  });

  describe('convenience properties', () => {
    it('position returns first touch', () => {
      const input = new InputManager();
      input.handleTouchStart(0, 50, 75, 0);
      input.update();

      expect(input.position).toEqual({ x: 50, y: 75 });
    });

    it('delta returns first touch delta', () => {
      const input = new InputManager();
      input.handleTouchStart(0, 50, 75, 0);
      input.update();
      input.update();

      input.handleTouchMove(0, 60, 85, 16);
      input.update();

      expect(input.delta).toEqual({ x: 10, y: 10 });
    });

    it('delta resets each frame', () => {
      const input = new InputManager();
      input.handleTouchStart(0, 50, 75, 0);
      input.update();
      input.update();

      input.handleTouchMove(0, 60, 85, 16);
      input.update();
      input.update();

      expect(input.delta).toEqual({ x: 0, y: 0 });
    });
  });

  describe('tap detection', () => {
    it('detects tap (short press + small distance)', () => {
      const input = new InputManager();
      input.handleTouchStart(0, 100, 200, 0);
      input.update();
      input.handleTouchEnd(0, 102, 201, 100);
      input.update();

      expect(input.isTap).toBe(true);
    });

    it('rejects tap if duration too long', () => {
      const input = new InputManager();
      input.handleTouchStart(0, 100, 200, 0);
      input.update();
      input.handleTouchEnd(0, 102, 201, 300);
      input.update();

      expect(input.isTap).toBe(false);
    });

    it('rejects tap if moved too far', () => {
      const input = new InputManager();
      input.handleTouchStart(0, 100, 200, 0);
      input.update();
      input.handleTouchEnd(0, 120, 200, 100);
      input.update();

      expect(input.isTap).toBe(false);
    });

    it('tap flag clears next frame', () => {
      const input = new InputManager();
      input.handleTouchStart(0, 100, 200, 0);
      input.update();
      input.handleTouchEnd(0, 100, 200, 50);
      input.update();
      expect(input.isTap).toBe(true);

      input.update();
      expect(input.isTap).toBe(false);
    });
  });

  describe('swipe detection', () => {
    it('detects swipe right', () => {
      const input = new InputManager();
      input.handleTouchStart(0, 100, 200, 0);
      input.update();
      input.handleTouchEnd(0, 200, 210, 200);
      input.update();

      expect(input.isSwipe).toBe(true);
      expect(input.swipeDirection).toBe('right');
    });

    it('detects swipe left', () => {
      const input = new InputManager();
      input.handleTouchStart(0, 200, 200, 0);
      input.update();
      input.handleTouchEnd(0, 100, 195, 200);
      input.update();

      expect(input.isSwipe).toBe(true);
      expect(input.swipeDirection).toBe('left');
    });

    it('detects swipe down', () => {
      const input = new InputManager();
      input.handleTouchStart(0, 200, 100, 0);
      input.update();
      input.handleTouchEnd(0, 205, 200, 200);
      input.update();

      expect(input.isSwipe).toBe(true);
      expect(input.swipeDirection).toBe('down');
    });

    it('detects swipe up', () => {
      const input = new InputManager();
      input.handleTouchStart(0, 200, 300, 0);
      input.update();
      input.handleTouchEnd(0, 195, 200, 200);
      input.update();

      expect(input.isSwipe).toBe(true);
      expect(input.swipeDirection).toBe('up');
    });

    it('rejects swipe if too slow', () => {
      const input = new InputManager();
      input.handleTouchStart(0, 100, 200, 0);
      input.update();
      input.handleTouchEnd(0, 200, 200, 500);
      input.update();

      expect(input.isSwipe).toBe(false);
      expect(input.swipeDirection).toBeNull();
    });

    it('rejects swipe if distance too short', () => {
      const input = new InputManager();
      input.handleTouchStart(0, 100, 200, 0);
      input.update();
      input.handleTouchEnd(0, 130, 200, 100);
      input.update();

      expect(input.isSwipe).toBe(false);
    });
  });

  describe('event buffering', () => {
    it('buffers multiple events in one frame', () => {
      const input = new InputManager();
      input.handleTouchStart(0, 100, 200, 0);
      input.handleTouchMove(0, 110, 210, 8);
      input.handleTouchMove(0, 120, 220, 16);
      input.update();

      const tp = input.getTouch(0)!;
      expect(tp.x).toBe(120);
      expect(tp.y).toBe(220);
      expect(tp.phase).toBe(TouchPhase.Began);
    });

    it('start and end in same frame works', () => {
      const input = new InputManager();
      input.handleTouchStart(0, 100, 200, 0);
      input.handleTouchEnd(0, 100, 200, 50);
      input.update();

      expect(input.justPressed).toBe(true);
      expect(input.justReleased).toBe(true);
      expect(input.isTap).toBe(true);
      const tp = input.getTouch(0)!;
      expect(tp.phase).toBe(TouchPhase.Ended);
    });
  });

  describe('dispose', () => {
    it('clears all state', () => {
      const input = new InputManager();
      input.handleTouchStart(0, 100, 200, 0);
      input.update();
      input.dispose();

      expect(input.touchCount).toBe(0);
      expect(input.isPressed).toBe(false);
    });
  });

  describe('custom config', () => {
    it('respects tapMaxDuration', () => {
      const input = new InputManager({ tapMaxDuration: 50 });
      input.handleTouchStart(0, 100, 200, 0);
      input.update();
      input.handleTouchEnd(0, 100, 200, 60);
      input.update();
      expect(input.isTap).toBe(false);
    });

    it('respects swipeMinDistance', () => {
      const input = new InputManager({ swipeMinDistance: 200 });
      input.handleTouchStart(0, 100, 200, 0);
      input.update();
      input.handleTouchEnd(0, 200, 200, 100);
      input.update();
      expect(input.isSwipe).toBe(false);
    });
  });
});
