import OpenAI from 'openai';
import { ContextStore, ValidationEngine, ContextKey, PRDContract, prdSchema } from '@letsela/core';
import { PRD_SYSTEM_PROMPT } from './prompt';

export interface PrdAgentConfig {
  openaiApiKey: string;
  modelName?: string;
}

export class PrdGenerationAgent {
  private openai: OpenAI;
  private model: string;
  private validator: ValidationEngine;
  private store: ContextStore;

  constructor(config: PrdAgentConfig, store: ContextStore) {
    this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    this.model = config.modelName || 'gpt-4o';
    this.validator = new ValidationEngine();
    this.store = store;
  }

  /**
   * Orchestrates prompt collection, contract validation, and multi-tenant persistence.
   */
  public async execute(key: ContextKey, userPrompt: string): Promise<PRDContract> {
    console.log(`[PRD Agent] Starting compile phase for Tenant Project [${key.projectId}]`);
    
    let currentPromptAttempt = `User Requirement Input: "${userPrompt}"`;
    let attempts = 0;
    const maxRetries = 3;

    while (attempts < maxRetries) {
      try {
        const response = await this.openai.chat.completions.create({
          model: this.model,
          temperature: 0.1, // Near-zero variance for deterministic token output choices
          messages: [
            { role: 'system', content: PRD_SYSTEM_PROMPT + JSON.stringify(prdSchema) },
            { role: 'user', content: currentPromptAttempt }
          ],
          response_format: { type: "json_object" }
        });

        const rawJsonText = response.choices[0]?.message?.content || '{}';
        const parsedData = JSON.parse(rawJsonText);

        // Run structural contract gatekeeping pass
        const validation = this.validator.validate('prd', parsedData);

        if (validation.isValid) {
          console.log(`[PRD Agent] Structural contract passed validation checks successfully.`);
          
          // Atomically persist to isolated project memory pipeline
          await this.store.set(key, 'artifacts:prd', parsedData);
          await this.store.set(key, 'pipeline:step', 'prd_compiled');
          
          return parsedData as PRDContract;
        }

        // Self-Correction Loop Trigger: Inject schema error tracing vectors straight back to LLM context
        console.warn(`[PRD Agent Warning] Contract mismatch encountered during validation pass. Executing loop recovery attempt ${attempts + 1}/${maxRetries}.`);
        currentPromptAttempt = `Your previous output failed validation checks against the system contract. You must fix these errors and emit the entire structured JSON artifact again:\n${validation.feedback}\nOriginal User Input Context: "${userPrompt}"`;
        attempts++;
        
      } catch (error: any) {
        console.error(`[PRD Agent Crash Layer] Fatal parsing disruption or network error: ${error.message}`);
        attempts++;
        if (attempts >= maxRetries) throw error;
      }
    }

    throw new Error(`Fatal Pipeline Interruption: PRD Agent exceeded maximum self-correction retry boundaries.`);
  }
}
