import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ArrowLeft01Icon } from '@hugeicons/core-free-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '../auth/AuthContext';
import SafeScreen from '../components/SafeScreen';
import { COLORS, FONTS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import type { RootStackParamList } from '../navigation/AppNavigator';
import {
  getPsgcBarangaysByCityMunicipality,
  getPsgcCitiesMunicipalitiesByProvince,
  getPsgcCitiesMunicipalitiesByRegion,
  getPsgcProvincesByRegion,
  getPsgcRegions,
  getPsgcRegionLabel,
} from '../psgc/api';
import type {
  PSGCBarangay,
  PSGCCityMunicipality,
  PSGCProvince,
  PSGCRegion,
} from '../psgc/types';
import {
  createMySavedPlace,
  getMySavedPlaces,
  updateMySavedPlace,
} from '../saved-places/api';
import {
  getSavedPlaceLabel,
  SAVED_PLACE_PRESET_OPTIONS,
  type SavedPlaceLabelKind,
  type SavedPlaceLabelPreset,
} from '../saved-places/types';
import { useToast } from '../toast/ToastContext';

type SavedPlaceEditorScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'SavedPlaceEditor'
>;

type LabelOption =
  | { key: SavedPlaceLabelPreset; label: string; kind: 'preset' }
  | { key: 'custom'; label: string; kind: 'custom' };

type SearchablePSGCOption = {
  code: string;
  name: string;
  subtitle?: string;
};

type ParsedSavedAddress = {
  line1: string;
  barangayName: string | null;
  cityMunicipalityName: string | null;
  provinceName: string | null;
  regionName: string | null;
};

type PendingPrefill = {
  regionName: string | null;
  provinceName: string | null;
  cityMunicipalityName: string | null;
  barangayName: string | null;
};

const LABEL_OPTIONS: LabelOption[] = [
  ...SAVED_PLACE_PRESET_OPTIONS.map((option) => ({
    key: option.value,
    label: option.label,
    kind: 'preset' as const,
  })),
  {
    key: 'custom',
    label: 'Custom',
    kind: 'custom',
  },
];

const getErrorMessage = (error: unknown, fallbackMessage: string): string =>
  error instanceof Error && error.message.trim().length > 0 ? error.message : fallbackMessage;

const normalizeText = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, ' ');

const parseSavedAddress = (value: string): ParsedSavedAddress => {
  const segments = value
    .split(',')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (segments.length < 4) {
    return {
      line1: value.trim(),
      barangayName: null,
      cityMunicipalityName: null,
      provinceName: null,
      regionName: null,
    };
  }

  if (segments.length === 4) {
    return {
      line1: segments[0] ?? '',
      barangayName: segments[1] ?? null,
      cityMunicipalityName: segments[2] ?? null,
      provinceName: null,
      regionName: segments[3] ?? null,
    };
  }

  return {
    line1: segments.slice(0, -4).join(', '),
    barangayName: segments.at(-4) ?? null,
    cityMunicipalityName: segments.at(-3) ?? null,
    provinceName: segments.at(-2) ?? null,
    regionName: segments.at(-1) ?? null,
  };
};

const buildSavedAddress = (input: {
  line1: string;
  region: PSGCRegion;
  province: PSGCProvince | null;
  cityMunicipality: PSGCCityMunicipality;
  barangay: PSGCBarangay;
}): string =>
  [
    input.line1.trim(),
    input.barangay.name,
    input.cityMunicipality.name,
    input.province?.name ?? null,
    getPsgcRegionLabel(input.region),
  ]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(', ');

const matchesSavedName = (candidate: string, target: string): boolean =>
  normalizeText(candidate) === normalizeText(target);

const filterOptions = <T extends SearchablePSGCOption>(
  options: T[],
  query: string,
  limit = 8
): T[] => {
  const normalizedQuery = normalizeText(query);

  if (normalizedQuery.length === 0) {
    return options.slice(0, limit);
  }

  return options
    .filter((option) => normalizeText(option.name).includes(normalizedQuery))
    .slice(0, limit);
};

function PSGCSelectorSection<T extends SearchablePSGCOption>({
  title,
  placeholder,
  query,
  onQueryChange,
  options,
  selectedOption,
  onSelect,
  loading,
  disabled,
  emptyText,
}: {
  title: string;
  placeholder: string;
  query: string;
  onQueryChange: (value: string) => void;
  options: T[];
  selectedOption: T | null;
  onSelect: (value: T) => void;
  loading: boolean;
  disabled?: boolean;
  emptyText: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (disabled) {
      setIsExpanded(false);
      return;
    }

    if (selectedOption === null && query.trim().length === 0) {
      setIsExpanded(false);
    }
  }, [disabled, query, selectedOption]);

  const handleSelect = (value: T) => {
    onSelect(value);
    onQueryChange('');
    setIsExpanded(false);
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Pressable
        style={[
          styles.selectedLocationCard,
          isExpanded && styles.selectedLocationCardExpanded,
          disabled && styles.selectedLocationCardDisabled,
        ]}
        onPress={() => {
          if (disabled) {
            return;
          }

          setIsExpanded((currentValue) => !currentValue);
        }}
      >
        <View style={styles.selectedLocationCopy}>
          <Text
            style={[
              styles.selectedLocationTitle,
              selectedOption === null && styles.selectedLocationPlaceholder,
            ]}
          >
            {selectedOption?.name ?? placeholder}
          </Text>
          {selectedOption?.subtitle ? (
            <Text style={styles.selectedLocationSubtitle}>{selectedOption.subtitle}</Text>
          ) : null}
          {selectedOption === null && disabled ? (
            <Text style={styles.selectedLocationSubtitle}>{emptyText}</Text>
          ) : null}
        </View>
        <View style={styles.selectedLocationAction}>
          {selectedOption ? (
            <Text style={styles.changeLink}>{isExpanded ? 'Close' : 'Change'}</Text>
          ) : (
            <Text style={styles.changeLink}>{isExpanded ? 'Close' : 'Choose'}</Text>
          )}
          <Text style={styles.dropdownChevron}>{isExpanded ? '▴' : '▾'}</Text>
        </View>
      </Pressable>
      {isExpanded ? (
        <>
          <TextInput
            style={[styles.input, disabled && styles.inputDisabled]}
            placeholder={placeholder}
            placeholderTextColor={COLORS.subText}
            value={query}
            onChangeText={(value) => {
              onQueryChange(value);
              if (!isExpanded) {
                setIsExpanded(true);
              }
            }}
            editable={!disabled}
          />
          <View style={styles.optionsList}>
            {loading ? (
              <View style={styles.optionStateRow}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.optionStateText}>Loading options</Text>
              </View>
            ) : options.length > 0 ? (
              options.map((option) => {
                const selected = selectedOption?.code === option.code;

                return (
                  <Pressable
                    key={option.code}
                    style={[styles.optionRow, selected && styles.optionRowSelected]}
                    onPress={() => handleSelect(option)}
                    disabled={disabled}
                  >
                    <View style={styles.optionRowCopy}>
                      <Text
                        style={[styles.optionRowTitle, selected && styles.optionRowTitleSelected]}
                      >
                        {option.name}
                      </Text>
                      {option.subtitle ? (
                        <Text style={styles.optionRowSubtitle}>{option.subtitle}</Text>
                      ) : null}
                    </View>
                    {selected ? <Text style={styles.optionCheck}>Selected</Text> : null}
                  </Pressable>
                );
              })
            ) : (
              <Text style={styles.optionEmptyText}>{emptyText}</Text>
            )}
          </View>
        </>
      ) : null}
    </View>
  );
}

export default function SavedPlaceEditorScreen({
  navigation,
  route,
}: SavedPlaceEditorScreenProps) {
  const { session } = useAuth();
  const { showToast } = useToast();
  const accessToken = session?.accessToken;
  const isEditing = route.params.mode === 'edit';
  const editingSavedPlaceId = route.params.mode === 'edit' ? route.params.savedPlaceId : null;
  const [line1, setLine1] = useState('');
  const [initialLine1, setInitialLine1] = useState('');
  const [existingAddress, setExistingAddress] = useState<string | null>(null);
  const [labelKind, setLabelKind] = useState<SavedPlaceLabelKind>('preset');
  const [presetLabel, setPresetLabel] = useState<SavedPlaceLabelPreset>('home');
  const [customLabel, setCustomLabel] = useState('');
  const [regions, setRegions] = useState<PSGCRegion[]>([]);
  const [provinces, setProvinces] = useState<PSGCProvince[]>([]);
  const [cityMunicipalities, setCityMunicipalities] = useState<PSGCCityMunicipality[]>([]);
  const [barangays, setBarangays] = useState<PSGCBarangay[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<PSGCRegion | null>(null);
  const [selectedProvince, setSelectedProvince] = useState<PSGCProvince | null>(null);
  const [selectedCityMunicipality, setSelectedCityMunicipality] =
    useState<PSGCCityMunicipality | null>(null);
  const [selectedBarangay, setSelectedBarangay] = useState<PSGCBarangay | null>(null);
  const [pendingPrefill, setPendingPrefill] = useState<PendingPrefill | null>(null);
  const [regionQuery, setRegionQuery] = useState('');
  const [provinceQuery, setProvinceQuery] = useState('');
  const [cityMunicipalityQuery, setCityMunicipalityQuery] = useState('');
  const [barangayQuery, setBarangayQuery] = useState('');
  const deferredRegionQuery = useDeferredValue(regionQuery);
  const deferredProvinceQuery = useDeferredValue(provinceQuery);
  const deferredCityMunicipalityQuery = useDeferredValue(cityMunicipalityQuery);
  const deferredBarangayQuery = useDeferredValue(barangayQuery);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [psgcErrorMessage, setPsgcErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(isEditing);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRegionsLoading, setIsRegionsLoading] = useState(true);
  const [isProvincesLoading, setIsProvincesLoading] = useState(false);
  const [isCityMunicipalitiesLoading, setIsCityMunicipalitiesLoading] = useState(false);
  const [isBarangaysLoading, setIsBarangaysLoading] = useState(false);

  const regionOptions = useMemo(
    () =>
      filterOptions(
        regions.map((region) => ({
          code: region.code,
          name: getPsgcRegionLabel(region),
          subtitle: region.name !== getPsgcRegionLabel(region) ? region.name : undefined,
        })),
        deferredRegionQuery
      ),
    [deferredRegionQuery, regions]
  );

  const provinceOptions = useMemo(
    () =>
      filterOptions(
        provinces.map((province) => ({
          code: province.code,
          name: province.name,
        })),
        deferredProvinceQuery
      ),
    [deferredProvinceQuery, provinces]
  );

  const cityMunicipalityOptions = useMemo(
    () =>
      filterOptions(
        cityMunicipalities.map((cityMunicipality) => ({
          code: cityMunicipality.code,
          name: cityMunicipality.name,
          subtitle: cityMunicipality.isCity ? 'City' : 'Municipality',
        })),
        deferredCityMunicipalityQuery
      ),
    [cityMunicipalities, deferredCityMunicipalityQuery]
  );

  const barangayOptions = useMemo(
    () =>
      filterOptions(
        barangays.map((barangay) => ({
          code: barangay.code,
          name: barangay.name,
        })),
        deferredBarangayQuery
      ),
    [barangays, deferredBarangayQuery]
  );

  useEffect(() => {
    let isMounted = true;

    const loadRegions = async () => {
      setIsRegionsLoading(true);

      try {
        const nextRegions = await getPsgcRegions();

        if (!isMounted) {
          return;
        }

        setRegions(nextRegions);
        setPsgcErrorMessage(null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setPsgcErrorMessage(getErrorMessage(error, 'Unable to load PSGC regions right now.'));
      } finally {
        if (isMounted) {
          setIsRegionsLoading(false);
        }
      }
    };

    void loadRegions();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadSavedPlace = async () => {
      if (!isEditing) {
        setIsLoading(false);
        return;
      }

      if (!accessToken) {
        if (isMounted) {
          setErrorMessage('Sign in to edit a saved place.');
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);

      try {
        const savedPlaces = await getMySavedPlaces(accessToken);
        const savedPlace = savedPlaces.find((item) => item.id === editingSavedPlaceId);

        if (!savedPlace) {
          throw new Error('That saved place is no longer available.');
        }

        if (!isMounted) {
          return;
        }

        const parsedAddress = parseSavedAddress(savedPlace.address);

        setLine1(parsedAddress.line1);
        setInitialLine1(parsedAddress.line1);
        setExistingAddress(savedPlace.address);
        setLabelKind(savedPlace.labelKind);
        setPresetLabel(savedPlace.presetLabel ?? 'home');
        setCustomLabel(savedPlace.customLabel ?? '');
        setPendingPrefill({
          regionName: parsedAddress.regionName,
          provinceName: parsedAddress.provinceName,
          cityMunicipalityName: parsedAddress.cityMunicipalityName,
          barangayName: parsedAddress.barangayName,
        });
        setErrorMessage(null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(getErrorMessage(error, 'Unable to load that saved place right now.'));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadSavedPlace();

    return () => {
      isMounted = false;
    };
  }, [accessToken, editingSavedPlaceId, isEditing]);

  useEffect(() => {
    if (!selectedRegion) {
      setProvinces([]);
      setSelectedProvince(null);
      setCityMunicipalities([]);
      setSelectedCityMunicipality(null);
      setBarangays([]);
      setSelectedBarangay(null);
      return;
    }

    let isMounted = true;

    const loadRegionChildren = async () => {
      setIsProvincesLoading(true);
      setIsCityMunicipalitiesLoading(true);

      try {
        const nextProvinces = await getPsgcProvincesByRegion(selectedRegion.code);

        if (!isMounted) {
          return;
        }

        setProvinces(nextProvinces);
        setSelectedProvince(null);
        setCityMunicipalities([]);
        setSelectedCityMunicipality(null);
        setBarangays([]);
        setSelectedBarangay(null);

        if (nextProvinces.length === 0) {
          const nextCitiesMunicipalities = await getPsgcCitiesMunicipalitiesByRegion(
            selectedRegion.code
          );

          if (!isMounted) {
            return;
          }

          setCityMunicipalities(nextCitiesMunicipalities);
        }

        setPsgcErrorMessage(null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setPsgcErrorMessage(
          getErrorMessage(error, 'Unable to load PSGC address options right now.')
        );
      } finally {
        if (isMounted) {
          setIsProvincesLoading(false);
          setIsCityMunicipalitiesLoading(false);
        }
      }
    };

    void loadRegionChildren();

    return () => {
      isMounted = false;
    };
  }, [selectedRegion]);

  useEffect(() => {
    if (!selectedProvince) {
      if (provinces.length > 0) {
        setCityMunicipalities([]);
        setSelectedCityMunicipality(null);
        setBarangays([]);
        setSelectedBarangay(null);
      }
      return;
    }

    let isMounted = true;

    const loadProvinceCitiesMunicipalities = async () => {
      setIsCityMunicipalitiesLoading(true);

      try {
        const nextCitiesMunicipalities = await getPsgcCitiesMunicipalitiesByProvince(
          selectedProvince.code
        );

        if (!isMounted) {
          return;
        }

        setCityMunicipalities(nextCitiesMunicipalities);
        setSelectedCityMunicipality(null);
        setBarangays([]);
        setSelectedBarangay(null);
        setPsgcErrorMessage(null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setPsgcErrorMessage(
          getErrorMessage(error, 'Unable to load PSGC city options right now.')
        );
      } finally {
        if (isMounted) {
          setIsCityMunicipalitiesLoading(false);
        }
      }
    };

    void loadProvinceCitiesMunicipalities();

    return () => {
      isMounted = false;
    };
  }, [provinces.length, selectedProvince]);

  useEffect(() => {
    if (!selectedCityMunicipality) {
      setBarangays([]);
      setSelectedBarangay(null);
      return;
    }

    let isMounted = true;

    const loadBarangays = async () => {
      setIsBarangaysLoading(true);

      try {
        const nextBarangays = await getPsgcBarangaysByCityMunicipality(
          selectedCityMunicipality.code
        );

        if (!isMounted) {
          return;
        }

        setBarangays(nextBarangays);
        setSelectedBarangay(null);
        setPsgcErrorMessage(null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setPsgcErrorMessage(
          getErrorMessage(error, 'Unable to load PSGC barangays right now.')
        );
      } finally {
        if (isMounted) {
          setIsBarangaysLoading(false);
        }
      }
    };

    void loadBarangays();

    return () => {
      isMounted = false;
    };
  }, [selectedCityMunicipality]);

  useEffect(() => {
    if (!pendingPrefill?.regionName || regions.length === 0 || selectedRegion) {
      return;
    }

    const matchingRegion = regions.find(
      (region) =>
        matchesSavedName(getPsgcRegionLabel(region), pendingPrefill.regionName ?? '') ||
        matchesSavedName(region.name, pendingPrefill.regionName ?? '')
    );

    if (!matchingRegion) {
      return;
    }

    setSelectedRegion(matchingRegion);
    setPendingPrefill((currentValue) =>
      currentValue
        ? {
            ...currentValue,
            regionName: null,
          }
        : currentValue
    );
  }, [pendingPrefill?.regionName, regions, selectedRegion]);

  useEffect(() => {
    if (!pendingPrefill?.provinceName || provinces.length === 0 || selectedProvince) {
      return;
    }

    const matchingProvince = provinces.find((province) =>
      matchesSavedName(province.name, pendingPrefill.provinceName ?? '')
    );

    if (!matchingProvince) {
      return;
    }

    setSelectedProvince(matchingProvince);
    setPendingPrefill((currentValue) =>
      currentValue
        ? {
            ...currentValue,
            provinceName: null,
          }
        : currentValue
    );
  }, [pendingPrefill?.provinceName, provinces, selectedProvince]);

  useEffect(() => {
    if (
      !pendingPrefill?.cityMunicipalityName ||
      cityMunicipalities.length === 0 ||
      selectedCityMunicipality
    ) {
      return;
    }

    const matchingCityMunicipality = cityMunicipalities.find((cityMunicipality) =>
      matchesSavedName(cityMunicipality.name, pendingPrefill.cityMunicipalityName ?? '')
    );

    if (!matchingCityMunicipality) {
      return;
    }

    setSelectedCityMunicipality(matchingCityMunicipality);
    setPendingPrefill((currentValue) =>
      currentValue
        ? {
            ...currentValue,
            cityMunicipalityName: null,
          }
        : currentValue
    );
  }, [cityMunicipalities, pendingPrefill?.cityMunicipalityName, selectedCityMunicipality]);

  useEffect(() => {
    if (!pendingPrefill?.barangayName || barangays.length === 0 || selectedBarangay) {
      return;
    }

    const matchingBarangay = barangays.find((barangay) =>
      matchesSavedName(barangay.name, pendingPrefill.barangayName ?? '')
    );

    if (!matchingBarangay) {
      return;
    }

    setSelectedBarangay(matchingBarangay);
    setPendingPrefill((currentValue) =>
      currentValue
        ? {
            ...currentValue,
            barangayName: null,
          }
        : currentValue
    );
  }, [barangays, pendingPrefill?.barangayName, selectedBarangay]);

  const screenTitle = useMemo(
    () => (isEditing ? 'Edit saved place' : 'Add saved place'),
    [isEditing]
  );

  const composedAddress =
    line1.trim().length > 0 &&
    selectedRegion &&
    selectedCityMunicipality &&
    selectedBarangay &&
    (selectedProvince || provinces.length === 0)
      ? buildSavedAddress({
          line1,
          region: selectedRegion,
          province: selectedProvince,
          cityMunicipality: selectedCityMunicipality,
          barangay: selectedBarangay,
        })
      : null;

  const handleManualLocationSelection = () => {
    setPendingPrefill(null);
    setErrorMessage(null);
  };

  const handleSave = async () => {
    if (!accessToken || isSubmitting) {
      return;
    }

    const trimmedLine1 = line1.trim();
    const trimmedCustomLabel = customLabel.trim();

    if (trimmedLine1.length === 0) {
      setErrorMessage('Enter a street, building, or landmark line for this address.');
      return;
    }

    if (labelKind === 'custom' && trimmedCustomLabel.length === 0) {
      setErrorMessage('Enter a label for this saved place.');
      return;
    }

    const hasExistingAddressFallback =
      existingAddress !== null && trimmedLine1 === initialLine1.trim() && composedAddress === null;

    if (
      !hasExistingAddressFallback &&
      (!selectedRegion ||
        !selectedCityMunicipality ||
        !selectedBarangay ||
        (provinces.length > 0 && !selectedProvince))
    ) {
      setErrorMessage('Choose the PSGC region, city or municipality, and barangay for this address.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const nextAddress = hasExistingAddressFallback ? existingAddress : composedAddress;

      if (!nextAddress) {
        throw new Error('Complete the PSGC address fields before saving.');
      }

      const payload =
        labelKind === 'custom'
          ? {
              address: nextAddress,
              labelKind,
              customLabel: trimmedCustomLabel,
            }
          : {
              address: nextAddress,
              labelKind,
              presetLabel,
            };

      const savedPlace = isEditing
        ? await updateMySavedPlace(accessToken, editingSavedPlaceId ?? '', payload)
        : await createMySavedPlace(accessToken, payload);

      showToast({
        tone: 'success',
        message: `${getSavedPlaceLabel(savedPlace)} saved.`,
      });
      navigation.goBack();
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Unable to save this place right now.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeScreen
      backgroundColor={COLORS.white}
      topInsetBackgroundColor={COLORS.white}
      statusBarStyle="dark"
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Pressable
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} size={20} color={COLORS.midnight} />
            </Pressable>
            <Text style={styles.title}>{screenTitle}</Text>
            <Text style={styles.subtitle}>
              Save a precise address with PSGC region, city, and barangay details so you can reuse
              it later.
            </Text>
          </View>

          {isLoading ? (
            <View style={styles.stateCard}>
              <ActivityIndicator color={COLORS.primary} />
              <Text style={styles.stateText}>Loading saved place details</Text>
            </View>
          ) : (
            <View style={styles.form}>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Street, building, or landmark</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Example: Unit 4B, 123 Ayala Avenue"
                  placeholderTextColor={COLORS.subText}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  value={line1}
                  onChangeText={setLine1}
                  editable={!isSubmitting}
                />
              </View>

              {psgcErrorMessage ? (
                <View style={styles.errorCard}>
                  <Text style={styles.errorText}>{psgcErrorMessage}</Text>
                </View>
              ) : null}

              <PSGCSelectorSection
                title="Region"
                placeholder="Search region"
                query={regionQuery}
                onQueryChange={setRegionQuery}
                options={regionOptions}
                selectedOption={
                  selectedRegion
                    ? {
                        code: selectedRegion.code,
                        name: getPsgcRegionLabel(selectedRegion),
                        subtitle:
                          selectedRegion.name !== getPsgcRegionLabel(selectedRegion)
                            ? selectedRegion.name
                            : undefined,
                      }
                    : null
                }
                onSelect={(option) => {
                  const region = regions.find((item) => item.code === option.code);

                  if (!region) {
                    return;
                  }

                  handleManualLocationSelection();
                  setSelectedRegion(region);
                  setSelectedProvince(null);
                  setSelectedCityMunicipality(null);
                  setSelectedBarangay(null);
                  setProvinceQuery('');
                  setCityMunicipalityQuery('');
                  setBarangayQuery('');
                }}
                loading={isRegionsLoading}
                emptyText="No PSGC regions matched your search."
              />

              {selectedRegion ? (
                <PSGCSelectorSection
                  title="Province"
                  placeholder={
                    provinces.length > 0 ? 'Search province' : 'No province step for this region'
                  }
                  query={provinceQuery}
                  onQueryChange={setProvinceQuery}
                  options={provinceOptions}
                  selectedOption={
                    selectedProvince
                      ? {
                          code: selectedProvince.code,
                          name: selectedProvince.name,
                        }
                      : null
                  }
                  onSelect={(option) => {
                    const province = provinces.find((item) => item.code === option.code);

                    if (!province) {
                      return;
                    }

                    handleManualLocationSelection();
                    setSelectedProvince(province);
                    setSelectedCityMunicipality(null);
                    setSelectedBarangay(null);
                    setCityMunicipalityQuery('');
                    setBarangayQuery('');
                  }}
                  loading={isProvincesLoading}
                  disabled={provinces.length === 0}
                  emptyText={
                    provinces.length === 0
                      ? 'This region has no province step. Move to city or municipality.'
                      : 'No PSGC provinces matched your search.'
                  }
                />
              ) : null}

              {selectedRegion ? (
                <PSGCSelectorSection
                  title="City or municipality"
                  placeholder="Search city or municipality"
                  query={cityMunicipalityQuery}
                  onQueryChange={setCityMunicipalityQuery}
                  options={cityMunicipalityOptions}
                  selectedOption={
                    selectedCityMunicipality
                      ? {
                          code: selectedCityMunicipality.code,
                          name: selectedCityMunicipality.name,
                          subtitle: selectedCityMunicipality.isCity ? 'City' : 'Municipality',
                        }
                      : null
                  }
                  onSelect={(option) => {
                    const cityMunicipality = cityMunicipalities.find(
                      (item) => item.code === option.code
                    );

                    if (!cityMunicipality) {
                      return;
                    }

                    handleManualLocationSelection();
                    setSelectedCityMunicipality(cityMunicipality);
                    setSelectedBarangay(null);
                    setBarangayQuery('');
                  }}
                  loading={isCityMunicipalitiesLoading}
                  disabled={provinces.length > 0 && !selectedProvince}
                  emptyText="No PSGC cities or municipalities matched your search."
                />
              ) : null}

              {selectedCityMunicipality ? (
                <PSGCSelectorSection
                  title="Barangay"
                  placeholder="Search barangay"
                  query={barangayQuery}
                  onQueryChange={setBarangayQuery}
                  options={barangayOptions}
                  selectedOption={
                    selectedBarangay
                      ? {
                          code: selectedBarangay.code,
                          name: selectedBarangay.name,
                        }
                      : null
                  }
                  onSelect={(option) => {
                    const barangay = barangays.find((item) => item.code === option.code);

                    if (!barangay) {
                      return;
                    }

                    handleManualLocationSelection();
                    setSelectedBarangay(barangay);
                  }}
                  loading={isBarangaysLoading}
                  emptyText="No PSGC barangays matched your search."
                />
              ) : null}

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Label</Text>
                <View style={styles.optionGrid}>
                  {LABEL_OPTIONS.map((option) => {
                    const selected =
                      option.kind === 'custom'
                        ? labelKind === 'custom'
                        : labelKind === 'preset' && presetLabel === option.key;

                    return (
                      <Pressable
                        key={option.key}
                        style={[styles.optionCard, selected && styles.optionCardSelected]}
                        onPress={() => {
                          setErrorMessage(null);

                          if (option.kind === 'custom') {
                            setLabelKind('custom');
                            return;
                          }

                          setLabelKind('preset');
                          setPresetLabel(option.key);
                        }}
                        disabled={isSubmitting}
                      >
                        <Text style={[styles.optionTitle, selected && styles.optionTitleSelected]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {labelKind === 'custom' ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Custom label</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Example: Lola's house"
                    placeholderTextColor={COLORS.subText}
                    value={customLabel}
                    onChangeText={setCustomLabel}
                    editable={!isSubmitting}
                  />
                </View>
              ) : null}

              {errorMessage ? (
                <View style={styles.errorCard}>
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              ) : null}

              <Pressable
                style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
                onPress={() => {
                  void handleSave();
                }}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {isEditing ? 'Save changes' : 'Save place'}
                  </Text>
                )}
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxl,
    gap: SPACING.md,
  },
  header: {
    gap: SPACING.xs + 2,
  },
  backButton: {
    alignSelf: 'flex-start',
    borderRadius: RADIUS.full,
    width: 40,
    height: 40,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: '#E3EBF2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: COLORS.midnight,
    fontSize: TYPOGRAPHY.fontSizes.xlarge,
    fontFamily: FONTS.bold,
  },
  subtitle: {
    color: COLORS.subText,
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.regular,
    lineHeight: 20,
  },
  stateCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#E6EDF3',
    backgroundColor: '#F9FBFD',
    padding: SPACING.lg,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  stateText: {
    color: COLORS.subText,
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
  },
  form: {
    gap: SPACING.md,
  },
  section: {
    gap: SPACING.xs + 4,
  },
  sectionTitle: {
    color: COLORS.midnight,
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.semibold,
  },
  input: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#DCE6EE',
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 6,
    color: COLORS.text,
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.regular,
  },
  textArea: {
    minHeight: 78,
  },
  inputDisabled: {
    opacity: 0.6,
  },
  optionsList: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#E6EDF3',
    backgroundColor: COLORS.white,
    overflow: 'hidden',
  },
  optionStateRow: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  optionStateText: {
    color: COLORS.subText,
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
  },
  optionRow: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF3F6',
  },
  optionRowSelected: {
    backgroundColor: '#F3F8FE',
  },
  optionRowCopy: {
    flex: 1,
    gap: 2,
  },
  optionRowTitle: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
  },
  optionRowTitleSelected: {
    color: COLORS.primary,
  },
  optionRowSubtitle: {
    color: COLORS.subText,
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.regular,
  },
  optionCheck: {
    color: COLORS.primary,
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
  },
  optionEmptyText: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    color: COLORS.subText,
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.regular,
    lineHeight: 20,
  },
  selectedLocationCard: {
    borderRadius: RADIUS.md,
    backgroundColor: '#F7FBFE',
    borderWidth: 1,
    borderColor: '#DEE8F1',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 6,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  selectedLocationCardExpanded: {
    borderColor: '#C7D9EA',
    backgroundColor: COLORS.white,
  },
  selectedLocationCardDisabled: {
    opacity: 0.7,
  },
  selectedLocationCopy: {
    flex: 1,
    gap: 2,
  },
  selectedLocationTitle: {
    color: COLORS.midnight,
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    lineHeight: 18,
  },
  selectedLocationPlaceholder: {
    color: COLORS.subText,
  },
  selectedLocationSubtitle: {
    color: COLORS.subText,
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.regular,
  },
  selectedLocationAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingTop: 2,
  },
  changeLink: {
    color: COLORS.primary,
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
  },
  dropdownChevron: {
    color: COLORS.primary,
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  optionCard: {
    minWidth: 100,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#DCE6EE',
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    alignItems: 'center',
  },
  optionCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#F3F8FE',
  },
  optionTitle: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
  },
  optionTitleSelected: {
    color: COLORS.primary,
  },
  errorCard: {
    borderRadius: RADIUS.md,
    backgroundColor: '#FDEEEE',
    padding: SPACING.md,
  },
  errorText: {
    color: '#B53329',
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
    lineHeight: 20,
  },
  primaryButton: {
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.black,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.semibold,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
