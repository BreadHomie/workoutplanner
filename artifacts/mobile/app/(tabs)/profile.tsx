import {
  useGetPersonalRecords, useGetProfile, useGetStatsSummary,
  useResetWorkouts, useResetAll
} from "@workspace/api-client-react";
import React, { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";

const MUSCLE_GROUP_ORDER = ["Chest", "Back", "Legs", "Core", "Arms", "Shoulders", "Other"];

const MUSCLE_ICONS: Record<string, string> = {
  Chest: "crosshair",
  Back: "activity",
  Legs: "anchor",
  Core: "wind",
  Arms: "zap",
  Shoulders: "sun",
  Other: "circle",
};

function getLevelLabel(level: number) {
  if (level <= 3) return "Beginner Lifter";
  if (level <= 7) return "Intermediate Lifter";
  if (level <= 12) return "Advanced Lifter";
  return "Elite Lifter";
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { data: profile, isLoading: isProfileLoading } = useGetProfile();
  const { data: stats, isLoading: isStatsLoading } = useGetStatsSummary();
  const { data: personalRecords, isLoading: isPRLoading } = useGetPersonalRecords();
  const resetWorkoutsMut = useResetWorkouts();
  const resetAllMut = useResetAll();

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(MUSCLE_GROUP_ORDER));

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  const handleResetWorkouts = () => {
    Alert.alert(
      "Reset Workouts",
      "This will delete all generated workout plans. Your profile, level, and settings will be kept.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            resetWorkoutsMut.mutate(undefined, {
              onSuccess: () => {
                queryClient.clear();
                Alert.alert("Done", "All workouts have been reset.");
              },
            });
          },
        },
      ]
    );
  };

  const handleHardReset = () => {
    Alert.alert(
      "Hard Reset",
      "This will delete ALL workouts and reset your profile, level, and coins to zero. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Hard Reset",
          style: "destructive",
          onPress: () => {
            resetAllMut.mutate(undefined, {
              onSuccess: () => {
                queryClient.clear();
                Alert.alert("Done", "Everything has been reset.");
              },
            });
          },
        },
      ]
    );
  };

  if (isProfileLoading || isStatsLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!profile) return null;

  const targetCadence = profile.targetCadence || 3;
  const thisWeekCount = stats?.thisWeekCount || 0;
  const radius = 50;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(thisWeekCount / targetCadence, 1);
  const strokeDashoffset = circumference - progress * circumference;

  const currentLevelXp = profile.totalXp % 100;

  const groupedRecords: Record<string, typeof personalRecords> = {};
  if (personalRecords) {
    for (const pr of personalRecords) {
      const g = pr.muscleGroup || "Other";
      if (!groupedRecords[g]) groupedRecords[g] = [];
      groupedRecords[g]!.push(pr);
    }
    for (const g of Object.keys(groupedRecords)) {
      groupedRecords[g]!.sort((a, b) => (b.bestWeight ?? 0) - (a.bestWeight ?? 0));
    }
  }

  const hasAnyRecords = personalRecords && personalRecords.length > 0;
  const isResetting = resetWorkoutsMut.isPending || resetAllMut.isPending;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 24,
        paddingBottom: 100,
        paddingHorizontal: 20,
      }}
    >
      <Text style={[styles.header, { color: colors.foreground }]}>Profile</Text>

      {/* XP / Level Card */}
      <View style={[styles.xpCard, { backgroundColor: colors.card }]}>
        <View style={styles.xpTopRow}>
          <View>
            <Text style={[styles.levelText, { color: colors.primary }]}>Level {profile.level}</Text>
            <Text style={[styles.levelLabel, { color: colors.foreground }]}>{getLevelLabel(profile.level)}</Text>
          </View>
          <View style={[styles.coinsBadge, { backgroundColor: colors.muted }]}>
            <Feather name="star" size={14} color={colors.primary} />
            <Text style={[styles.coinsText, { color: colors.primary }]}>{profile.totalCoins}</Text>
          </View>
        </View>

        <View style={[styles.progressBarBg, { backgroundColor: colors.muted }]}>
          <View
            style={[
              styles.progressBarFill,
              { backgroundColor: colors.primary, width: `${(currentLevelXp / 100) * 100}%` as any },
            ]}
          />
        </View>
        <View style={styles.xpRow}>
          <Text style={[styles.xpMuted, { color: colors.mutedForeground }]}>{currentLevelXp} XP</Text>
          <Text style={[styles.xpMuted, { color: colors.mutedForeground }]}>100 XP</Text>
        </View>
      </View>

      {/* Stats Grid */}
      {stats && (
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{stats.totalSessions}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Sessions</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{stats.completedSessions}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Completed</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{stats.totalExercisesLogged}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Exercises</Text>
          </View>
        </View>
      )}

      {/* Weekly Ring */}
      <View style={styles.ringContainer}>
        <View style={styles.svgWrapper}>
          <Svg width="120" height="120" viewBox="0 0 120 120">
            <Circle
              cx="60" cy="60" r={radius}
              stroke={colors.secondary} strokeWidth={strokeWidth} fill="transparent"
            />
            <Circle
              cx="60" cy="60" r={radius}
              stroke={colors.primary} strokeWidth={strokeWidth} fill="transparent"
              strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
              strokeLinecap="round" transform="rotate(-90 60 60)"
            />
          </Svg>
          <View style={styles.ringTextContainer}>
            <Text style={[styles.ringCount, { color: colors.foreground }]}>{thisWeekCount}</Text>
            <Text style={[styles.ringTarget, { color: colors.mutedForeground }]}>/ {targetCadence}</Text>
          </View>
        </View>
        <Text style={[styles.ringLabel, { color: colors.mutedForeground }]}>This Week</Text>
      </View>

      {/* Personal Records */}
      <View style={styles.prSection}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Personal Records</Text>

        {isPRLoading && (
          <View style={styles.prLoading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}

        {!isPRLoading && !hasAnyRecords && (
          <View style={[styles.prEmpty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="award" size={28} color={colors.mutedForeground} />
            <Text style={[styles.prEmptyText, { color: colors.mutedForeground }]}>
              Log workouts to see your personal records
            </Text>
          </View>
        )}

        {!isPRLoading && hasAnyRecords &&
          MUSCLE_GROUP_ORDER.filter((g) => groupedRecords[g] && groupedRecords[g]!.length > 0).map((group) => {
            const isExpanded = expandedGroups.has(group);
            const records = groupedRecords[group]!;
            const iconName = (MUSCLE_ICONS[group] ?? "circle") as any;

            return (
              <View key={group} style={[styles.groupCard, { backgroundColor: colors.card }]}>
                <TouchableOpacity
                  style={styles.groupHeader}
                  onPress={() => toggleGroup(group)}
                  activeOpacity={0.7}
                >
                  <View style={styles.groupHeaderLeft}>
                    <View style={[styles.groupIconBox, { backgroundColor: colors.muted }]}>
                      <Feather name={iconName} size={14} color={colors.primary} />
                    </View>
                    <Text style={[styles.groupTitle, { color: colors.foreground }]}>{group}</Text>
                    <View style={[styles.countBubble, { backgroundColor: colors.muted }]}>
                      <Text style={[styles.countBubbleText, { color: colors.mutedForeground }]}>
                        {records.length}
                      </Text>
                    </View>
                  </View>
                  <Feather
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={colors.mutedForeground}
                  />
                </TouchableOpacity>

                {isExpanded && (
                  <View style={[styles.groupBody, { borderTopColor: colors.border }]}>
                    {records.map((pr, idx) => (
                      <View
                        key={pr.exerciseId}
                        style={[
                          styles.prRow,
                          idx < records.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                        ]}
                      >
                        <View style={styles.prRowLeft}>
                          <Text style={[styles.prRank, { color: idx === 0 ? colors.primary : colors.mutedForeground }]}>
                            #{idx + 1}
                          </Text>
                          <Text style={[styles.prName, { color: colors.foreground }]} numberOfLines={1}>
                            {pr.exerciseName}
                          </Text>
                        </View>
                        <View style={[styles.prBadge, { backgroundColor: idx === 0 ? colors.primary : colors.muted }]}>
                          <Text
                            style={[
                              styles.prBadgeText,
                              { color: idx === 0 ? colors.primaryForeground : colors.foreground },
                            ]}
                          >
                            {pr.bestWeight} lbs
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
      </View>

      {/* Exercise Library */}
      <TouchableOpacity
        style={[styles.libBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => router.push("/exercise-library")}
      >
        <View style={[styles.libIconBox, { backgroundColor: colors.muted }]}>
          <Feather name="book-open" size={16} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.libBtnTitle, { color: colors.foreground }]}>Exercise Library</Text>
          <Text style={[styles.libBtnSub, { color: colors.mutedForeground }]}>
            Browse all exercises · Add custom exercises
          </Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      </TouchableOpacity>

      {/* Danger Zone */}
      <View style={[styles.dangerZone, { borderColor: colors.border }]}>
        <Text style={[styles.dangerTitle, { color: colors.mutedForeground }]}>Data Management</Text>

        <TouchableOpacity
          style={[styles.resetBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
          onPress={handleResetWorkouts}
          disabled={isResetting}
        >
          {resetWorkoutsMut.isPending ? (
            <ActivityIndicator size="small" color={colors.foreground} />
          ) : (
            <>
              <Feather name="refresh-ccw" size={16} color={colors.foreground} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.resetBtnTitle, { color: colors.foreground }]}>Reset Workouts</Text>
                <Text style={[styles.resetBtnSub, { color: colors.mutedForeground }]}>
                  Delete all plans · keeps level & settings
                </Text>
              </View>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.resetBtn, { backgroundColor: "#ef444415", borderColor: "#ef444430" }]}
          onPress={handleHardReset}
          disabled={isResetting}
        >
          {resetAllMut.isPending ? (
            <ActivityIndicator size="small" color="#ef4444" />
          ) : (
            <>
              <Feather name="alert-triangle" size={16} color="#ef4444" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.resetBtnTitle, { color: "#ef4444" }]}>Hard Reset</Text>
                <Text style={[styles.resetBtnSub, { color: "#ef444499" }]}>
                  Wipe everything · resets level to 1
                </Text>
              </View>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { fontSize: 32, fontFamily: "Inter_700Bold", marginBottom: 24, letterSpacing: -1 },

  xpCard: { padding: 20, borderRadius: 16, marginBottom: 24 },
  xpTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  levelText: { fontSize: 36, fontFamily: "Inter_700Bold", lineHeight: 40 },
  levelLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  coinsBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100 },
  coinsText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  progressBarBg: { height: 8, borderRadius: 4, width: "100%", marginBottom: 6, overflow: "hidden" },
  progressBarFill: { height: "100%", borderRadius: 4 },
  xpRow: { flexDirection: "row", justifyContent: "space-between" },
  xpMuted: { fontSize: 12, fontFamily: "Inter_500Medium" },

  statsGrid: { flexDirection: "row", gap: 12, marginBottom: 24 },
  statCard: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  statValue: { fontSize: 24, fontFamily: "Inter_700Bold", marginBottom: 4 },
  statLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },

  ringContainer: { alignItems: "center", marginBottom: 32 },
  svgWrapper: { width: 120, height: 120, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  ringTextContainer: { position: "absolute", alignItems: "center", justifyContent: "center" },
  ringCount: { fontSize: 32, fontFamily: "Inter_700Bold", lineHeight: 36 },
  ringTarget: { fontSize: 12, fontFamily: "Inter_500Medium" },
  ringLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  prSection: { gap: 12 },
  sectionTitle: { fontSize: 22, fontFamily: "Inter_700Bold", marginBottom: 4, letterSpacing: -0.5 },
  prLoading: { paddingVertical: 32, alignItems: "center" },
  prEmpty: { borderWidth: 1, borderRadius: 16, padding: 32, alignItems: "center", gap: 12 },
  prEmptyText: { fontSize: 14, fontFamily: "Inter_500Medium", textAlign: "center", lineHeight: 20 },

  groupCard: { borderRadius: 16, overflow: "hidden" },
  groupHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
  },
  groupHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  groupIconBox: { width: 28, height: 28, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  groupTitle: { fontSize: 16, fontFamily: "Inter_700Bold", flex: 1 },
  countBubble: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100 },
  countBubbleText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  groupBody: { borderTopWidth: 1, paddingHorizontal: 16 },
  prRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12 },
  prRowLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, marginRight: 12 },
  prRank: { fontSize: 13, fontFamily: "Inter_700Bold", width: 24 },
  prName: { fontSize: 14, fontFamily: "Inter_500Medium", flex: 1 },
  prBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  prBadgeText: { fontSize: 13, fontFamily: "Inter_700Bold" },

  libBtn: {
    flexDirection: "row", alignItems: "center", gap: 14,
    padding: 16, borderRadius: 14, borderWidth: 1, marginTop: 32,
  },
  libIconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  libBtnTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  libBtnSub: { fontSize: 12, fontFamily: "Inter_400Regular" },

  dangerZone: { marginTop: 16, borderTopWidth: 1, paddingTop: 24, gap: 12 },
  dangerTitle: { fontSize: 12, fontFamily: "Inter_700Bold", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 },
  resetBtn: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 16, borderRadius: 14, borderWidth: 1,
  },
  resetBtnTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  resetBtnSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
});
