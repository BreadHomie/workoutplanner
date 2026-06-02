import { useGetSession, useListSessions } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card } from "@/components/Card";
import { useColors } from "@/hooks/useColors";

function SessionDetails({ sessionId }: { sessionId: number }) {
  const colors = useColors();
  const { data: session, isLoading } = useGetSession(sessionId);

  if (isLoading) {
    return <ActivityIndicator style={styles.loader} color={colors.primary} />;
  }

  if (!session) return null;

  return (
    <View style={styles.detailsContainer}>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      {session.logs.map((log) => (
        <View key={log.id} style={styles.logRow}>
          <Text
            style={[styles.logExercise, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {log.exercise.name}
          </Text>
          <Text style={[styles.logStats, { color: colors.mutedForeground }]}>
            {log.sets}×{log.reps} {log.weightUsed ? `@ ${log.weightUsed}lbs` : "BW"}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: sessions, isLoading, refetch, isRefetching } = useListSessions();

  const [expandedId, setExpandedId] = useState<number | null>(null);

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top + 24 },
      ]}
    >
      <Text style={[styles.header, { color: colors.foreground }]}>History</Text>

      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
        refreshing={isRefetching}
        onRefresh={refetch}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="inbox" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No workouts logged yet.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.7} onPress={() => toggleExpand(item.id)}>
            <Card style={styles.card} padding={16}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={[styles.date, { color: colors.foreground }]}>
                    {format(new Date(item.createdAt), "MMM d, yyyy")}
                  </Text>
                  <Text style={[styles.split, { color: colors.primary }]}>
                    {item.splitType} {item.splitVariant !== "Standard" ? `+ ${item.splitVariant}` : ""}
                  </Text>
                </View>
                <View style={styles.countBadge}>
                  <Text style={[styles.countText, { color: colors.mutedForeground }]}>
                    {item.logCount} exercises
                  </Text>
                  <Feather
                    name={expandedId === item.id ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={colors.mutedForeground}
                  />
                </View>
              </View>

              {expandedId === item.id && <SessionDetails sessionId={item.id} />}
            </Card>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    marginBottom: 24,
    paddingHorizontal: 20,
    letterSpacing: -1,
  },
  card: {
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  date: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 4,
  },
  split: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
  },
  countBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  countText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  detailsContainer: {
    marginTop: 16,
  },
  divider: {
    height: 1,
    marginBottom: 12,
  },
  logRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  logExercise: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    marginRight: 16,
  },
  logStats: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  loader: {
    marginVertical: 16,
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 64,
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
});
