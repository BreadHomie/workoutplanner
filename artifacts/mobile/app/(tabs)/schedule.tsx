import { useGetSchedule, useCreateScheduleEntry, useDeleteScheduleEntry, CreateScheduleEntryInputSplitType, CreateScheduleEntryInputSplitVariant } from "@workspace/api-client-react";
import { addDays, format, startOfWeek } from "date-fns";
import React, { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { Select } from "@/components/Select";
import { useColors } from "@/hooks/useColors";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";

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

export default function ScheduleScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { data: schedule, isLoading } = useGetSchedule();
  const createEntry = useCreateScheduleEntry();
  const deleteEntry = useDeleteScheduleEntry();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [split, setSplit] = useState<string>("Full Body");
  const [variant, setVariant] = useState<string>("Standard");

  const startOfCurrentWeek = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(startOfCurrentWeek, i));

  const handleAdd = () => {
    createEntry.mutate(
      {
        data: {
          scheduledDate: selectedDate.toISOString(),
          splitType: split as CreateScheduleEntryInputSplitType,
          splitVariant: variant as CreateScheduleEntryInputSplitVariant,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteEntry.mutate(
      { entryId: id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
        },
      }
    );
  };

  if (isLoading) {
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
      }}
    >
      <Text style={[styles.header, { color: colors.foreground, paddingHorizontal: 20 }]}>
        Schedule
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.calendarStrip}
      >
        {weekDays.map((date, i) => {
          const isSelected = format(date, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd");
          const isToday = format(date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

          return (
            <TouchableOpacity
              key={i}
              activeOpacity={0.7}
              onPress={() => setSelectedDate(date)}
              style={[
                styles.dayCard,
                {
                  backgroundColor: isSelected ? colors.primary : colors.card,
                  borderColor: isToday && !isSelected ? colors.primary : "transparent",
                  borderWidth: isToday && !isSelected ? 1 : 0,
                },
              ]}
            >
              <Text
                style={[
                  styles.dayName,
                  { color: isSelected ? colors.primaryForeground : colors.mutedForeground },
                ]}
              >
                {format(date, "E")}
              </Text>
              <Text
                style={[
                  styles.dayNumber,
                  { color: isSelected ? colors.primaryForeground : colors.foreground },
                ]}
              >
                {format(date, "d")}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.content}>
        <View style={styles.addSection}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Plan for {format(selectedDate, "MMM d")}
          </Text>

          <Select label="Split" options={SPLIT_OPTIONS} value={split} onChange={setSplit} />

          {showVariant && (
            <Select label="Variant" options={VARIANT_OPTIONS} value={variant} onChange={setVariant} />
          )}

          <Button
            title="Schedule Workout"
            icon="calendar"
            onPress={handleAdd}
            loading={createEntry.isPending}
            style={styles.addBtn}
          />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 32 }]}>
          Upcoming Workouts
        </Text>

        {schedule && schedule.length > 0 ? (
          schedule.map((entry) => (
            <View
              key={entry.id}
              style={[
                styles.entryCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View>
                <Text style={[styles.entryDate, { color: colors.foreground }]}>
                  {format(new Date(entry.scheduledDate), "EEEE, MMM d")}
                </Text>
                <Text style={[styles.entrySplit, { color: colors.primary }]}>
                  {entry.splitType} {entry.splitVariant !== "Standard" ? `+ ${entry.splitVariant}` : ""}
                </Text>
              </View>
              <TouchableOpacity onPress={() => handleDelete(entry.id)} style={styles.deleteBtn}>
                <Feather name="trash-2" size={20} color={colors.destructive} />
              </TouchableOpacity>
            </View>
          ))
        ) : (
          <Text style={{ color: colors.mutedForeground }}>No scheduled workouts.</Text>
        )}
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
  calendarStrip: {
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 32,
  },
  dayCard: {
    width: 60,
    height: 72,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  dayName: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 4,
  },
  dayNumber: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  content: {
    paddingHorizontal: 20,
  },
  addSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 16,
  },
  addBtn: {
    marginTop: 16,
  },
  entryCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  entryDate: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 4,
  },
  entrySplit: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  deleteBtn: {
    padding: 8,
  },
});
