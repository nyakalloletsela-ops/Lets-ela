export const prdSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "LetselaPRDContract",
  type: "object",
  properties: {
    projectName: { type: "string", minLength: 1 },
    targetAudience: { type: "string" },
    userRoles: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      uniqueItems: true
    },
    features: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", pattern: "^[a-z][a-z0-9-]*$" },
          name: { type: "string", minLength: 1 },
          description: { type: "string" },
          priority: { type: "string", enum: ["P0", "P1", "P2"] },
          dependencies: {
            type: "array",
            items: { type: "string" }
          }
        },
        required: ["id", "name", "description"],
        additionalProperties: false
      }
    },
    constraints: {
      type: "object",
      properties: {
        budget: { type: "string" },
        timeline: { type: "string" },
        compliance: { type: "array", items: { type: "string" } }
      }
    }
  },
  required: ["projectName", "userRoles", "features"],
  additionalProperties: false
} as const;
