import OpenAI from 'openai';
import { 
  ValidationEngine, 
  ValidationError, 
  ArchitectureContract, 
  PRDContract,
  ContextStore, 
  ContextKey 
} from '@letsela/core';
import { ARCHITECTURE_SYSTEM_PROMPT } from './prompt';

export interface ArchitectureAgentConfig {
  openaiApiKey: string;
  model?: string;
  maxRetries?: number;
  contextStore: ContextStore;
}

export interface ArchitectureAgentInput {
  projectId: string;
  sessionId: string;
}

export class ArchitectureAgent {
  private openai: OpenAI;
  private validator: ValidationEngine;
  private model: string;
  private maxRetries: number;
  private contextStore: ContextStore;

  constructor(config: ArchitectureAgentConfig) {
    this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    this.validator = new ValidationEngine();
    this.model = config.model || 'gpt-4-turbo-preview';
    this.maxRetries = config.maxRetries || 3;
    this.contextStore = config.contextStore;
  }

  async execute(input: ArchitectureAgentInput): Promise<ArchitectureContract> {
    const contextKey: ContextKey = {
      projectId: input.projectId,
      sessionId: input.sessionId
    };

    console.log(`[Architecture Agent] Fetching target PRD for Project: ${input.projectId}`);
    const prdData = await this.contextStore.get<PRDContract>(contextKey, 'prd');
    
    if (!prdData) {
      throw new Error(`Execution Blocked: PRD Contract was not compiled for project isolation lane: ${input.projectId}`);
    }

    let attempt = 0;
    let lastError: Error | null = null;
    let currentFeedback: string | undefined;

    while (attempt < this.maxRetries) {
      attempt++;
      console.log(`[Architecture Agent] Compiling Architecture blueprint map iteration ${attempt}/${this.maxRetries}`);

      try {
        const generatedArch = await this.generateArchitecture(input.projectId, prdData, currentFeedback);
        const validation = this.validator.validate('architecture', generatedArch);

        if (validation.isValid) {
          const architecture = generatedArch as ArchitectureContract;

          // Commit to isolated tenant context map spaces securely
          await this.contextStore.set(contextKey, 'architecture', architecture);
          await this.contextStore.set(contextKey, 'architecture_generated_at', new Date().toISOString());

          console.log(`[Architecture Agent] System successfully structured! Stack Selected: Frontend [${architecture.stack.frontend}], Database [${architecture.stack.database}]`);
          console.log(`[Architecture Agent] Engineered Tables: ${architecture.dataModel.length}, API Vectors: ${architecture.apiEndpoints.length}`);

          return architecture;
        }

        currentFeedback = validation.feedback;
        lastError = new ValidationError(validation.feedback!, validation.errors!);
        console.warn(`[Architecture Agent] System mapping validation rejected: ${validation.errors?.length} structural errors.`);

      } catch (error) {
        lastError = error as Error;
        console.error(`[Architecture Agent Fail Channel] Loop error encountered during execution attempt ${attempt}:`, error);

        if (attempt === this.maxRetries) {
          throw new Error(`Architecture Agent failed processing requirements after ${this.maxRetries} cycles: ${lastError.message}`);
        }
      }
    }

    throw new Error(`Architecture Agent exhausted layout correction boundaries: ${lastError?.message}`);
  }

  private async generateArchitecture(projectId: string, prd: PRDContract, feedback?: string): Promise<unknown> {
    let userPromptPayload = `## INPUT TARGET SYSTEM PRD DATA:\n\n${JSON.stringify(prd, null, 2)}\n\n`;
    userPromptPayload += `## RUNTIME INSTRUCTIONS:\nGenerate an architecture map aligning specifically back to target project tracking key UUID: "${projectId}".`;

    if (feedback) {
      userPromptPayload += `\n\n## SCHEMA MISMATCH CORRECTION REPORT:\nYour previous construction configuration failed standard contract verification:\n${feedback}\n\nAdjust formatting parameters to maintain exact data alignment properties. Output ONLY valid JSON.`;
    }

    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: ARCHITECTURE_SYSTEM_PROMPT },
        { role: 'user', content: userPromptPayload }
      ],
      temperature: 0.2, // Locked low temperature settings to prevent layout component generation drift
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAI returned an empty operational message block response');
    }

    try {
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Structural parsing failed on response payload data: ${error}`);
    }
  }
}
