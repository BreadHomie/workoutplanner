import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Card } from "./Card";
import { useColors } from "@/hooks/useColors";
import { ExerciseWithHistory } from "@workspace/api-client-react";

interface ExerciseCardProps {
  item: ExerciseWithHistory;
  index?: number;
}

export function ExerciseCard({ item, index }: ExerciseCardProps) {
  const colors = useColors();

  const getMuscleGroups = () => {
    const m = [];
    if (item.exercise.hitChest) m.push("Chest");
    if (item.exercise.hitBack) m.push("Back");
    if (item.exercise.hitLegs) m.push("Legs");
    if (item.exercise.hitShoulder) m.push("Shoulders");
    if (item.exercise.hitArm) m.push("Arms");
    if (item.exercise.hitCore) m.push("Core");
    return m.join(", ");
  };

  return (
    <Card style={styles.container} padding={12}>
      <View style={styles.header}>
        {index !== undefined && (
          <View style={[styles.badge, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.badgeText, { color: colors.foreground }]}>
              {index + 1}
            </Text>
          </View>
        )}
        <Text
          style={[styles.name, { color: colors.foreground }]}
          numberOfLines={1}
        >
          {item.exercise.name}
        </Text>
      </View>

      <Text style={[styles.muscles, { color: colors.mutedForeground }]}>
        {getMuscleGroups()}
      </Text>

      <View style={styles.footer}>
        <View style={styles.statBox}>
          <Feather name="layers" size={14} color={colors.primary} />
          <Text style={[styles.statText, { color: colors.foreground }]}>
            {item.suggestedSets} sets × {item.suggestedReps} reps
          </Text>
        </View>

        <View style={styles.statBox}>
          <Feather name="activity" size={14} color={colors.primary} />
          <Text style={[styles.statText, { color: colors.foreground }]}>
            {item.lastLog?.weightUsed
              ? `Last: ${item.lastLog.weightUsed} lbs`
              : "First time"}
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  badge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  name: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  muscles: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginBottom: 12,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
});
