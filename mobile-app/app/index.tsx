import React, { useState, useEffect } from "react";
import { ScrollView, TouchableOpacity, Linking } from "react-native";
import { Card, Text } from "react-native-paper";
import { getSummarizedNews } from "../scripts/fetchNews";

export default function Index() {
  const [feed, setFeed] = useState<any[]>([]);
  const topics = ["AI", "Technology"];

  useEffect(() => {
    fetchFeed();
    const interval = setInterval(fetchFeed, 1000 * 60 * 60 * 3); // every 3 hours
    return () => clearInterval(interval);
  }, []);

  async function fetchFeed() {
    const news = await getSummarizedNews(topics);
    setFeed(news);
  }

  return (
    <ScrollView style={{ padding: 10 }}>
      {feed.map((item, i) => (
        <TouchableOpacity key={i} onPress={() => Linking.openURL(item.url)}>
          <Card style={{ marginBottom: 10 }}>
            <Card.Content>
              <Text variant="titleMedium">{item.title}</Text>
              <Text>{item.summary}</Text>
            </Card.Content>
          </Card>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}
