import { Image } from "expo-image";
import { Link, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ScrollView,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
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
  voice_url?: string | null;
};

export default function HomeScreen() {
  const router = useRouter();
  const { isDark } = useAppTheme();
  // simple audio playback per card
  const soundRef = useRef<any>(null);
  const [currentVoice, setCurrentVoice] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingSound, setIsLoadingSound] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [progressWidth, setProgressWidth] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragMs, setDragMs] = useState(0);
  const formatMs = (ms: number) => {
    const sec = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };
  const togglePlay = useCallback(async (uri: string) => {
    try {
      const { Audio } = await import("expo-av");
      // Ensure the right audio mode for audible playback
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
          staysActiveInBackground: false,
        });
      } catch {}
      // If tapping the same post, toggle pause/resume
      if (currentVoice && soundRef.current && currentVoice === uri) {
        const status = await soundRef.current.getStatusAsync();
        if (status?.isLoaded) {
          if (status.isPlaying) {
            await soundRef.current.pauseAsync();
            setIsPlaying(false);
          } else {
            await soundRef.current.playAsync();
            setIsPlaying(true);
          }
          return;
        }
      }
      // New selection: unload previous and play this one
      setIsLoadingSound(true);
      if (soundRef.current) {
        try { await soundRef.current.unloadAsync(); } catch {}
        soundRef.current = null;
      }
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true, progressUpdateIntervalMillis: 250, isMuted: false, volume: 1.0 }
      );
      soundRef.current = sound;
      setCurrentVoice(uri);
      setIsPlaying(true);
      try { await sound.setVolumeAsync(1.0); } catch {}
      sound.setOnPlaybackStatusUpdate((s: any) => {
        if (!s?.isLoaded) return;
        if (typeof s.positionMillis === 'number') setPositionMs(s.positionMillis);
        if (typeof s.durationMillis === 'number') setDurationMs(s.durationMillis);
        if (s.didJustFinish) {
          setIsPlaying(false);
          setCurrentVoice(null);
          try { sound.unloadAsync(); } catch {}
          soundRef.current = null;
          setPositionMs(0);
          setDurationMs(0);
        } else {
          setIsPlaying(!!s.isPlaying);
        }
      });
    } catch (e) {
      Alert.alert("Playback failed", (e as any)?.message ?? "");
    }
    finally {
      setIsLoadingSound(false);
    }
  }, [currentVoice]);
  const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n));
  const percent = (ms: number, total: number) => (total > 0 ? clamp(ms / total, 0, 1) * 100 : 0);
  const onScrubGrant = useCallback((x: number) => {
    if (!durationMs) return;
    setIsDragging(true);
    const frac = clamp(x / Math.max(1, progressWidth));
    setDragMs(Math.floor(frac * durationMs));
  }, [durationMs, progressWidth]);
  const onScrubMove = useCallback((x: number) => {
    if (!durationMs) return;
    const frac = clamp(x / Math.max(1, progressWidth));
    setDragMs(Math.floor(frac * durationMs));
  }, [durationMs, progressWidth]);
  const onScrubRelease = useCallback(async (x?: number) => {
    try {
      if (!soundRef.current || !currentVoice || !durationMs) { setIsDragging(false); return; }
      let target = dragMs;
      if (typeof x === 'number') {
        const frac = clamp(x / Math.max(1, progressWidth));
        target = Math.floor(frac * durationMs);
        setDragMs(target);
      }
      const status = await soundRef.current.getStatusAsync();
      if (status?.isLoaded) {
        if (status.isPlaying) await soundRef.current.playFromPositionAsync(target);
        else await soundRef.current.setPositionAsync(target);
        setPositionMs(target);
      }
    } catch {}
    finally {
      setIsDragging(false);
    }
  }, [dragMs, durationMs, progressWidth, currentVoice]);
  useEffect(() => {
    // Set a global audio mode once on mount to maximize audibility
    (async () => {
      try {
        const { Audio } = await import("expo-av");
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false, // use loudspeaker
          staysActiveInBackground: false,
        });
      } catch {}
    })();
    return () => {
      (async () => {
        try {
          if (soundRef.current) {
            await soundRef.current.unloadAsync();
            soundRef.current = null;
          }
        } catch {}
      })();
    };
  }, []);
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
    if (publicEnv) list.push(publicEnv.replace(/\/$/, ""));

    const hostUri: string | undefined = (Constants as any)?.expoConfig?.hostUri || (Constants as any)?.debuggerHost;
    const host = typeof hostUri === "string" ? hostUri.split(":" )[0] : undefined;
    const isIPv4 = host ? /^\d+\.\d+\.\d+\.\d+$/.test(host) : false;

    if (Platform.OS === "android") {
      // Emulator alias
      list.push("http://10.0.2.2:8000");
      if (isIPv4) list.push(`http://${host}:8000`);
      // Fallback to loopback
      list.push("http://127.0.0.1:8000");
    } else {
      if (isIPv4) list.push(`http://${host}:8000`);
      list.push("http://127.0.0.1:8000");
    }
    // Deduplicate while preserving order
    return Array.from(new Set(list));
  }, []);

  const fetchReports = useCallback(async (showSpinner: boolean) => {
    const fetchWithTimeout = async (url: string, ms = 5000) => {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : (null as any);
      const timer = setTimeout(() => {
        try { controller?.abort(); } catch {}
      }, ms);
      try {
        const res = await fetch(url, controller ? { signal: controller.signal } : undefined);
        return res;
      } finally {
        clearTimeout(timer);
      }
    };
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
          const res = await fetchWithTimeout(url, 5000);
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
        <AuthHeaderRight onPressAvatar={() => router.push('/settings') } onPressLogin={() => router.push('/login')} />
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
            {!!r.voice_url && (
              <View style={styles.voiceRow}>
                <TouchableOpacity
                  style={[styles.voiceBtn, (currentVoice === r.voice_url && isPlaying) && styles.voiceBtnActive]}
                  activeOpacity={0.85}
                  disabled={isLoadingSound && currentVoice === r.voice_url}
                  onPress={() => togglePlay(r.voice_url!)}
                >
                  <Ionicons
                    name={currentVoice === r.voice_url && isPlaying ? "pause-circle-outline" : "play-circle-outline"}
                    size={18}
                    color="#fff"
                  />
                  <Text style={styles.voiceBtnText}>
                    {currentVoice === r.voice_url && isPlaying ? "Pause voice" : (isLoadingSound && currentVoice === r.voice_url) ? "Loading…" : "Play voice"}
                  </Text>
                </TouchableOpacity>
                {currentVoice === r.voice_url && (
                    <View style={styles.voiceMeta}>
                    <View
                      onLayout={(e) => setProgressWidth(e.nativeEvent.layout.width)}
                      onStartShouldSetResponder={() => true}
                      onMoveShouldSetResponder={() => true}
                      onStartShouldSetResponderCapture={() => true}
                      onMoveShouldSetResponderCapture={() => true}
                      onResponderTerminationRequest={() => false}
                      onResponderGrant={(e) => onScrubGrant((e as any).nativeEvent.locationX)}
                      onResponderMove={(e) => onScrubMove((e as any).nativeEvent.locationX)}
                      onResponderRelease={(e) => onScrubRelease((e as any).nativeEvent.locationX)}
                      onResponderTerminate={() => setIsDragging(false)}
                      style={styles.progressTrack}
                    >
                      <View style={[styles.progressBar, { width: `${percent(isDragging ? dragMs : positionMs, durationMs)}%` }]} />
                      <View style={[styles.progressThumb, { left: `${percent(isDragging ? dragMs : positionMs, durationMs)}%` }]} />
                    </View>
                    <Text style={styles.voiceTimeText}>{formatMs(positionMs)} / {formatMs(durationMs)}</Text>
                  </View>
                )}
              </View>
            )}

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

function AuthHeaderRight({ onPressAvatar, onPressLogin }: { onPressAvatar: () => void; onPressLogin: () => void }) {
  const [avatar, setAvatar] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const inited = useRef(false);
  useEffect(() => {
    if (inited.current) return; inited.current = true;
    (async () => {
      try {
        const { default: SecureStore } = await import('expo-secure-store');
        const token = await SecureStore.getItemAsync('auth_token');
        const profileRaw = await SecureStore.getItemAsync('auth_profile');
        let p: any = null; try { p = profileRaw ? JSON.parse(profileRaw) : null; } catch {}
        let avatarUrl: string | null = p?.avatar ?? null;
        if (token) {
          // refresh profile
          const base = await pickBase();
          const res = await fetch(`${base}/api/auth/me/`, { headers: { 'Authorization': `Token ${token}` } });
          if (res.ok) {
            const me = await res.json();
            avatarUrl = me?.avatar ?? avatarUrl;
            await SecureStore.setItemAsync('auth_profile', JSON.stringify(me));
          }
        }
        setAvatar(avatarUrl);
      } catch {}
      finally { setLoading(false); }
    })();
  }, []);
  if (loading) return <View style={styles.avatarWrap} />;
  if (avatar) {
    return (
      <TouchableOpacity style={styles.avatarWrap} activeOpacity={0.8} onPress={onPressAvatar}>
        <Image source={{ uri: avatar }} style={styles.avatar} />
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity onPress={onPressLogin} style={{ paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10 }}>
      <Text style={{ color: '#0A66C2', fontWeight: '800' }}>Sign In</Text>
    </TouchableOpacity>
  );
}

async function pickBase(): Promise<string> {
  const list: string[] = [];
  const env = (process as any)?.env?.EXPO_PUBLIC_API_URL as string | undefined;
  if (env) list.push(env.replace(/\/$/, ""));
  const { default: ConstantsLocal } = await import('expo-constants');
  const hostUri: string | undefined = (ConstantsLocal as any)?.expoConfig?.hostUri || (ConstantsLocal as any)?.debuggerHost;
  const host = typeof hostUri === "string" ? hostUri.split(":")[0] : undefined;
  const isIPv4 = host ? /^\d+\.\d+\.\d+\.\d+$/.test(host) : false;
  if (Platform.OS === "android") { list.push("http://10.0.2.2:8000"); if (isIPv4) list.push(`http://${host}:8000`); list.push("http://127.0.0.1:8000"); }
  else { if (isIPv4) list.push(`http://${host}:8000`); list.push("http://127.0.0.1:8000"); }
  return Array.from(new Set(list))[0];
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
  voiceRow: { marginTop: 8, flexDirection: "row", alignItems: "center" },
  voiceBtn: {
    backgroundColor: "#2563EB",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
  },
  voiceBtnActive: { backgroundColor: "#1D4ED8" },
  voiceBtnText: { color: "#fff", fontWeight: "800" },
  voiceMeta: { marginLeft: 12, flex: 1 },
  progressTrack: {
    height: 24,
    backgroundColor: "#E5E7EB",
    borderRadius: 12,
    // Make drag easier and keep thumb visible
    justifyContent: 'center',
  },
  progressBar: { height: 4, backgroundColor: "#2563EB", borderRadius: 2 },
  progressThumb: {
    position: 'absolute',
    // Center the 16px thumb inside 24px-high track
    top: 4,
    width: 16,
    height: 16,
    marginLeft: -8,
    borderRadius: 8,
    backgroundColor: '#2563EB',
    borderWidth: 2,
    borderColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    zIndex: 2,
  },
  voiceTimeText: { marginTop: 4, color: "#6B7280", fontSize: 12, fontWeight: "600" },
});
