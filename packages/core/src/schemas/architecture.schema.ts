export const architectureSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "LetselaArchitectureContract",
  type: "object",
  properties: {
    projectId: { type: "string", format: "uuid" },
    stack: {
      type: "object",
      properties: {
        frontend: { 
          type: "string", 
          enum: ["nextjs", "react-vite", "vue", "angular"] 
        },
        backend: { 
          type: "string", 
          enum: ["fastapi", "express", "django", "spring-boot"] 
        },
        database: { 
          type: "string", 
          enum: ["postgresql", "mysql", "mongodb", "sqlite"] 
        },
        orm: { 
          type: "string",
          enum: ["prisma", "typeorm", "drizzle", "sqlalchemy"]
        }
      },
      required: ["frontend", "backend", "database"]
    },
    dataModel: {
      type: "array",
      items: {
        type: "object",
        properties: {
          table: { type: "string", pattern: "^[a-z][a-z_]*$" },
          description: { type: "string" },
          columns: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string", pattern: "^[a-z][a-z_]*$" },
                type: { 
                  type: "string",
                  enum: ["string", "int", "float", "boolean", "datetime", "json", "uuid"]
                },
                constraints: {
                  type: "array",
                  items: { 
                    type: "string",
                    enum: ["primary", "unique", "nullable", "index"]
                  }
                },
                references: {
                  type: "object",
                  properties: {
                    table: { type: "string" },
                    column: { type: "string" }
                  }
                }
              },
              required: ["name", "type"]
            }
          }
        },
        required: ["table", "columns"]
      }
    },
    apiEndpoints: {
      type: "array",
      items: {
        type: "object",
        properties: {
          path: { type: "string", pattern: "^/api/" },
          method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE", "PATCH"] },
          description: { type: "string" },
          authenticated: { type: "boolean" },
          roles: {
            type: "array",
            items: { type: "string" }
          },
          requestBody: { type: "object" },
          responseType: { type: "string" }
        },
        required: ["path", "method", "authenticated"]
      }
    },
    frontendViews: {
      type: "array",
      items: {
        type: "object",
        properties: {
          route: { type: "string", pattern: "^/" },
          componentName: { type: "string", pattern: "^[A-Z][a-zA-Z]*$" },
          requiredRoles: {
            type: "array",
            items: { type: "string" }
          },
          description: { type: "string" }
        },
        required: ["route", "componentName"]
      }
    },
    environment: {
      type: "object",
      properties: {
        variables: {
          type: "array",
          items: {
            type: "object",
            properties: {
              key: { type: "string" },
              description: { type: "string" },
              required: { type: "boolean" }
            },
            required: ["key", "required"]
          }
        }
      }
    }
  },
  required: ["projectId", "stack", "dataModel", "apiEndpoints", "frontendViews"],
  additionalProperties: false
} as const;
