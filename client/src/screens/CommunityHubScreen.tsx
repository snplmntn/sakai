import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ArrowLeft01Icon } from '@hugeicons/core-free-icons';

import { useAuth } from '../auth/AuthContext';
import {
  approveCommunityProposal,
  createCommunityQuestion,
  createCommunitySubmission,
  generateCommunityProposalAiDraft,
  getCommunityReviewQueue,
  getCommunityReviewProposalDetail,
  getMyCommunityQuestions,
  getMyCommunitySubmissions,
  getRecentCommunityQuestions,
  rejectCommunityProposal,
} from '../community/api';
import CommunityProposalChangeSetEditor from '../community/CommunityProposalChangeSetEditor';
import type {
  CommunityQuestion,
  CommunityReviewedChangeSet,
  CommunityReviewProposalDetail,
  CommunityReviewProposal,
  CommunitySubmission,
  CommunitySubmissionType,
} from '../community/types';
import { coerceReviewedChangeSet, createEmptyReviewedChangeSet } from '../community/review-change-set-types';
import SafeScreen from '../components/SafeScreen';
import { COLORS, FONTS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import type { RootStackParamList } from '../navigation/AppNavigator';

type CommunityHubScreenProps = NativeStackScreenProps<RootStackParamList, 'CommunityHub'>;
type ComposerMode = 'question' | 'submission';
type CommunityLoadMode = 'initial' | 'refresh' | 'background';

const SUBMISSION_TYPES: Array<{ value: CommunitySubmissionType; label: string }> = [
  { value: 'route_update', label: 'Route update' },
  { value: 'route_deprecate', label: 'Deprecate route' },
  { value: 'route_reactivate', label: 'Reactivate route' },
  { value: 'stop_correction', label: 'Stop correction' },
  { value: 'transfer_correction', label: 'Transfer fix' },
  { value: 'fare_update', label: 'Fare update' },
  { value: 'route_note', label: 'Route note' },
  { value: 'route_create', label: 'New route' },
];

const hasReviewerRole = (value: unknown): boolean => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const appMetadata = value as Record<string, unknown>;
  const singleRole = typeof appMetadata.role === 'string' ? [appMetadata.role] : [];
  const multipleRoles = Array.isArray(appMetadata.roles)
    ? appMetadata.roles.filter((role): role is string => typeof role === 'string')
    : [];

  return [...singleRole, ...multipleRoles].some((role) => {
    const normalized = role.trim().toLowerCase();
    return normalized === 'reviewer' || normalized === 'admin';
  });
};

const formatDate = (value: string): string =>
  new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

const submissionBadgeStyle = (status: CommunitySubmission['status']) =>
  status === 'published'
    ? styles.badgeSuccess
    : status === 'rejected'
      ? styles.badgeDanger
      : status === 'approved' || status === 'under_review'
        ? styles.badgeWarning
        : styles.badgeNeutral;

const questionStatusStyle = (question: CommunityQuestion) =>
  question.replyCount > 0 ? styles.badgeSuccess : styles.badgeNeutral;

const questionStatusLabel = (question: CommunityQuestion) =>
  question.replyCount > 0 ? 'Answered' : 'Open';

const previewText = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.length <= 120) {
    return trimmed;
  }

  return `${trimmed.slice(0, 117)}...`;
};

const buildSubmissionPayload = (input: {
  submissionType: CommunitySubmissionType;
  details: string;
  originLabel: string;
  destinationLabel: string;
  routeId: string;
  affectedModeOrProduct: string;
  proposedAmount: string;
  passengerType: string;
}): Record<string, unknown> => {
  if (input.submissionType === 'missing_route') {
    return {
      origin: input.originLabel,
      destination: input.destinationLabel,
    };
  }

  if (input.submissionType === 'route_correction' || input.submissionType === 'route_update') {
    return {
      targetRouteOrPlaceId: input.routeId || 'community-route-correction',
      incorrectDetail: input.details,
      proposedCorrection: input.details,
    };
  }

  if (input.submissionType === 'route_create') {
    return {
      routeCode: input.routeId || undefined,
      displayName: input.destinationLabel || input.originLabel || 'Community proposed route',
      origin: input.originLabel,
      destination: input.destinationLabel,
      note: input.details,
    };
  }

  if (input.submissionType === 'route_deprecate' || input.submissionType === 'route_reactivate') {
    return {
      reason: input.details,
      replacementRouteCode: input.routeId || undefined,
      note: input.details,
    };
  }

  if (input.submissionType === 'stop_correction') {
    return {
      stopName: input.originLabel || input.destinationLabel,
      correctedName: input.destinationLabel || input.originLabel,
      note: input.details,
    };
  }

  if (input.submissionType === 'transfer_correction') {
    return {
      correctedWalkingDistanceM: 150,
      correctedWalkingDurationMinutes: 3,
      note: input.details,
    };
  }

  if (input.submissionType === 'fare_update') {
    return {
      affectedModeOrProduct: input.affectedModeOrProduct || 'commute',
      proposedAmount: Number(input.proposedAmount || '0'),
      passengerType: input.passengerType || 'regular',
      note: input.details,
    };
  }

  return {
    note: input.details,
    routeOrArea: input.destinationLabel || input.originLabel,
  };
};

function ThreadCard({
  question,
  currentUserId,
  onOpen,
}: {
  question: CommunityQuestion;
  currentUserId?: string;
  onOpen: () => void;
}) {
  return (
    <Pressable style={styles.threadCard} onPress={onOpen}>
      <View style={styles.threadHeaderRow}>
        <View style={styles.threadAvatar}>
          <Text style={styles.threadAvatarText}>
            {question.userId === currentUserId ? 'Y' : 'R'}
          </Text>
        </View>
        <View style={styles.threadHeaderContent}>
          <View style={styles.threadAuthorRow}>
            <Text style={styles.threadAuthor}>
              {question.userId === currentUserId ? 'You' : 'Community rider'}
            </Text>
            <Text style={styles.threadDot}>·</Text>
            <Text style={styles.threadMeta}>{formatDate(question.createdAt)}</Text>
          </View>
          <Text style={styles.threadRouteMeta}>
            {question.originLabel} to {question.destinationLabel}
          </Text>
        </View>
        <View style={[styles.badge, questionStatusStyle(question)]}>
          <Text style={styles.badgeText}>{questionStatusLabel(question)}</Text>
        </View>
      </View>

      <Text style={styles.threadTitle}>{question.title}</Text>
      <Text style={styles.threadPreview}>{previewText(question.body)}</Text>

      <View style={styles.threadFooterRow}>
        <Text style={styles.threadReplyMeta}>
          {question.replyCount} {question.replyCount === 1 ? 'reply' : 'replies'}
        </Text>
        <Pressable style={styles.inlineActionButton} onPress={onOpen}>
          <Text style={styles.inlineActionText}>Answer</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

export default function CommunityHubScreen({
  navigation,
  route,
}: CommunityHubScreenProps) {
  const { session, status, user } = useAuth();
  const draft = route.params?.draft;
  const accessToken = session?.accessToken;
  const [composerMode, setComposerMode] = useState<ComposerMode>(draft?.defaultMode ?? 'question');
  const [showComposer, setShowComposer] = useState(Boolean(draft));
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mySubmissions, setMySubmissions] = useState<CommunitySubmission[]>([]);
  const [myQuestions, setMyQuestions] = useState<CommunityQuestion[]>([]);
  const [recentQuestions, setRecentQuestions] = useState<CommunityQuestion[]>([]);
  const [reviewQueue, setReviewQueue] = useState<CommunityReviewProposal[]>([]);
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
  const [selectedProposalDetail, setSelectedProposalDetail] =
    useState<CommunityReviewProposalDetail | null>(null);
  const [reviewChangeSummary, setReviewChangeSummary] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [reviewedChangeSet, setReviewedChangeSet] = useState<CommunityReviewedChangeSet>(
    createEmptyReviewedChangeSet('route_note')
  );
  const [isLoadingProposalDetail, setIsLoadingProposalDetail] = useState(false);
  const [isGeneratingProposalAiDraft, setIsGeneratingProposalAiDraft] = useState(false);
  const [isPublishingProposal, setIsPublishingProposal] = useState(false);

  const [originLabel, setOriginLabel] = useState(draft?.originLabel ?? '');
  const [destinationLabel, setDestinationLabel] = useState(draft?.destinationLabel ?? '');
  const [questionTitle, setQuestionTitle] = useState(draft?.title ?? '');
  const [questionBody, setQuestionBody] = useState(draft?.body ?? '');
  const [submissionTitle, setSubmissionTitle] = useState(
    draft?.title ?? 'Share a route or fare update'
  );
  const [submissionType, setSubmissionType] = useState<CommunitySubmissionType>('route_update');
  const [submissionDetails, setSubmissionDetails] = useState(draft?.body ?? '');
  const [affectedModeOrProduct, setAffectedModeOrProduct] = useState('');
  const [proposedAmount, setProposedAmount] = useState('');

  const sourceContext = useMemo<Record<string, unknown> | undefined>(
    () => draft?.sourceContext,
    [draft]
  );
  const isReviewer = hasReviewerRole(user?.appMetadata);

  const loadCommunityData = useCallback(
    async (mode: CommunityLoadMode) => {
      if (!accessToken) {
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      if (mode === 'initial') {
        setIsLoading(true);
      }

      if (mode === 'refresh') {
        setIsRefreshing(true);
      }

      setErrorMessage(null);

      try {
        const [submissions, questions, recent, queue] = await Promise.all([
          getMyCommunitySubmissions(accessToken),
          getMyCommunityQuestions(accessToken),
          getRecentCommunityQuestions(accessToken),
          isReviewer ? getCommunityReviewQueue(accessToken) : Promise.resolve([]),
        ]);

        setMySubmissions(submissions);
        setMyQuestions(questions);
        setRecentQuestions(recent);
        setReviewQueue(queue);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : 'Unable to load community activity right now.'
        );
      } finally {
        if (mode === 'initial') {
          setIsLoading(false);
        }

        if (mode === 'refresh') {
          setIsRefreshing(false);
        }
      }
    },
    [accessToken, isReviewer]
  );

  useEffect(() => {
    void loadCommunityData('initial');
  }, [loadCommunityData]);

  useEffect(() => {
    if (!draft) {
      return;
    }

    setShowComposer(true);
    setComposerMode(draft.defaultMode ?? 'question');
    setOriginLabel(draft.originLabel ?? '');
    setDestinationLabel(draft.destinationLabel ?? '');
    setQuestionTitle(draft.title ?? '');
    setQuestionBody(draft.body ?? '');
    setSubmissionTitle(draft.title ?? 'Share a route or fare update');
    setSubmissionDetails(draft.body ?? '');
  }, [draft]);

  const applyProposalAiDraft = (proposal: CommunityReviewProposalDetail) => {
    if (!proposal.aiSuggestion) {
      return;
    }

    setReviewChangeSummary(proposal.aiSuggestion.changeSummary);
    setReviewNotes(proposal.aiSuggestion.reviewNotes);
    setReviewNote(proposal.aiSuggestion.note ?? '');
    setReviewedChangeSet(
      coerceReviewedChangeSet(proposal.proposalType, proposal.aiSuggestion.reviewedChangeSet)
    );
  };

  const loadProposalDetail = useCallback(
    async (proposalId: string) => {
      if (!accessToken) {
        return;
      }

      setIsLoadingProposalDetail(true);
      setErrorMessage(null);

      try {
        const detail = await getCommunityReviewProposalDetail(accessToken, proposalId);
        setSelectedProposalId(proposalId);
        setSelectedProposalDetail(detail);
        setReviewChangeSummary(detail.aiSuggestion?.changeSummary ?? detail.summary ?? detail.title);
        setReviewNotes(detail.aiSuggestion?.reviewNotes ?? detail.reviewNotes ?? '');
        setReviewNote(detail.aiSuggestion?.note ?? detail.evidenceNote ?? detail.summary ?? '');
        setReviewedChangeSet(
          coerceReviewedChangeSet(
            detail.proposalType,
            detail.aiSuggestion?.reviewedChangeSet ?? detail.reviewedChangeSet
          )
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : 'Unable to load this proposal for review.'
        );
      } finally {
        setIsLoadingProposalDetail(false);
      }
    },
    [accessToken]
  );

  const handleSubmitQuestion = async () => {
    if (!accessToken) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await createCommunityQuestion(accessToken, {
        title: questionTitle.trim(),
        body: questionBody.trim(),
        originLabel: originLabel.trim(),
        destinationLabel: destinationLabel.trim(),
        originPlaceId: draft?.originPlaceId,
        destinationPlaceId: draft?.destinationPlaceId,
        routeQueryText: draft?.routeQueryText,
        preference: draft?.preference,
        passengerType: draft?.passengerType,
        sourceContext,
      });

      setQuestionTitle('');
      setQuestionBody('');
      setShowComposer(false);
      await loadCommunityData('background');
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to post your community question.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitContribution = async () => {
    if (!accessToken) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await createCommunitySubmission(accessToken, {
        submissionType,
        title: submissionTitle.trim(),
        payload: buildSubmissionPayload({
          submissionType,
          details: submissionDetails.trim(),
          originLabel: originLabel.trim(),
          destinationLabel: destinationLabel.trim(),
          routeId: draft?.routeId ?? '',
          affectedModeOrProduct: affectedModeOrProduct.trim(),
          proposedAmount: proposedAmount.trim(),
          passengerType: draft?.passengerType ?? 'regular',
        }),
        sourceContext,
        routeId: draft?.routeId,
      });

      setSubmissionDetails('');
      setAffectedModeOrProduct('');
      setProposedAmount('');
      setShowComposer(false);
      await loadCommunityData('background');
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to submit your community update.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveReviewItem = async () => {
    if (!accessToken || !selectedProposalDetail) {
      return;
    }

    setIsPublishingProposal(true);
    setErrorMessage(null);

    try {
      await approveCommunityProposal(accessToken, selectedProposalDetail.id, {
        changeSummary: reviewChangeSummary.trim(),
        reviewNotes: reviewNotes.trim() || undefined,
        note: reviewNote.trim() || undefined,
        reviewedChangeSet,
      });
      setSelectedProposalId(null);
      setSelectedProposalDetail(null);
      await loadCommunityData('background');
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to approve this community proposal.'
      );
    } finally {
      setIsPublishingProposal(false);
    }
  };

  const handleRejectReviewItem = async () => {
    if (!accessToken || !selectedProposalDetail) {
      return;
    }

    setIsPublishingProposal(true);
    setErrorMessage(null);

    try {
      await rejectCommunityProposal(accessToken, selectedProposalDetail.id, {
        reviewNotes: reviewNotes.trim() || 'Rejected after reviewer review.',
      });
      setSelectedProposalId(null);
      setSelectedProposalDetail(null);
      await loadCommunityData('background');
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to reject this community proposal.'
      );
    } finally {
      setIsPublishingProposal(false);
    }
  };

  const handleGenerateProposalAiDraft = async () => {
    if (!accessToken || !selectedProposalId) {
      return;
    }

    setIsGeneratingProposalAiDraft(true);
    setErrorMessage(null);

    try {
      await generateCommunityProposalAiDraft(accessToken, selectedProposalId);
      await loadProposalDetail(selectedProposalId);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to generate an AI review draft.'
      );
    } finally {
      setIsGeneratingProposalAiDraft(false);
    }
  };

  return (
    <SafeScreen backgroundColor={COLORS.surface} topInsetBackgroundColor={COLORS.surface}>
      {status !== 'authenticated' || !accessToken ? (
        <View style={styles.signedOutState}>
          <View style={styles.signedOutCard}>
            <Pressable
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} size={20} color={COLORS.midnight} />
            </Pressable>
            <Text style={styles.signedOutTitle}>Sign in to view community activity.</Text>
            <Text style={styles.signedOutSubtitle}>
              Ask riders, answer commute threads, and track the route or fare updates you shared.
            </Text>
            <Pressable
              style={styles.primaryButton}
              onPress={() =>
                navigation.navigate('Login', {
                  successMessage: 'Sign in to open Community.',
                })
              }
            >
              <Text style={styles.primaryButtonText}>Go to login</Text>
            </Pressable>
          </View>
        </View>
      ) : (
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => void loadCommunityData('refresh')} />
        }
      >
        <View style={styles.pageHeader}>
          <Pressable
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={20} color={COLORS.midnight} />
          </Pressable>
          <Text style={styles.pageTitle}>Community activity</Text>
          <Text style={styles.pageSubtitle}>
            Ask riders, answer commute threads, and share route fixes with less noise.
          </Text>
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Ask riders. Share route fixes.</Text>
          <Text style={styles.heroSubtitle}>
            Community answers add local context without changing trusted route data.
          </Text>

          <View style={styles.heroActions}>
            <Pressable
              style={styles.heroPrimaryAction}
              onPress={() => {
                setShowComposer(true);
                setComposerMode('question');
              }}
            >
              <Text style={styles.heroPrimaryActionText}>Ask the community</Text>
            </Pressable>
            <Pressable
              style={styles.heroSecondaryAction}
              onPress={() => {
                setShowComposer(true);
                setComposerMode('submission');
              }}
            >
              <Text style={styles.heroSecondaryActionText}>Submit an update</Text>
            </Pressable>
          </View>
        </View>

        {showComposer ? (
          <View style={styles.composerCard}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.composerTitle}>
                  {composerMode === 'question' ? 'Start a thread' : 'Send a route update'}
                </Text>
                <Text style={styles.composerSubtitle}>
                  {composerMode === 'question'
                    ? 'Post a commute question riders can answer.'
                    : 'Share route or fare corrections for review.'}
                </Text>
              </View>
              <Pressable style={styles.dismissButton} onPress={() => setShowComposer(false)}>
                <Text style={styles.dismissButtonText}>Close</Text>
              </Pressable>
            </View>

            <View style={styles.modeRow}>
              <Pressable
                style={[styles.modeChip, composerMode === 'question' && styles.modeChipActive]}
                onPress={() => setComposerMode('question')}
              >
                <Text
                  style={[
                    styles.modeChipText,
                    composerMode === 'question' && styles.modeChipTextActive,
                  ]}
                >
                  Ask the community
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modeChip, composerMode === 'submission' && styles.modeChipActive]}
                onPress={() => setComposerMode('submission')}
              >
                <Text
                  style={[
                    styles.modeChipText,
                    composerMode === 'submission' && styles.modeChipTextActive,
                  ]}
                >
                  Submit an update
                </Text>
              </Pressable>
            </View>

            <TextInput
              value={originLabel}
              onChangeText={setOriginLabel}
              placeholder="Origin"
              placeholderTextColor="#8191A0"
              style={styles.input}
            />
            <TextInput
              value={destinationLabel}
              onChangeText={setDestinationLabel}
              placeholder="Destination"
              placeholderTextColor="#8191A0"
              style={styles.input}
            />

            {composerMode === 'question' ? (
              <>
                <TextInput
                  value={questionTitle}
                  onChangeText={setQuestionTitle}
                  placeholder="Thread title"
                  placeholderTextColor="#8191A0"
                  style={styles.input}
                />
                <TextInput
                  value={questionBody}
                  onChangeText={setQuestionBody}
                  placeholder="How would you commute this trip?"
                  placeholderTextColor="#8191A0"
                  multiline
                  style={[styles.input, styles.textArea]}
                />
                <Pressable
                  style={[styles.primaryButton, isSubmitting && styles.primaryButtonDisabled]}
                  onPress={() => void handleSubmitQuestion()}
                  disabled={isSubmitting}
                >
                  <Text style={styles.primaryButtonText}>
                    {isSubmitting ? 'Posting...' : 'Post thread'}
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <TextInput
                  value={submissionTitle}
                  onChangeText={setSubmissionTitle}
                  placeholder="Submission title"
                  placeholderTextColor="#8191A0"
                  style={styles.input}
                />
                <View style={styles.chipList}>
                  {SUBMISSION_TYPES.map((item) => (
                    <Pressable
                      key={item.value}
                      style={[
                        styles.selectionChip,
                        submissionType === item.value && styles.selectionChipActive,
                      ]}
                      onPress={() => setSubmissionType(item.value)}
                    >
                      <Text
                        style={[
                          styles.selectionChipText,
                          submissionType === item.value && styles.selectionChipTextActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {submissionType === 'fare_update' ? (
                  <>
                    <TextInput
                      value={affectedModeOrProduct}
                      onChangeText={setAffectedModeOrProduct}
                      placeholder="Affected mode or fare product"
                      placeholderTextColor="#8191A0"
                      style={styles.input}
                    />
                    <TextInput
                      value={proposedAmount}
                      onChangeText={setProposedAmount}
                      placeholder="Proposed amount"
                      placeholderTextColor="#8191A0"
                      keyboardType="decimal-pad"
                      style={styles.input}
                    />
                  </>
                ) : null}
                <TextInput
                  value={submissionDetails}
                  onChangeText={setSubmissionDetails}
                  placeholder="Details"
                  placeholderTextColor="#8191A0"
                  multiline
                  style={[styles.input, styles.textArea]}
                />
                <Pressable
                  style={[styles.primaryButton, isSubmitting && styles.primaryButtonDisabled]}
                  onPress={() => void handleSubmitContribution()}
                  disabled={isSubmitting}
                >
                  <Text style={styles.primaryButtonText}>
                    {isSubmitting ? 'Submitting...' : 'Submit update'}
                  </Text>
                </Pressable>
              </>
            )}

            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent rider threads</Text>
            <Text style={styles.sectionSubtitle}>Answer live commute questions from the community.</Text>
          </View>
          <View style={styles.feedSection}>
            {isLoading ? <ActivityIndicator color={COLORS.primary} /> : null}
            {!isLoading && recentQuestions.length === 0 ? (
              <Text style={styles.emptyText}>No rider threads yet.</Text>
            ) : null}
            {recentQuestions.map((question) => (
              <ThreadCard
                key={question.id}
                question={question}
                currentUserId={user?.id}
                onOpen={() =>
                  navigation.navigate('CommunityQuestionDetail', {
                    questionId: question.id,
                  })
                }
              />
            ))}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My questions</Text>
            <Text style={styles.sectionSubtitle}>Threads you started and can revisit.</Text>
          </View>
          <View style={styles.feedSection}>
            {!isLoading && myQuestions.length === 0 ? (
              <Text style={styles.emptyText}>No community questions yet.</Text>
            ) : null}
            {myQuestions.map((question) => (
              <ThreadCard
                key={question.id}
                question={question}
                currentUserId={user?.id}
                onOpen={() =>
                  navigation.navigate('CommunityQuestionDetail', {
                    questionId: question.id,
                  })
                }
              />
            ))}
          </View>
        </View>

        {isReviewer ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Reviewer queue</Text>
              <Text style={styles.sectionSubtitle}>
                Promote answers and publish route learning back into Sakai.
              </Text>
            </View>
            <View style={styles.submissionSection}>
              {reviewQueue.map((proposal) => (
                <View key={proposal.id} style={styles.submissionCard}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.submissionTitle}>{proposal.title}</Text>
                    <View style={[styles.badge, submissionBadgeStyle(proposal.reviewStatus)]}>
                      <Text style={styles.badgeText}>{proposal.reviewStatus.replace(/_/g, ' ')}</Text>
                    </View>
                  </View>
                  <Text style={styles.submissionMeta}>
                    {proposal.proposalType.replace(/_/g, ' ')}
                    {proposal.routeLabel ? ` • ${proposal.routeLabel}` : ''}
                  </Text>
                  {proposal.sourceQuestionTitle ? (
                    <Text style={styles.submissionMeta}>Thread: {proposal.sourceQuestionTitle}</Text>
                  ) : null}
                  {proposal.sourceAnswerPreview ? (
                    <Text style={styles.submissionMeta}>{proposal.sourceAnswerPreview}</Text>
                  ) : null}
                  {proposal.aiConfidence ? (
                    <Text style={styles.submissionMeta}>
                      AI confidence: {proposal.aiConfidence}
                      {proposal.relatedProposalCount > 1
                        ? ` • ${proposal.relatedProposalCount} related proposals`
                        : ''}
                    </Text>
                  ) : null}
                  <View style={styles.reviewActionRow}>
                    <Pressable
                      style={styles.inlineApproveButton}
                      onPress={() => void loadProposalDetail(proposal.id)}
                    >
                      <Text style={styles.inlineApproveButtonText}>
                        {selectedProposalId === proposal.id ? 'Reviewing' : 'Review'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ))}
              {!isLoading && reviewQueue.length === 0 ? (
                <Text style={styles.emptyText}>No proposals waiting for review.</Text>
              ) : null}
            </View>
            {selectedProposalDetail ? (
              <View style={styles.reviewDetailCard}>
                <View style={styles.sectionHeader}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.sectionTitle}>Review detail</Text>
                    <Pressable
                      style={styles.dismissButton}
                      onPress={() => {
                        setSelectedProposalId(null);
                        setSelectedProposalDetail(null);
                      }}
                    >
                      <Text style={styles.dismissButtonText}>Close</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.sectionSubtitle}>{selectedProposalDetail.title}</Text>
                </View>
                {isLoadingProposalDetail ? <ActivityIndicator color={COLORS.primary} /> : null}
                {!isLoadingProposalDetail ? (
                  <>
                    <Text style={styles.submissionMeta}>
                      {selectedProposalDetail.proposalType.replace(/_/g, ' ')}
                      {selectedProposalDetail.routeLabel ? ` • ${selectedProposalDetail.routeLabel}` : ''}
                    </Text>
                    {selectedProposalDetail.sourceQuestion ? (
                      <Text style={styles.submissionMeta}>
                        Thread: {selectedProposalDetail.sourceQuestion.title}
                      </Text>
                    ) : null}
                    {selectedProposalDetail.sourceAnswer ? (
                      <Text style={styles.submissionMeta}>
                        Answer: {selectedProposalDetail.sourceAnswer.body}
                      </Text>
                    ) : null}
                    {selectedProposalDetail.sourceSubmission ? (
                      <Text style={styles.submissionMeta}>
                        Submission: {selectedProposalDetail.sourceSubmission.title}
                      </Text>
                    ) : null}
                    {selectedProposalDetail.aiSuggestion ? (
                      <View style={styles.aiDraftCard}>
                        <Text style={styles.aiDraftTitle}>
                          AI draft {selectedProposalDetail.aiSuggestion.confidence}
                        </Text>
                        <Text style={styles.aiDraftText}>
                          {selectedProposalDetail.aiSuggestion.reason}
                        </Text>
                        <Pressable
                          style={styles.secondaryActionButton}
                          onPress={() => applyProposalAiDraft(selectedProposalDetail)}
                        >
                          <Text style={styles.secondaryActionButtonText}>Apply AI draft</Text>
                        </Pressable>
                      </View>
                    ) : null}
                    <TextInput
                      value={reviewChangeSummary}
                      onChangeText={setReviewChangeSummary}
                      placeholder="Change summary"
                      placeholderTextColor="#8191A0"
                      style={styles.input}
                    />
                    <TextInput
                      value={reviewNotes}
                      onChangeText={setReviewNotes}
                      placeholder="Reviewer notes"
                      placeholderTextColor="#8191A0"
                      multiline
                      style={[styles.input, styles.textArea]}
                    />
                    <TextInput
                      value={reviewNote}
                      onChangeText={setReviewNote}
                      placeholder="Rider-facing route note"
                      placeholderTextColor="#8191A0"
                      multiline
                      style={[styles.input, styles.textArea]}
                    />
                    <CommunityProposalChangeSetEditor
                      proposalType={selectedProposalDetail.proposalType}
                      value={reviewedChangeSet}
                      onChange={setReviewedChangeSet}
                    />
                    <View style={styles.reviewActionRow}>
                      <Pressable
                        style={styles.secondaryActionButton}
                        onPress={() => void handleGenerateProposalAiDraft()}
                        disabled={isGeneratingProposalAiDraft}
                      >
                        <Text style={styles.secondaryActionButtonText}>
                          {isGeneratingProposalAiDraft ? 'Generating...' : 'Refresh AI draft'}
                        </Text>
                      </Pressable>
                      <Pressable
                        style={styles.inlineApproveButton}
                        onPress={() => void handleApproveReviewItem()}
                        disabled={isPublishingProposal}
                      >
                        <Text style={styles.inlineApproveButtonText}>
                          {isPublishingProposal ? 'Publishing...' : 'Approve and publish'}
                        </Text>
                      </Pressable>
                      <Pressable
                        style={styles.inlineRejectButton}
                        onPress={() => void handleRejectReviewItem()}
                        disabled={isPublishingProposal}
                      >
                        <Text style={styles.inlineRejectButtonText}>Reject</Text>
                      </Pressable>
                    </View>
                  </>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My submissions</Text>
            <Text style={styles.sectionSubtitle}>Structured route and fare updates under review.</Text>
          </View>
          <View style={styles.submissionSection}>
            {mySubmissions.map((submission) => (
              <View key={submission.id} style={styles.submissionCard}>
                <View style={styles.rowBetween}>
                  <Text style={styles.submissionTitle}>{submission.title}</Text>
                  <View style={[styles.badge, submissionBadgeStyle(submission.status)]}>
                    <Text style={styles.badgeText}>{submission.status}</Text>
                  </View>
                </View>
                <Text style={styles.submissionMeta}>
                  {submission.submissionType.replace(/_/g, ' ')}
                </Text>
                <Text style={styles.submissionMeta}>{formatDate(submission.createdAt)}</Text>
              </View>
            ))}
            {!isLoading && mySubmissions.length === 0 ? (
              <Text style={styles.emptyText}>No submissions yet.</Text>
            ) : null}
          </View>
        </View>
      </ScrollView>
      )}
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  signedOutState: {
    flex: 1,
    padding: SPACING.lg,
    justifyContent: 'center',
  },
  signedOutCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E4EBF2',
  },
  backButton: {
    alignSelf: 'flex-start',
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#E3EBF2',
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signedOutTitle: {
    color: COLORS.midnight,
    fontFamily: FONTS.bold,
    fontSize: TYPOGRAPHY.fontSizes.large,
    lineHeight: 28,
  },
  signedOutSubtitle: {
    color: '#5A6B79',
    fontFamily: FONTS.regular,
    fontSize: TYPOGRAPHY.fontSizes.small,
    lineHeight: 20,
  },
  content: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    gap: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  pageHeader: {
    gap: SPACING.xs,
    paddingHorizontal: SPACING.xs,
  },
  pageTitle: {
    color: COLORS.midnight,
    fontFamily: FONTS.bold,
    fontSize: TYPOGRAPHY.fontSizes.xlarge,
    lineHeight: 32,
  },
  pageSubtitle: {
    color: '#6D7F90',
    fontFamily: FONTS.regular,
    fontSize: TYPOGRAPHY.fontSizes.small,
    lineHeight: 20,
  },
  heroCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E4EBF2',
  },
  heroTitle: {
    color: COLORS.midnight,
    fontFamily: FONTS.bold,
    fontSize: TYPOGRAPHY.fontSizes.xlarge,
    lineHeight: 30,
  },
  heroSubtitle: {
    color: '#6D7F90',
    fontFamily: FONTS.regular,
    fontSize: TYPOGRAPHY.fontSizes.small,
    lineHeight: 20,
  },
  heroActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  heroPrimaryAction: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: COLORS.black,
    paddingVertical: SPACING.sm + 4,
    alignItems: 'center',
  },
  heroPrimaryActionText: {
    color: COLORS.white,
    fontFamily: FONTS.semibold,
    fontSize: TYPOGRAPHY.fontSizes.small,
  },
  heroSecondaryAction: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D8E4EC',
    backgroundColor: '#F8FBFD',
    paddingVertical: SPACING.sm + 4,
    alignItems: 'center',
  },
  heroSecondaryActionText: {
    color: COLORS.midnight,
    fontFamily: FONTS.semibold,
    fontSize: TYPOGRAPHY.fontSizes.small,
  },
  composerCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E4EBF2',
  },
  composerTitle: {
    color: COLORS.midnight,
    fontFamily: FONTS.bold,
    fontSize: TYPOGRAPHY.fontSizes.medium,
  },
  composerSubtitle: {
    color: '#5A6B79',
    fontFamily: FONTS.regular,
    fontSize: 11,
  },
  dismissButton: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  dismissButtonText: {
    color: COLORS.primary,
    fontFamily: FONTS.bold,
    fontSize: TYPOGRAPHY.fontSizes.small,
  },
  modeRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  modeChip: {
    flex: 1,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#D8E4EC',
    backgroundColor: '#F7FBFE',
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  modeChipActive: {
    backgroundColor: COLORS.midnight,
    borderColor: COLORS.midnight,
  },
  modeChipText: {
    color: '#5A6B79',
    fontFamily: FONTS.medium,
  },
  modeChipTextActive: {
    color: COLORS.white,
  },
  input: {
    borderRadius: 12,
    backgroundColor: '#F8FBFD',
    borderWidth: 1,
    borderColor: '#E6EDF3',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    color: '#102033',
    fontFamily: FONTS.regular,
    fontSize: TYPOGRAPHY.fontSizes.small,
  },
  textArea: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
  chipList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  selectionChip: {
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#D8E4EC',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  selectionChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#E7F1FF',
  },
  selectionChipText: {
    color: '#5A6B79',
    fontFamily: FONTS.medium,
    fontSize: TYPOGRAPHY.fontSizes.small,
  },
  selectionChipTextActive: {
    color: COLORS.primary,
  },
  primaryButton: {
    borderRadius: 14,
    backgroundColor: COLORS.black,
    paddingVertical: SPACING.sm + 4,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontFamily: FONTS.semibold,
    fontSize: TYPOGRAPHY.fontSizes.small,
  },
  sectionCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#E4EBF2',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  sectionHeader: {
    gap: SPACING.xs,
  },
  sectionTitle: {
    color: COLORS.midnight,
    fontFamily: FONTS.bold,
    fontSize: TYPOGRAPHY.fontSizes.medium,
  },
  sectionSubtitle: {
    color: '#5A6B79',
    fontFamily: FONTS.regular,
    fontSize: 11,
  },
  feedSection: {
    gap: SPACING.sm,
  },
  submissionSection: {
    gap: SPACING.sm,
  },
  threadCard: {
    backgroundColor: '#FBFCFD',
    borderRadius: 14,
    padding: SPACING.md,
    gap: SPACING.xs + 6,
    borderWidth: 1,
    borderColor: '#E8EEF3',
  },
  threadHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  threadAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E8EFF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  threadAvatarText: {
    color: COLORS.midnight,
    fontFamily: FONTS.bold,
    fontSize: TYPOGRAPHY.fontSizes.small,
  },
  threadHeaderContent: {
    flex: 1,
    gap: 2,
  },
  threadAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  threadAuthor: {
    color: COLORS.midnight,
    fontFamily: FONTS.semibold,
    fontSize: TYPOGRAPHY.fontSizes.small,
  },
  threadDot: {
    color: '#8191A0',
    fontFamily: FONTS.medium,
    fontSize: TYPOGRAPHY.fontSizes.small,
  },
  threadMeta: {
    color: '#8191A0',
    fontFamily: FONTS.regular,
    fontSize: TYPOGRAPHY.fontSizes.small,
  },
  threadRouteMeta: {
    color: '#5A6B79',
    fontFamily: FONTS.medium,
    fontSize: 11,
  },
  threadTitle: {
    color: COLORS.midnight,
    fontFamily: FONTS.bold,
    fontSize: TYPOGRAPHY.fontSizes.medium,
    lineHeight: 22,
  },
  threadPreview: {
    color: '#213547',
    fontFamily: FONTS.regular,
    fontSize: TYPOGRAPHY.fontSizes.small,
    lineHeight: 20,
  },
  threadFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: '#EDF2F6',
  },
  threadReplyMeta: {
    color: '#5A6B79',
    fontFamily: FONTS.medium,
    fontSize: TYPOGRAPHY.fontSizes.small,
  },
  inlineActionButton: {
    borderRadius: 999,
    backgroundColor: '#EEF4F8',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  inlineActionText: {
    color: '#304A63',
    fontFamily: FONTS.semibold,
    fontSize: 11,
  },
  submissionCard: {
    borderRadius: 14,
    backgroundColor: '#FBFCFD',
    padding: SPACING.md,
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: '#E8EEF3',
  },
  submissionTitle: {
    flex: 1,
    marginRight: SPACING.sm,
    color: COLORS.midnight,
    fontFamily: FONTS.bold,
    fontSize: TYPOGRAPHY.fontSizes.small,
  },
  submissionMeta: {
    color: '#5A6B79',
    fontFamily: FONTS.regular,
    fontSize: 11,
  },
  reviewActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  inlineApproveButton: {
    borderRadius: RADIUS.full,
    backgroundColor: '#0C7A43',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  inlineApproveButtonText: {
    color: COLORS.white,
    fontFamily: FONTS.semibold,
    fontSize: 11,
  },
  inlineRejectButton: {
    borderRadius: RADIUS.full,
    backgroundColor: '#FCEAEA',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderWidth: 1,
    borderColor: '#F3C7C7',
  },
  inlineRejectButtonText: {
    color: COLORS.danger,
    fontFamily: FONTS.semibold,
    fontSize: 11,
  },
  reviewDetailCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D8E4EC',
    backgroundColor: '#F7FBFE',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  aiDraftCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D8E4EC',
    backgroundColor: COLORS.white,
    padding: SPACING.sm,
    gap: SPACING.xs,
  },
  aiDraftTitle: {
    color: COLORS.midnight,
    fontFamily: FONTS.bold,
    fontSize: TYPOGRAPHY.fontSizes.small,
  },
  aiDraftText: {
    color: '#5A6B79',
    fontFamily: FONTS.regular,
    fontSize: TYPOGRAPHY.fontSizes.small,
    lineHeight: 18,
  },
  secondaryActionButton: {
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#D8E4EC',
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionButtonText: {
    color: COLORS.midnight,
    fontFamily: FONTS.semibold,
    fontSize: 11,
  },
  reviewJsonTextArea: {
    minHeight: 144,
    textAlignVertical: 'top',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  badgeText: {
    color: COLORS.white,
    fontFamily: FONTS.semibold,
    fontSize: 10,
    textTransform: 'capitalize',
  },
  badgeNeutral: {
    backgroundColor: '#5D7286',
  },
  badgeWarning: {
    backgroundColor: COLORS.warning,
  },
  badgeSuccess: {
    backgroundColor: COLORS.success,
  },
  badgeDanger: {
    backgroundColor: COLORS.danger,
  },
  emptyText: {
    color: '#5A6B79',
    fontFamily: FONTS.regular,
    fontSize: TYPOGRAPHY.fontSizes.small,
  },
  errorText: {
    color: COLORS.danger,
    fontFamily: FONTS.medium,
  },
});
