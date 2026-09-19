import { StyleSheet, Text, View } from 'react-native';
import type { Sample, SampleStatus } from '../api/types';
import { colors, spacing } from '../theme';

// Same shape as admin-web/customer-web's SampleProgress — collapses the
// AT_CENTER branch (IN_HOUSE_PROCESSING / ROUTED_TO_PARTNER_LAB) into one
// visual step, courier-tracking style.
const STATUS_TO_STEP: Record<SampleStatus, number> = {
  BOOKED: 0,
  COLLECTED: 1,
  IN_TRANSIT_TO_CENTER: 2,
  AT_CENTER: 3,
  IN_HOUSE_PROCESSING: 4,
  ROUTED_TO_PARTNER_LAB: 4,
  RESULT_READY: 5,
  DELIVERED: 6,
};

function branchLabel(sample: Sample): string {
  if (sample.status === 'ROUTED_TO_PARTNER_LAB') return 'Partner lab';
  if (sample.status === 'IN_HOUSE_PROCESSING') return 'In-house';
  if (sample.status === 'RESULT_READY' || sample.status === 'DELIVERED') {
    return sample.routedToPartnerLabId ? 'Partner lab' : 'In-house';
  }
  return 'Processing';
}

function steps(sample: Sample): string[] {
  return ['Booked', 'Collected', 'In transit', 'At center', branchLabel(sample), 'Result ready', 'Delivered'];
}

export function SampleProgress({ sample }: { sample: Sample }) {
  const current = STATUS_TO_STEP[sample.status];
  const items = steps(sample);

  return (
    <View>
      {items.map((label, i) => {
        const state = i < current ? 'done' : i === current ? 'active' : 'todo';
        const isLast = i === items.length - 1;
        return (
          <View style={styles.row} key={label + i}>
            <View style={styles.railColumn}>
              <View
                style={[
                  styles.dot,
                  state === 'done' && styles.dotDone,
                  state === 'active' && styles.dotActive,
                ]}
              />
              {!isLast && <View style={[styles.connector, state === 'done' && styles.connectorDone]} />}
            </View>
            <Text style={[styles.label, state === 'todo' && styles.labelTodo]}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const DOT_SIZE = 14;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  railColumn: { alignItems: 'center', width: DOT_SIZE + spacing.sm },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: colors.greySoft,
    borderWidth: 2,
    borderColor: colors.border,
  },
  dotDone: { backgroundColor: colors.accent, borderColor: colors.accent },
  dotActive: { backgroundColor: colors.card, borderColor: colors.accent, borderWidth: 3 },
  connector: { width: 2, flexGrow: 1, minHeight: 22, backgroundColor: colors.border, marginVertical: 2 },
  connectorDone: { backgroundColor: colors.accent },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
    paddingBottom: spacing.lg,
    paddingLeft: spacing.sm,
  },
  labelTodo: { color: colors.inkFaint, fontWeight: '500' },
});
