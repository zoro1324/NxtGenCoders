import { Image } from "expo-image";
import { Link } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  useColorScheme,
  Platform,
  Linking,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../theme/ThemeProvider";

type Report = {
  id: number;
  name: string;
  time?: string;
  title: string;
  location?: string;
  photo?: string;
  image_url?: string;
  body: string;
  comments: number;
  likes: number;
  shares: number;
  created_at?: string;
  coords?: { lat: number; lng: number };
};

export default function HomeScreen() {
  const { isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // removed unused usedBase to avoid lint warning
  const [triedBases, setTriedBases] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const apiCandidates = useMemo(() => {
    const list: string[] = [];
    const publicEnv = (typeof process !== "undefined" && (process as any)?.env?.EXPO_PUBLIC_API_URL)
      ? (process as any).env.EXPO_PUBLIC_API_URL as string
      : undefined;
    if (publicEnv) return [publicEnv.replace(/\/$/, "")];

    const hostUri: string | undefined = (Constants as any)?.expoConfig?.hostUri || (Constants as any)?.debuggerHost;
    const host = typeof hostUri === "string" ? hostUri.split(":" )[0] : undefined;
    const isIPv4 = host ? /^\d+\.\d+\.\d+\.\d+$/.test(host) : false;

    if (Platform.OS === "android") {
      // Prefer emulator alias first
      list.push("http://10.0.2.2:8000");
      if (isIPv4) list.push(`http://${host}:8000`);
      list.push("http://127.0.0.1:8000");
    } else {
      if (isIPv4) list.push(`http://${host}:8000`);
      list.push("http://127.0.0.1:8000");
    }
    return list;
  }, []);

  const fetchReports = useCallback(async (showSpinner: boolean) => {
    let cancelled = false;
    try {
      if (showSpinner) setLoading(true);
      setError(null);
      let lastErr: any = null;
      const attempts: string[] = [];
      for (const base of apiCandidates) {
        attempts.push(base);
        try {
          const url = `${base}/api/reports/`;
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          const items: Report[] = (data.results ?? data) as Report[];
          if (!cancelled) {
            setReports(items);
            setError(null);
            setTriedBases(attempts);
          }
          return; // success
        } catch (e) {
          lastErr = e;
          // try next candidate
        }
      }
      // if all candidates failed
      if (!cancelled) {
        setError(lastErr?.message ?? "Failed to load");
        setTriedBases(attempts);
      }
    } catch (e: any) {
      if (!cancelled) setError(e?.message ?? "Failed to load");
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [apiCandidates]);

  useEffect(() => {
    fetchReports(true);
  }, [fetchReports]);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await fetchReports(false);
    } finally {
      setRefreshing(false);
    }
  }, [fetchReports]);

  function formatTime(iso?: string) {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "";
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const sec = Math.max(1, Math.floor(diffMs / 1000));
      if (sec < 60) return `${sec}s ago`;
      const min = Math.floor(sec / 60);
      if (min < 60) return `${min}m ago`;
      const hr = Math.floor(min / 60);
      if (hr < 24) return `${hr}h ago`;
      const day = Math.floor(hr / 24);
      if (day < 7) return `${day}d ago`;
      return d.toLocaleDateString();
    } catch {
      return "";
    }
  }

  const openLocation = useCallback((r: Report) => {
    try {
      const hasCoords = !!(r.coords && typeof r.coords.lat === "number" && typeof r.coords.lng === "number");
      const query = hasCoords
        ? `${r.coords!.lat},${r.coords!.lng}`
        : encodeURIComponent(r.location || r.title || "Location");
      const url = Platform.select({
        ios: `http://maps.apple.com/?q=${query}`,
        android: `https://www.google.com/maps/search/?api=1&query=${query}`,
        default: `https://www.google.com/maps/search/?api=1&query=${query}`,
      });
      if (!url) throw new Error("Unsupported platform");
      Linking.openURL(url);
    } catch (e: any) {
      Alert.alert("Unable to open maps", e?.message ?? "Try again later.");
    }
  }, []);

  return (
    <ScrollView
      style={[styles.container, isDark && { backgroundColor: "#0B0B0D" }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0A66C2" colors={["#0A66C2"]} />}
    > 
      <LinearGradient
        colors={isDark ? ["#0E141B", "#0E141B"] : ["#EAF7FF", "#ECF2FF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.header,
          // Add top padding for status bar/safe area to avoid overlap
          { paddingTop: Math.max(insets.top, 12) + 8 },
        ]}
      >
        <View>
          <Text style={[styles.appTitle, isDark && { color: "#A5D6FF" }]}>Smart City</Text>
        </View>
        <TouchableOpacity style={styles.avatarWrap} activeOpacity={0.8}>
          <Image
            source={{
              uri: "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?q=80&w=400&auto=format&fit=crop",
            }}
            style={styles.avatar}
          />
        </TouchableOpacity>
      </LinearGradient>

      <View style={styles.actions}>
        <Link href="/(tabs)/reports" asChild>
          <TouchableOpacity activeOpacity={0.9}>
            <LinearGradient
              colors={["#0BC5EA", "#2563EB"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cta}
            >
              <Ionicons style={styles.ctaIconLeft} name="document-text-outline" size={22} color="#fff" />
              <Text style={[styles.ctaText, styles.ctaTextCenter]}>My Reports</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Link>

        <Link href="/(tabs)/issues" asChild>
          <TouchableOpacity activeOpacity={0.9}>
            <LinearGradient
              colors={["#0BC5EA", "#2563EB"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cta}
            >
              <Ionicons style={styles.ctaIconLeft} name="megaphone-outline" size={22} color="#fff" />
              <Text style={[styles.ctaText, styles.ctaTextCenter]}>Report an Issue</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Link>
      </View>

      <Text style={[styles.sectionTitle, isDark && { color: "#E6EAF2" }]}>Community Reports</Text>

      <View style={styles.list}>
        {loading && (
          <Text style={{ paddingHorizontal: 16, color: isDark ? "#C9D2DC" : "#6B7280" }}>Loading…</Text>
        )}
        {!!error && !loading && (
          <Text style={{ paddingHorizontal: 16, color: "#DC2626" }}>
            Error: {error}{"\n"}
            {triedBases.length > 0 ? `Tried: ${triedBases.join(', ')}` : ''}
          </Text>
        )}
        {!loading && !error && reports.length === 0 && (
          <Text style={{ paddingHorizontal: 16, color: isDark ? "#C9D2DC" : "#6B7280" }}>No reports yet.</Text>
        )}
        {!loading && !error && reports.map((r) => (
          <View key={r.id} style={[styles.card, isDark && { backgroundColor: "#14161A", borderColor: "#1F2430" }]}>
            <View style={styles.cardHeader}>
              <Image
                source={{ uri: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=200&auto=format&fit=crop" }}
                style={styles.userAvatar}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.userName, isDark && { color: "#E6EAF2" }]}>{r.name}</Text>
                <Text style={styles.timeText}>{r.time ?? formatTime(r.created_at)}</Text>
              </View>
              <Ionicons name="ellipsis-horizontal" size={20} color={isDark ? "#9BA7B4" : "#6B7280"} />
            </View>

            <Text style={[styles.cardTitle, isDark && { color: "#E6EAF2" }]}>{r.title}</Text>
            {!!(r.photo || r.image_url) && <Image source={{ uri: r.photo || r.image_url! }} style={styles.cardImage} contentFit="cover" />}
            {!!r.body && <Text style={[styles.cardBody, isDark && { color: "#C9D2DC" }]}>{r.body}</Text>}

            <View style={styles.cardFooter}>
              <TouchableOpacity style={styles.footerItem} activeOpacity={0.7}>
                <Ionicons name="thumbs-up-outline" size={18} color="#6B7280" />
                <Text style={styles.footerText}>{r.likes ?? 0}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.footerItem} activeOpacity={0.7}>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color="#6B7280" />
                <Text style={styles.footerText}>{r.comments ?? 0}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.footerItem} activeOpacity={0.7}>
                <Ionicons name="arrow-redo-outline" size={18} color="#6B7280" />
                <Text style={styles.footerText}>{r.shares ?? 0}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.footerItem} onPress={() => openLocation(r)} activeOpacity={0.7}>
                <Ionicons name="location-outline" size={18} color="#6B7280" />
                <Text style={styles.footerText}>View</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F6F8FB" },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#DDE3F1",
  },
  appTitle: { fontSize: 20, fontWeight: "800", color: "#0A66C2" },
  appSubtitle: { fontSize: 18, fontWeight: "700", color: "#2B7FFF" },
  avatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  avatar: { width: "100%", height: "100%" },
  actions: { paddingHorizontal: 20, gap: 12, marginTop: 12 },
  cta: {
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    // Center label; icon is absolutely positioned on the left
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  ctaIconLeft: { position: "absolute", left: 18 },
  ctaText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  ctaTextCenter: { textAlign: "center", width: "100%" },
  sectionTitle: {
    paddingHorizontal: 20,
    marginTop: 18,
    marginBottom: 10,
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 14 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  userAvatar: { width: 28, height: 28, borderRadius: 14 },
  userName: { fontWeight: "700", color: "#111827" },
  timeText: { color: "#6B7280", fontSize: 12 },
  cardTitle: { marginTop: 8, fontWeight: "700", fontSize: 15, color: "#111827" },
  cardImage: { marginTop: 10, width: "100%", height: 180, borderRadius: 12 },
  cardBody: { marginTop: 10, color: "#374151", lineHeight: 20 },
  cardFooter: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  footerText: { color: "#6B7280", fontWeight: "600" },
});
