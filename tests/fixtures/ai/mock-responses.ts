export const CLAUDE_SCENE_RESPONSE = {
  id: 'msg_mock',
  type: 'message',
  role: 'assistant',
  content: [{
    type: 'text',
    text: JSON.stringify({
      sceneId: 'runner_level_01',
      name: 'Runner Level 1',
      description: 'A simple runner game level',
      entities: [
        {
          id: 'main_camera',
          name: 'Main Camera',
          parent: null,
          enabled: true,
          components: {
            Transform: { x: 360, y: 640 },
            Camera: { mode: 'orthographic', size: 640 },
          },
        },
        {
          id: 'player',
          name: 'Player',
          parent: null,
          enabled: true,
          components: {
            Transform: { x: 200, y: 900 },
            Sprite: { atlas: 'characters', frame: 'player_idle', order: 10 },
            Tags: { values: ['player'] },
          },
        },
        {
          id: 'ground',
          name: 'Ground',
          parent: null,
          enabled: true,
          components: {
            Transform: { x: 360, y: 1100, scaleX: 10, scaleY: 1 },
            Sprite: { atlas: 'environment', frame: 'ground_tile', order: 1 },
            Tags: { values: ['solid'] },
          },
        },
        {
          id: 'enemy_01',
          name: 'Enemy Spike',
          parent: null,
          enabled: true,
          components: {
            Transform: { x: 600, y: 1050 },
            Sprite: { atlas: 'enemies', frame: 'spike', order: 5 },
            Tags: { values: ['enemy', 'hazard'] },
          },
        },
      ],
      events: [
        {
          id: 'player_hit_enemy',
          on: 'tag:player touch tag:enemy',
          do: ['play:hurt', 'scene:game_over'],
        },
        {
          id: 'collect_coin',
          on: 'tag:player touch tag:coin',
          do: ['destroy:self', 'score:+10', 'play:coin_pickup'],
        },
      ],
    }),
  }],
  usage: { input_tokens: 500, output_tokens: 800 },
};

export const CLAUDE_EVENTS_RESPONSE = {
  id: 'msg_mock',
  type: 'message',
  role: 'assistant',
  content: [{
    type: 'text',
    text: JSON.stringify([
      { id: 'jump', on: 'input:tap', do: 'emit:player_jump' },
      { id: 'land', on: 'tag:player touch tag:solid', do: 'emit:player_land' },
    ]),
  }],
  usage: { input_tokens: 300, output_tokens: 200 },
};

export const CLAUDE_CODE_RESPONSE = {
  id: 'msg_mock',
  type: 'message',
  role: 'assistant',
  content: [{
    type: 'text',
    text: 'function gravitySystem(world: World, dt: number): void {\n  // apply gravity\n}',
  }],
  usage: { input_tokens: 200, output_tokens: 100 },
};

export const OPENAI_IMAGE_RESPONSE = {
  created: 1234567890,
  data: [{
    b64_json: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  }],
};

export const PERPLEXITY_RESEARCH_RESPONSE = {
  choices: [{
    message: {
      content: JSON.stringify({
        summary: 'Runner games typically feature auto-scrolling, obstacle avoidance, and score collection.',
        keyPoints: [
          'Auto-scrolling at increasing speed creates difficulty progression',
          'Simple tap/swipe controls work best for mobile',
          'Coins and power-ups provide player motivation',
        ],
        references: [
          'https://example.com/runner-design',
        ],
      }),
    },
  }],
  usage: { prompt_tokens: 100, completion_tokens: 200 },
};

export const PERPLEXITY_GDD_RESPONSE = {
  choices: [{
    message: {
      content: JSON.stringify({
        title: 'Endless Runner',
        overview: 'A fast-paced runner where the player dodges obstacles and collects coins.',
        mechanics: ['auto-scroll', 'jump', 'slide', 'coin-collect'],
        entities: ['player', 'ground', 'obstacle_spike', 'obstacle_wall', 'coin', 'power_up'],
        eventRules: [
          'player touch obstacle → game over',
          'player touch coin → score +10',
          'score >= 100 → speed increase',
        ],
      }),
    },
  }],
  usage: { prompt_tokens: 100, completion_tokens: 300 },
};

export const SUNO_AUDIO_RESPONSE = {
  audio_url: 'https://example.com/mock-audio.mp3',
};

export const CLAUDE_TRANSLATE_RESPONSE = {
  id: 'msg_mock',
  type: 'message',
  role: 'assistant',
  content: [{
    type: 'text',
    text: JSON.stringify([
      { original: 'Player', language: 'zh-CN', translated: '玩家' },
      { original: 'Enemy Spike', language: 'zh-CN', translated: '尖刺敌人' },
      { original: 'Ground', language: 'zh-CN', translated: '地面' },
    ]),
  }],
  usage: { input_tokens: 200, output_tokens: 150 },
};
