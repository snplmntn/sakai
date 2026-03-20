import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ArrowLeft01Icon } from '@hugeicons/core-free-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';

import { useAuth } from '../auth/AuthContext';
import SafeScreen from '../components/SafeScreen';
import { COLORS, FONTS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { deleteMySavedPlace, getMySavedPlaces } from '../saved-places/api';
import {
  getSavedPlaceLabel,
  type SavedPlace,
  type SavedPlaceLabelPreset,
} from '../saved-places/types';
import { useToast } from '../toast/ToastContext';

type SavedPlacesScreenProps = NativeStackScreenProps<RootStackParamList, 'SavedPlaces'>;
type LoadMode = 'initial' | 'refresh' | 'background';

const PRESET_SORT_ORDER: Record<SavedPlaceLabelPreset, number> = {
  home: 0,
  office: 1,
  school: 2,
};

const sortSavedPlaces = (savedPlaces: SavedPlace[]): SavedPlace[] =>
  [...savedPlaces].sort((left, right) => {
    const leftRank =
      left.labelKind === 'preset' && left.presetLabel ? PRESET_SORT_ORDER[left.presetLabel] : 99;
    const rightRank =
      right.labelKind === 'preset' && right.presetLabel ? PRESET_SORT_ORDER[right.presetLabel] : 99;

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    if (left.labelKind === 'custom' && right.labelKind === 'custom') {
      return right.updatedAt.localeCompare(left.updatedAt);
    }

    return right.updatedAt.localeCompare(left.updatedAt);
  });

const getErrorMessage = (error: unknown, fallbackMessage: string): string =>
  error instanceof Error && error.message.trim().length > 0 ? error.message : fallbackMessage;

export default function SavedPlacesScreen({ navigation }: SavedPlacesScreenProps) {
  const { session } = useAuth();
  const { showToast } = useToast();
  const accessToken = session?.accessToken;
  const hasLoadedOnceRef = useRef(false);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deletingSavedPlaceId, setDeletingSavedPlaceId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadSavedPlaces = useCallback(
    async (mode: LoadMode) => {
      if (!accessToken) {
        setSavedPlaces([]);
        setErrorMessage('Sign in to view your saved places.');
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
        const nextSavedPlaces = await getMySavedPlaces(accessToken);
        setSavedPlaces(sortSavedPlaces(nextSavedPlaces));
      } catch (error) {
        setErrorMessage(getErrorMessage(error, 'Unable to load your saved places right now.'));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [accessToken]
  );

  useFocusEffect(
    useCallback(() => {
      const nextMode: LoadMode = hasLoadedOnceRef.current ? 'background' : 'initial';
      hasLoadedOnceRef.current = true;
      void loadSavedPlaces(nextMode);
    }, [loadSavedPlaces])
  );

  const handleDelete = useCallback(
    (savedPlace: SavedPlace) => {
      if (!accessToken || deletingSavedPlaceId) {
        return;
      }

      Alert.alert(
        'Delete saved place?',
        `Remove ${getSavedPlaceLabel(savedPlace)} from your saved places?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              void (async () => {
                setDeletingSavedPlaceId(savedPlace.id);

                try {
                  await deleteMySavedPlace(accessToken, savedPlace.id);
                  setSavedPlaces((currentValue) =>
                    currentValue.filter((item) => item.id !== savedPlace.id)
                  );
                  showToast({
                    tone: 'success',
                    message: `${getSavedPlaceLabel(savedPlace)} removed.`,
                  });
                } catch (error) {
                  showToast({
                    tone: 'error',
                    message: getErrorMessage(
                      error,
                      'Unable to remove that saved place right now.'
                    ),
                  });
                } finally {
                  setDeletingSavedPlaceId(null);
                }
              })();
            },
          },
        ]
      );
    },
    [accessToken, deletingSavedPlaceId, showToast]
  );

  return (
    <SafeScreen
      backgroundColor={COLORS.white}
      topInsetBackgroundColor={COLORS.white}
      statusBarStyle="dark"
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => void loadSavedPlaces('refresh')} />
        }
      >
        <View style={styles.body}>
          <View style={styles.header}>
            <Pressable
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} size={20} color={COLORS.midnight} />
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>Saved places</Text>
              <Text style={styles.subtitle}>
                Keep your frequent addresses ready for faster planning.
              </Text>
            </View>
            <Pressable
              style={styles.addButton}
              onPress={() => navigation.navigate('SavedPlaceEditor', { mode: 'create' })}
            >
              <Text style={styles.addButtonText}>Add place</Text>
            </Pressable>
          </View>

          {isLoading ? (
            <View style={styles.stateCard}>
              <ActivityIndicator color={COLORS.primary} />
              <Text style={styles.stateText}>Loading your saved places</Text>
            </View>
          ) : null}

          {!isLoading && errorMessage ? (
            <View style={styles.stateCard}>
              <Text style={styles.errorTitle}>Couldn&apos;t load saved places</Text>
              <Text style={styles.errorBody}>{errorMessage}</Text>
              <Pressable style={styles.retryButton} onPress={() => void loadSavedPlaces('initial')}>
                <Text style={styles.retryButtonText}>Try again</Text>
              </Pressable>
            </View>
          ) : null}

          {!isLoading && !errorMessage && savedPlaces.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No saved places yet</Text>
              <Text style={styles.emptyBody}>
                Add your home, office, school, or another frequent stop to keep trip setup short.
              </Text>
              <Pressable
                style={styles.emptyAction}
                onPress={() => navigation.navigate('SavedPlaceEditor', { mode: 'create' })}
              >
                <Text style={styles.emptyActionText}>Add your first place</Text>
              </Pressable>
            </View>
          ) : null}

          {!isLoading && !errorMessage && savedPlaces.length > 0 ? (
            <View style={styles.list}>
              {savedPlaces.map((savedPlace) => {
                const isDeleting = deletingSavedPlaceId === savedPlace.id;

                return (
                  <View key={savedPlace.id} style={styles.placeCard}>
                    <View style={styles.placeHeader}>
                      <View style={styles.labelChip}>
                        <Text style={styles.labelChipText}>{getSavedPlaceLabel(savedPlace)}</Text>
                      </View>
                      <Text style={styles.updatedAt}>
                        Updated {new Date(savedPlace.updatedAt).toLocaleDateString()}
                      </Text>
                    </View>
                    <Text style={styles.address}>{savedPlace.address}</Text>
                    <View style={styles.actionRow}>
                      <Pressable
                        style={styles.secondaryButton}
                        onPress={() =>
                          navigation.navigate('SavedPlaceEditor', {
                            mode: 'edit',
                            savedPlaceId: savedPlace.id,
                          })
                        }
                      >
                        <Text style={styles.secondaryButtonText}>Edit</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.deleteButton, isDeleting && styles.buttonDisabled]}
                        onPress={() => handleDelete(savedPlace)}
                        disabled={isDeleting}
                      >
                        {isDeleting ? (
                          <ActivityIndicator size="small" color={COLORS.danger} />
                        ) : (
                          <Text style={styles.deleteButtonText}>Delete</Text>
                        )}
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: SPACING.xxl,
  },
  body: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  header: {
    gap: SPACING.md,
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
  headerCopy: {
    gap: SPACING.xs,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizes.xlarge,
    fontFamily: FONTS.bold,
    color: COLORS.midnight,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.regular,
    color: COLORS.subText,
    lineHeight: 20,
  },
  addButton: {
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.black,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md - 2,
    alignItems: 'center',
  },
  addButtonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.semibold,
  },
  list: {
    gap: SPACING.md,
  },
  placeCard: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#E6EDF3',
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    gap: SPACING.md,
  },
  placeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  labelChip: {
    borderRadius: RADIUS.full,
    backgroundColor: '#EAF2FF',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
  },
  labelChipText: {
    color: COLORS.primary,
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
  },
  updatedAt: {
    flex: 1,
    textAlign: 'right',
    color: COLORS.subText,
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.regular,
  },
  address: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.medium,
    lineHeight: 22,
  },
  actionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#DCE6EE',
    paddingVertical: SPACING.sm + 6,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.medium,
  },
  deleteButton: {
    flex: 1,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#F4C9C4',
    paddingVertical: SPACING.sm + 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    color: COLORS.danger,
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.medium,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  stateCard: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#E6EDF3',
    backgroundColor: '#F8FBFD',
    padding: SPACING.lg,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  stateText: {
    color: COLORS.subText,
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
  },
  errorTitle: {
    color: COLORS.midnight,
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.semibold,
  },
  errorBody: {
    color: COLORS.subText,
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.regular,
    lineHeight: 20,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: SPACING.xs,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.black,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 2,
  },
  retryButtonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
  },
  emptyCard: {
    borderRadius: RADIUS.md,
    backgroundColor: '#F8FBFD',
    borderWidth: 1,
    borderColor: '#E6EDF3',
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  emptyTitle: {
    color: COLORS.midnight,
    fontSize: TYPOGRAPHY.fontSizes.large,
    fontFamily: FONTS.bold,
  },
  emptyBody: {
    color: COLORS.subText,
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.regular,
    lineHeight: 20,
  },
  emptyAction: {
    alignSelf: 'flex-start',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#DCE6EE',
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  emptyActionText: {
    color: COLORS.midnight,
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
  },
});
