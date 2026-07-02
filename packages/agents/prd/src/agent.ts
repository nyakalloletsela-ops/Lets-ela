import { GeminiClient, ContextStore, ValidationEngine, ContextKey, PRDContract, prdSchema } from '@letsela/core';
import { PRD_SYSTEM_PROMPT } from './prompt';

export interface PrdAgentConfig {
  geminiApiKey: string;
  contextStore: ContextStore;
  maxRetries?: number;
}

export interface PrdAgentInput {
  userPrompt: string;
  projectId: string;
  sessionId: string;
}

/**
 * PRD Agent - Generates structured Product Requirement Documents using Gemini
 */
export class PRDAgent {
  private geminiClient: GeminiClient;
  private validator: ValidationEngine;
  private contextStore: ContextStore;
  private maxRetries: number;

  constructor(config: PrdAgentConfig) {
    this.geminiClient = new GeminiClient({ apiKey: config.geminiApiKey });
    this.validator = new ValidationEngine();
    this.contextStore = config.contextStore;
    this.maxRetries = config.maxRetries || 3;
  }

  /**
   * Execute PRD generation with automatic retries and validation
   */
  async execute(input: PrdAgentInput): Promise<PRDContract> {
    const contextKey: ContextKey = {
      projectId: input.projectId,
      sessionId: input.sessionId
    };

    console.log(`[PRD Agent] Starting PRD generation for project: ${input.projectId}`);
    console.log(`[PRD Agent] User prompt: "${input.userPrompt.substring(0, 80)}..."`);

    let attempt = 0;
    let lastError: Error | null = null;
    let currentFeedback: string | undefined;

    while (attempt < this.maxRetries) {
      attempt++;
      console.log(`[PRD Agent] Compilation attempt ${attempt}/${this.maxRetries}`);

      try {
        const generatedPrd = await this.generatePrd(input.userPrompt, currentFeedback);
        const validation = this.validator.validate('prd', generatedPrd);

        if (validation.isValid) {
          const prd = generatedPrd as PRDContract;

          // Persist to context store
          await this.contextStore.set(contextKey, 'prd', prd);
          await this.contextStore.set(contextKey, 'prd_generated_at', new Date().toISOString());

          console.log(`[PRD Agent] ✓ PRD successfully generated: "${prd.projectName}"`);
          console.log(`[PRD Agent]   - Roles: ${prd.userRoles.join(', ')}`);
          console.log(`[PRD Agent]   - Features: ${prd.features.length}`);

          return prd;
        }

        // Validation failed - use feedback for self-correction
        currentFeedback = validation.feedback;
        lastError = new Error(validation.feedback!);
        console.warn(`[PRD Agent] Validation failed. ${validation.errors?.length || 0} errors detected.`);

      } catch (error) {
        lastError = error as Error;
        console.error(`[PRD Agent] Error during attempt ${attempt}:`, lastError.message);

        if (attempt >= this.maxRetries) {
          throw new Error(`PRD Agent failed after ${this.maxRetries} attempts: ${lastError.message}`);
        }
      }
    }

    throw new Error(`PRD Agent exhausted retry limit: ${lastError?.message}`);
  }

  /**
   * Generate PRD using Gemini with structured JSON output
   */
  private async generatePrd(userPrompt: string, previousFeedback?: string): Promise<unknown> {
    let fullPrompt = `${PRD_SYSTEM_PROMPT}\n\n${JSON.stringify(prdSchema, null, 2)}`;

    if (previousFeedback) {
      fullPrompt += `\n\nPrevious validation errors that MUST be fixed:\n${previousFeedback}`;
      fullPrompt += `\n\nPlease regenerate the entire JSON artifact, fixing all listed errors above.`;
    }

    fullPrompt += `\n\nUser requirement: ${userPrompt}`;

    const response = await this.geminiClient.generateStructuredJSON(fullPrompt, prdSchema);

    if (!response.success) {
      throw new Error(`Failed to generate PRD: ${response.error}`);
    }

    return response.data;
  }
}
