import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Add01Icon, BubbleChatIcon } from '@hugeicons/core-free-icons';
import { useAuth } from '../auth/AuthContext';
import {
  createCommunityQuestion,
  createCommunitySubmission,
  getMyCommunityQuestions,
  getRecentCommunityQuestions,
} from '../community/api';
import type { CommunityQuestion, CommunitySubmissionType } from '../community/types';
import SafeScreen from '../components/SafeScreen';
import { COLORS, FONTS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NavigationProp<RootStackParamList>;
type FeedTab = 'feed' | 'mine';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#457b9d', '#2a9d8f', '#e76f51', '#6a4c93', '#f4a261'];

const getAvatarColor = (userId: string): string => {
  const code = userId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
};

const formatTimeAgo = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const previewText = (value: string, len = 160): string => {
  const t = value.trim();
  return t.length <= len ? t : `${t.slice(0, len - 1)}…`;
};

const SUBMISSION_TYPES: Array<{ value: CommunitySubmissionType; label: string }> = [
  { value: 'route_update', label: 'Route update' },
  { value: 'fare_update', label: 'Fare update' },
  { value: 'stop_correction', label: 'Stop fix' },
  { value: 'route_note', label: 'Route note' },
  { value: 'route_create', label: 'New route' },
  { value: 'route_deprecate', label: 'Deprecate' },
];

const buildSimplePayload = (
  type: CommunitySubmissionType,
  details: string,
  origin: string,
  destination: string
): Record<string, unknown> => {
  if (type === 'fare_update') {
    return { affectedModeOrProduct: 'commute', proposedAmount: 0, note: details };
  }
  if (type === 'route_create') {
    return { origin, destination, note: details };
  }
  if (type === 'stop_correction') {
    return { stopName: origin || destination, correctedName: destination || origin, note: details };
  }
  if (type === 'route_deprecate' || type === 'route_reactivate') {
    return { reason: details, note: details };
  }
  return {
    targetRouteOrPlaceId: 'community-route-correction',
    incorrectDetail: details,
    proposedCorrection: details,
    note: details,
    routeOrArea: destination || origin,
  };
};

// ─── PostCard ─────────────────────────────────────────────────────────────────

function PostCard({
  question,
  currentUserId,
  onPress,
}: {
  question: CommunityQuestion;
  currentUserId?: string;
  onPress: () => void;
}) {
  const isOwn = question.userId === currentUserId;
  const avatarColor = getAvatarColor(question.userId ?? 'anon');
  const isAnswered = question.replyCount > 0;

  return (
    <Pressable
      style={({ pressed }) => [styles.postCard, pressed && styles.postCardPressed]}
      onPress={onPress}
    >
      <View style={[styles.postAccent, isAnswered ? styles.postAccentAnswered : styles.postAccentOpen]} />
      <View style={styles.postInner}>

        {/* Author row */}
        <View style={styles.authorRow}>
          <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
            <Text style={styles.avatarText}>{isOwn ? 'Y' : 'R'}</Text>
          </View>
          <View style={styles.authorMeta}>
            <Text style={styles.authorName}>{isOwn ? 'You' : 'Community rider'}</Text>
            <Text style={styles.postTime}>{formatTimeAgo(question.createdAt)}</Text>
          </View>
          <View style={[styles.statusBadge, isAnswered ? styles.statusBadgeAnswered : styles.statusBadgeOpen]}>
            <View style={[styles.statusDot, isAnswered ? styles.statusDotAnswered : styles.statusDotOpen]} />
            <Text style={[styles.statusText, isAnswered ? styles.statusTextAnswered : styles.statusTextOpen]}>
              {isAnswered ? 'Answered' : 'Open'}
            </Text>
          </View>
        </View>

        {/* Route context pill */}
        {(question.originLabel || question.destinationLabel) ? (
          <View style={styles.routePill}>
            <Text style={styles.routePillText} numberOfLines={1}>
              {question.originLabel}
              {question.originLabel && question.destinationLabel ? ' → ' : ''}
              {question.destinationLabel}
            </Text>
          </View>
        ) : null}

        {/* Content */}
        <Text style={styles.postTitle} numberOfLines={2}>{question.title}</Text>
        {question.body ? (
          <Text style={styles.postBody} numberOfLines={3}>{previewText(question.body)}</Text>
        ) : null}

        {/* Footer */}
        <View style={styles.postFooter}>
          <View style={styles.replyCountRow}>
            <HugeiconsIcon icon={BubbleChatIcon} size={13} color="#8191A0" />
            <Text style={styles.replyCount}>
              {question.replyCount} {question.replyCount === 1 ? 'reply' : 'replies'}
            </Text>
          </View>
          <View style={styles.replyButton}>
            <Text style={styles.replyButtonText}>Reply →</Text>
          </View>
        </View>

      </View>
    </Pressable>
  );
}

// ─── ComposeModal ─────────────────────────────────────────────────────────────

type ComposeMode = 'question' | 'update';

function ComposeModal({
  visible,
  onClose,
  onSubmitQuestion,
  onSubmitUpdate,
  isSubmitting,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmitQuestion: (data: {
    title: string;
    body: string;
    originLabel: string;
    destinationLabel: string;
  }) => void;
  onSubmitUpdate: (data: {
    title: string;
    details: string;
    submissionType: CommunitySubmissionType;
    originLabel: string;
    destinationLabel: string;
  }) => void;
  isSubmitting: boolean;
}) {
  const [mode, setMode] = useState<ComposeMode>('question');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [details, setDetails] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [submissionType, setSubmissionType] = useState<CommunitySubmissionType>('route_update');

  useEffect(() => {
    if (!visible) {
      setMode('question');
      setTitle('');
      setBody('');
      setDetails('');
      setOrigin('');
      setDestination('');
      setSubmissionType('route_update');
    }
  }, [visible]);

  const canPost =
    mode === 'question' ? title.trim().length > 0 : title.trim().length > 0 && details.trim().length > 0;

  const handleSubmit = () => {
    if (!canPost) return;
    if (mode === 'question') {
      onSubmitQuestion({
        title: title.trim(),
        body: body.trim(),
        originLabel: origin.trim(),
        destinationLabel: destination.trim(),
      });
    } else {
      onSubmitUpdate({
        title: title.trim(),
        details: details.trim(),
        submissionType,
        originLabel: origin.trim(),
        destinationLabel: destination.trim(),
      });
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHandle} />

        <View style={styles.modalHeader}>
          <Pressable style={styles.modalCancelButton} onPress={onClose}>
            <Text style={styles.modalCancelText}>Cancel</Text>
          </Pressable>
          <Text style={styles.modalTitle}>
            {mode === 'question' ? 'New Thread' : 'Submit Update'}
          </Text>
          <Pressable
            style={[styles.modalPostButton, (!canPost || isSubmitting) && styles.modalPostButtonDisabled]}
            onPress={handleSubmit}
            disabled={!canPost || isSubmitting}
          >
            <Text style={styles.modalPostText}>
              {isSubmitting ? (mode === 'question' ? 'Posting…' : 'Sending…') : (mode === 'question' ? 'Post' : 'Send')}
            </Text>
          </Pressable>
        </View>

        {/* Mode toggle */}
        <View style={styles.modeToggleRow}>
          <Pressable
            style={[styles.modeToggleChip, mode === 'question' && styles.modeToggleChipActive]}
            onPress={() => setMode('question')}
          >
            <Text style={[styles.modeToggleText, mode === 'question' && styles.modeToggleTextActive]}>
              Ask community
            </Text>
          </Pressable>
          <Pressable
            style={[styles.modeToggleChip, mode === 'update' && styles.modeToggleChipActive]}
            onPress={() => setMode('update')}
          >
            <Text style={[styles.modeToggleText, mode === 'update' && styles.modeToggleTextActive]}>
              Submit update
            </Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.modalBody}
          contentContainerStyle={styles.modalBodyContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {mode === 'question' ? (
            <>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="What's your commute question?"
                placeholderTextColor="#B0BBC8"
                style={styles.composeTitleInput}
                multiline
                maxLength={140}
                autoFocus
              />
              <View style={styles.composeDivider} />
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder="Add more context… (optional)"
                placeholderTextColor="#B0BBC8"
                style={styles.composeBodyInput}
                multiline
              />
            </>
          ) : (
            <>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Short title for your update"
                placeholderTextColor="#B0BBC8"
                style={styles.composeTitleInput}
                multiline
                maxLength={120}
                autoFocus
              />
              <View style={styles.composeDivider} />

              {/* Submission type chips */}
              <Text style={styles.composeRouteSectionLabel}>UPDATE TYPE</Text>
              <View style={styles.typeChipRow}>
                {SUBMISSION_TYPES.map((t) => (
                  <Pressable
                    key={t.value}
                    style={[styles.typeChip, submissionType === t.value && styles.typeChipActive]}
                    onPress={() => setSubmissionType(t.value)}
                  >
                    <Text style={[styles.typeChipText, submissionType === t.value && styles.typeChipTextActive]}>
                      {t.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <TextInput
                value={details}
                onChangeText={setDetails}
                placeholder="Describe the issue or change clearly…"
                placeholderTextColor="#B0BBC8"
                style={[styles.composeBodyInput, styles.composeDetailsInput]}
                multiline
              />
            </>
          )}

          {/* Route context — shared between modes */}
          <View style={styles.composeRouteSection}>
            <Text style={styles.composeRouteSectionLabel}>ROUTE CONTEXT</Text>
            <TextInput
              value={origin}
              onChangeText={setOrigin}
              placeholder="Origin (e.g. Espana, Manila)"
              placeholderTextColor="#B0BBC8"
              style={styles.composeRouteInput}
            />
            <TextInput
              value={destination}
              onChangeText={setDestination}
              placeholder="Destination (e.g. BGC)"
              placeholderTextColor="#B0BBC8"
              style={styles.composeRouteInput}
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── CommunityScreen ──────────────────────────────────────────────────────────

export default function CommunityScreen() {
  const navigation = useNavigation<Nav>();
  const { session, user } = useAuth();
  const accessToken = session?.accessToken;

  const [feedTab, setFeedTab] = useState<FeedTab>('feed');
  const [recentQuestions, setRecentQuestions] = useState<CommunityQuestion[]>([]);
  const [myQuestions, setMyQuestions] = useState<CommunityQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (!accessToken) {
        setIsLoading(false);
        return;
      }

      if (mode === 'initial') setIsLoading(true);
      if (mode === 'refresh') setIsRefreshing(true);
      setErrorMessage(null);

      try {
        const [recent, mine] = await Promise.all([
          getRecentCommunityQuestions(accessToken),
          getMyCommunityQuestions(accessToken),
        ]);
        setRecentQuestions(recent);
        setMyQuestions(mine);
      } catch (e) {
        setErrorMessage(e instanceof Error ? e.message : 'Unable to load community.');
      } finally {
        if (mode === 'initial') setIsLoading(false);
        if (mode === 'refresh') setIsRefreshing(false);
      }
    },
    [accessToken]
  );

  useEffect(() => {
    void loadData('initial');
  }, [loadData]);

  const handleSubmitQuestion = useCallback(
    async (data: {
      title: string;
      body: string;
      originLabel: string;
      destinationLabel: string;
    }) => {
      if (!accessToken) return;
      setIsSubmitting(true);
      try {
        await createCommunityQuestion(accessToken, {
          title: data.title,
          body: data.body,
          originLabel: data.originLabel,
          destinationLabel: data.destinationLabel,
        });
        setShowCompose(false);
        void loadData('initial');
      } catch (e) {
        setErrorMessage(e instanceof Error ? e.message : 'Failed to post question.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [accessToken, loadData]
  );

  const handleSubmitUpdate = useCallback(
    async (data: {
      title: string;
      details: string;
      submissionType: CommunitySubmissionType;
      originLabel: string;
      destinationLabel: string;
    }) => {
      if (!accessToken) return;
      setIsSubmitting(true);
      try {
        await createCommunitySubmission(accessToken, {
          submissionType: data.submissionType,
          title: data.title,
          payload: buildSimplePayload(
            data.submissionType,
            data.details,
            data.originLabel,
            data.destinationLabel
          ),
        });
        setShowCompose(false);
      } catch (e) {
        setErrorMessage(e instanceof Error ? e.message : 'Failed to submit update.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [accessToken]
  );

  const displayedQuestions = feedTab === 'feed' ? recentQuestions : myQuestions;

  if (!accessToken) {
    return (
      <SafeScreen backgroundColor="#F5F7FA" topInsetBackgroundColor={COLORS.white} statusBarStyle="dark">
        <View style={styles.signedOutContainer}>
          <View style={styles.signedOutCard}>
            <Text style={styles.signedOutTitle}>Join the conversation</Text>
            <Text style={styles.signedOutBody}>
              Ask riders, answer commute threads, and help keep routes accurate.
            </Text>
            <TouchableOpacity
              style={styles.signInButton}
              activeOpacity={0.88}
              onPress={() =>
                (navigation as any).navigate('Login', {
                  successMessage: 'Sign in to access Community.',
                })
              }
            >
              <Text style={styles.signInButtonText}>Sign in to continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeScreen>
    );
  }

  return (
    <SafeScreen backgroundColor="#F5F7FA" topInsetBackgroundColor={COLORS.white} statusBarStyle="dark">

      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Community</Text>
          <Text style={styles.headerSubtitle}>Rider threads & route updates</Text>
        </View>
        <TouchableOpacity
          style={styles.composeButton}
          onPress={() => setShowCompose(true)}
          activeOpacity={0.85}
        >
          <HugeiconsIcon icon={Add01Icon} size={15} color={COLORS.white} />
          <Text style={styles.composeButtonText}>Ask</Text>
        </TouchableOpacity>
      </View>

      {/* ── Feed tabs ── */}
      <View style={styles.tabRow}>
        <Pressable
          style={[styles.feedTab, feedTab === 'feed' && styles.feedTabActive]}
          onPress={() => setFeedTab('feed')}
        >
          <Text style={[styles.feedTabText, feedTab === 'feed' && styles.feedTabTextActive]}>
            For You
          </Text>
        </Pressable>
        <Pressable
          style={[styles.feedTab, feedTab === 'mine' && styles.feedTabActive]}
          onPress={() => setFeedTab('mine')}
        >
          <Text style={[styles.feedTabText, feedTab === 'mine' && styles.feedTabTextActive]}>
            My Threads
          </Text>
          {myQuestions.length > 0 ? (
            <View style={styles.tabCount}>
              <Text style={styles.tabCountText}>{myQuestions.length}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {/* ── Feed ── */}
      <ScrollView
        contentContainerStyle={styles.feedContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void loadData('refresh')}
            tintColor={COLORS.primary}
          />
        }
      >
        {isLoading ? (
          <ActivityIndicator color={COLORS.primary} style={styles.loader} />
        ) : errorMessage ? (
          <View style={styles.errorState}>
            <Text style={styles.errorStateText}>{errorMessage}</Text>
          </View>
        ) : displayedQuestions.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <HugeiconsIcon icon={BubbleChatIcon} size={28} color="rgba(69,123,157,0.6)" />
            </View>
            <Text style={styles.emptyStateTitle}>
              {feedTab === 'feed' ? 'No threads yet' : "You haven't posted yet"}
            </Text>
            <Text style={styles.emptyStateBody}>
              {feedTab === 'feed'
                ? 'Be the first to start a commute thread.'
                : 'Tap "Ask" to post your first commute question.'}
            </Text>
          </View>
        ) : (
          displayedQuestions.map((q) => (
            <PostCard
              key={q.id}
              question={q}
              currentUserId={user?.id}
              onPress={() =>
                (navigation as any).navigate('CommunityQuestionDetail', { questionId: q.id })
              }
            />
          ))
        )}
      </ScrollView>

      <ComposeModal
        visible={showCompose}
        onClose={() => setShowCompose(false)}
        onSubmitQuestion={handleSubmitQuestion}
        onSubmitUpdate={handleSubmitUpdate}
        isSubmitting={isSubmitting}
      />
    </SafeScreen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF1F6',
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: FONTS.bold,
    color: '#0F1C2E',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    fontFamily: FONTS.regular,
    color: '#9AAAB8',
    marginTop: 1,
  },
  composeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
  },
  composeButtonText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: COLORS.white,
  },

  // Feed tabs
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF1F6',
    gap: SPACING.xs,
  },
  feedTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.full,
  },
  feedTabActive: {
    backgroundColor: '#EEF5FF',
  },
  feedTabText: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: '#9AAAB8',
  },
  feedTabTextActive: {
    color: COLORS.primary,
    fontFamily: FONTS.semibold,
  },
  tabCount: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabCountText: {
    fontSize: 10,
    fontFamily: FONTS.bold,
    color: COLORS.white,
  },

  // Feed
  feedContainer: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl + 32,
    gap: SPACING.sm,
  },
  loader: {
    marginTop: SPACING.xxl,
  },

  // Post card
  postCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E8EEF4',
    shadowColor: '#1A2E44',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  postCardPressed: {
    backgroundColor: '#FAFCFF',
    opacity: 0.96,
  },
  postAccent: {
    width: 4,
  },
  postAccentAnswered: {
    backgroundColor: '#22A55A',
  },
  postAccentOpen: {
    backgroundColor: COLORS.primary,
  },
  postInner: {
    flex: 1,
    padding: SPACING.md,
    gap: SPACING.xs + 2,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontFamily: FONTS.bold,
    color: COLORS.white,
  },
  authorMeta: {
    flex: 1,
    gap: 1,
  },
  authorName: {
    fontSize: 13,
    fontFamily: FONTS.semibold,
    color: '#0F1C2E',
  },
  postTime: {
    fontSize: 11,
    fontFamily: FONTS.regular,
    color: '#9AAAB8',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  statusBadgeAnswered: {
    backgroundColor: '#EDFAF3',
  },
  statusBadgeOpen: {
    backgroundColor: '#EEF5FF',
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  statusDotAnswered: {
    backgroundColor: '#22A55A',
  },
  statusDotOpen: {
    backgroundColor: COLORS.primary,
  },
  statusText: {
    fontSize: 10,
    fontFamily: FONTS.semibold,
  },
  statusTextAnswered: {
    color: '#22A55A',
  },
  statusTextOpen: {
    color: COLORS.primary,
  },

  // Route pill
  routePill: {
    alignSelf: 'flex-start',
    backgroundColor: '#F0F5FA',
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    maxWidth: '90%',
  },
  routePillText: {
    fontSize: 10,
    fontFamily: FONTS.medium,
    color: '#5D7286',
  },

  // Post content
  postTitle: {
    fontSize: 15,
    fontFamily: FONTS.bold,
    color: '#0F1C2E',
    lineHeight: 21,
  },
  postBody: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: '#3D5068',
    lineHeight: 19,
  },

  // Post footer
  postFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SPACING.xs + 2,
    borderTopWidth: 1,
    borderTopColor: '#F0F4F8',
    marginTop: 2,
  },
  replyCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  replyCount: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: '#9AAAB8',
  },
  replyButton: {
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    backgroundColor: '#F0F5FA',
  },
  replyButtonText: {
    fontSize: 11,
    fontFamily: FONTS.semibold,
    color: COLORS.primary,
  },

  // Empty / error states
  emptyState: {
    paddingTop: SPACING.xxl + 8,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EEF5FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  emptyStateTitle: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.bold,
    color: '#0F1C2E',
  },
  emptyStateBody: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.regular,
    color: '#9AAAB8',
    textAlign: 'center',
    maxWidth: 220,
    lineHeight: 20,
  },
  errorState: {
    paddingTop: SPACING.xxl,
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  errorStateText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.regular,
    color: COLORS.danger,
    textAlign: 'center',
  },

  // Signed-out state
  signedOutContainer: {
    flex: 1,
    padding: SPACING.lg,
    justifyContent: 'center',
  },
  signedOutCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: '#E4EBF2',
    alignItems: 'center',
  },
  signedOutTitle: {
    fontSize: TYPOGRAPHY.fontSizes.large,
    fontFamily: FONTS.bold,
    color: '#0F1C2E',
    textAlign: 'center',
  },
  signedOutBody: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.regular,
    color: '#6D7F90',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
  },
  signInButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.xl,
    marginTop: SPACING.xs,
  },
  signInButtonText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.bold,
    color: COLORS.white,
  },

  // Compose modal
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D8E2EB',
    alignSelf: 'center',
    marginTop: SPACING.sm,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF1F6',
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.bold,
    color: '#0F1C2E',
  },
  modalCancelButton: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: 4,
    minWidth: 60,
  },
  modalCancelText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
    color: '#9AAAB8',
  },
  modalPostButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.full,
    minWidth: 60,
    alignItems: 'center',
  },
  modalPostButtonDisabled: {
    backgroundColor: '#B0C4D4',
  },
  modalPostText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.bold,
    color: COLORS.white,
  },
  // Mode toggle
  modeToggleRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF1F6',
  },
  modeToggleChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#E0E8F0',
    backgroundColor: '#F8FBFD',
  },
  modeToggleChipActive: {
    backgroundColor: '#0F1C2E',
    borderColor: '#0F1C2E',
  },
  modeToggleText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
    color: '#6D7F90',
  },
  modeToggleTextActive: {
    color: COLORS.white,
    fontFamily: FONTS.semibold,
  },
  // Type chips
  typeChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  typeChip: {
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#E0E8F0',
    backgroundColor: '#F8FBFD',
  },
  typeChipActive: {
    backgroundColor: '#EEF5FF',
    borderColor: COLORS.primary,
  },
  typeChipText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: '#6D7F90',
  },
  typeChipTextActive: {
    color: COLORS.primary,
    fontFamily: FONTS.semibold,
  },
  composeDetailsInput: {
    minHeight: 100,
    marginTop: SPACING.sm,
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    padding: SPACING.md,
    paddingTop: SPACING.lg,
    gap: SPACING.sm,
  },
  composeTitleInput: {
    fontSize: 20,
    fontFamily: FONTS.semibold,
    color: '#0F1C2E',
    padding: 0,
    minHeight: 56,
    textAlignVertical: 'top',
    lineHeight: 28,
  },
  composeDivider: {
    height: 1,
    backgroundColor: '#EDF1F6',
    marginVertical: SPACING.sm,
  },
  composeBodyInput: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.regular,
    color: '#3D5068',
    padding: 0,
    minHeight: 80,
    textAlignVertical: 'top',
    lineHeight: 24,
  },
  composeRouteSection: {
    marginTop: SPACING.md,
    gap: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: '#F8FBFD',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#E6EDF3',
  },
  composeRouteSectionLabel: {
    fontSize: 10,
    fontFamily: FONTS.semibold,
    color: '#9AAAB8',
    letterSpacing: 1,
  },
  composeRouteInput: {
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#E6EDF3',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    color: '#102033',
    fontFamily: FONTS.regular,
    fontSize: TYPOGRAPHY.fontSizes.small,
  },
});
