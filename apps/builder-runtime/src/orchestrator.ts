import { PRDAgent } from '@letsela/prd-agent';
import { ArchitectureAgent } from '@letsela/architecture-agent';
import { FileGeneratorEngine, GenerationContext } from '@letsela/file-generator';
import { SessionManager } from './context-manager';

export interface OrchestratorConfig {
  openaiApiKey: string;
  redisUrl?: string;
  outputBaseDir?: string;
}

export class BuildOrchestrator {
  private sessionManager: SessionManager;
  private prdAgent: PRDAgent;
  private architectureAgent: ArchitectureAgent;
  private fileGenerator: FileGeneratorEngine;
  private outputBaseDir: string;
  private openaiApiKey: string;

  constructor(config: OrchestratorConfig) {
    this.openaiApiKey = config.openaiApiKey;
    this.sessionManager = new SessionManager(config.redisUrl);
    this.outputBaseDir = config.outputBaseDir || './generated-projects';
    
    this.prdAgent = new PRDAgent({
      openaiApiKey: config.openaiApiKey,
      contextStore: this.sessionManager.getContextStore(),
      maxRetries: 2
    });
    
    this.architectureAgent = new ArchitectureAgent({
      openaiApiKey: config.openaiApiKey,
      contextStore: this.sessionManager.getContextStore(),
      maxRetries: 2
    });
    
    this.fileGenerator = new FileGeneratorEngine();
  }

  async startBuild(prompt: string, existingProjectId?: string): Promise<string> {
    const session = this.sessionManager.createSession(existingProjectId);
    
    console.log(`[Orchestrator] Starting build session: ${session.id}`);
    console.log(`[Orchestrator] Project: ${session.projectId}`);
    console.log(`[Orchestrator] Prompt: ${prompt.substring(0, 100)}...`);
    
    try {
      // Step 1: Generate PRD
      await this.sessionManager.updateSessionStatus(session.id, 'prd_generating');
      console.log(`[Orchestrator] Phase 1/3: Generating PRD...`);
      
      const prd = await this.prdAgent.execute({
        userPrompt: prompt,
        projectId: session.projectId,
        sessionId: session.id
      });
      
      await this.sessionManager.updateSessionStatus(session.id, 'prd_complete');
      console.log(`[Orchestrator] ✓ PRD complete: ${prd.projectName}`);
      
      // Step 2: Generate Architecture
      await this.sessionManager.updateSessionStatus(session.id, 'architecture_generating');
      console.log(`[Orchestrator] Phase 2/3: Generating Architecture...`);
      
      const architecture = await this.architectureAgent.execute({
        projectId: session.projectId,
        sessionId: session.id
      });
      
      await this.sessionManager.updateSessionStatus(session.id, 'architecture_complete');
      console.log(`[Orchestrator] ✓ Architecture complete`);
      console.log(`[Orchestrator]   - Stack: ${architecture.stack.frontend} + ${architecture.stack.backend}`);
      console.log(`[Orchestrator]   - Tables: ${architecture.dataModel.length}`);
      console.log(`[Orchestrator]   - APIs: ${architecture.apiEndpoints.length}`);
      
      // Step 3: Generate Files
      await this.sessionManager.updateSessionStatus(session.id, 'file_generating');
      console.log(`[Orchestrator] Phase 3/3: Generating files...`);
      
      const generationContext: GenerationContext = {
        architecture,
        projectId: session.projectId,
        sessionId: session.id,
        outputDir: `${this.outputBaseDir}/${session.projectId}`
      };
      
      const outputDir = await this.fileGenerator.generateProject(generationContext);
      
      await this.sessionManager.updateSessionStatus(session.id, 'done');
      console.log(`[Orchestrator] ✓ Done! Files generated at: ${outputDir}`);
      
      return session.id;
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      await this.sessionManager.updateSessionStatus(session.id, 'failed', errorMsg);
      console.error(`[Orchestrator] Build failed: ${errorMsg}`);
      throw error;
    }
  }

  async getBuildStatus(sessionId: string) {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    const contextKey = this.sessionManager.getContextKey(sessionId);
    const contextStore = this.sessionManager.getContextStore();
    
    const prd = await contextStore.get(contextKey, 'prd');
    const architecture = await contextStore.get(contextKey, 'architecture');
    
    return {
      session: session,
      artifacts: {
        prd,
        architecture
      },
      outputPath: `${this.outputBaseDir}/${session.projectId}`
    };
  }
}
