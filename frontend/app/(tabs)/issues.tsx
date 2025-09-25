import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  useColorScheme,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";

type CategoryKey = "pothole" | "garbage" | "streetlight";

export default function ReportIssueScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  const [media, setMedia] = useState<string | null>(null);
  const [address, setAddress] = useState<string>("Detecting location…");
  const [category, setCategory] = useState<CategoryKey>("garbage");
  const [description, setDescription] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setAddress("Location permission denied");
          return;
        }
        const loc = await Location.getCurrentPositionAsync({});
        const geo = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        if (geo.length) {
          const g = geo[0];
          const composed = [g.name, g.street, g.city, g.region]
            .filter(Boolean)
            .join(", ");
          setAddress(composed || "Current location detected");
        } else {
          setAddress("Current location detected");
        }
      } catch {
        setAddress("Could not detect location");
      }
    })();
  }, []);

  const capturePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Please allow camera access to take a photo.");
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      cameraType: ImagePicker.CameraType.back,
    });
    if (!res.canceled && res.assets?.length) {
      setMedia(res.assets[0].uri);
    }
  }, []);

  const CategoryPill = useCallback(
    ({ label, icon, value }: { label: string; icon: keyof typeof Ionicons.glyphMap; value: CategoryKey }) => {
      const selected = category === value;
      return (
        <TouchableOpacity
          onPress={() => setCategory(value)}
          activeOpacity={0.8}
          style={[styles.pill, selected && styles.pillSelected, isDark && { backgroundColor: selected ? "#1D2531" : "#111418" }]}
        >
          {selected ? (
            <LinearGradient
              colors={["#47C3FF", "#6C8CF5", "#E25C67"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          <Ionicons
            name={icon}
            size={18}
            color={selected ? "#fff" : isDark ? "#A7B0BB" : "#6B7280"}
          />
          <Text style={[styles.pillText, selected && { color: "#fff" }]}>{label}</Text>
        </TouchableOpacity>
      );
    },
    [category, isDark]
  );

  const canSubmit = useMemo(() => description.trim().length >= 10, [description]);

  const onSubmit = useCallback(() => {
    if (!canSubmit) {
      Alert.alert("Add more details", "Please provide at least 10 characters.");
      return;
    }
    console.log("Submitting report", { media, address, category, description });
    Alert.alert("Submitted", "Your report has been submitted.");
    setDescription("");
  }, [canSubmit, media, address, category, description]);

  return (
    <ScrollView style={[styles.container, isDark && { backgroundColor: "#0B0B0D" }]} contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={[styles.header, isDark && { borderBottomColor: "#20242F" }]}>
        <TouchableOpacity onPress={() => router.replace("/(tabs)")} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color={isDark ? "#E6EAF2" : "#111827"} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDark && { color: "#E6EAF2" }]}>Report an Issue</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={[styles.card, isDark && styles.cardDark]}>
        <TouchableOpacity style={styles.uploadBox} activeOpacity={0.8} onPress={capturePhoto}>
          {media ? (
            <Image source={{ uri: media }} style={styles.preview} contentFit="cover" />
          ) : (
            <>
              <Ionicons name="camera-outline" size={26} color="#6B7280" />
              <Text style={styles.uploadText}>Tap to Capture Photo</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={[styles.card, isDark && styles.cardDark]}>
        <Text style={[styles.sectionTitle, isDark && { color: "#E6EAF2" }]}>Location Details</Text>
        <View style={styles.row}>
          <Ionicons name="location-outline" size={18} color="#34D399" />
          <View style={{ flex: 1 }}>
            <Text style={styles.hint}>Auto-Detected:</Text>
            <Text style={[styles.addr, isDark && { color: "#C9D2DC" }]} numberOfLines={2}>{address}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => Alert.alert("Manual Location", "Coming soon.")} style={styles.linkBtn}>
          <Text style={styles.link}>Adjust Location Manually</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, isDark && styles.cardDark]}> 
        <Text style={[styles.sectionTitle, isDark && { color: "#E6EAF2" }]}>Issue Category</Text>
        <View style={styles.pillsRow}>
          <CategoryPill label="Pothole" icon="ellipse-outline" value="pothole" />
          <CategoryPill label="Garbage" icon="trash-outline" value="garbage" />
          <CategoryPill label="St. Light" icon="bulb-outline" value="streetlight" />
        </View>
      </View>

      <View style={[styles.card, isDark && styles.cardDark]}> 
        <Text style={[styles.sectionTitle, isDark && { color: "#E6EAF2" }]}>Description Box</Text>
        <TextInput
          placeholder="Please describe the issue in detail…"
          placeholderTextColor="#9CA3AF"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={6}
          style={[styles.input, isDark && { backgroundColor: "#0F1217", color: "#E6EAF2", borderColor: "#1F2430" }]}
        />
      </View>

      <TouchableOpacity onPress={onSubmit} activeOpacity={0.85} disabled={!canSubmit} style={{ marginHorizontal: 20 }}>
        <LinearGradient
          colors={canSubmit ? ["#47C3FF", "#6C8CF5", "#E25C67"] : ["#9CA3AF", "#9CA3AF"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.submit}
        >
          <Text style={styles.submitText}>Submit Report</Text>
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F6F8FB" },
  header: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#EEEFF3",
  },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  card: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardDark: { backgroundColor: "#14161A", borderColor: "#1F2430" },
  uploadBox: {
    height: 160,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 14,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    overflow: "hidden",
  },
  preview: { width: "100%", height: "100%" },
  uploadText: { color: "#6B7280", fontWeight: "600" },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 8 },
  row: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  hint: { color: "#6B7280", marginBottom: 2 },
  addr: { color: "#374151", fontWeight: "600" },
  linkBtn: { marginTop: 8 },
  link: { color: "#2563EB", fontWeight: "700" },
  pillsRow: { flexDirection: "row", gap: 10, marginTop: 2 },
  pill: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pillSelected: { borderColor: "transparent" },
  pillText: { fontWeight: "700", color: "#374151" },
  input: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    minHeight: 120,
    textAlignVertical: "top",
    backgroundColor: "#F9FAFB",
  },
  submit: { marginTop: 16, borderRadius: 24, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  submitText: { color: "#fff", fontWeight: "800" },
});
