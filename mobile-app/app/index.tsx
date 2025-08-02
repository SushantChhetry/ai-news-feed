import { useEffect, useState } from 'react';
import { FlatList, View, ActivityIndicator, RefreshControl, StyleSheet } from 'react-native';
// @ts-ignore
import NewsCard from '../components/NewsCard';
// @ts-ignore
import fetchNews from '../scripts/fetchNews';

export default function HomeScreen() {
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNews = async () => {
    setLoading(true);
    try {
      const data = await fetchNews(['AI technology']);
      setArticles(data);
    } catch (error) {
      console.error('Error fetching news:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNews();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNews();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={articles}
          keyExtractor={(item, index) => index.toString()}
          renderItem={({ item }) => (
            <NewsCard
              title={item.title}
              summary={item.summary}
              source={item.source}
              publishedAt={item.publishedAt}
              onPress={() => {}}
            />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
  },
});
