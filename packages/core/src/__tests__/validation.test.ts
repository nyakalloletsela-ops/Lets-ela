import { ValidationEngine } from '../validation/engine';

describe('ValidationEngine', () => {
  let engine: ValidationEngine;

  beforeEach(() => {
    engine = new ValidationEngine();
  });

  test('validates correct PRD', () => {
    const validPRD = {
      projectName: "AskATutor",
      userRoles: ["student", "tutor", "admin"],
      features: [
        {
          id: "booking",
          name: "Session Booking",
          description: "Schedule tutoring sessions"
        },
        {
          id: "payments",
          name: "Payment Processing",
          description: "Handle payments and escrow",
          dependencies: ["booking"]
        }
      ]
    };

    const result = engine.validate('prd', validPRD);
    expect(result.isValid).toBe(true);
  });

  test('rejects PRD missing required fields', () => {
    const invalidPRD = {
      projectName: "AskATutor",
      userRoles: ["student"]
      // missing features array
    };

    const result = engine.validate('prd', invalidPRD);
    expect(result.isValid).toBe(false);
    expect(result.errors?.length).toBeGreaterThan(0);
  });

  test('validates correct architecture', () => {
    const validArch = {
      projectId: "123e4567-e89b-12d3-a456-426614174000",
      stack: {
        frontend: "nextjs",
        backend: "express",
        database: "postgresql"
      },
      dataModel: [
        {
          table: "users",
          columns: [
            { name: "id", type: "uuid", constraints: ["primary"] },
            { name: "email", type: "string", constraints: ["unique"] }
          ]
        }
      ],
      apiEndpoints: [
        {
          path: "/api/users",
          method: "GET",
          description: "List users",
          authenticated: true
        }
      ],
      frontendViews: [
        {
          route: "/dashboard",
          componentName: "Dashboard"
        }
      ]
    };

    const result = engine.validate('architecture', validArch);
    expect(result.isValid).toBe(true);
  });
});
