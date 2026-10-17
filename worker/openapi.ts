export const openapi = (origin: string) => {
  const schema = {
    openapi: "3.1.0",
    info: {
      title: "Oh My CV API",
      version: "1.0.0",
      description:
        "Authenticate with a personal API token. All resume queries are isolated to the token owner. Updates require the current revision."
    },
    servers: [{ url: origin }],
    components: {
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } },
      schemas: {
        Resume: {
          type: "object",
          properties: {
            id: { type: "integer" },
            revision: { type: "string" },
            name: { type: "string" },
            markdown: { type: "string" },
            css: { type: "string" },
            styles: { type: "object" }
          }
        }
      }
    },
    security: [{ bearerAuth: [] }],
    paths: {
      "/api/v1/active-resume": {
        get: {
          summary: "Read the resume most recently opened in the editor",
          responses: { 200: { description: "Full resume and revision" } }
        }
      },
      "/api/v1/resumes": {
        get: {
          summary: "List owned resume metadata; paginate with before",
          responses: { 200: { description: "resumes and nextCursor" } }
        },
        post: {
          summary: "Create a resume",
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Resume" } }
            }
          },
          responses: { 201: { description: "Created resume" } }
        }
      },
      "/api/v1/resumes/{id}": {
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } }
        ],
        get: {
          summary: "Read full resume and revision",
          responses: {
            200: { description: "Resume with ETag header" },
            404: { description: "Not owned or not found" }
          }
        },
        patch: {
          summary: "Update selected fields; merge partial styles",
          parameters: [
            {
              name: "If-Match",
              in: "header",
              required: true,
              schema: { type: "string" },
              example: '"1"'
            }
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Resume" } }
            }
          },
          responses: {
            200: { description: "Updated resume and new revision" },
            409: { description: "Revision conflict" },
            428: { description: "Missing revision" }
          }
        },
        delete: {
          summary: "Soft-delete a resume (requires If-Match)",
          responses: { 200: { description: "Deleted resume" } }
        }
      },
      "/api/v1/resumes/{id}/history": {
        get: {
          summary: "List version history, cursor is before=<version id>",
          responses: {
            200: { description: "versions, total, nextBefore and currentRevision" }
          }
        }
      },
      "/api/v1/resumes/{id}/history/{versionId}": {
        get: {
          summary: "Read a full historical snapshot",
          responses: { 200: { description: "Version and resume snapshot" } }
        }
      },
      "/api/v1/resumes/{id}/history/restore": {
        post: {
          summary: "Restore an owned version using JSON {id, revision}",
          responses: {
            200: { description: "New revision" },
            409: { description: "Revision conflict" }
          }
        }
      },
      "/api/v1/resumes/{id}/undelete": {
        post: {
          summary: "Restore a deleted resume using the current revision",
          responses: { 200: { description: "Restored resume" } }
        }
      },
      "/api/v1/import": {
        post: {
          summary: "Idempotently import JSON {sourceId, resume}",
          responses: {
            201: { description: "New resume id" },
            200: { description: "Existing import id" }
          }
        }
      },
      "/api/v1/resumes/{id}/history/import": {
        post: {
          summary:
            "Import an older version using {sourceId,resume,createdAt}; send newest old version first",
          responses: { 201: { description: "Imported historical version id" } }
        }
      }
    }
  };
  for (const [path, item] of Object.entries(schema.paths)) {
    const parameters = [...path.matchAll(/\{([^}]+)\}/g)].map((match) => ({
      name: match[1],
      in: "path",
      required: true,
      schema: { type: match[1] === "id" ? "integer" : "string" }
    }));
    if (parameters.length) (item as { parameters?: unknown[] }).parameters = parameters;
  }
  return schema;
};
