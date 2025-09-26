import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import Constants from "expo-constants";
import { useAppTheme } from "../../theme/ThemeProvider";

type CategoryKey = "pothole" | "garbage" | "streetlight";

export default function ReportIssueScreen() {
  const { isDark } = useAppTheme();

  const [media, setMedia] = useState<string | null>(null);
  const [address, setAddress] = useState<string>("Capture a photo to lock location");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [category, setCategory] = useState<CategoryKey>("garbage");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [voiceUri, setVoiceUri] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const recordingRef = useRef<any>(null);
  // Local preview playback state
  const previewSoundRef = useRef<any>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewPosMs, setPreviewPosMs] = useState(0);
  const [previewDurMs, setPreviewDurMs] = useState(0);
  const [previewWidth, setPreviewWidth] = useState(0);
  const [isPreviewDragging, setIsPreviewDragging] = useState(false);
  const [previewDragMs, setPreviewDragMs] = useState(0);
  const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n));
  const percent = (ms: number, total: number) => (total > 0 ? clamp(ms / total, 0, 1) * 100 : 0);
  const formatMs = (ms: number) => {
    const sec = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };
  // Prevent double-tapping start from preparing multiple Recording instances
  const preparingRef = useRef<boolean>(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<any>(null);
  const startTimeRef = useRef<number | null>(null);

  // Remove auto-detect on mount: location will be captured only when photo is taken

  const capturePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Please allow camera access to take a photo.");
      return;
    }
    // Prefer the new API (MediaType) with array; fallback only if not available at runtime
    const hasNewApi = !!(ImagePicker as any).MediaType;
    const mediaTypes = hasNewApi
      ? [((ImagePicker as any).MediaType.Images as any)]
      : (ImagePicker as any).MediaTypeOptions.Images;
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: mediaTypes as any,
      allowsEditing: true,
      quality: 0.8,
      cameraType: ImagePicker.CameraType.back,
    });
    if (!res.canceled && res.assets?.length) {
      setMedia(res.assets[0].uri);
      // Capture location at the exact time of photo capture
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== "granted") {
          setAddress("Location permission denied — re-take photo after allowing location");
          setLat(null);
          setLng(null);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced, mayShowUserSettingsDialog: false });
        setLat(loc.coords.latitude);
        setLng(loc.coords.longitude);
        try {
          const geo = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
          if (geo.length) {
            const g = geo[0];
            const composed = [g.name, g.street, g.city, g.region].filter(Boolean).join(", ");
            setAddress(composed || "Location locked with photo");
          } else {
            setAddress("Location locked with photo");
          }
        } catch {
          setAddress("Location locked with photo");
        }
      } catch {
        setAddress("Location capture failed — re-take photo");
        setLat(null);
        setLng(null);
      }
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (preparingRef.current || isRecording || recordingRef.current) {
      return; // already preparing/recording
    }
    preparingRef.current = true;
    setIsPreparing(true);
    try {
      // Use expo-av (stable for this project)
      const { Audio } = await import("expo-av");
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission required", "Please allow microphone access to record voice.");
        return;
      }
      // Configure audio mode for recording (ensure loudspeaker on Android)
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch {}
      const recording = new Audio.Recording();
      // Use HIGH_QUALITY but force safer Android params (mono, 44.1kHz, AAC) to avoid emulator noise
      let options: any = (Audio as any).RecordingOptionsPresets?.HIGH_QUALITY ?? (Audio as any).RecordingOptionsPresets?.HIGH_QUALITY;
      try {
        options = {
          ...(options || {}),
          android: {
            extension: ".m4a",
            outputFormat: (Audio as any).AndroidOutputFormat?.MPEG_4 ?? (Audio as any).RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
            audioEncoder: (Audio as any).AndroidAudioEncoder?.AAC ?? (Audio as any).RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
            sampleRate: 44100,
            numberOfChannels: 1,
            bitRate: 96000,
          },
        };
      } catch {}
      await recording.prepareToRecordAsync(options as any);
      await recording.startAsync();
      recordingRef.current = recording;
      setIsRecording(true);
      // start timer
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        if (startTimeRef.current != null) {
          const sec = Math.max(0, Math.floor((Date.now() - startTimeRef.current) / 1000));
          setElapsed(sec);
        }
      }, 250);
    } catch (e) {
      Alert.alert("Unable to start recording", (e as any)?.message ?? "");
    } finally {
      preparingRef.current = false;
      setIsPreparing(false);
    }
  }, [isRecording]);

  const stopRecording = useCallback(async () => {
    try {
      const rec = recordingRef.current;
      if (!rec) return;
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI?.();
      setVoiceUri(uri || null);
      recordingRef.current = null;
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      startTimeRef.current = null;
      setElapsed(0);
    } catch (e) {
      Alert.alert("Recording failed", (e as any)?.message ?? "");
    }
  }, []);

  // Ensure any in-flight recording is cleaned up on unmount
  useEffect(() => {
    return () => {
      (async () => {
        try {
          const rec = recordingRef.current;
          if (rec) {
            try { await rec.stopAndUnloadAsync(); } catch {}
            recordingRef.current = null;
          }
        } catch {}
        if (timerRef.current) {
          try { clearInterval(timerRef.current); } catch {}
          timerRef.current = null;
        }
        try {
          if (previewSoundRef.current) {
            await previewSoundRef.current.unloadAsync();
            previewSoundRef.current = null;
          }
        } catch {}
      })();
    };
  }, []);

  // Reset preview sound when voiceUri changes
  useEffect(() => {
    (async () => {
      try {
        if (previewSoundRef.current) {
          await previewSoundRef.current.unloadAsync();
          previewSoundRef.current = null;
        }
      } catch {}
      setIsPreviewPlaying(false);
      setIsPreviewLoading(false);
      setPreviewPosMs(0);
      setPreviewDurMs(0);
    })();
  }, [voiceUri]);

  const togglePreview = useCallback(async () => {
    if (!voiceUri) return;
    if (isRecording) return; // don't preview while recording
    try {
      const { Audio } = await import("expo-av");
      // Playback mode for preview (use loudspeaker)
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch {}
      // If already loaded for this uri, toggle
      if (previewSoundRef.current) {
        const status = await previewSoundRef.current.getStatusAsync();
        if (status?.isLoaded) {
          if (status.isPlaying) {
            await previewSoundRef.current.pauseAsync();
            setIsPreviewPlaying(false);
          } else {
            // If playback finished or we're at the end, restart from the beginning
            const atEnd = (typeof status.positionMillis === 'number' && typeof status.durationMillis === 'number')
              ? (status.durationMillis - status.positionMillis) <= 100
              : !!status.didJustFinish;
            try {
              if (status.didJustFinish || atEnd) {
                if (typeof (previewSoundRef.current as any).replayAsync === 'function') {
                  await (previewSoundRef.current as any).replayAsync();
                } else {
                  await previewSoundRef.current.setPositionAsync(0);
                  await previewSoundRef.current.playAsync();
                }
              } else {
                await previewSoundRef.current.playAsync();
              }
            } catch {}
            setIsPreviewPlaying(true);
          }
          return;
        }
      }
      // Load and play
      setIsPreviewLoading(true);
      if (previewSoundRef.current) {
        try { await previewSoundRef.current.unloadAsync(); } catch {}
        previewSoundRef.current = null;
      }
      const { sound } = await Audio.Sound.createAsync(
        { uri: voiceUri },
        { shouldPlay: true, isMuted: false, volume: 1.0, progressUpdateIntervalMillis: 250 }
      );
      previewSoundRef.current = sound;
      setIsPreviewPlaying(true);
      try { await sound.setVolumeAsync(1.0); } catch {}
      sound.setOnPlaybackStatusUpdate((s: any) => {
        if (!s?.isLoaded) return;
        if (typeof s.positionMillis === 'number') setPreviewPosMs(s.positionMillis);
        if (typeof s.durationMillis === 'number') setPreviewDurMs(s.durationMillis);
        if (s.didJustFinish) {
          setIsPreviewPlaying(false);
          // Keep position at duration so the UI shows full progress and offers Replay
          if (typeof s.durationMillis === 'number') setPreviewPosMs(s.durationMillis);
        }
      });
    } catch (e) {
      Alert.alert("Preview failed", (e as any)?.message ?? "");
    } finally {
      setIsPreviewLoading(false);
    }
  }, [voiceUri, isRecording]);

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
              style={[StyleSheet.absoluteFill, styles.pillGradient]}
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

  const canSubmit = useMemo(() => {
    const hasText = description.trim().length >= 10;
    const hasVoice = !!voiceUri;
    return hasText || hasVoice;
  }, [description, voiceUri]);

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
      list.push("http://10.0.2.2:8000");
      if (isIPv4) list.push(`http://${host}:8000`);
      list.push("http://127.0.0.1:8000");
    } else {
      if (isIPv4) list.push(`http://${host}:8000`);
      list.push("http://127.0.0.1:8000");
    }
    return Array.from(new Set(list));
  }, []);

  const onSubmit = useCallback(async () => {
    if (!canSubmit) {
      Alert.alert("Add details", "Please provide a description or record a voice message.");
      return;
    }
    // If a photo is attached, location must have been locked at capture time
    if (media && (lat == null || lng == null)) {
      Alert.alert("Location required", "Please re-take the photo and allow location to lock it.");
      return;
    }
    try {
      setSubmitting(true);
      const fetchWithTimeout = async (input: RequestInfo | URL, init?: RequestInit & { timeout?: number }) => {
        const ms = init?.timeout ?? 8000;
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : (null as any);
        const timer = setTimeout(() => {
          try { controller?.abort(); } catch {}
        }, ms);
        try {
          const res = await fetch(input, controller ? { ...init, signal: controller.signal } : init);
          return res;
        } finally {
          clearTimeout(timer);
        }
      };
  const useMultipart = !!media || !!voiceUri; // upload when we have any binary
      let body: any;
      let headers: Record<string, string> | undefined = undefined;
      if (useMultipart) {
        const form = new FormData();
        form.append("name", "guest"); // TODO: use real username when auth is ready
        form.append("title", category);
        form.append("body", description);
        form.append("location", address);
        if (lat != null) (form as any).append("lat", String(lat));
        if (lng != null) (form as any).append("lng", String(lng));
        if (media) {
          (form as any).append("image", {
            uri: media,
            name: "report.jpg",
            type: "image/jpeg",
          } as any);
        }
        if (voiceUri) {
          (form as any).append("voice", {
            uri: voiceUri,
            name: "voice.m4a",
            type: "audio/m4a",
          } as any);
        }
        body = form;
        // Do NOT set Content-Type; let fetch set proper multipart boundary
      } else {
        body = JSON.stringify({
          name: "guest",
          title: category,
          body: description,
          location: address,
          coords: lat != null && lng != null ? { lat, lng } : undefined,
          image_url: "",
        });
        headers = { "Content-Type": "application/json" };
      }
      let lastErr: any = null;
      for (const base of apiCandidates) {
        try {
          const res = await fetchWithTimeout(`${base}/api/reports/`, {
            method: "POST",
            headers,
            body,
            timeout: 8000,
          } as any);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          await res.json();
          Alert.alert("Submitted", "Your report has been submitted.");
          setDescription("");
          setVoiceUri(null);
          router.replace("/(tabs)");
          return;
        } catch (e) {
          lastErr = e;
        }
      }
      throw lastErr ?? new Error("Failed to submit");
    } catch (e: any) {
      Alert.alert("Failed", e?.message ?? "Could not submit your report");
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, apiCandidates, category, description, address, media, lat, lng, voiceUri]);

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
        <LinearGradient
          colors={isDark ? ["#12161C", "#12161C"] : ["#FFFFFF", "#F7FAFF"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.uploadOuter}
        >
          <TouchableOpacity style={styles.uploadBox} activeOpacity={0.85} onPress={capturePhoto}>
            {media ? (
              <Image source={{ uri: media }} style={styles.preview} contentFit="cover" />
            ) : (
              <>
                <Ionicons name="camera-outline" size={26} color="#6B7280" />
                <Text style={styles.uploadText}>Tap to Capture Photo</Text>
              </>
            )}
          </TouchableOpacity>
        </LinearGradient>
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
        {/* Location is locked at photo capture; manual adjustment disabled */}
        <View style={{ marginTop: 8, alignSelf: 'flex-start', backgroundColor: isDark ? '#1D2531' : '#EEF2FF', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10 }}>
          <Text style={{ color: isDark ? '#9BA7B4' : '#2563EB', fontWeight: '700' }}>Locked at capture time</Text>
        </View>
      </View>

      <View style={[styles.card, isDark && styles.cardDark]}>
        <Text style={[styles.sectionTitle, isDark && { color: "#E6EAF2" }]}>Voice Message (Optional)</Text>
        {isPreparing && (
          <View style={styles.statusRow}>
            <ActivityIndicator size="small" color="#F59E0B" />
            <Text style={[styles.statusText, isDark && { color: "#E6EAF2" }]}>Preparing microphone…</Text>
          </View>
        )}
        {isRecording && (
          <View style={styles.statusRow}>
            <View style={[styles.dot, { opacity: (elapsed * 2) % 2 < 1 ? 1 : 0.4 }]} />
            <Text style={[styles.statusText, { color: "#EF4444" }]}>
              Recording {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
            </Text>
          </View>
        )}
        {!isRecording && !voiceUri && (
          <TouchableOpacity onPress={startRecording} style={styles.voiceBtn} activeOpacity={0.85}>
            <Ionicons name="mic-outline" size={18} color="#fff" />
            <Text style={styles.voiceBtnText}>Start Recording</Text>
          </TouchableOpacity>
        )}
        {isRecording && (
          <TouchableOpacity onPress={stopRecording} style={styles.voiceBtnGhost} activeOpacity={0.85}>
            <Ionicons name="stop-circle-outline" size={18} color="#2563EB" />
            <Text style={styles.voiceBtnGhostText}>Stop & Attach</Text>
          </TouchableOpacity>
        )}
        {!!voiceUri && (
          <View style={styles.voiceBlock}>
            <View style={styles.voiceRowColumn}>
              <Text style={[styles.voiceInfo, isDark && { color: "#E6EAF2" }]}>Voice ready to upload</Text>
              <View style={styles.btnRow}>
                <TouchableOpacity onPress={togglePreview} disabled={isPreviewLoading || isRecording || isPreparing} activeOpacity={0.9} style={styles.miniBtnWrap}>
                  <LinearGradient
                    colors={isPreviewPlaying ? ["#16A34A", "#22C55E"] : ["#22C55E", "#16A34A"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.miniBtn}
                  >
                    {isPreviewLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name={isPreviewPlaying ? "pause-circle-outline" : "play-circle-outline"} size={18} color="#fff" />
                        <Text style={styles.miniBtnText}>{isPreviewPlaying ? "Pause" : (previewDurMs > 0 && previewPosMs >= Math.max(0, previewDurMs - 100) ? "Replay" : "Preview")}</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setVoiceUri(null); startRecording(); }} activeOpacity={0.9} style={styles.miniBtnWrap}>
                  <LinearGradient colors={["#0EA5E9", "#2563EB"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.miniBtn}>
                    <Ionicons name="mic-circle-outline" size={18} color="#fff" />
                    <Text style={styles.miniBtnText}>Re-record</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setVoiceUri(null)} activeOpacity={0.9} style={styles.miniBtnWrap}>
                  <LinearGradient colors={["#94A3B8", "#6B7280"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.miniBtn}>
                    <Ionicons name="trash-outline" size={18} color="#fff" />
                    <Text style={styles.miniBtnText}>Remove</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
            {isPreviewPlaying || previewPosMs > 0 ? (
              <View style={styles.previewMeta}>
                <View
                  onLayout={(e) => setPreviewWidth(e.nativeEvent.layout.width)}
                  onStartShouldSetResponder={() => true}
                  onMoveShouldSetResponder={() => true}
                  onStartShouldSetResponderCapture={() => true}
                  onMoveShouldSetResponderCapture={() => true}
                  onResponderTerminationRequest={() => false}
                  onResponderGrant={(e) => {
                    if (!previewDurMs) return;
                    setIsPreviewDragging(true);
                    const x = (e as any).nativeEvent.locationX;
                    const frac = clamp(x / Math.max(1, previewWidth));
                    setPreviewDragMs(Math.floor(frac * previewDurMs));
                  }}
                  onResponderMove={(e) => {
                    if (!previewDurMs) return;
                    const x = (e as any).nativeEvent.locationX;
                    const frac = clamp(x / Math.max(1, previewWidth));
                    setPreviewDragMs(Math.floor(frac * previewDurMs));
                  }}
                  onResponderRelease={async (e) => {
                    try {
                      if (!previewSoundRef.current || !previewDurMs) { setIsPreviewDragging(false); return; }
                      const x = (e as any).nativeEvent.locationX;
                      const frac = clamp(x / Math.max(1, previewWidth));
                      const target = Math.floor(frac * previewDurMs);
                      const status = await previewSoundRef.current.getStatusAsync();
                      if (status?.isLoaded) {
                        if (status.isPlaying) await previewSoundRef.current.playFromPositionAsync(target);
                        else await previewSoundRef.current.setPositionAsync(target);
                        setPreviewPosMs(target);
                      }
                    } catch {}
                    finally {
                      setIsPreviewDragging(false);
                    }
                  }}
                  onResponderTerminate={() => setIsPreviewDragging(false)}
                  style={styles.previewTrack}
                >
                  <View style={[styles.previewBar, { width: `${percent(isPreviewDragging ? previewDragMs : previewPosMs, previewDurMs)}%` }]} />
                  <View style={[styles.previewThumb, { left: `${percent(isPreviewDragging ? previewDragMs : previewPosMs, previewDurMs)}%` }]} />
                </View>
                <Text style={styles.previewTimeText}>{formatMs(previewPosMs)} / {formatMs(previewDurMs)}</Text>
              </View>
            ) : null}
          </View>
        )}
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

      <TouchableOpacity onPress={onSubmit} activeOpacity={0.9} disabled={!canSubmit || submitting} style={{ marginHorizontal: 20 }}>
        <LinearGradient
          colors={canSubmit && !submitting ? ["#47C3FF", "#6C8CF5", "#E25C67"] : ["#9CA3AF", "#9CA3AF"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.submit}
        >
          <Text style={styles.submitText}>{submitting ? "Submitting..." : "Submit Report"}</Text>
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
    borderRadius: 18,
    padding: 14,
    shadowColor: "#0B1220",
    shadowOpacity: 0.05,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    borderWidth: 1,
    borderColor: "#E8ECF3",
  },
  cardDark: { backgroundColor: "#14161A", borderColor: "#1F2430" },
  uploadOuter: {
    borderRadius: 18,
    padding: 10,
  },
  uploadBox: {
    height: 160,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 16,
    borderColor: "#D6DBE6",
    backgroundColor: "#FBFCFE",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    overflow: "hidden",
  },
  preview: { width: "100%", height: "100%" },
  uploadText: { color: "#6B7280", fontWeight: "700" },
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
    backgroundColor: "#F7F9FC",
    borderWidth: 1,
    borderColor: "#E6EAF2",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    overflow: "hidden", // ensure gradient keeps pill shape
  },
  pillGradient: { borderRadius: 16 },
  pillSelected: { borderColor: "transparent" },
  pillText: { fontWeight: "700", color: "#374151" },
  input: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#E8ECF3",
    borderRadius: 14,
    padding: 12,
    minHeight: 120,
    textAlignVertical: "top",
    backgroundColor: "#FBFCFE",
  },
  submit: { marginTop: 16, borderRadius: 28, paddingVertical: 16, alignItems: "center", justifyContent: "center" },
  submitText: { color: "#fff", fontWeight: "800" },
  voiceBtn: {
    backgroundColor: "#2563EB",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  voiceBtnText: { color: "#fff", fontWeight: "800" },
  voiceBtnGhost: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2563EB",
    backgroundColor: "#EEF2FF",
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  voiceBtnGhostText: { color: "#2563EB", fontWeight: "800" },
  voiceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  voiceInfo: { color: "#111827", fontWeight: "700" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  statusText: { color: "#374151", fontWeight: "700" },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#EF4444" },
  // Preview polish styles
  voiceBlock: { marginTop: 8 },
  btnRow: { flexDirection: "row", gap: 12, alignItems: "center", flexWrap: 'wrap' },
  miniBtnWrap: { borderRadius: 10, overflow: "hidden" },
  miniBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  miniBtnText: { color: "#fff", fontWeight: "800" },
  previewMeta: { marginTop: 10 },
  previewTrack: {
    height: 24,
    backgroundColor: "#E5E7EB",
    borderRadius: 12,
    justifyContent: 'center',
  },
  previewBar: { height: 4, backgroundColor: "#22C55E", borderRadius: 2 },
  previewTimeText: { marginTop: 4, color: "#6B7280", fontSize: 12, fontWeight: "600" },
  voiceRowColumn: { flexDirection: 'column', gap: 8 },
  previewThumb: {
    position: 'absolute',
    top: 4,
    width: 16,
    height: 16,
    marginLeft: -8,
    borderRadius: 8,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    zIndex: 2,
  },
});
