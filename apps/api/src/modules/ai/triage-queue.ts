import { logger } from "../../infrastructure/logging/logger.js";
import type { TriageService } from "./triage-service.js";

interface TriageJob {
  issueId: string;
  attempt: number;
}

export class TriageQueue {
  private readonly jobs: TriageJob[] = [];
  private readonly queuedIssueIds = new Set<string>();
  private running = 0;

  public constructor(
    private readonly triageService: TriageService,
    private readonly options: {
      concurrency: number;
      maxAttempts: number;
      retryDelayMs: number;
    } = {
      concurrency: 2,
      maxAttempts: 3,
      retryDelayMs: 5_000
    }
  ) {}

  public enqueue(issueId: string): void {
    if (this.queuedIssueIds.has(issueId)) {
      return;
    }

    this.queuedIssueIds.add(issueId);
    this.jobs.push({
      issueId,
      attempt: 1
    });
    this.drain();
  }

  private drain(): void {
    while (
      this.running < this.options.concurrency &&
      this.jobs.length > 0
    ) {
      const job = this.jobs.shift();

      if (!job) {
        return;
      }

      this.running += 1;
      void this.runJob(job);
    }
  }

  private async runJob(job: TriageJob): Promise<void> {
    try {
      const result = await this.triageService.analyzeIssue(job.issueId);

      if (result === "failed" && job.attempt < this.options.maxAttempts) {
        setTimeout(() => {
          this.jobs.push({
            issueId: job.issueId,
            attempt: job.attempt + 1
          });
          this.drain();
        }, this.options.retryDelayMs * job.attempt);
        return;
      }

      this.queuedIssueIds.delete(job.issueId);
    } catch (error) {
      this.queuedIssueIds.delete(job.issueId);
      logger.error({ error, issueId: job.issueId }, "Triage queue job crashed");
    } finally {
      this.running -= 1;
      this.drain();
    }
  }
}
