import { useGetProfile, useGetStatsSummary, useUpdateProfile, UpdateProfileInputDifficultyLevel, UpdateProfileInputPreferredSplit } from "@workspace/api-client-react";
import React, { useState, useEffect } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { Select } from "@/components/Select";
import { useColors } from "@/hooks/useColors";
import { useQueryClient } from "@tanstack/react-query";

const DIFFICULTY_OPTIONS = [
  { label: "Beginner", value: "Beginner" },
  { label: "Intermediate", value: "Intermediate" },
  { label: "Advanced", value: "Advanced" },
];

const SPLIT_OPTIONS = [
  { label: "Full Body", value: "Full Body" },
  { label: "Upper/Lower", value: "Upper/Lower" },
  { label: "Upper/Lower + Core", value: "Upper/Lower + Core" },
  { label: "Push/Pull/Legs", value: "Push/Pull/Legs" },
  { label: "Push/Pull/Legs + Core", value: "Push/Pull/Legs + Core" },
];

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  // We are skipping the hooks if they aren't fully implemented in mock openapi, but we'll try to use them as defined.
  // Actually, we'll just check if they return data.
  const { data: profile, isLoading: isProfileLoading } = useGetProfile();
  const { data: stats, isLoading: isStatsLoading } = useGetStatsSummary();
  const updateProfile = useUpdateProfile();

  const [difficulty, setDifficulty] = useState<string>("Intermediate");
  const [preferredSplit, setPreferredSplit] = useState<string>("Full Body");
  const [cadence, setCadence] = useState<string>("3");

  useEffect(() => {
    if (profile) {
      setDifficulty(profile.difficultyLevel);
      setPreferredSplit(profile.preferredSplit);
      setCadence(profile.targetCadence?.toString() || "3");
    }
  }, [profile]);

  const handleSave = () => {
    updateProfile.mutate(
      {
        data: {
          difficultyLevel: difficulty as UpdateProfileInputDifficultyLevel,
          preferredSplit: preferredSplit as UpdateProfileInputPreferredSplit,
          targetCadence: parseInt(cadence, 10),
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
          Alert.alert("Success", "Profile updated successfully");
        },
      }
    );
  };

  if (isProfileLoading || isStatsLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

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

      {stats && (
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{stats.totalSessions}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Sessions</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{stats.currentStreak}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Streak</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{stats.totalExercisesLogged}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Exercises</Text>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Settings</Text>

        <Select
          label="Difficulty Level"
          options={DIFFICULTY_OPTIONS}
          value={difficulty}
          onChange={setDifficulty}
        />

        <Select
          label="Preferred Split"
          options={SPLIT_OPTIONS}
          value={preferredSplit}
          onChange={setPreferredSplit}
        />

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>Workouts per week</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.input,
                color: colors.foreground,
                borderColor: colors.border,
              },
            ]}
            keyboardType="numeric"
            value={cadence}
            onChangeText={setCadence}
          />
        </View>

        <Button
          title="Save Settings"
          onPress={handleSave}
          loading={updateProfile.isPending}
          style={styles.saveBtn}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    marginBottom: 24,
    letterSpacing: -1,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 32,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderRadius: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 16,
  },
  saveBtn: {
    marginTop: 16,
  },
});
