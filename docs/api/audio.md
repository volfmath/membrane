# Audio API 规格

> **职责**: 封装音频播放，提供音效（SFX）对象池和背景音乐（BGM）单实例管理。

---

## AudioManager

```typescript
interface AudioManagerConfig { maxSFXChannels?: number; }

class AudioManager {
  constructor(platform: PlatformAdapter, config?: AudioManagerConfig);

  playSFX(source: string | ArrayBuffer, volume?: number): void;
  stopAllSFX(): void;

  playBGM(source: string | ArrayBuffer, loop?: boolean, volume?: number, fadeIn?: number): void;
  stopBGM(fadeOut?: number): void;
  pauseBGM(): void;
  resumeBGM(): void;

  masterVolume: number;   // 0.0 ~ 1.0
  muted: boolean;
  dispose(): void;
}
```

## 实现要点

- **Browser**: Web Audio API（AudioContext + GainNode 淡入淡出）
- **微信**: wx.createInnerAudioContext（定时器调整 volume 实现淡入淡出）

## 关键约束

1. SFX 通道预分配，超限时最早播放的被停止
2. BGM 单实例
3. 淡入淡出非阻塞
4. dispose() 释放所有资源
5. 微信切后台自动暂停 BGM

## 使用示例

```typescript
const audio = new AudioManager(platform, { maxSFXChannels: 6 });
audio.playSFX('assets/click.mp3');
audio.playBGM('assets/bgm_main.mp3', true, 0.8, 1.0);
audio.masterVolume = 0.6;
audio.dispose();
```

## 依赖关系

- **依赖**: `platform/platform-adapter`
- 被 `core/engine` 和游戏逻辑 System 使用
