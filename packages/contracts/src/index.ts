import { z } from "zod";

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional()
  }),
  meta: z.object({
    requestId: z.string().optional()
  })
});

export const authUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().nullable(),
  createdAt: z.string()
});

export const registerRequestSchema = z.object({
  email: z.string().email().max(320),
  name: z.string().trim().min(1).max(120).optional(),
  password: z.string().min(8).max(256)
});

export const loginRequestSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(256)
});

export const authResponseSchema = z.object({
  data: z.object({
    user: authUserSchema,
    csrfToken: z.string()
  })
});

export const repositorySchema = z.object({
  id: z.string().uuid(),
  githubId: z.string(),
  installationId: z.string().uuid(),
  ownerLogin: z.string(),
  name: z.string(),
  fullName: z.string(),
  private: z.boolean(),
  defaultBranch: z.string().nullable(),
  htmlUrl: z.string().url(),
  connectedAt: z.string(),
  updatedAt: z.string()
});

export const issueStateSchema = z.enum(["open", "closed"]);
export const issuePrioritySchema = z.enum([
  "low",
  "medium",
  "high",
  "urgent"
]);

export const issueCategorySchema = z.enum([
  "bug",
  "feature",
  "question",
  "documentation",
  "maintenance",
  "security",
  "other"
]);

export const suggestedLabelSchema = z.object({
  name: z.string().trim().min(1).max(50),
  rationale: z.string().trim().min(1).max(500),
  color: z
    .string()
    .regex(/^[0-9a-fA-F]{6}$/)
    .nullable()
});

export const aiIssueAnalysisSchema = z.object({
  summary: z.string().trim().min(1).max(1200),
  category: issueCategorySchema,
  priority: issuePrioritySchema,
  confidence: z.number().min(0).max(1),
  userImpact: z.string().trim().min(1).max(1000),
  suggestedLabels: z.array(suggestedLabelSchema).min(1).max(8),
  missingInformation: z.array(z.string().trim().min(1).max(500)).max(8),
  draftResponse: z.string().trim().min(1).max(5000),
  rationale: z.string().trim().min(1).max(2000),
  needsHumanReview: z.boolean()
});

export const similarIssueSchema = z.object({
  issueId: z.string().uuid(),
  issueNumber: z.number().int().positive(),
  title: z.string(),
  state: issueStateSchema,
  htmlUrl: z.string().url(),
  similarity: z.number().min(0).max(1),
  summary: z.string().nullable()
});

export const triageAnalysisSchema = z.object({
  id: z.string().uuid(),
  issueId: z.string().uuid(),
  status: z.enum(["pending", "completed", "failed"]),
  model: z.string().nullable(),
  embeddingModel: z.string().nullable(),
  analysis: aiIssueAnalysisSchema.nullable(),
  similarIssues: z.array(similarIssueSchema),
  errorMessage: z.string().nullable(),
  createdAt: z.string()
});

export const issueListItemSchema = z.object({
  id: z.string().uuid(),
  repositoryId: z.string().uuid(),
  number: z.number().int().positive(),
  title: z.string(),
  state: issueStateSchema,
  authorLogin: z.string().nullable(),
  labels: z.array(z.string()),
  priority: issuePrioritySchema.nullable(),
  analysisStatus: z.enum(["pending", "completed", "failed"]).nullable(),
  htmlUrl: z.string().url(),
  githubCreatedAt: z.string(),
  githubUpdatedAt: z.string()
});

export const issueDetailSchema = issueListItemSchema.extend({
  body: z.string().nullable(),
  repository: repositorySchema,
  latestAnalysis: triageAnalysisSchema.nullable(),
  approvals: z.array(
    z.object({
      id: z.string().uuid(),
      analysisId: z.string().uuid(),
      status: z.enum(["approved", "applied", "failed"]),
      approvedLabels: z.array(z.string()),
      approvedComment: z.string().nullable(),
      errorMessage: z.string().nullable(),
      createdAt: z.string(),
      appliedAt: z.string().nullable()
    })
  )
});

export const issueQuerySchema = z.object({
  repositoryId: z.string().uuid().optional(),
  state: issueStateSchema.optional(),
  priority: issuePrioritySchema.optional(),
  label: z.string().trim().min(1).max(50).optional(),
  q: z.string().trim().min(1).max(200).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25)
});

export const issueListResponseSchema = z.object({
  data: z.array(issueListItemSchema),
  pageInfo: z.object({
    nextCursor: z.string().nullable()
  })
});

export const approvalRequestSchema = z.object({
  analysisId: z.string().uuid(),
  labels: z.array(z.string().trim().min(1).max(50)).max(8),
  comment: z.string().trim().min(1).max(5000).optional()
});

export const githubSetupUrlResponseSchema = z.object({
  data: z.object({
    url: z.string().url()
  })
});

export type ApiError = z.infer<typeof apiErrorSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type Repository = z.infer<typeof repositorySchema>;
export type IssueListItem = z.infer<typeof issueListItemSchema>;
export type IssueDetail = z.infer<typeof issueDetailSchema>;
export type IssueListResponse = z.infer<typeof issueListResponseSchema>;
export type IssueQuery = z.infer<typeof issueQuerySchema>;
export type AiIssueAnalysis = z.infer<typeof aiIssueAnalysisSchema>;
export type TriageAnalysis = z.infer<typeof triageAnalysisSchema>;
export type SimilarIssue = z.infer<typeof similarIssueSchema>;
export type ApprovalRequest = z.infer<typeof approvalRequestSchema>;
