import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SUGGESTED_TOPICS } from "../constants/topics";

export default function SettingsPage() {
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [customTopic, setCustomTopic] = useState("");

  // Load topics from storage
  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem("userTopics");
      if (saved) setSelectedTopics(JSON.parse(saved));
    })();
  }, []);

  // Save topics to storage
  const saveTopics = async (topics: string[]) => {
    setSelectedTopics(topics);
    await AsyncStorage.setItem("userTopics", JSON.stringify(topics));
  };

  const toggleTopic = (topic: string) => {
    if (selectedTopics.includes(topic)) {
      saveTopics(selectedTopics.filter((t) => t !== topic));
    } else {
      saveTopics([...selectedTopics, topic]);
    }
  };

  const addCustomTopic = () => {
    if (customTopic.trim() && !selectedTopics.includes(customTopic.trim())) {
      saveTopics([...selectedTopics, customTopic.trim()]);
      setCustomTopic("");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Select Topics</Text>

      <FlatList
        data={SUGGESTED_TOPICS}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.topicButton,
              selectedTopics.includes(item) && styles.selectedTopic,
            ]}
            onPress={() => toggleTopic(item)}
          >
            <Text
              style={[
                styles.topicText,
                selectedTopics.includes(item) && styles.selectedText,
              ]}
            >
              {item}
            </Text>
          </TouchableOpacity>
        )}
      />

      <Text style={styles.heading}>Add Custom Topic</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Enter a topic..."
          value={customTopic}
          onChangeText={setCustomTopic}
        />
        <TouchableOpacity style={styles.addButton} onPress={addCustomTopic}>
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  heading: { fontSize: 18, fontWeight: "bold", marginVertical: 10 },
  topicButton: {
    padding: 12,
    backgroundColor: "#f0f0f0",
    marginVertical: 5,
    borderRadius: 8,
  },
  selectedTopic: {
    backgroundColor: "#007AFF",
  },
  topicText: {
    fontSize: 16,
    color: "#333",
  },
  selectedText: {
    color: "#fff",
    fontWeight: "bold",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    marginRight: 10,
  },
  addButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  addButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
});
