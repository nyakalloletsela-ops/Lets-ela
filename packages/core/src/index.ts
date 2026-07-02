// Core exports
export { ContextStore } from './context/store';
export type { ContextKey, ContextSnapshot } from './context/store';

export { ValidationEngine, ValidationError } from './validation/engine';
export type { ValidationResult, ValidationErrorDetail } from './validation/engine';

// Schemas
export { prdSchema } from './schemas/prd.schema';
export { architectureSchema } from './schemas/architecture.schema';

// LLM - Gemini
export { GeminiClient, createGeminiClient } from './llm';
export type { GeminiClientConfig, ChatMessage, StructuredOutput } from './llm';

// Types
export interface PRDContract {
  projectName: string;
  targetAudience?: string;
  userRoles: string[];
  features: Array<{
    id: string;
    name: string;
    description: string;
    priority?: 'P0' | 'P1' | 'P2';
    dependencies?: string[];
  }>;
  constraints?: {
    budget?: string;
    timeline?: string;
    compliance?: string[];
  };
}

export interface ArchitectureContract {
  projectId: string;
  stack: {
    frontend: 'nextjs' | 'react-vite' | 'vue' | 'angular';
    backend: 'fastapi' | 'express' | 'django' | 'spring-boot';
    database: 'postgresql' | 'mysql' | 'mongodb' | 'sqlite';
    orm?: 'prisma' | 'typeorm' | 'drizzle' | 'sqlalchemy';
  };
  dataModel: Array<{
    table: string;
    description?: string;
    columns: Array<{
      name: string;
      type: 'string' | 'int' | 'float' | 'boolean' | 'datetime' | 'json' | 'uuid';
      constraints?: Array<'primary' | 'unique' | 'nullable' | 'index'>;
      references?: {
        table: string;
        column: string;
      };
    }>;
  }>;
  apiEndpoints: Array<{
    path: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    description: string;
    authenticated: boolean;
    roles?: string[];
    requestBody?: Record<string, unknown>;
    responseType?: string;
  }>;
  frontendViews: Array<{
    route: string;
    componentName: string;
    requiredRoles?: string[];
    description?: string;
  }>;
  environment?: {
    variables: Array<{
      key: string;
      description: string;
      required: boolean;
    }>;
  };
}
