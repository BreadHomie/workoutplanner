import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  GenerateWorkoutInputDifficultyLevel,
  GeneratedWorkout,
  useGenerateWorkout,
  useGetProfile,
} from "@workspace/api-client-react";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { ExerciseCard } from "@/components/ExerciseCard";
import { Select } from "@/components/Select";
import { useColors } from "@/hooks/useColors";

const SPLIT_OPTIONS = [
  { label: "Full Body", value: "Full Body" },
  { label: "Upper", value: "Upper" },
  { label: "Lower", value: "Lower" },
  { label: "Push", value: "Push" },
  { label: "Pull", value: "Pull" },
  { label: "Legs", value: "Legs" },
];

const VARIANT_OPTIONS = [
  { label: "Standard", value: "Standard" },
  { label: "Core", value: "Core" },
];

export default function TodayScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: profile, isLoading: isProfileLoading } = useGetProfile();
  const generateWorkoutMut = useGenerateWorkout();

  const [split, setSplit] = useState<string>("Full Body");
  const [variant, setVariant] = useState<string>("Standard");
  const [generatedWorkout, setGeneratedWorkout] = useState<GeneratedWorkout | null>(null);

  useEffect(() => {
    AsyncStorage.getItem("lastGeneratedWorkout").then((data) => {
      if (data) {
        try {
          const parsed = JSON.parse(data);
          const isToday =
            new Date(parsed.timestamp).toDateString() === new Date().toDateString();
          if (isToday && parsed.workout) {
            setGeneratedWorkout(parsed.workout);
          }
        } catch (e) {}
      }
    });
  }, []);

  const handleGenerate = () => {
    if (!profile) return;
    const now = new Date();
    generateWorkoutMut.mutate(
      {
        data: {
          splitType: split as any,
          splitVariant: variant as any,
          difficultyLevel: profile.difficultyLevel as GenerateWorkoutInputDifficultyLevel,
          equipment: profile.equipment,
          scheduledDate: now.toISOString(),
        },
      },
      {
        onSuccess: (data) => {
          setGeneratedWorkout(data);
          AsyncStorage.setItem(
            "lastGeneratedWorkout",
            JSON.stringify({ workout: data, timestamp: now.toISOString() })
          );
        },
      }
    );
  };

  const handleStartWorkout = () => {
    if (!generatedWorkout) return;
    // Just navigate to the log-workout screen and pass the generated workout via params or context
    // Actually passing complex objects in router params is not good, we'll stringify it or use AsyncStorage
    AsyncStorage.setItem("activeWorkout", JSON.stringify(generatedWorkout)).then(() => {
      router.push("/log-workout");
    });
  };

  if (isProfileLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const showVariant = split === "Lower" || split === "Legs";

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 24,
        paddingBottom: 100,
        paddingHorizontal: 20,
      }}
    >
      <Text style={[styles.header, { color: colors.foreground }]}>Today's Session</Text>

      {!generatedWorkout ? (
        <View style={styles.generatorSection}>
          <Text style={[styles.subHeader, { color: colors.mutedForeground }]}>
            Configure your session parameters to generate a custom training block.
          </Text>

          <Select
            label="Target Split"
            options={SPLIT_OPTIONS}
            value={split}
            onChange={setSplit}
          />

          {showVariant && (
            <Select
              label="Variant"
              options={VARIANT_OPTIONS}
              value={variant}
              onChange={setVariant}
            />
          )}

          <Button
            title="Generate Workout"
            icon="zap"
            onPress={handleGenerate}
            loading={generateWorkoutMut.isPending}
            style={styles.generateBtn}
          />
        </View>
      ) : (
        <View style={styles.workoutSection}>
          <View style={styles.workoutHeader}>
            <View>
              <Text style={[styles.workoutSplit, { color: colors.primary }]}>
                {generatedWorkout.splitType} {generatedWorkout.splitVariant !== "Standard" ? `+ ${generatedWorkout.splitVariant}` : ""}
              </Text>
              <Text style={[styles.workoutTitle, { color: colors.foreground }]}>
                Training Block
              </Text>
            </View>
            <Button
              title="Reset"
              variant="outline"
              size="sm"
              onPress={() => {
                setGeneratedWorkout(null);
                AsyncStorage.removeItem("lastGeneratedWorkout");
              }}
            />
          </View>

          <View style={styles.compoundSection}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Primary Movement
            </Text>
            <ExerciseCard item={generatedWorkout.compound} />
          </View>

          {generatedWorkout.circuits.map((circuit) => (
            <View key={circuit.circuitNumber} style={styles.circuitSection}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                Circuit {circuit.circuitNumber}
              </Text>
              {circuit.exercises.map((ex, i) => (
                <ExerciseCard key={i} item={ex} index={i} />
              ))}
            </View>
          ))}

          <Button
            title="Start Workout"
            icon="play"
            size="lg"
            onPress={handleStartWorkout}
            style={styles.startBtn}
          />
        </View>
      )}
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
  subHeader: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    marginBottom: 24,
    lineHeight: 24,
  },
  generatorSection: {
    marginTop: 8,
  },
  generateBtn: {
    marginTop: 16,
  },
  workoutSection: {
    marginTop: 8,
  },
  workoutHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 32,
  },
  workoutSplit: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  workoutTitle: {
    fontSize: 24,
    fontFamily: "Inter_600SemiBold",
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 16,
  },
  compoundSection: {
    marginBottom: 32,
  },
  circuitSection: {
    marginBottom: 32,
  },
  startBtn: {
    marginTop: 16,
  },
});
