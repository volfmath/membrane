import type { AIConnectorConfig, AIResponse, GeneratedScene, ConnectorName } from './types.js';
import type { CanonicalSceneFile } from '../../src/canonical/types.js';
import type { ProjectDataManager } from '../mcp/project-data.js';
import { generateScene as claudeGenerateScene } from './claude.js';
import { generateGDD } from './perplexity.js';
import { generateSprite } from './openai-image.js';
import { generateMusic } from './audio.js';

export interface WorkflowStep {
  id: string;
  connector: ConnectorName;
  action: string;
  input: Record<string, unknown>;
  dependsOn?: string[];
}

export interface StepResult {
  id: string;
  status: 'ok' | 'error' | 'skipped';
  result?: unknown;
  error?: string;
}

export interface WorkflowResult {
  steps: StepResult[];
  scene?: CanonicalSceneFile;
}

export function createGameWorkflow(description: string): WorkflowStep[] {
  return [
    {
      id: 'research',
      connector: 'perplexity',
      action: 'generateGDD',
      input: { prompt: description },
    },
    {
      id: 'scene',
      connector: 'claude',
      action: 'generateScene',
      input: { prompt: description },
      dependsOn: ['research'],
    },
    {
      id: 'sprites',
      connector: 'openai-image',
      action: 'generateSprite',
      input: { prompt: `game sprites for: ${description}` },
      dependsOn: ['scene'],
    },
    {
      id: 'bgm',
      connector: 'audio',
      action: 'generateMusic',
      input: { prompt: `background music for: ${description}` },
      dependsOn: ['scene'],
    },
  ];
}

export async function runWorkflow(
  steps: WorkflowStep[],
  configs: Partial<Record<ConnectorName, AIConnectorConfig>>,
  manager?: ProjectDataManager,
): Promise<WorkflowResult> {
  const results: StepResult[] = [];
  const completed = new Map<string, unknown>();
  let generatedScene: CanonicalSceneFile | undefined;

  const sorted = topoSort(steps);

  for (const step of sorted) {
    if (step.dependsOn?.some(dep => {
      const depResult = results.find(r => r.id === dep);
      return !depResult || depResult.status !== 'ok';
    })) {
      results.push({ id: step.id, status: 'skipped', error: 'dependency failed' });
      continue;
    }

    const config = configs[step.connector];
    if (!config) {
      results.push({ id: step.id, status: 'skipped', error: `no API key for ${step.connector}` });
      continue;
    }

    try {
      const result = await executeStep(step, config, completed, manager);
      if (!result.ok) {
        results.push({ id: step.id, status: 'error', error: result.error });
        continue;
      }
      completed.set(step.id, result.data);
      results.push({ id: step.id, status: 'ok', result: result.data });

      if (step.connector === 'claude' && step.action === 'generateScene' && result.data) {
        const sceneData = result.data as GeneratedScene;
        if (manager) {
          const scene = manager.createScene(sceneData.sceneId, sceneData.name);
          for (const entity of sceneData.entities) {
            manager.createEntity(sceneData.sceneId, entity);
          }
          if (sceneData.events) {
            for (const event of sceneData.events) {
              manager.addEvent(sceneData.sceneId, event);
            }
          }
          generatedScene = manager.getScene(sceneData.sceneId) ?? undefined;
        }
      }
    } catch (e: any) {
      results.push({ id: step.id, status: 'error', error: e.message });
    }
  }

  return { steps: results, scene: generatedScene };
}

async function executeStep(
  step: WorkflowStep,
  config: AIConnectorConfig,
  completed: Map<string, unknown>,
  _manager?: ProjectDataManager,
): Promise<AIResponse<unknown>> {
  const prompt = step.input.prompt as string;

  switch (step.connector) {
    case 'claude': {
      if (step.action === 'generateScene') {
        const gdd = completed.get('research') as { entities?: string[] } | undefined;
        let enrichedPrompt = prompt;
        if (gdd?.entities) {
          enrichedPrompt += `\n\nSuggested entities from research: ${gdd.entities.join(', ')}`;
        }
        return claudeGenerateScene(config, enrichedPrompt);
      }
      return { ok: false, error: `Unknown claude action: ${step.action}` };
    }
    case 'perplexity': {
      return generateGDD(config, prompt);
    }
    case 'openai-image': {
      return generateSprite(config, prompt, {
        size: step.input.size as any ?? '256x256',
      });
    }
    case 'audio': {
      return generateMusic(config, prompt, {
        duration: step.input.duration as number ?? 30,
        genre: step.input.genre as string,
      });
    }
    default:
      return { ok: false, error: `Unknown connector: ${step.connector}` };
  }
}

function topoSort(steps: WorkflowStep[]): WorkflowStep[] {
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const result: WorkflowStep[] = [];
  const stepMap = new Map(steps.map(s => [s.id, s]));

  function visit(id: string): void {
    if (visited.has(id)) return;
    if (inStack.has(id)) {
      throw new Error(`Cyclic dependency detected: "${id}"`);
    }
    inStack.add(id);
    const step = stepMap.get(id);
    if (!step) return;
    for (const dep of step.dependsOn ?? []) {
      visit(dep);
    }
    inStack.delete(id);
    visited.add(id);
    result.push(step);
  }

  for (const step of steps) {
    visit(step.id);
  }
  return result;
}
