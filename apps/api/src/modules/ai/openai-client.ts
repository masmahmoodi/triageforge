import {
  aiIssueAnalysisSchema,
  type AiIssueAnalysis
} from "@triageforge/contracts";

import type { AppConfig } from "../../config/env.js";
import { integrationUnavailable } from "../../shared/errors.js";

interface OpenAIResponsePayload {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
}

interface OpenAIEmbeddingPayload {
  data?: Array<{
    embedding?: number[];
  }>;
}

export interface IssueForAi {
  repositoryFullName: string;
  number: number;
  title: string;
  body: string | null;
  labels: string[];
  authorLogin: string | null;
}

export class OpenAIClient {
  public constructor(private readonly config: AppConfig["openai"]) {}

  public async analyzeIssue(issue: IssueForAi): Promise<AiIssueAnalysis> {
    if (!this.config.apiKey) {
      throw integrationUnavailable("OPENAI_API_KEY is required to generate issue triage analysis");
    }

    const response = await fetch(`${this.config.baseUrl}/responses`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model: this.config.triageModel,
        input: [
          {
            role: "system",
            content:
              "You are TriageForge, an expert GitHub issue triage assistant. Return only the requested structured JSON."
          },
          {
            role: "user",
            content: buildIssuePrompt(issue)
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "issue_triage_analysis",
            description:
              "Structured analysis for a GitHub issue before a human applies labels or comments.",
            strict: true,
            schema: TRIAGE_ANALYSIS_JSON_SCHEMA
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(
        `OpenAI Responses API failed with ${response.status}: ${await response.text()}`
      );
    }

    const payload = (await response.json()) as OpenAIResponsePayload;
    const text = extractResponseText(payload);

    return aiIssueAnalysisSchema.parse(JSON.parse(text));
  }

  public async embedIssueText(text: string): Promise<number[]> {
    if (!this.config.apiKey) {
      throw integrationUnavailable("OPENAI_API_KEY is required to generate issue embeddings");
    }

    const response = await fetch(`${this.config.baseUrl}/embeddings`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model: this.config.embeddingModel,
        input: text,
        dimensions: this.config.embeddingDimensions
      })
    });

    if (!response.ok) {
      throw new Error(
        `OpenAI Embeddings API failed with ${response.status}: ${await response.text()}`
      );
    }

    const payload = (await response.json()) as OpenAIEmbeddingPayload;
    const embedding = payload.data?.[0]?.embedding;

    if (!embedding || embedding.length !== this.config.embeddingDimensions) {
      throw new Error("OpenAI embedding response did not match the configured dimensions");
    }

    return embedding;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
      "Content-Type": "application/json"
    };
  }
}

function buildIssuePrompt(issue: IssueForAi): string {
  return [
    `Repository: ${issue.repositoryFullName}`,
    `Issue: #${issue.number}`,
    `Author: ${issue.authorLogin ?? "unknown"}`,
    `Existing labels: ${issue.labels.length > 0 ? issue.labels.join(", ") : "none"}`,
    `Title: ${issue.title}`,
    "Body:",
    issue.body?.trim() || "(empty)"
  ].join("\n");
}

function extractResponseText(payload: OpenAIResponsePayload): string {
  if (payload.output_text) {
    return payload.output_text;
  }

  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (
        (content.type === "output_text" || content.type === "text") &&
        content.text
      ) {
        return content.text;
      }
    }
  }

  throw new Error("OpenAI response did not include text output");
}

export function buildEmbeddingText(issue: IssueForAi, analysis: AiIssueAnalysis): string {
  return [
    issue.repositoryFullName,
    `#${issue.number}`,
    issue.title,
    issue.body ?? "",
    analysis.summary,
    analysis.category,
    analysis.priority,
    analysis.userImpact
  ].join("\n");
}

const TRIAGE_ANALYSIS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "category",
    "priority",
    "confidence",
    "userImpact",
    "suggestedLabels",
    "missingInformation",
    "draftResponse",
    "rationale",
    "needsHumanReview"
  ],
  properties: {
    summary: {
      type: "string",
      minLength: 1,
      maxLength: 1200
    },
    category: {
      type: "string",
      enum: [
        "bug",
        "feature",
        "question",
        "documentation",
        "maintenance",
        "security",
        "other"
      ]
    },
    priority: {
      type: "string",
      enum: ["low", "medium", "high", "urgent"]
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1
    },
    userImpact: {
      type: "string",
      minLength: 1,
      maxLength: 1000
    },
    suggestedLabels: {
      type: "array",
      minItems: 1,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "rationale", "color"],
        properties: {
          name: {
            type: "string",
            minLength: 1,
            maxLength: 50
          },
          rationale: {
            type: "string",
            minLength: 1,
            maxLength: 500
          },
          color: {
            type: ["string", "null"],
            pattern: "^[0-9a-fA-F]{6}$"
          }
        }
      }
    },
    missingInformation: {
      type: "array",
      maxItems: 8,
      items: {
        type: "string",
        minLength: 1,
        maxLength: 500
      }
    },
    draftResponse: {
      type: "string",
      minLength: 1,
      maxLength: 5000
    },
    rationale: {
      type: "string",
      minLength: 1,
      maxLength: 2000
    },
    needsHumanReview: {
      type: "boolean"
    }
  }
} as const;
