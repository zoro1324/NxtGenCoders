import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useAppTheme } from "../../theme/ThemeProvider";

export default function SettingsScreen() {
  const { mode, isDark, setMode } = useAppTheme();
  return (
    <View style={[styles.container, { backgroundColor: isDark ? "#0B0B0D" : "#F6F8FB" }]}>
      <View style={[styles.card, isDark && { backgroundColor: "#14161A", borderColor: "#1F2430" }]}>
        <Text style={[styles.title, { color: isDark ? "#E6EAF2" : "#111827" }]}>Theme</Text>
        <View style={styles.row}>
          {(["light", "dark", "system"] as const).map((m) => (
            <TouchableOpacity
              key={m}
              onPress={() => setMode(m)}
              style={[
                styles.option,
                isDark && { backgroundColor: "#0F1217", borderColor: "#1F2430" },
                mode === m && (isDark ? styles.optionActiveDark : styles.optionActive),
              ]}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.optionText,
                  isDark && { color: "#C9D2DC" },
                  mode === m && (isDark ? styles.optionTextActiveDark : styles.optionTextActive),
                ]}
              >
                {m[0].toUpperCase() + m.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
  },
  title: { fontSize: 16, fontWeight: "700", marginBottom: 10 },
  row: { flexDirection: "row", gap: 10 },
  option: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F7F9FC",
  },
  optionActive: { backgroundColor: "#2563EB", borderColor: "transparent" },
  optionText: { color: "#111827", fontWeight: "700" },
  optionTextActive: { color: "#fff" },
  optionActiveDark: { backgroundColor: "#2563EB", borderColor: "transparent" },
  optionTextActiveDark: { color: "#fff" },
});
