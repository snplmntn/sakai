import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS, FONTS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import type { RouteQueryIncident } from '../routes/types';

const SEVERITY_LABELS: Record<RouteQueryIncident['severity'], string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

const SEVERITY_STYLES: Record<
  RouteQueryIncident['severity'],
  { backgroundColor: string; borderColor: string; textColor: string }
> = {
  low: {
    backgroundColor: '#EDF7EE',
    borderColor: '#C9E7D0',
    textColor: '#1F7A3F',
  },
  medium: {
    backgroundColor: '#FFF4E6',
    borderColor: '#FFD9AE',
    textColor: '#B35C00',
  },
  high: {
    backgroundColor: '#FDECEC',
    borderColor: '#F5C2C0',
    textColor: '#B42318',
  },
};

const formatIncidentDate = (value: string, prefix: string) => {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return `${prefix} ${parsed.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })}`;
};

const buildIncidentMeta = (incident: RouteQueryIncident) =>
  [
    incident.location,
    incident.direction,
    formatIncidentDate(incident.scrapedAt, 'Updated'),
    formatIncidentDate(incident.displayUntil, 'Active until'),
  ]
    .filter((value): value is string => value !== null && value.length > 0)
    .join(' • ');

export default function RelevantIncidentsSection({
  incidents,
  title = 'Area updates',
  compact = false,
  maxItems,
  metaNotice,
  emptyText,
}: {
  incidents: RouteQueryIncident[];
  title?: string;
  compact?: boolean;
  maxItems?: number;
  metaNotice?: string | null;
  emptyText?: string | null;
}) {
  if (incidents.length === 0 && !emptyText) {
    return null;
  }

  const visibleIncidents = typeof maxItems === 'number' ? incidents.slice(0, maxItems) : incidents;
  const hiddenCount = Math.max(0, incidents.length - visibleIncidents.length);

  return (
    <View style={[styles.sectionCard, compact && styles.sectionCardCompact]}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        {incidents.length > 0 ? (
          <View style={styles.countChip}>
            <Text style={styles.countChipText}>
              {incidents.length} update{incidents.length === 1 ? '' : 's'}
            </Text>
          </View>
        ) : null}
      </View>

      {metaNotice ? <Text style={styles.metaNotice}>{metaNotice}</Text> : null}

      {visibleIncidents.length === 0 && emptyText ? (
        <Text style={styles.emptyText}>{emptyText}</Text>
      ) : null}

      {visibleIncidents.map((incident) => {
        const severityStyle = SEVERITY_STYLES[incident.severity];

        return (
          <View key={incident.id} style={styles.incidentCard}>
            <View style={styles.incidentTopRow}>
              <Text style={styles.incidentType}>{incident.alertType}</Text>
              <View
                style={[
                  styles.severityChip,
                  {
                    backgroundColor: severityStyle.backgroundColor,
                    borderColor: severityStyle.borderColor,
                  },
                ]}
              >
                <Text style={[styles.severityChipText, { color: severityStyle.textColor }]}>
                  {SEVERITY_LABELS[incident.severity]}
                </Text>
              </View>
            </View>

            <Text style={styles.summary}>{incident.summary}</Text>

            <Text style={styles.metaText}>{buildIncidentMeta(incident)}</Text>

            <Pressable
              onPress={() => {
                void Linking.openURL(incident.sourceUrl);
              }}
              style={styles.linkButton}
            >
              <Text style={styles.linkText}>View MMDA source</Text>
            </Pressable>
          </View>
        );
      })}

      {hiddenCount > 0 ? (
        <Text style={styles.hiddenCountText}>
          +{hiddenCount} more route-relevant update{hiddenCount === 1 ? '' : 's'}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    borderRadius: RADIUS.md,
    backgroundColor: '#F8FBFD',
    borderWidth: 1,
    borderColor: '#D7E7F1',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  sectionCardCompact: {
    marginTop: SPACING.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizes.medium,
    fontFamily: FONTS.bold,
    color: COLORS.midnight,
  },
  countChip: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs,
    backgroundColor: '#E7F1F7',
  },
  countChipText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: COLORS.primary,
  },
  metaNotice: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
    color: '#5D7286',
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
    color: '#5D7286',
  },
  incidentCard: {
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#E2EAF0',
    padding: SPACING.sm + 4,
    gap: SPACING.xs,
  },
  incidentTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  incidentType: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.bold,
    color: COLORS.midnight,
  },
  severityChip: {
    borderRadius: RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  severityChipText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.bold,
  },
  summary: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
    lineHeight: 18,
    color: COLORS.text,
  },
  metaText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.regular,
    color: '#5D7286',
  },
  linkButton: {
    alignSelf: 'flex-start',
    paddingTop: SPACING.xs,
  },
  linkText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.semibold,
    color: COLORS.primary,
  },
  hiddenCountText: {
    fontSize: TYPOGRAPHY.fontSizes.small,
    fontFamily: FONTS.medium,
    color: '#5D7286',
  },
});
