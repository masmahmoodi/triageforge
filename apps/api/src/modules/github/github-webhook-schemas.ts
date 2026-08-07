import { z } from "zod";

const githubUserSchema = z.object({
  login: z.string()
});

const githubLabelSchema = z.object({
  name: z.string(),
  color: z.string().nullable().optional(),
  description: z.string().nullable().optional()
});

const githubIssueSchema = z.object({
  id: z.number().int().positive(),
  number: z.number().int().positive(),
  title: z.string(),
  body: z.string().nullable(),
  state: z.enum(["open", "closed"]),
  user: githubUserSchema.nullable(),
  labels: z.array(githubLabelSchema),
  assignees: z.array(githubUserSchema).default([]),
  comments: z.number().int().nonnegative().default(0),
  html_url: z.string().url(),
  created_at: z.string(),
  updated_at: z.string(),
  closed_at: z.string().nullable()
});

const githubRepositorySchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  full_name: z.string(),
  private: z.boolean(),
  default_branch: z.string().nullable().optional(),
  html_url: z.string().url(),
  owner: githubUserSchema
});

export const githubIssuesWebhookPayloadSchema = z.object({
  action: z.string(),
  installation: z.object({
    id: z.number().int().positive()
  }),
  repository: githubRepositorySchema,
  issue: githubIssueSchema
});

export type GitHubIssuesWebhookPayload = z.infer<
  typeof githubIssuesWebhookPayloadSchema
>;
