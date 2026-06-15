import dotenv from 'dotenv';
import { createServer } from './api/server';
import { BuildOrchestrator } from './orchestrator';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const REDIS_URL = process.env.REDIS_URL;

if (!OPENAI_API_KEY) {
  console.error('FATAL: OPENAI_API_KEY environment variable is required');
  process.exit(1);
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║                                                       ║');
  console.log('║     LETS\'ELA BUILDER RUNTIME v1.0                     ║');
  console.log('║     Contract-First AI Platform Factory                ║');
  console.log('║                                                       ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log('');
  
  console.log('📦 Initializing orchestrator...');
  const orchestrator = new BuildOrchestrator({
    openaiApiKey: OPENAI_API_KEY,
    redisUrl: REDIS_URL,
    outputBaseDir: process.env.OUTPUT_DIR || './generated-projects'
  });
  
  console.log('🌐 Starting API server...');
  const app = createServer(orchestrator);
  
  app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
    console.log('');
    console.log('📡 Endpoints:');
    console.log(`   POST   /api/build                    - Start a new build`);
    console.log(`   GET    /api/build/:id                - Get build status`);
    console.log(`   GET    /api/build/:id/artifacts      - Get PRD + Architecture`);
    console.log(`   GET    /health                       - Health check`);
    console.log('');
    console.log('🚀 Ready to build applications from prompts!');
    console.log('');
    console.log('💡 Example:');
    console.log(`   curl -X POST http://localhost:${PORT}/api/build \\`);
    console.log(`     -H "Content-Type: application/json" \\`);
    console.log(`     -d '{"prompt": "Build a todo app"}'`);
  });
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
