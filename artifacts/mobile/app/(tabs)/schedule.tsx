import { useGetSchedule, useSaveScheduleBulk } from "@workspace/api-client-react";
import { format, startOfMonth, getDaysInMonth, getDay, isSameDay, isSameMonth, parseISO, addMonths, subMonths } from "date-fns";
import React, { useState, useEffect } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";

export default function ScheduleScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { data: schedule, isLoading } = useGetSchedule();
  const saveScheduleBulk = useSaveScheduleBulk();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());

  // Initialize selected dates when schedule data loads or month changes
  useEffect(() => {
    if (schedule) {
      const currentMonthStr = format(currentMonth, "yyyy-MM");
      const initialDates = new Set<string>();
      schedule.forEach((entry: any) => {
        const dateStr = format(new Date(entry.scheduledDate), "yyyy-MM-dd");
        if (dateStr.startsWith(currentMonthStr)) {
          initialDates.add(dateStr);
        }
      });
      setSelectedDates(initialDates);
    }
  }, [schedule, currentMonth]);

  const toggleDate = (dateStr: string) => {
    setSelectedDates(prev => {
      const next = new Set(prev);
      if (next.has(dateStr)) {
        next.delete(dateStr);
      } else {
        next.add(dateStr);
      }
      return next;
    });
  };

  const handleSave = () => {
    saveScheduleBulk.mutate(
      {
        data: {
          yearMonth: format(currentMonth, "yyyy-MM"),
          dates: [...selectedDates].sort()
        }
      },
      {
        onSuccess: () => {
          Alert.alert("Saved", "Schedule saved successfully");
          queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
        }
      }
    );
  };

  const generateCalendarGrid = () => {
    const monthStart = startOfMonth(currentMonth);
    const daysInMonth = getDaysInMonth(currentMonth);
    const startOffset = getDay(monthStart); // 0 = Sun
    
    const days = [];
    // Blank days before start
    for (let i = 0; i < startOffset; i++) {
      days.push(null);
    }
    // Actual days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i));
    }
    // Pad end
    while (days.length % 7 !== 0) {
      days.push(null);
    }
    return days;
  };

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const calendarDays = generateCalendarGrid();
  const weekDayHeaders = ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: 100 }}>
      <Text style={[styles.header, { color: colors.foreground, paddingHorizontal: 20 }]}>Schedule</Text>

      <View style={styles.monthNav}>
        <TouchableOpacity onPress={() => setCurrentMonth(prev => subMonths(prev, 1))} style={styles.navBtn}>
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.monthText, { color: colors.foreground }]}>{format(currentMonth, "MMMM yyyy")}</Text>
        <TouchableOpacity onPress={() => setCurrentMonth(prev => addMonths(prev, 1))} style={styles.navBtn}>
          <Feather name="chevron-right" size={24} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <View style={styles.calendarContainer}>
        <View style={styles.weekHeaders}>
          {weekDayHeaders.map((day, i) => (
            <Text key={i} style={[styles.weekDayText, { color: colors.mutedForeground }]}>{day}</Text>
          ))}
        </View>

        <View style={styles.daysGrid}>
          {calendarDays.map((date, i) => {
            if (!date) {
              return <View key={i} style={styles.dayCellEmpty} />;
            }

            const dateStr = format(date, "yyyy-MM-dd");
            const isSelected = selectedDates.has(dateStr);
            const isToday = format(date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
            const hasExisting = schedule?.some((entry: any) => format(new Date(entry.scheduledDate), "yyyy-MM-dd") === dateStr);

            return (
              <TouchableOpacity
                key={i}
                onPress={() => toggleDate(dateStr)}
                style={[
                  styles.dayCell,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.card,
                    borderColor: isToday && !isSelected ? colors.primary : "transparent",
                    borderWidth: isToday && !isSelected ? 1 : 0
                  }
                ]}
              >
                <Text style={[
                  styles.dayText, 
                  { color: isSelected ? colors.primaryForeground : colors.foreground }
                ]}>
                  {format(date, "d")}
                </Text>
                {hasExisting && !isSelected && (
                  <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={[styles.selectedText, { color: colors.mutedForeground }]}>
          {selectedDates.size} days selected
        </Text>
        
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.primary }]}
          onPress={handleSave}
          disabled={saveScheduleBulk.isPending}
        >
          {saveScheduleBulk.isPending ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>Save Plan</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { fontSize: 32, fontFamily: "Inter_700Bold", marginBottom: 24, letterSpacing: -1 },
  monthNav: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 24 },
  navBtn: { padding: 8 },
  monthText: { fontSize: 20, fontFamily: "Inter_600SemiBold" },
  calendarContainer: { paddingHorizontal: 12 },
  weekHeaders: { flexDirection: "row", justifyContent: "space-around", marginBottom: 12 },
  weekDayText: { width: 40, textAlign: "center", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  daysGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-around", gap: 8 },
  dayCellEmpty: { width: 40, height: 40 },
  dayCell: { width: 40, height: 40, borderRadius: 8, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  dayText: { fontSize: 16, fontFamily: "Inter_500Medium" },
  dot: { width: 4, height: 4, borderRadius: 2, position: "absolute", bottom: 4 },
  footer: { paddingHorizontal: 20, marginTop: 40, alignItems: "center" },
  selectedText: { fontSize: 14, fontFamily: "Inter_500Medium", marginBottom: 16 },
  saveBtn: { width: "100%", height: 56, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  saveBtnText: { fontSize: 18, fontFamily: "Inter_700Bold" },
});
