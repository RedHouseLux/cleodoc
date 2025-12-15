import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Button, FlatList } from "react-native";
import { initDb, getOrCreateUserId, insertEntry, listEntries } from "../db";
import { syncNow } from "../sync";

export default function HomeScreen() {
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState("");
  const [mood, setMood] = useState("7");
  const [stress, setStress] = useState("3");
  const [note, setNote] = useState("");
  const [items, setItems] = useState([]);
  const [syncMsg, setSyncMsg] = useState("");

  async function refresh() {
    const rows = await listEntries(50);
    setItems(rows);
  }

  useEffect(() => {
    (async () => {
      await initDb();
      const uid = await getOrCreateUserId();
      setUserId(uid);
      await refresh();
      setReady(true);
    })();
  }, []);

  if (!ready) return <Text>Loading...</Text>;

  return (
    <View style={{ padding: 20, paddingTop: 60 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>CLEODOC</Text>
      <Text style={{ marginTop: 8, opacity: 0.7 }}>Offline-first check-in</Text>

      <Text style={{ marginTop: 20 }}>Mood (1–10)</Text>
      <TextInput value={mood} onChangeText={setMood} keyboardType="numeric" style={{ borderWidth: 1, padding: 10 }} />

      <Text style={{ marginTop: 12 }}>Stress (1–10)</Text>
      <TextInput value={stress} onChangeText={setStress} keyboardType="numeric" style={{ borderWidth: 1, padding: 10 }} />

      <Text style={{ marginTop: 12 }}>Note</Text>
      <TextInput value={note} onChangeText={setNote} style={{ borderWidth: 1, padding: 10 }} />

      <View style={{ marginTop: 12 }}>
        <Button
          title="Save offline"
          onPress={async () => {
            await insertEntry({
              userId,
              mood: parseInt(mood, 10),
              stress: parseInt(stress, 10),
              note,
            });
            setNote("");
            await refresh();
          }}
        />
      </View>

      <View style={{ marginTop: 10 }}>
        <Button
          title="Sync now"
          onPress={async () => {
            setSyncMsg("Syncing...");
            const r = await syncNow({ userId, label: "CLEODOC User" });
            setSyncMsg(r.ok ? `Synced: ${r.synced}` : `Sync error: ${r.error}`);
            await refresh();
          }}
        />
      </View>

      {!!syncMsg && <Text style={{ marginTop: 10 }}>{syncMsg}</Text>}

      <Text style={{ marginTop: 20, fontWeight: "700" }}>Last entries</Text>
      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        renderItem={({ item }) => (
          <View style={{ paddingVertical: 10, borderBottomWidth: 1, opacity: 0.9 }}>
            <Text>{new Date(item.ts).toLocaleString()}</Text>
            <Text>Mood: {item.mood} | Stress: {item.stress}</Text>
            <Text>{item.note}</Text>
            <Text style={{ opacity: 0.6 }}>Sync: {item.sync_status}</Text>
          </View>
        )}
      />
    </View>
  );
}
