import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { resolve } from 'path';
import { createMembraneServer } from './server.js';

const args = process.argv.slice(2);
let projectRoot = process.cwd();

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--project' && args[i + 1]) {
    projectRoot = resolve(args[i + 1]);
    i++;
  }
}

const server = createMembraneServer(projectRoot);
const transport = new StdioServerTransport();

console.error(`[Membrane MCP] Starting server for project: ${projectRoot}`);
await server.connect(transport);
