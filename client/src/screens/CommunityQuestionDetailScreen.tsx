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
import { createCommunityAnswer, getCommunityQuestionDetail } from '../community/api';
import type { CommunityQuestionDetail } from '../community/types';
import SafeScreen from '../components/SafeScreen';
import { COLORS, FONTS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import type { RootStackParamList } from '../navigation/AppNavigator';

type CommunityQuestionDetailScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'CommunityQuestionDetail'
>;
type DetailLoadMode = 'initial' | 'refresh' | 'background';

const formatDate = (value: string): string =>
  new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

export default function CommunityQuestionDetailScreen({
  route,
}: CommunityQuestionDetailScreenProps) {
  const { session, user } = useAuth();
  const accessToken = session?.accessToken;
  const [detail, setDetail] = useState<CommunityQuestionDetail | null>(null);
  const [answerBody, setAnswerBody] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
