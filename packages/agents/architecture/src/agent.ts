import { 
  GeminiClient,
  ValidationEngine, 
  ValidationError, 
  ArchitectureContract, 
  PRDContract,
  ContextStore, 
  ContextKey,
  architectureSchema
} from '@letsela/core';
import { ARCHITECTURE_SYSTEM_PROMPT } from './prompt';

export interface ArchitectureAgentConfig {
  geminiApiKey: string;
  contextStore: ContextStore;
  maxRetries?: number;
}

export interface ArchitectureAgentInput {
  projectId: string;
  sessionId: string;
}

/**
 * Architecture Agent - Generates production-grade architecture from PRD using Gemini
 */
export class ArchitectureAgent {
  private geminiClient: GeminiClient;
  private validator: ValidationEngine;
  private contextStore: ContextStore;
  private maxRetries: number;

  constructor(config: ArchitectureAgentConfig) {
    this.geminiClient = new GeminiClient({ apiKey: config.geminiApiKey });
    this.validator = new ValidationEngine();
    this.contextStore = config.contextStore;
    this.maxRetries = config.maxRetries || 3;
  }

  /**
   * Execute architecture generation with automatic retries and validation
   */
  async execute(input: ArchitectureAgentInput): Promise<ArchitectureContract> {
    const contextKey: ContextKey = {
      projectId: input.projectId,
      sessionId: input.sessionId
    };

    console.log(`[Architecture Agent] Fetching PRD for project: ${input.projectId}`);
    const prdData = await this.contextStore.get<PRDContract>(contextKey, 'prd');
    
    if (!prdData) {
      throw new Error(`PRD not found for project: ${input.projectId}`);
    }

    console.log(`[Architecture Agent] Starting architecture design from PRD: "${prdData.projectName}"`);

    let attempt = 0;
    let lastError: Error | null = null;
    let currentFeedback: string | undefined;

    while (attempt < this.maxRetries) {
      attempt++;
      console.log(`[Architecture Agent] Design iteration ${attempt}/${this.maxRetries}`);

      try {
        const generatedArch = await this.generateArchitecture(input.projectId, prdData, currentFeedback);
        const validation = this.validator.validate('architecture', generatedArch);

        if (validation.isValid) {
          const architecture = generatedArch as ArchitectureContract;

          // Persist to context store
          await this.contextStore.set(contextKey, 'architecture', architecture);
          await this.contextStore.set(contextKey, 'architecture_generated_at', new Date().toISOString());

          console.log(`[Architecture Agent] ✓ Architecture successfully designed`);
          console.log(`[Architecture Agent]   - Frontend: ${architecture.stack.frontend}`);
          console.log(`[Architecture Agent]   - Backend: ${architecture.stack.backend}`);
          console.log(`[Architecture Agent]   - Database: ${architecture.stack.database}`);
          console.log(`[Architecture Agent]   - Data Tables: ${architecture.dataModel.length}`);
          console.log(`[Architecture Agent]   - API Endpoints: ${architecture.apiEndpoints.length}`);
          console.log(`[Architecture Agent]   - Frontend Views: ${architecture.frontendViews.length}`);

          return architecture;
        }

        // Validation failed - use feedback for self-correction
        currentFeedback = validation.feedback;
        lastError = new ValidationError(validation.feedback!, validation.errors!);
        console.warn(`[Architecture Agent] Validation failed. ${validation.errors?.length || 0} errors detected.`);

      } catch (error) {
        lastError = error as Error;
        console.error(`[Architecture Agent] Error during iteration ${attempt}:`, lastError.message);

        if (attempt >= this.maxRetries) {
          throw new Error(`Architecture Agent failed after ${this.maxRetries} attempts: ${lastError.message}`);
        }
      }
    }

    throw new Error(`Architecture Agent exhausted retry limit: ${lastError?.message}`);
  }

  /**
   * Generate architecture using Gemini with structured JSON output
   */
  private async generateArchitecture(projectId: string, prd: PRDContract, previousFeedback?: string): Promise<unknown> {
    let fullPrompt = `${ARCHITECTURE_SYSTEM_PROMPT}\n\n`;
    fullPrompt += `## INPUT PRD DATA:\n${JSON.stringify(prd, null, 2)}\n\n`;
    fullPrompt += `## PROJECT ID:\n${projectId}\n\n`;
    fullPrompt += `## EXPECTED OUTPUT FORMAT:\n${JSON.stringify(architectureSchema, null, 2)}\n\n`;

    if (previousFeedback) {
      fullPrompt += `## PREVIOUS VALIDATION ERRORS (MUST FIX):\n${previousFeedback}\n\n`;
      fullPrompt += `Please regenerate the entire architecture JSON, fixing all listed errors above.`;
    }

    const response = await this.geminiClient.generateStructuredJSON(fullPrompt, architectureSchema);

    if (!response.success) {
      throw new Error(`Failed to generate architecture: ${response.error}`);
    }

    return response.data;
  }
}
