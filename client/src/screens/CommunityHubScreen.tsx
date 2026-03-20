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

import { useAuth } from '../auth/AuthContext';
import {
  createCommunityQuestion,
  createCommunitySubmission,
  getMyCommunityQuestions,
  getMyCommunitySubmissions,
  getRecentCommunityQuestions,
} from '../community/api';
import type {
  CommunityQuestion,
  CommunitySubmission,
  CommunitySubmissionType,
} from '../community/types';
import SafeScreen from '../components/SafeScreen';
import { COLORS, FONTS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import type { RootStackParamList } from '../navigation/AppNavigator';

type CommunityHubScreenProps = NativeStackScreenProps<RootStackParamList, 'CommunityHub'>;
type ComposerMode = 'question' | 'submission';
type CommunityLoadMode = 'initial' | 'refresh' | 'background';

const SUBMISSION_TYPES: Array<{ value: CommunitySubmissionType; label: string }> = [
  { value: 'missing_route', label: 'Missing route' },
  { value: 'route_correction', label: 'Correction' },
  { value: 'fare_update', label: 'Fare update' },
  { value: 'route_note', label: 'Route note' },
];

const formatDate = (value: string): string =>
  new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

const submissionBadgeStyle = (status: CommunitySubmission['status']) =>
  status === 'approved'
    ? styles.badgeSuccess
    : status === 'rejected'
      ? styles.badgeDanger
      : status === 'reviewed'
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

  if (input.submissionType === 'route_correction') {
    return {
      targetRouteOrPlaceId: input.routeId || 'community-route-correction',
      incorrectDetail: input.details,
      proposedCorrection: input.details,
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

  const [originLabel, setOriginLabel] = useState(draft?.originLabel ?? '');
  const [destinationLabel, setDestinationLabel] = useState(draft?.destinationLabel ?? '');
  const [questionTitle, setQuestionTitle] = useState(draft?.title ?? '');
  const [questionBody, setQuestionBody] = useState(draft?.body ?? '');
  const [submissionTitle, setSubmissionTitle] = useState(
    draft?.title ?? 'Share a route or fare update'
  );
  const [submissionType, setSubmissionType] = useState<CommunitySubmissionType>('missing_route');
  const [submissionDetails, setSubmissionDetails] = useState(draft?.body ?? '');
  const [affectedModeOrProduct, setAffectedModeOrProduct] = useState('');
  const [proposedAmount, setProposedAmount] = useState('');

  const sourceContext = useMemo<Record<string, unknown> | undefined>(
    () => draft?.sourceContext,
    [draft]
  );

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
        const [submissions, questions, recent] = await Promise.all([
          getMyCommunitySubmissions(accessToken),
          getMyCommunityQuestions(accessToken),
          getRecentCommunityQuestions(accessToken),
        ]);

        setMySubmissions(submissions);
        setMyQuestions(questions);
        setRecentQuestions(recent);
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
    [accessToken]
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

  return (
    <SafeScreen backgroundColor={COLORS.surface} topInsetBackgroundColor={COLORS.surface}>
      {status !== 'authenticated' || !accessToken ? (
        <View style={styles.signedOutState}>
          <View style={styles.signedOutCard}>
            <Text style={styles.eyebrow}>Community</Text>
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
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>Community</Text>
          <Text style={styles.heroTitle}>Ask riders. Answer threads. Share route fixes.</Text>
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
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: '#D8E4EC',
  },
  signedOutTitle: {
    color: COLORS.midnight,
    fontFamily: FONTS.bold,
    fontSize: TYPOGRAPHY.fontSizes.xlarge,
    lineHeight: 30,
  },
  signedOutSubtitle: {
    color: '#5A6B79',
    fontFamily: FONTS.regular,
    fontSize: TYPOGRAPHY.fontSizes.body,
    lineHeight: 22,
  },
  content: {
    padding: SPACING.lg,
    gap: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  heroCard: {
    backgroundColor: COLORS.midnight,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  eyebrow: {
    color: '#9CC6E3',
    fontFamily: FONTS.medium,
    fontSize: TYPOGRAPHY.fontSizes.small,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroTitle: {
    color: COLORS.white,
    fontFamily: FONTS.bold,
    fontSize: TYPOGRAPHY.fontSizes.hero,
    lineHeight: 38,
  },
  heroSubtitle: {
    color: '#CAD8E4',
    fontFamily: FONTS.regular,
    fontSize: TYPOGRAPHY.fontSizes.body,
    lineHeight: 22,
  },
  heroActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  heroPrimaryAction: {
    flex: 1,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.white,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  heroPrimaryActionText: {
    color: COLORS.midnight,
    fontFamily: FONTS.bold,
    fontSize: TYPOGRAPHY.fontSizes.body,
  },
  heroSecondaryAction: {
    flex: 1,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#35516B',
    backgroundColor: '#183049',
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  heroSecondaryActionText: {
    color: COLORS.white,
    fontFamily: FONTS.bold,
    fontSize: TYPOGRAPHY.fontSizes.body,
  },
  composerCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: '#D8E4EC',
  },
  composerTitle: {
    color: COLORS.midnight,
    fontFamily: FONTS.bold,
    fontSize: TYPOGRAPHY.fontSizes.large,
  },
  composerSubtitle: {
    color: '#5A6B79',
    fontFamily: FONTS.regular,
    fontSize: TYPOGRAPHY.fontSizes.small,
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
    borderRadius: RADIUS.md,
    backgroundColor: '#F7FBFE',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    color: '#102033',
    fontFamily: FONTS.regular,
    fontSize: TYPOGRAPHY.fontSizes.body,
  },
  textArea: {
    minHeight: 104,
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
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.black,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontFamily: FONTS.bold,
    fontSize: TYPOGRAPHY.fontSizes.body,
  },
  sectionHeader: {
    gap: SPACING.xs,
    paddingHorizontal: SPACING.xs,
  },
  sectionTitle: {
    color: COLORS.midnight,
    fontFamily: FONTS.bold,
    fontSize: TYPOGRAPHY.fontSizes.large,
  },
  sectionSubtitle: {
    color: '#5A6B79',
    fontFamily: FONTS.regular,
    fontSize: TYPOGRAPHY.fontSizes.small,
  },
  feedSection: {
    gap: SPACING.md,
  },
  submissionSection: {
    gap: SPACING.sm,
  },
  threadCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E2EBF2',
  },
  threadHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  threadAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#D8E8F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  threadAvatarText: {
    color: COLORS.midnight,
    fontFamily: FONTS.bold,
    fontSize: TYPOGRAPHY.fontSizes.body,
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
    fontFamily: FONTS.bold,
    fontSize: TYPOGRAPHY.fontSizes.body,
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
    fontSize: TYPOGRAPHY.fontSizes.small,
  },
  threadTitle: {
    color: COLORS.midnight,
    fontFamily: FONTS.bold,
    fontSize: TYPOGRAPHY.fontSizes.large,
    lineHeight: 25,
  },
  threadPreview: {
    color: '#213547',
    fontFamily: FONTS.regular,
    fontSize: TYPOGRAPHY.fontSizes.body,
    lineHeight: 22,
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
    borderRadius: RADIUS.full,
    backgroundColor: '#E7F1FF',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  inlineActionText: {
    color: COLORS.primary,
    fontFamily: FONTS.bold,
    fontSize: TYPOGRAPHY.fontSizes.small,
  },
  submissionCard: {
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: '#E2EBF2',
  },
  submissionTitle: {
    flex: 1,
    marginRight: SPACING.sm,
    color: COLORS.midnight,
    fontFamily: FONTS.bold,
    fontSize: TYPOGRAPHY.fontSizes.body,
  },
  submissionMeta: {
    color: '#5A6B79',
    fontFamily: FONTS.regular,
    fontSize: TYPOGRAPHY.fontSizes.small,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  badgeText: {
    color: COLORS.white,
    fontFamily: FONTS.bold,
    fontSize: TYPOGRAPHY.fontSizes.small,
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
