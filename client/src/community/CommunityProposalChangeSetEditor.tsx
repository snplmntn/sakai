import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { COLORS, FONTS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import type {
  CommunityFareProductChangeSet,
  CommunityFareUpdateChangeSet,
  CommunityProposalType,
  CommunityReviewedChangeSet,
  CommunityRouteCreateChangeSet,
  CommunityRouteLeg,
  CommunityRouteUpdateChangeSet,
  CommunityStopCorrectionChangeSet,
  CommunityTransferCorrectionChangeSet,
  CommunityTrainStationFareChangeSet,
} from './review-change-set-types';
import {
  createEmptyFareProduct,
  createEmptyRouteLeg,
  createEmptyTrainStationFare,
} from './review-change-set-types';

interface Props {
  proposalType: CommunityProposalType;
  value: CommunityReviewedChangeSet;
  onChange: (nextValue: CommunityReviewedChangeSet) => void;
}

const toInputValue = (value: number | string | undefined) =>
  typeof value === 'number' ? String(value) : value ?? '';

const parseNumberInput = (value: string): number | undefined => {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const field = (label: string, input: ReactNode) => (
  <View style={styles.fieldBlock}>
    <Text style={styles.fieldLabel}>{label}</Text>
    {input}
  </View>
);

const input = (
  value: string,
  onChangeText: (nextValue: string) => void,
  placeholder: string,
  multiline = false
) => (
  <TextInput
    value={value}
    onChangeText={onChangeText}
    placeholder={placeholder}
    placeholderTextColor="#8191A0"
    multiline={multiline}
    style={[styles.input, multiline && styles.textArea]}
  />
);

const modeOptions: CommunityRouteLeg['mode'][] = ['jeepney', 'uv', 'mrt3', 'lrt1', 'lrt2', 'bus', 'car'];
const fareModeOptions: CommunityFareUpdateChangeSet['ruleVersion']['mode'][] = [
  'jeepney',
  'uv',
  'mrt3',
  'lrt1',
  'lrt2',
  'bus',
];

const OptionChips = <T extends string>({
  value,
  options,
  onChange,
}: {
  value: T | undefined;
  options: readonly T[];
  onChange: (nextValue: T) => void;
}) => (
  <View style={styles.chipRow}>
    {options.map((option) => (
      <Pressable
        key={option}
        style={[styles.chip, value === option && styles.chipActive]}
        onPress={() => onChange(option)}
      >
        <Text style={[styles.chipText, value === option && styles.chipTextActive]}>{option}</Text>
      </Pressable>
    ))}
  </View>
);

const RouteLegEditor = ({
  leg,
  index,
  onChange,
  onRemove,
}: {
  leg: CommunityRouteLeg;
  index: number;
  onChange: (nextLeg: CommunityRouteLeg) => void;
  onRemove: () => void;
}) => (
  <View style={styles.listCard}>
    <View style={styles.rowBetween}>
      <Text style={styles.subsectionTitle}>Leg {index + 1}</Text>
      <Pressable style={styles.smallAction} onPress={onRemove}>
        <Text style={styles.smallActionText}>Remove</Text>
      </Pressable>
    </View>
    {field(
      'Sequence',
      input(toInputValue(leg.sequence), (nextValue) => onChange({ ...leg, sequence: parseNumberInput(nextValue) ?? 0 }), '0')
    )}
    {field('Mode', <OptionChips value={leg.mode} options={modeOptions} onChange={(nextValue) => onChange({ ...leg, mode: nextValue })} />)}
    {field('From stop ID', input(leg.fromStopId, (nextValue) => onChange({ ...leg, fromStopId: nextValue }), 'UUID'))}
    {field('To stop ID', input(leg.toStopId, (nextValue) => onChange({ ...leg, toStopId: nextValue }), 'UUID'))}
    {field('Route label', input(leg.routeLabel ?? '', (nextValue) => onChange({ ...leg, routeLabel: nextValue }), 'Optional'))}
    {field('Distance (km)', input(toInputValue(leg.distanceKm), (nextValue) => onChange({ ...leg, distanceKm: parseNumberInput(nextValue) ?? 0 }), '0'))}
    {field('Duration (minutes)', input(toInputValue(leg.durationMinutes), (nextValue) => onChange({ ...leg, durationMinutes: parseNumberInput(nextValue) ?? 0 }), '0'))}
    {field('Fare product code', input(leg.fareProductCode ?? '', (nextValue) => onChange({ ...leg, fareProductCode: nextValue }), 'Optional'))}
    {field('Corridor tag', input(leg.corridorTag ?? '', (nextValue) => onChange({ ...leg, corridorTag: nextValue }), 'Optional'))}
  </View>
);

const FareProductEditor = ({
  value,
  index,
  onChange,
  onRemove,
}: {
  value: CommunityFareProductChangeSet;
  index: number;
  onChange: (nextValue: CommunityFareProductChangeSet) => void;
  onRemove: () => void;
}) => (
  <View style={styles.listCard}>
    <View style={styles.rowBetween}>
      <Text style={styles.subsectionTitle}>Fare product {index + 1}</Text>
      <Pressable style={styles.smallAction} onPress={onRemove}>
        <Text style={styles.smallActionText}>Remove</Text>
      </Pressable>
    </View>
    {field('Product code', input(value.productCode, (nextValue) => onChange({ ...value, productCode: nextValue }), 'Required'))}
    {field('Mode', <OptionChips value={value.mode} options={fareModeOptions} onChange={(nextValue) => onChange({ ...value, mode: nextValue })} />)}
    {field('Pricing strategy', input(value.pricingStrategy, (nextValue) => onChange({ ...value, pricingStrategy: nextValue }), 'minimum_plus_succeeding'))}
    {field('Vehicle class', input(value.vehicleClass, (nextValue) => onChange({ ...value, vehicleClass: nextValue }), 'standard'))}
    {field('Minimum distance (km)', input(toInputValue(value.minimumDistanceKm), (nextValue) => onChange({ ...value, minimumDistanceKm: parseNumberInput(nextValue) ?? 0 }), '0'))}
    {field('Minimum fare regular', input(toInputValue(value.minimumFareRegular), (nextValue) => onChange({ ...value, minimumFareRegular: parseNumberInput(nextValue) ?? 0 }), '0'))}
    {field('Minimum fare discounted', input(toInputValue(value.minimumFareDiscounted), (nextValue) => onChange({ ...value, minimumFareDiscounted: parseNumberInput(nextValue) }), 'Optional'))}
    {field('Succeeding distance (km)', input(toInputValue(value.succeedingDistanceKm), (nextValue) => onChange({ ...value, succeedingDistanceKm: parseNumberInput(nextValue) ?? 1 }), '1'))}
    {field('Succeeding fare regular', input(toInputValue(value.succeedingFareRegular), (nextValue) => onChange({ ...value, succeedingFareRegular: parseNumberInput(nextValue) ?? 0 }), '0'))}
    {field('Succeeding fare discounted', input(toInputValue(value.succeedingFareDiscounted), (nextValue) => onChange({ ...value, succeedingFareDiscounted: parseNumberInput(nextValue) }), 'Optional'))}
    {field('Notes', input(value.notes ?? '', (nextValue) => onChange({ ...value, notes: nextValue }), 'Optional', true))}
  </View>
);

const TrainFareEditor = ({
  value,
  index,
  onChange,
  onRemove,
}: {
  value: CommunityTrainStationFareChangeSet;
  index: number;
  onChange: (nextValue: CommunityTrainStationFareChangeSet) => void;
  onRemove: () => void;
}) => (
  <View style={styles.listCard}>
    <View style={styles.rowBetween}>
      <Text style={styles.subsectionTitle}>Station fare {index + 1}</Text>
      <Pressable style={styles.smallAction} onPress={onRemove}>
        <Text style={styles.smallActionText}>Remove</Text>
      </Pressable>
    </View>
    {field('Origin stop ID', input(value.originStopId, (nextValue) => onChange({ ...value, originStopId: nextValue }), 'UUID'))}
    {field('Destination stop ID', input(value.destinationStopId, (nextValue) => onChange({ ...value, destinationStopId: nextValue }), 'UUID'))}
    {field('Regular fare', input(toInputValue(value.regularFare), (nextValue) => onChange({ ...value, regularFare: parseNumberInput(nextValue) ?? 0 }), '0'))}
    {field('Discounted fare', input(toInputValue(value.discountedFare), (nextValue) => onChange({ ...value, discountedFare: parseNumberInput(nextValue) ?? 0 }), '0'))}
  </View>
);

export default function CommunityProposalChangeSetEditor({ proposalType, value, onChange }: Props) {
  switch (proposalType) {
    case 'route_create': {
      const changeSet = value as CommunityRouteCreateChangeSet;
      return (
        <View style={styles.container}>
          <Text style={styles.sectionTitle}>Route draft</Text>
          {field('Route code', input(changeSet.route.code, (nextValue) => onChange({ ...changeSet, route: { ...changeSet.route, code: nextValue } }), 'Required'))}
          {field('Display name', input(changeSet.route.displayName ?? '', (nextValue) => onChange({ ...changeSet, route: { ...changeSet.route, displayName: nextValue } }), 'Optional'))}
          {field('Primary mode', <OptionChips value={changeSet.route.primaryMode} options={modeOptions} onChange={(nextValue) => onChange({ ...changeSet, route: { ...changeSet.route, primaryMode: nextValue } })} />)}
          {field('Operator name', input(changeSet.route.operatorName ?? '', (nextValue) => onChange({ ...changeSet, route: { ...changeSet.route, operatorName: nextValue } }), 'Optional'))}
          {field('Source name', input(changeSet.route.sourceName ?? '', (nextValue) => onChange({ ...changeSet, route: { ...changeSet.route, sourceName: nextValue } }), 'Optional'))}
          {field('Source URL', input(changeSet.route.sourceUrl ?? '', (nextValue) => onChange({ ...changeSet, route: { ...changeSet.route, sourceUrl: nextValue } }), 'Optional'))}

          <Text style={styles.sectionTitle}>Variant draft</Text>
          {field('Variant code', input(changeSet.variant.code, (nextValue) => onChange({ ...changeSet, variant: { ...changeSet.variant, code: nextValue } }), 'Required'))}
          {field('Variant display name', input(changeSet.variant.displayName ?? '', (nextValue) => onChange({ ...changeSet, variant: { ...changeSet.variant, displayName: nextValue } }), 'Optional'))}
          {field('Direction label', input(changeSet.variant.directionLabel ?? '', (nextValue) => onChange({ ...changeSet, variant: { ...changeSet.variant, directionLabel: nextValue } }), 'Optional'))}
          {field('Origin place ID', input(changeSet.variant.originPlaceId ?? '', (nextValue) => onChange({ ...changeSet, variant: { ...changeSet.variant, originPlaceId: nextValue } }), 'Optional UUID'))}
          {field('Destination place ID', input(changeSet.variant.destinationPlaceId ?? '', (nextValue) => onChange({ ...changeSet, variant: { ...changeSet.variant, destinationPlaceId: nextValue } }), 'Optional UUID'))}

          <Text style={styles.sectionTitle}>Legs</Text>
          {changeSet.legs.map((leg, index) => (
            <RouteLegEditor
              key={`${leg.sequence}-${index}`}
              leg={leg}
              index={index}
              onChange={(nextLeg) =>
                onChange({
                  ...changeSet,
                  legs: changeSet.legs.map((item, itemIndex) => (itemIndex === index ? nextLeg : item)),
                })
              }
              onRemove={() =>
                onChange({
                  ...changeSet,
                  legs:
                    changeSet.legs.length > 1
                      ? changeSet.legs.filter((_, itemIndex) => itemIndex !== index)
                      : [createEmptyRouteLeg(0)],
                })
              }
            />
          ))}
          <Pressable
            style={styles.addButton}
            onPress={() =>
              onChange({
                ...changeSet,
                legs: [...changeSet.legs, createEmptyRouteLeg(changeSet.legs.length)],
              })
            }
          >
            <Text style={styles.addButtonText}>Add leg</Text>
          </Pressable>
        </View>
      );
    }
    case 'route_update': {
      const changeSet = value as CommunityRouteUpdateChangeSet;
      return (
        <View style={styles.container}>
          <Text style={styles.sectionTitle}>Route fields</Text>
          {field('Display name', input(changeSet.route?.displayName ?? '', (nextValue) => onChange({ ...changeSet, route: { ...(changeSet.route ?? {}), displayName: nextValue } }), 'Optional'))}
          {field('Operator name', input(changeSet.route?.operatorName ?? '', (nextValue) => onChange({ ...changeSet, route: { ...(changeSet.route ?? {}), operatorName: nextValue } }), 'Optional'))}
          {field('Source name', input(changeSet.route?.sourceName ?? '', (nextValue) => onChange({ ...changeSet, route: { ...(changeSet.route ?? {}), sourceName: nextValue } }), 'Optional'))}
          {field('Source URL', input(changeSet.route?.sourceUrl ?? '', (nextValue) => onChange({ ...changeSet, route: { ...(changeSet.route ?? {}), sourceUrl: nextValue } }), 'Optional'))}

          <Text style={styles.sectionTitle}>Variant draft</Text>
          {field('Variant code', input(changeSet.variant.code, (nextValue) => onChange({ ...changeSet, variant: { ...changeSet.variant, code: nextValue } }), 'Required'))}
          {field('Variant display name', input(changeSet.variant.displayName ?? '', (nextValue) => onChange({ ...changeSet, variant: { ...changeSet.variant, displayName: nextValue } }), 'Optional'))}
          {field('Direction label', input(changeSet.variant.directionLabel ?? '', (nextValue) => onChange({ ...changeSet, variant: { ...changeSet.variant, directionLabel: nextValue } }), 'Optional'))}
          {field('Origin place ID', input(changeSet.variant.originPlaceId ?? '', (nextValue) => onChange({ ...changeSet, variant: { ...changeSet.variant, originPlaceId: nextValue } }), 'Optional UUID'))}
          {field('Destination place ID', input(changeSet.variant.destinationPlaceId ?? '', (nextValue) => onChange({ ...changeSet, variant: { ...changeSet.variant, destinationPlaceId: nextValue } }), 'Optional UUID'))}

          <Text style={styles.sectionTitle}>Legs</Text>
          {changeSet.legs.map((leg, index) => (
            <RouteLegEditor
              key={`${leg.sequence}-${index}`}
              leg={leg}
              index={index}
              onChange={(nextLeg) =>
                onChange({
                  ...changeSet,
                  legs: changeSet.legs.map((item, itemIndex) => (itemIndex === index ? nextLeg : item)),
                })
              }
              onRemove={() =>
                onChange({
                  ...changeSet,
                  legs:
                    changeSet.legs.length > 1
                      ? changeSet.legs.filter((_, itemIndex) => itemIndex !== index)
                      : [createEmptyRouteLeg(0)],
                })
              }
            />
          ))}
          <Pressable
            style={styles.addButton}
            onPress={() =>
              onChange({
                ...changeSet,
                legs: [...changeSet.legs, createEmptyRouteLeg(changeSet.legs.length)],
              })
            }
          >
            <Text style={styles.addButtonText}>Add leg</Text>
          </Pressable>
        </View>
      );
    }
    case 'stop_correction': {
      const changeSet = value as CommunityStopCorrectionChangeSet;
      return (
        <View style={styles.container}>
          {field('Stop ID', input(changeSet.stopId ?? '', (nextValue) => onChange({ ...changeSet, stopId: nextValue }), 'UUID or linked target'))}
          {field('Stop name', input(changeSet.stopName ?? '', (nextValue) => onChange({ ...changeSet, stopName: nextValue }), 'Optional'))}
          {field('External stop code', input(changeSet.externalStopCode ?? '', (nextValue) => onChange({ ...changeSet, externalStopCode: nextValue }), 'Optional'))}
          {field('Area', input(changeSet.area ?? '', (nextValue) => onChange({ ...changeSet, area: nextValue }), 'Optional'))}
          {field('Latitude', input(toInputValue(changeSet.latitude), (nextValue) => onChange({ ...changeSet, latitude: parseNumberInput(nextValue) }), 'Optional'))}
          {field('Longitude', input(toInputValue(changeSet.longitude), (nextValue) => onChange({ ...changeSet, longitude: parseNumberInput(nextValue) }), 'Optional'))}
          {field('Place ID', input(changeSet.placeId ?? '', (nextValue) => onChange({ ...changeSet, placeId: nextValue }), 'Optional UUID'))}
          <View style={styles.switchRow}>
            <Text style={styles.fieldLabel}>Set active flag</Text>
            <Switch
              value={changeSet.isActive ?? true}
              onValueChange={(nextValue) => onChange({ ...changeSet, isActive: nextValue })}
            />
          </View>
        </View>
      );
    }
    case 'transfer_correction': {
      const changeSet = value as CommunityTransferCorrectionChangeSet;
      return (
        <View style={styles.container}>
          {field('Transfer point ID', input(changeSet.transferPointId ?? '', (nextValue) => onChange({ ...changeSet, transferPointId: nextValue }), 'UUID or leave blank to create'))}
          {field('From stop ID', input(changeSet.fromStopId ?? '', (nextValue) => onChange({ ...changeSet, fromStopId: nextValue }), 'Required when creating'))}
          {field('To stop ID', input(changeSet.toStopId ?? '', (nextValue) => onChange({ ...changeSet, toStopId: nextValue }), 'Required when creating'))}
          {field('Walking distance (m)', input(toInputValue(changeSet.walkingDistanceM), (nextValue) => onChange({ ...changeSet, walkingDistanceM: parseNumberInput(nextValue) }), 'Optional'))}
          {field('Walking duration (minutes)', input(toInputValue(changeSet.walkingDurationMinutes), (nextValue) => onChange({ ...changeSet, walkingDurationMinutes: parseNumberInput(nextValue) }), 'Optional'))}
          <View style={styles.switchRow}>
            <Text style={styles.fieldLabel}>Accessible</Text>
            <Switch
              value={changeSet.isAccessible ?? true}
              onValueChange={(nextValue) => onChange({ ...changeSet, isAccessible: nextValue })}
            />
          </View>
        </View>
      );
    }
    case 'fare_update': {
      const changeSet = value as CommunityFareUpdateChangeSet;
      return (
        <View style={styles.container}>
          <Text style={styles.sectionTitle}>Rule version</Text>
          {field('Mode', <OptionChips value={changeSet.ruleVersion.mode} options={fareModeOptions} onChange={(nextValue) => onChange({ ...changeSet, ruleVersion: { ...changeSet.ruleVersion, mode: nextValue } })} />)}
          {field('Version name', input(changeSet.ruleVersion.versionName ?? '', (nextValue) => onChange({ ...changeSet, ruleVersion: { ...changeSet.ruleVersion, versionName: nextValue } }), 'Optional'))}
          {field('Source name', input(changeSet.ruleVersion.sourceName ?? '', (nextValue) => onChange({ ...changeSet, ruleVersion: { ...changeSet.ruleVersion, sourceName: nextValue } }), 'Optional'))}
          {field('Source URL', input(changeSet.ruleVersion.sourceUrl ?? '', (nextValue) => onChange({ ...changeSet, ruleVersion: { ...changeSet.ruleVersion, sourceUrl: nextValue } }), 'Optional'))}
          {field('Effectivity date', input(changeSet.ruleVersion.effectivityDate ?? '', (nextValue) => onChange({ ...changeSet, ruleVersion: { ...changeSet.ruleVersion, effectivityDate: nextValue } }), 'YYYY-MM-DD'))}
          {field('Verified at', input(changeSet.ruleVersion.verifiedAt ?? '', (nextValue) => onChange({ ...changeSet, ruleVersion: { ...changeSet.ruleVersion, verifiedAt: nextValue } }), 'ISO timestamp'))}
          <View style={styles.switchRow}>
            <Text style={styles.fieldLabel}>Activate version</Text>
            <Switch
              value={changeSet.activateVersion ?? true}
              onValueChange={(nextValue) => onChange({ ...changeSet, activateVersion: nextValue })}
            />
          </View>

          <Text style={styles.sectionTitle}>Fare products</Text>
          {(changeSet.fareProducts ?? []).map((product, index) => (
            <FareProductEditor
              key={`${product.productCode}-${index}`}
              value={product}
              index={index}
              onChange={(nextValue) =>
                onChange({
                  ...changeSet,
                  fareProducts: (changeSet.fareProducts ?? []).map((item, itemIndex) =>
                    itemIndex === index ? nextValue : item
                  ),
                })
              }
              onRemove={() =>
                onChange({
                  ...changeSet,
                  fareProducts:
                    (changeSet.fareProducts ?? []).length > 1
                      ? (changeSet.fareProducts ?? []).filter((_, itemIndex) => itemIndex !== index)
                      : [createEmptyFareProduct()],
                })
              }
            />
          ))}
          <Pressable
            style={styles.addButton}
            onPress={() =>
              onChange({
                ...changeSet,
                fareProducts: [...(changeSet.fareProducts ?? []), createEmptyFareProduct()],
              })
            }
          >
            <Text style={styles.addButtonText}>Add fare product</Text>
          </Pressable>

          <Text style={styles.sectionTitle}>Train station fares</Text>
          {(changeSet.trainStationFares ?? []).map((stationFare, index) => (
            <TrainFareEditor
              key={`${stationFare.originStopId}-${stationFare.destinationStopId}-${index}`}
              value={stationFare}
              index={index}
              onChange={(nextValue) =>
                onChange({
                  ...changeSet,
                  trainStationFares: (changeSet.trainStationFares ?? []).map((item, itemIndex) =>
                    itemIndex === index ? nextValue : item
                  ),
                })
              }
              onRemove={() =>
                onChange({
                  ...changeSet,
                  trainStationFares: (changeSet.trainStationFares ?? []).filter(
                    (_, itemIndex) => itemIndex !== index
                  ),
                })
              }
            />
          ))}
          <Pressable
            style={styles.addButton}
            onPress={() =>
              onChange({
                ...changeSet,
                trainStationFares: [...(changeSet.trainStationFares ?? []), createEmptyTrainStationFare()],
              })
            }
          >
            <Text style={styles.addButtonText}>Add station fare</Text>
          </Pressable>
        </View>
      );
    }
    default:
      return (
        <View style={styles.container}>
          <Text style={styles.helperText}>
            This proposal type does not need a structured reviewed change set.
          </Text>
        </View>
      );
  }
}

const styles = StyleSheet.create({
  container: {
    gap: SPACING.sm,
  },
  sectionTitle: {
    color: COLORS.midnight,
    fontFamily: FONTS.bold,
    fontSize: TYPOGRAPHY.fontSizes.body,
    marginTop: SPACING.xs,
  },
  subsectionTitle: {
    color: COLORS.midnight,
    fontFamily: FONTS.bold,
    fontSize: TYPOGRAPHY.fontSizes.small,
  },
  fieldBlock: {
    gap: SPACING.xs,
  },
  fieldLabel: {
    color: '#516270',
    fontFamily: FONTS.medium,
    fontSize: TYPOGRAPHY.fontSizes.small,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D8E4EC',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    color: COLORS.midnight,
    backgroundColor: COLORS.white,
    fontFamily: FONTS.regular,
    fontSize: TYPOGRAPHY.fontSizes.body,
  },
  textArea: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#D8E4EC',
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    backgroundColor: COLORS.white,
  },
  chipActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#E8F2FF',
  },
  chipText: {
    color: '#5C6B77',
    fontFamily: FONTS.medium,
    fontSize: TYPOGRAPHY.fontSizes.small,
  },
  chipTextActive: {
    color: COLORS.primary,
  },
  listCard: {
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E0E8EF',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    backgroundColor: '#F8FBFD',
  },
  addButton: {
    alignSelf: 'flex-start',
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    backgroundColor: '#E8F2FF',
  },
  addButtonText: {
    color: COLORS.primary,
    fontFamily: FONTS.medium,
    fontSize: TYPOGRAPHY.fontSizes.small,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  smallAction: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  smallActionText: {
    color: '#C43D3D',
    fontFamily: FONTS.medium,
    fontSize: TYPOGRAPHY.fontSizes.small,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  helperText: {
    color: '#647584',
    fontFamily: FONTS.regular,
    fontSize: TYPOGRAPHY.fontSizes.small,
    lineHeight: 20,
  },
});
