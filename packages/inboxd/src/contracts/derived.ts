export type AttachmentParsePipeline = "attachment_text";
export type AttachmentParseState = "pending" | "running" | "succeeded" | "failed";

export interface AttachmentParseJobRecord {
  jobId: string;
  captureId: string;
  attachmentId: string;
  pipeline: AttachmentParsePipeline;
  state: AttachmentParseState;
  attempts: number;
  providerId?: string | null;
  resultPath?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
}

export interface AttachmentParseJobFilters {
  captureId?: string;
  attachmentId?: string;
  state?: AttachmentParseState;
  limit?: number;
}

export interface AttachmentParseJobClaimFilters {
  captureId?: string;
  attachmentId?: string;
}

export interface CompleteAttachmentParseJobInput {
  jobId: string;
  attempt: number;
  providerId: string;
  resultPath: string;
  extractedText?: string | null;
  transcriptText?: string | null;
  finishedAt?: string;
}

export interface FailAttachmentParseJobInput {
  jobId: string;
  attempt: number;
  providerId?: string | null;
  errorCode?: string | null;
  errorMessage: string;
  finishedAt?: string;
}

export interface AttachmentParseJobFinalizeResult {
  job: AttachmentParseJobRecord;
  applied: boolean;
}

export interface RequeueAttachmentParseJobsInput {
  captureId?: string;
  attachmentId?: string;
  state?: AttachmentParseState;
}
