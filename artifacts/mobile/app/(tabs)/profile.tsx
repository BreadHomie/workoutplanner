import { useGetProfile, useGetStatsSummary } from "@workspace/api-client-react";
import React from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const { data: profile, isLoading: isProfileLoading } = useGetProfile();
  const { data: stats, isLoading: isStatsLoading } = useGetStatsSummary();

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

  const getLevelLabel = (level: number) => {
    if (level <= 3) return "Beginner Lifter";
    if (level <= 7) return "Intermediate Lifter";
    if (level <= 12) return "Advanced Lifter";
    return "Elite Lifter";
  };

  const currentLevelXp = profile.totalXp % 100;
  const progressWidth = `${(currentLevelXp / 100) * 100}%`;

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

      {/* XP/Level Card */}
      <View style={[styles.xpCard, { backgroundColor: colors.card }]}>
        <Text style={[styles.levelText, { color: colors.primary }]}>Level {profile.level}</Text>
        <Text style={[styles.levelLabel, { color: colors.foreground }]}>{getLevelLabel(profile.level)}</Text>
        
        <View style={[styles.progressBarBg, { backgroundColor: colors.muted }]}>
          <View style={[styles.progressBarFill, { backgroundColor: colors.primary, width: progressWidth as any }]} />
        </View>
        <Text style={[styles.xpText, { color: colors.mutedForeground }]}>{currentLevelXp} / 100 XP to next level</Text>

        <View style={styles.coinsRow}>
          <Feather name="star" size={16} color={colors.primary} />
          <Text style={[styles.coinsText, { color: colors.mutedForeground }]}>{profile.totalCoins} coins</Text>
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
            <Circle cx="60" cy="60" r={radius} stroke={colors.secondary} strokeWidth={strokeWidth} fill="transparent" />
            <Circle
              cx="60" cy="60" r={radius} stroke={colors.primary} strokeWidth={strokeWidth} fill="transparent"
              strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" transform="rotate(-90 60 60)"
            />
          </Svg>
          <View style={styles.ringTextContainer}>
            <Text style={[styles.ringCount, { color: colors.foreground }]}>{thisWeekCount}</Text>
            <Text style={[styles.ringTarget, { color: colors.mutedForeground }]}>/ {targetCadence}</Text>
          </View>
        </View>
        <Text style={[styles.ringLabel, { color: colors.mutedForeground }]}>This Week</Text>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { fontSize: 32, fontFamily: "Inter_700Bold", marginBottom: 24, letterSpacing: -1 },
  
  xpCard: { padding: 20, borderRadius: 16, marginBottom: 32 },
  levelText: { fontSize: 40, fontFamily: "Inter_700Bold", marginBottom: 4 },
  levelLabel: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 24 },
  progressBarBg: { height: 8, borderRadius: 4, width: "100%", marginBottom: 8, overflow: "hidden" },
  progressBarFill: { height: "100%", borderRadius: 4 },
  xpText: { fontSize: 14, fontFamily: "Inter_500Medium", marginBottom: 16 },
  coinsRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  coinsText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  statsGrid: { flexDirection: "row", gap: 12, marginBottom: 32 },
  statCard: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  statValue: { fontSize: 24, fontFamily: "Inter_700Bold", marginBottom: 4 },
  statLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },

  ringContainer: { alignItems: "center", marginBottom: 32 },
  svgWrapper: { width: 120, height: 120, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  ringTextContainer: { position: "absolute", alignItems: "center", justifyContent: "center" },
  ringCount: { fontSize: 32, fontFamily: "Inter_700Bold", lineHeight: 36 },
  ringTarget: { fontSize: 12, fontFamily: "Inter_500Medium" },
  ringLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
