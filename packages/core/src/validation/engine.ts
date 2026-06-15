import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { prdSchema } from '../schemas/prd.schema';
import { architectureSchema } from '../schemas/architecture.schema';

export type SchemaType = 'prd' | 'architecture';

export class ValidationEngine {
  private ajv: Ajv;
  private validators: Map<SchemaType, ValidateFunction>;

  constructor() {
    this.ajv = new Ajv({ 
      allErrors: true, 
      verbose: true,
      strict: true 
    });
    addFormats(this.ajv);
    
    this.validators = new Map();
    this.validators.set('prd', this.ajv.compile(prdSchema));
    this.validators.set('architecture', this.ajv.compile(architectureSchema));
  }

  validate(schemaType: SchemaType, data: unknown): ValidationResult {
    const validator = this.validators.get(schemaType);
    
    if (!validator) {
      throw new Error(`Unknown schema type: ${schemaType}`);
    }

    const isValid = validator(data);
    
    if (isValid) {
      return { isValid: true };
    }

    const errors = validator.errors || [];
    const formattedFeedback = this.formatErrors(errors, schemaType);
    
    return {
      isValid: false,
      errors: errors.map(e => ({
        path: e.instancePath || '/',
        message: e.message || 'Validation error',
        value: e.data
      })),
      feedback: formattedFeedback
    };
  }

  private formatErrors(errors: any[], schemaType: string): string {
    const lines = [
      `❌ Schema validation failed for ${schemaType.toUpperCase()} contract`,
      '',
      'Errors found:'
    ];

    for (const err of errors) {
      const path = err.instancePath || 'root';
      const message = err.message;
      const value = err.data !== undefined ? ` (got: ${JSON.stringify(err.data)})` : '';
      lines.push(`  • ${path}: ${message}${value}`);
    }

    lines.push('');
    lines.push('💡 Tip: Ensure your output matches the exact schema structure.');
    lines.push(`   See packages/core/src/schemas/${schemaType}.schema.ts for reference.`);

    return lines.join('\n');
  }

  async validateOrThrow(schemaType: SchemaType, data: unknown): Promise<void> {
    const result = this.validate(schemaType, data);
    if (!result.isValid) {
      throw new ValidationError(result.feedback!, result.errors!);
    }
  }
}

export interface ValidationResult {
  isValid: boolean;
  errors?: ValidationErrorDetail[];
  feedback?: string;
}

export interface ValidationErrorDetail {
  path: string;
  message: string;
  value?: unknown;
}

export class ValidationError extends Error {
  public errors: ValidationErrorDetail[];
  
  constructor(message: string, errors: ValidationErrorDetail[]) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}
