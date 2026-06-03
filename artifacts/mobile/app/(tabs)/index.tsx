import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useGenerateWorkoutPlan, useGetProfile, useUpdateProfile, UpdateProfileInputDifficultyLevel, UpdateProfileInputPreferredSplit, GeneratePlanInputPeriod, GeneratePlanInputDifficultyLevel } from "@workspace/api-client-react";
import { format, addDays, subDays } from "date-fns";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";

const DIFFICULTY_OPTIONS = ["Beginner", "Intermediate", "Advanced"];
const SPLIT_OPTIONS = ["Full Body", "Upper/Lower", "Upper/Lower + Core", "Push/Pull/Legs", "Push/Pull/Legs + Core"];
const DAYS_OPTIONS = [2, 3, 4, 5, 6];
const PERIOD_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" }
];

export default function GenerateScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  
  const { data: profile, isLoading: isProfileLoading } = useGetProfile();
  const updateProfile = useUpdateProfile();
  const generateWorkoutMut = useGenerateWorkoutPlan();

  const [difficulty, setDifficulty] = useState<string>("Intermediate");
  const [split, setSplit] = useState<string>("Full Body");
  const [cadence, setCadence] = useState<number>(3);
  const [period, setPeriod] = useState<string>("weekly");
  const [startDate, setStartDate] = useState<Date>(new Date());

  useEffect(() => {
    if (profile) {
      setDifficulty(profile.difficultyLevel);
      setSplit(profile.preferredSplit);
      if (profile.targetCadence) {
        setCadence(profile.targetCadence);
      }
    }
  }, [profile]);

  const handleGenerate = async () => {
    if (!profile) return;
    
    // Save settings to profile first
    await updateProfile.mutateAsync({
      data: {
        difficultyLevel: difficulty as UpdateProfileInputDifficultyLevel,
        preferredSplit: split as UpdateProfileInputPreferredSplit,
        targetCadence: cadence
      }
    });

    generateWorkoutMut.mutate(
      {
        data: {
          period: period as GeneratePlanInputPeriod,
          startDate: format(startDate, "yyyy-MM-dd"),
          difficultyLevel: difficulty as GeneratePlanInputDifficultyLevel,
          equipment: profile.equipment,
          preferredSplit: split,
          targetCadence: cadence
        }
      },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.push("/(tabs)/history");
        }
      }
    );
  };

  const getSubtextForPeriod = (p: string) => {
    if (p === "daily") return "1 day";
    if (p === "weekly") return `~${cadence} workouts`;
    if (p === "monthly") return `~${cadence * 4} workouts`;
    return "";
  };

  if (isProfileLoading) {
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
      <Text style={[styles.header, { color: colors.foreground }]}>Generate</Text>

      {/* SETTINGS SECTION */}
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Settings</Text>
        
        <Text style={[styles.label, { color: colors.foreground }]}>Difficulty Level</Text>
        <View style={[styles.segmentedControl, { backgroundColor: colors.secondary }]}>
          {DIFFICULTY_OPTIONS.map(d => (
            <TouchableOpacity
              key={d}
              onPress={() => setDifficulty(d)}
              style={[
                styles.segmentBtn,
                difficulty === d && { backgroundColor: colors.card, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 }
              ]}
            >
              <Text style={[styles.segmentText, { color: difficulty === d ? colors.foreground : colors.mutedForeground }]}>{d}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.foreground, marginTop: 16 }]}>Program</Text>
        <View style={styles.gridWrap}>
          {SPLIT_OPTIONS.map(s => (
            <TouchableOpacity
              key={s}
              onPress={() => setSplit(s)}
              style={[
                styles.gridBtn,
                { backgroundColor: split === s ? colors.primary : colors.secondary }
              ]}
            >
              <Text style={[styles.gridBtnText, { color: split === s ? colors.primaryForeground : colors.secondaryForeground }]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.foreground, marginTop: 16 }]}>Days per week</Text>
        <View style={styles.daysRow}>
          {DAYS_OPTIONS.map(d => (
            <TouchableOpacity
              key={d}
              onPress={() => setCadence(d)}
              style={[
                styles.dayChip,
                { backgroundColor: cadence === d ? colors.primary : colors.secondary }
              ]}
            >
              <Text style={[styles.dayChipText, { color: cadence === d ? colors.primaryForeground : colors.secondaryForeground }]}>{d}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* PERIOD SECTION */}
      <View style={[styles.card, { backgroundColor: colors.card, marginTop: 16 }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Plan Duration</Text>
        <View style={styles.periodRow}>
          {PERIOD_OPTIONS.map(p => {
            const isSelected = period === p.value;
            return (
              <TouchableOpacity
                key={p.value}
                onPress={() => setPeriod(p.value)}
                style={[
                  styles.periodCard,
                  { 
                    backgroundColor: isSelected ? 'transparent' : colors.card,
                    borderColor: isSelected ? colors.primary : colors.border,
                    borderWidth: isSelected ? 2 : 1
                  }
                ]}
              >
                <Text style={[styles.periodLabel, { color: isSelected ? colors.primary : colors.foreground }]}>{p.label}</Text>
                <Text style={[styles.periodSubtext, { color: colors.mutedForeground }]}>{getSubtextForPeriod(p.value)}</Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>

      {/* START DATE */}
      <View style={[styles.card, { backgroundColor: colors.card, marginTop: 16 }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Start Date</Text>
        <View style={styles.dateRow}>
          <TouchableOpacity
            style={[styles.dateArrow, { backgroundColor: colors.secondary }]}
            onPress={() => setStartDate(prev => subDays(prev, 1))}
          >
            <Feather name="chevron-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <View style={[styles.dateLabelBox, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.dateLabelText, { color: colors.foreground }]}>
              {format(startDate, "EEE, MMM d, yyyy")}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.dateArrow, { backgroundColor: colors.secondary }]}
            onPress={() => setStartDate(prev => addDays(prev, 1))}
          >
            <Feather name="chevron-right" size={20} color={colors.foreground} />
          </TouchableOpacity>
        </View>
      </View>

      {/* GENERATE BUTTON */}
      <TouchableOpacity
        style={[styles.generateBtn, { backgroundColor: colors.primary, marginTop: 32 }]}
        onPress={handleGenerate}
        disabled={generateWorkoutMut.isPending}
      >
        {generateWorkoutMut.isPending ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <>
            <Feather name="zap" size={20} color={colors.primaryForeground} style={{ marginRight: 8 }} />
            <Text style={[styles.generateBtnText, { color: colors.primaryForeground }]}>Generate Plan</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { fontSize: 32, fontFamily: "Inter_700Bold", marginBottom: 24, letterSpacing: -1 },
  card: { padding: 20, borderRadius: 16 },
  cardTitle: { fontSize: 20, fontFamily: "Inter_600SemiBold", marginBottom: 16 },
  label: { fontSize: 14, fontFamily: "Inter_500Medium", marginBottom: 8 },
  segmentedControl: { flexDirection: "row", padding: 4, borderRadius: 12 },
  segmentBtn: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 8 },
  segmentText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  gridWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  gridBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  gridBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  daysRow: { flexDirection: "row", gap: 12 },
  dayChip: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  dayChipText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  periodRow: { flexDirection: "row", gap: 12 },
  periodCard: { flex: 1, padding: 12, borderRadius: 12, alignItems: "center" },
  periodLabel: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  periodSubtext: { fontSize: 12, fontFamily: "Inter_400Regular" },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dateArrow: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  dateLabelBox: { flex: 1, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  dateLabelText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  generateBtn: { height: 64, borderRadius: 16, flexDirection: "row", justifyContent: "center", alignItems: "center" },
  generateBtnText: { fontSize: 18, fontFamily: "Inter_700Bold" },
});
