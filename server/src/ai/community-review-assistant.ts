import {
  generateJson,
  getLightModel,
  isAiEnabled,
  type AiInvalidResponseError,
  type AiUnavailableError
} from "./client.js";
import {
  communityReviewAiDraftResponseSchema,
  communityReviewAiDraftSchema,
  type CommunityReviewAiDraft
} from "./types.js";

export interface CommunityReviewAiSource {
  sourceType: "proposal" | "answer";
  proposalTypeHint?: string | null;
  title: string;
  summary?: string | null;
  questionTitle?: string | null;
  questionBody?: string | null;
  answerBody?: string | null;
  submissionTitle?: string | null;
  submissionPayload?: Record<string, unknown> | null;
  sourceContext?: Record<string, unknown> | null;
  payload?: Record<string, unknown> | null;
  routeId?: string | null;
  routeVariantId?: string | null;
  routeLabel?: string | null;
  routeVariantLabel?: string | null;
}

const isRecoverableDraftError = (
  error: unknown
): error is AiUnavailableError | AiInvalidResponseError =>
  error instanceof Error &&
  (error.name === "AiUnavailableError" || error.name === "AiInvalidResponseError");

const buildFallbackDraft = (input: CommunityReviewAiSource): CommunityReviewAiDraft => {
  const fallbackType =
    input.proposalTypeHint === "route_deprecate" || input.proposalTypeHint === "route_reactivate"
      ? input.proposalTypeHint
      : "route_note";
  const summaryText =
    input.summary?.trim() ||
    input.answerBody?.trim() ||
    input.questionBody?.trim() ||
    input.submissionTitle?.trim() ||
    input.title.trim();
  const title =
    input.sourceType === "answer"
      ? `Community answer follow-up: ${input.questionTitle ?? input.title}`
      : input.title;

  return {
    confidence: "low",
    suggestedProposalType: fallbackType,
    reason: "Fallback draft created without AI assistance. Reviewer confirmation is required.",
    title,
    summary: summaryText.slice(0, 600) || null,
    changeSummary: summaryText.slice(0, 240) || title,
    reviewNotes: "Review manually before publishing. This draft was created without AI assistance.",
    note: summaryText.slice(0, 1200) || null,
    routeCode: null,
    routeVariantCode: null,
    proposedLifecycleStatus:
      fallbackType === "route_deprecate"
        ? "deprecated"
        : fallbackType === "route_reactivate"
          ? "active"
          : null,
    duplicateKey: null,
    reviewedChangeSetText: "{}"
  };
};

const buildPrompt = (input: CommunityReviewAiSource) => `You are drafting reviewer-assist suggestions for Sakai community learning.

Return JSON only.

Rules:
- Do not invent route IDs, variant IDs, stops, fares, or route topology facts.
- You may suggest routeCode or routeVariantCode only when they are directly stated or strongly implied in the source text.
- If a deterministic change set is not clearly supported by the source, return "{}" for reviewedChangeSetText.
- reviewedChangeSetText must be a valid JSON object string, not markdown.
- Prefer "route_note" when evidence is too weak for a live data mutation.
- Keep changeSummary concise and reviewer-facing.
- Keep reviewNotes practical and mention uncertainty when needed.
- duplicateKey should only be set when there is an obvious normalized duplicate signature.

Source type: ${input.sourceType}
Proposal type hint: ${input.proposalTypeHint ?? "none"}
Proposal title: ${input.title}
Proposal summary: ${input.summary ?? "none"}
Route label: ${input.routeLabel ?? "none"}
Route variant label: ${input.routeVariantLabel ?? "none"}
Question title: ${input.questionTitle ?? "none"}
Question body: ${input.questionBody ?? "none"}
Answer body: ${input.answerBody ?? "none"}
Submission title: ${input.submissionTitle ?? "none"}
Proposal payload: ${JSON.stringify(input.payload ?? {})}
Submission payload: ${JSON.stringify(input.submissionPayload ?? {})}
Source context: ${JSON.stringify(input.sourceContext ?? {})}`;

export const generateCommunityReviewAiDraft = async (
  input: CommunityReviewAiSource
): Promise<{
  draft: CommunityReviewAiDraft;
  modelName: string;
}> => {
  if (!isAiEnabled()) {
    return {
      draft: buildFallbackDraft(input),
      modelName: "manual-fallback"
    };
  }

  try {
    const modelName = getLightModel();
    const draft = await generateJson({
      model: modelName,
      prompt: buildPrompt(input),
      outputSchema: communityReviewAiDraftSchema,
      responseSchema: communityReviewAiDraftResponseSchema,
      temperature: 0.2
    });

    return { draft, modelName };
  } catch (error) {
    if (isRecoverableDraftError(error)) {
      console.warn("Falling back to deterministic community review draft", {
        operation: "community_review_ai_draft",
        reason: error.message
      });

      return {
        draft: buildFallbackDraft(input),
        modelName: "manual-fallback"
      };
    }

    throw error;
  }
};
