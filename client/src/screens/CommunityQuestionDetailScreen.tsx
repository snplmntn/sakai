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
  createCommunityAnswer,
  generateCommunityAnswerAiDraft,
  getCommunityQuestionDetail,
  promoteCommunityAnswer,
} from '../community/api';
import CommunityProposalChangeSetEditor from '../community/CommunityProposalChangeSetEditor';
import type {
  CommunityProposalType,
  CommunityQuestionAnswer,
  CommunityQuestionDetail,
  CommunityReviewedChangeSet,
  CommunityReviewAiSuggestion,
} from '../community/types';
import { coerceReviewedChangeSet, createEmptyReviewedChangeSet } from '../community/review-change-set-types';
import SafeScreen from '../components/SafeScreen';
import { COLORS, FONTS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import type { RootStackParamList } from '../navigation/AppNavigator';

type CommunityQuestionDetailScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'CommunityQuestionDetail'
>;
type DetailLoadMode = 'initial' | 'refresh' | 'background';

interface PromotionDraftState {
  answerId: string;
  proposalType: CommunityProposalType;
  title: string;
  summary: string;
  routeId: string;
  routeVariantId: string;
  routeCode: string;
  routeVariantCode: string;
  evidenceNote: string;
  reviewedChangeSet: CommunityReviewedChangeSet;
  aiDraft: CommunityReviewAiSuggestion | null;
  isGeneratingAiDraft: boolean;
  isSubmitting: boolean;
}

const PROMOTION_TYPES: Array<{ value: CommunityProposalType; label: string }> = [
  { value: 'route_note', label: 'Route note' },
  { value: 'route_deprecate', label: 'Deprecate route' },
  { value: 'route_reactivate', label: 'Reactivate route' },
  { value: 'route_update', label: 'Route update' },
  { value: 'route_create', label: 'New route' },
  { value: 'stop_correction', label: 'Stop correction' },
  { value: 'transfer_correction', label: 'Transfer fix' },
  { value: 'fare_update', label: 'Fare update' },
];

const formatDate = (value: string): string =>
  new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

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

const buildPromotionDraft = (input: {
  question: CommunityQuestionDetail['question'];
  answer: CommunityQuestionAnswer;
}): PromotionDraftState => {
  const sourceContext = input.question.sourceContext;
  const routeId = typeof sourceContext?.routeId === 'string' ? sourceContext.routeId : '';
  const routeVariantId =
    typeof sourceContext?.routeVariantId === 'string' ? sourceContext.routeVariantId : '';

  return {
    answerId: input.answer.id,
    proposalType: 'route_note',
    title: `Thread route note: ${input.question.title}`,
    summary: input.question.body,
    routeId,
    routeVariantId,
    routeCode: '',
    routeVariantCode: '',
    evidenceNote: input.answer.body,
    reviewedChangeSet: createEmptyReviewedChangeSet('route_note'),
    aiDraft: null,
    isGeneratingAiDraft: false,
    isSubmitting: false,
  };
};

export default function CommunityQuestionDetailScreen({
  route,
}: CommunityQuestionDetailScreenProps) {
  const { session, user } = useAuth();
  const accessToken = session?.accessToken;
  const isReviewer = hasReviewerRole(user?.appMetadata);
  const [detail, setDetail] = useState<CommunityQuestionDetail | null>(null);
  const [answerBody, setAnswerBody] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [promotionDraft, setPromotionDraft] = useState<PromotionDraftState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadDetail = useCallback(
    async (mode: DetailLoadMode) => {
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
        const nextDetail = await getCommunityQuestionDetail(accessToken, route.params.questionId);
        setDetail(nextDetail);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : 'Unable to load this community thread.'
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
    [accessToken, route.params.questionId]
  );

  useEffect(() => {
    void loadDetail('initial');
  }, [loadDetail]);

  const contextChips = useMemo(() => {
    if (!detail) {
      return [];
    }

    const chips = [`${detail.question.originLabel} to ${detail.question.destinationLabel}`];

    if (detail.question.preference) {
      chips.push(detail.question.preference);
    }

    if (detail.question.passengerType) {
      chips.push(detail.question.passengerType);
    }

    return chips;
  }, [detail]);

  const handleSubmitAnswer = async () => {
    if (!accessToken) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await createCommunityAnswer(accessToken, route.params.questionId, {
        body: answerBody.trim(),
      });
      setAnswerBody('');
      await loadDetail('background');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to post your answer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const applyAiDraft = (draft: CommunityReviewAiSuggestion) => {
    setPromotionDraft((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        proposalType: draft.suggestedProposalType,
        title: draft.title,
        summary: draft.summary ?? current.summary,
        routeCode: draft.routeCode ?? current.routeCode,
        routeVariantCode: draft.routeVariantCode ?? current.routeVariantCode,
        evidenceNote: draft.note ?? current.evidenceNote,
        reviewedChangeSet: coerceReviewedChangeSet(
          draft.suggestedProposalType,
          draft.reviewedChangeSet
        ),
        aiDraft: draft,
        isGeneratingAiDraft: false,
      };
    });
  };

  const handleOpenPromotion = (answer: CommunityQuestionAnswer) => {
    if (!detail) {
      return;
    }

    setPromotionDraft(buildPromotionDraft({ question: detail.question, answer }));
    setErrorMessage(null);
  };

  const handleGenerateAiDraft = async () => {
    if (!accessToken || !promotionDraft) {
      return;
    }

    setPromotionDraft((current) =>
      current ? { ...current, isGeneratingAiDraft: true } : current
    );
    setErrorMessage(null);

    try {
      const draft = await generateCommunityAnswerAiDraft(
        accessToken,
        route.params.questionId,
        promotionDraft.answerId,
        {
          proposalTypeHint: promotionDraft.proposalType,
          title: promotionDraft.title,
          summary: promotionDraft.summary,
        }
      );
      applyAiDraft(draft);
    } catch (error) {
      setPromotionDraft((current) =>
        current ? { ...current, isGeneratingAiDraft: false } : current
      );
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to generate an AI promotion draft.'
      );
    }
  };

  const handlePromoteAnswer = async () => {
    if (!accessToken || !promotionDraft) {
      return;
    }

    setPromotionDraft((current) =>
      current ? { ...current, isSubmitting: true } : current
    );
    setErrorMessage(null);

    try {
      await promoteCommunityAnswer(accessToken, route.params.questionId, promotionDraft.answerId, {
        proposalType: promotionDraft.proposalType,
        title: promotionDraft.title.trim(),
        summary: promotionDraft.summary.trim() || undefined,
        routeId: promotionDraft.routeId.trim() || undefined,
        routeVariantId: promotionDraft.routeVariantId.trim() || undefined,
        routeCode: promotionDraft.routeCode.trim() || undefined,
        routeVariantCode: promotionDraft.routeVariantCode.trim() || undefined,
        evidenceNote: promotionDraft.evidenceNote.trim() || undefined,
        reviewedChangeSet: promotionDraft.reviewedChangeSet,
      });
      setPromotionDraft(null);
      await loadDetail('background');
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to promote this answer into route learning.'
      );
    } finally {
      setPromotionDraft((current) =>
        current ? { ...current, isSubmitting: false } : current
      );
    }
  };

  return (
    <SafeScreen backgroundColor={COLORS.surface} topInsetBackgroundColor={COLORS.surface}>
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={() => void loadDetail('refresh')} />
          }
        >
          {isLoading ? <ActivityIndicator color={COLORS.primary} /> : null}
          {detail ? (
            <>
              <View style={styles.threadStarterCard}>
                <View style={styles.authorRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {detail.question.userId === user?.id ? 'Y' : 'R'}
                    </Text>
                  </View>
                  <View style={styles.authorMeta}>
                    <Text style={styles.authorName}>
                      {detail.question.userId === user?.id ? 'You' : 'Community rider'}
                    </Text>
                    <Text style={styles.authorTimestamp}>{formatDate(detail.question.createdAt)}</Text>
                  </View>
                </View>

                <Text style={styles.title}>{detail.question.title}</Text>

                <View style={styles.chipRow}>
                  {contextChips.map((chip) => (
                    <View key={chip} style={styles.contextChip}>
                      <Text style={styles.contextChipText}>{chip}</Text>
                    </View>
                  ))}
                </View>

                <Text style={styles.body}>{detail.question.body}</Text>

                <View style={styles.threadStatsRow}>
                  <Text style={styles.threadStatsText}>
                    {detail.answers.length} {detail.answers.length === 1 ? 'reply' : 'replies'}
                  </Text>
                  <Text style={styles.threadStatsText}>
                    {detail.answers.length > 0 ? 'Active thread' : 'Waiting for first answer'}
                  </Text>
                </View>
              </View>

              <View style={styles.repliesSection}>
                <Text style={styles.sectionTitle}>Thread replies</Text>
                {detail.answers.length === 0 ? (
                  <View style={styles.emptyReplyCard}>
                    <Text style={styles.emptyReplyTitle}>No answers yet</Text>
                    <Text style={styles.emptyReplyText}>
                      Be the first rider to share a route, transfer tip, or fare context.
                    </Text>
                  </View>
                ) : null}

                {detail.answers.map((answer, index) => (
                  <View key={answer.id} style={styles.replyRow}>
                    <View style={styles.replyRailColumn}>
                      <View style={styles.replyAvatar}>
                        <Text style={styles.replyAvatarText}>
                          {answer.userId === user?.id ? 'Y' : 'R'}
                        </Text>
                      </View>
                      {index < detail.answers.length - 1 ? <View style={styles.replyRail} /> : null}
                    </View>

                    <View style={styles.replyCard}>
                      <View style={styles.replyHeader}>
                        <Text style={styles.replyAuthor}>
                          {answer.userId === user?.id ? 'You' : 'Community rider'}
                        </Text>
                        <Text style={styles.replyTimestamp}>{formatDate(answer.createdAt)}</Text>
                      </View>
                      <Text style={styles.replyBody}>{answer.body}</Text>
                      <View style={styles.replyMetaRow}>
                        <Text style={styles.replyMetaText}>
                          {answer.promotionStatus === 'published'
                            ? 'Published into route learning'
                            : answer.promotionStatus === 'promoted'
                              ? 'Queued for review'
                              : 'Not yet promoted'}
                        </Text>
                        {isReviewer && answer.promotionStatus !== 'published' ? (
                          <Pressable
                            style={styles.promoteButton}
                            onPress={() => handleOpenPromotion(answer)}
                          >
                            <Text style={styles.promoteButtonText}>
                              {promotionDraft?.answerId === answer.id ? 'Editing promotion' : 'Promote to learning'}
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                      {promotionDraft?.answerId === answer.id ? (
                        <View style={styles.promotionCard}>
                          <View style={styles.replyMetaRow}>
                            <Text style={styles.promotionTitle}>Reviewer promotion</Text>
                            <Pressable onPress={() => setPromotionDraft(null)}>
                              <Text style={styles.dismissPromotionText}>Close</Text>
                            </Pressable>
                          </View>
                          <View style={styles.selectionRow}>
                            {PROMOTION_TYPES.map((item) => (
                              <Pressable
                                key={item.value}
                                style={[
                                  styles.selectionChip,
                                  promotionDraft.proposalType === item.value && styles.selectionChipActive,
                                ]}
                                onPress={() =>
                                  setPromotionDraft((current) =>
                                    current
                                      ? {
                                          ...current,
                                          proposalType: item.value,
                                          reviewedChangeSet: createEmptyReviewedChangeSet(item.value),
                                        }
                                      : current
                                  )
                                }
                              >
                                <Text
                                  style={[
                                    styles.selectionChipText,
                                    promotionDraft.proposalType === item.value &&
                                      styles.selectionChipTextActive,
                                  ]}
                                >
                                  {item.label}
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                          <TextInput
                            value={promotionDraft.title}
                            onChangeText={(value) =>
                              setPromotionDraft((current) =>
                                current ? { ...current, title: value } : current
                              )
                            }
                            placeholder="Proposal title"
                            placeholderTextColor="#8191A0"
                            style={styles.input}
                          />
                          <TextInput
                            value={promotionDraft.summary}
                            onChangeText={(value) =>
                              setPromotionDraft((current) =>
                                current ? { ...current, summary: value } : current
                              )
                            }
                            placeholder="Proposal summary"
                            placeholderTextColor="#8191A0"
                            multiline
                            style={[styles.input, styles.shortTextArea]}
                          />
                          <TextInput
                            value={promotionDraft.routeId}
                            onChangeText={(value) =>
                              setPromotionDraft((current) =>
                                current ? { ...current, routeId: value } : current
                              )
                            }
                            placeholder="Route ID if known"
                            placeholderTextColor="#8191A0"
                            style={styles.input}
                          />
                          <TextInput
                            value={promotionDraft.routeVariantId}
                            onChangeText={(value) =>
                              setPromotionDraft((current) =>
                                current ? { ...current, routeVariantId: value } : current
                              )
                            }
                            placeholder="Route variant ID if known"
                            placeholderTextColor="#8191A0"
                            style={styles.input}
                          />
                          <TextInput
                            value={promotionDraft.routeCode}
                            onChangeText={(value) =>
                              setPromotionDraft((current) =>
                                current ? { ...current, routeCode: value } : current
                              )
                            }
                            placeholder="Route code from the answer"
                            placeholderTextColor="#8191A0"
                            style={styles.input}
                          />
                          <TextInput
                            value={promotionDraft.routeVariantCode}
                            onChangeText={(value) =>
                              setPromotionDraft((current) =>
                                current ? { ...current, routeVariantCode: value } : current
                              )
                            }
                            placeholder="Route variant code from the answer"
                            placeholderTextColor="#8191A0"
                            style={styles.input}
                          />
                          <TextInput
                            value={promotionDraft.evidenceNote}
                            onChangeText={(value) =>
                              setPromotionDraft((current) =>
                                current ? { ...current, evidenceNote: value } : current
                              )
                            }
                            placeholder="Evidence note"
                            placeholderTextColor="#8191A0"
                            multiline
                            style={[styles.input, styles.shortTextArea]}
                          />
                          <CommunityProposalChangeSetEditor
                            proposalType={promotionDraft.proposalType}
                            value={promotionDraft.reviewedChangeSet}
                            onChange={(nextValue) =>
                              setPromotionDraft((current) =>
                                current ? { ...current, reviewedChangeSet: nextValue } : current
                              )
                            }
                          />
                          {promotionDraft.aiDraft ? (
                            <View style={styles.aiDraftCard}>
                              <Text style={styles.aiDraftTitle}>
                                AI draft {promotionDraft.aiDraft.confidence}
                              </Text>
                              <Text style={styles.aiDraftText}>{promotionDraft.aiDraft.reason}</Text>
                            </View>
                          ) : null}
                          <View style={styles.promotionActions}>
                            <Pressable
                              style={styles.secondaryButton}
                              onPress={() => void handleGenerateAiDraft()}
                              disabled={promotionDraft.isGeneratingAiDraft}
                            >
                              <Text style={styles.secondaryButtonText}>
                                {promotionDraft.isGeneratingAiDraft ? 'Generating...' : 'Use AI draft'}
                              </Text>
                            </Pressable>
                            <Pressable
                              style={[
                                styles.primaryInlineButton,
                                promotionDraft.isSubmitting && styles.primaryButtonDisabled,
                              ]}
                              onPress={() => void handlePromoteAnswer()}
                              disabled={promotionDraft.isSubmitting}
                            >
                              <Text style={styles.primaryInlineButtonText}>
                                {promotionDraft.isSubmitting ? 'Promoting...' : 'Create proposal'}
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        </ScrollView>

        <View style={styles.composerDock}>
          <Text style={styles.composerLabel}>Reply to this thread</Text>
          <TextInput
            value={answerBody}
            onChangeText={setAnswerBody}
            placeholder="Share the route, transfer tip, or fare context you know."
            placeholderTextColor="#8191A0"
            multiline
            style={styles.textArea}
          />
          <Pressable
            style={[styles.primaryButton, isSubmitting && styles.primaryButtonDisabled]}
            onPress={() => void handleSubmitAnswer()}
            disabled={isSubmitting}
          >
            <Text style={styles.primaryButtonText}>
              {isSubmitting ? 'Posting...' : 'Post answer'}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: SPACING.lg,
    gap: SPACING.lg,
    paddingBottom: 220,
  },
  threadStarterCard: {
    backgroundColor: COLORS.midnight,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#D7E8F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: COLORS.midnight,
    fontFamily: FONTS.bold,
    fontSize: TYPOGRAPHY.fontSizes.body,
  },
  authorMeta: {
    gap: 2,
  },
  authorName: {
    color: COLORS.white,
    fontFamily: FONTS.bold,
    fontSize: TYPOGRAPHY.fontSizes.body,
  },
  authorTimestamp: {
    color: '#B8CAD8',
    fontFamily: FONTS.regular,
    fontSize: TYPOGRAPHY.fontSizes.small,
  },
  title: {
    color: COLORS.white,
    fontFamily: FONTS.bold,
    fontSize: TYPOGRAPHY.fontSizes.xlarge,
    lineHeight: 30,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  contextChip: {
    borderRadius: RADIUS.full,
    backgroundColor: '#17324B',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  contextChipText: {
    color: '#DDEBF4',
    fontFamily: FONTS.medium,
    fontSize: TYPOGRAPHY.fontSizes.small,
    textTransform: 'capitalize',
  },
  body: {
    color: '#EDF4FA',
    fontFamily: FONTS.regular,
    fontSize: TYPOGRAPHY.fontSizes.body,
    lineHeight: 24,
  },
  threadStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#29445D',
    paddingTop: SPACING.sm,
  },
  threadStatsText: {
    color: '#B8CAD8',
    fontFamily: FONTS.medium,
    fontSize: TYPOGRAPHY.fontSizes.small,
  },
  repliesSection: {
    gap: SPACING.md,
  },
  sectionTitle: {
    color: COLORS.midnight,
    fontFamily: FONTS.bold,
    fontSize: TYPOGRAPHY.fontSizes.large,
  },
  emptyReplyCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: '#E2EBF2',
  },
  emptyReplyTitle: {
    color: COLORS.midnight,
    fontFamily: FONTS.bold,
    fontSize: TYPOGRAPHY.fontSizes.body,
  },
  emptyReplyText: {
    color: '#5A6B79',
    fontFamily: FONTS.regular,
    fontSize: TYPOGRAPHY.fontSizes.body,
    lineHeight: 22,
  },
  replyRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: SPACING.sm,
  },
  replyRailColumn: {
    alignItems: 'center',
    width: 40,
  },
  replyAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#D7E8F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyAvatarText: {
    color: COLORS.midnight,
    fontFamily: FONTS.bold,
    fontSize: TYPOGRAPHY.fontSizes.small,
  },
  replyRail: {
    flex: 1,
    width: 2,
    marginTop: SPACING.xs,
    backgroundColor: '#D8E4EC',
  },
  replyCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E2EBF2',
  },
  replyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  replyAuthor: {
    color: COLORS.midnight,
    fontFamily: FONTS.bold,
    fontSize: TYPOGRAPHY.fontSizes.body,
  },
  replyTimestamp: {
    color: '#8191A0',
    fontFamily: FONTS.regular,
    fontSize: TYPOGRAPHY.fontSizes.small,
  },
  replyBody: {
    color: '#213547',
    fontFamily: FONTS.regular,
    fontSize: TYPOGRAPHY.fontSizes.body,
    lineHeight: 22,
  },
  replyMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  replyMetaText: {
    flex: 1,
    color: '#5A6B79',
    fontFamily: FONTS.medium,
    fontSize: TYPOGRAPHY.fontSizes.small,
  },
  promoteButton: {
    borderRadius: RADIUS.full,
    backgroundColor: '#E7F1FF',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  promoteButtonText: {
    color: COLORS.primary,
    fontFamily: FONTS.semibold,
    fontSize: 11,
  },
  promotionCard: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#E6EDF3',
    gap: SPACING.sm,
  },
  promotionTitle: {
    color: COLORS.midnight,
    fontFamily: FONTS.bold,
    fontSize: TYPOGRAPHY.fontSizes.body,
  },
  dismissPromotionText: {
    color: COLORS.primary,
    fontFamily: FONTS.semibold,
    fontSize: TYPOGRAPHY.fontSizes.small,
  },
  selectionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  selectionChip: {
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#D8E4EC',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    backgroundColor: '#F7FBFE',
  },
  selectionChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#E7F1FF',
  },
  selectionChipText: {
    color: '#5A6B79',
    fontFamily: FONTS.medium,
    fontSize: 11,
  },
  selectionChipTextActive: {
    color: COLORS.primary,
  },
  input: {
    borderRadius: 12,
    backgroundColor: '#F7FBFE',
    borderWidth: 1,
    borderColor: '#E6EDF3',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    color: '#102033',
    fontFamily: FONTS.regular,
    fontSize: TYPOGRAPHY.fontSizes.small,
  },
  shortTextArea: {
    minHeight: 76,
    textAlignVertical: 'top',
  },
  jsonTextArea: {
    minHeight: 128,
    textAlignVertical: 'top',
  },
  aiDraftCard: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#D8E4EC',
    backgroundColor: '#F7FBFE',
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
  promotionActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#D8E4EC',
    backgroundColor: '#F7FBFE',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
  },
  secondaryButtonText: {
    color: COLORS.midnight,
    fontFamily: FONTS.semibold,
    fontSize: TYPOGRAPHY.fontSizes.small,
  },
  primaryInlineButton: {
    flex: 1,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.black,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
  },
  primaryInlineButtonText: {
    color: COLORS.white,
    fontFamily: FONTS.bold,
    fontSize: TYPOGRAPHY.fontSizes.small,
  },
  composerDock: {
    position: 'absolute',
    left: SPACING.lg,
    right: SPACING.lg,
    bottom: SPACING.lg,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: '#D8E4EC',
  },
  composerLabel: {
    color: COLORS.midnight,
    fontFamily: FONTS.bold,
    fontSize: TYPOGRAPHY.fontSizes.body,
  },
  textArea: {
    minHeight: 108,
    borderRadius: RADIUS.md,
    backgroundColor: '#F7FBFE',
    padding: SPACING.md,
    color: '#102033',
    fontFamily: FONTS.regular,
    textAlignVertical: 'top',
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
  errorText: {
    color: COLORS.danger,
    fontFamily: FONTS.medium,
  },
});
