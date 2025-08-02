import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

type NewsCardProps = {
  title: string;
  summary: string;
  source: string;
  publishedAt: string;
  onPress: () => void;
};

export default function NewsCard({ title, summary, source, publishedAt, onPress }: NewsCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.summary}>{summary}</Text>
      <View style={styles.footer}>
        <Text style={styles.source}>{source}</Text>
        <Text style={styles.date}>{timeAgo(publishedAt)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const timeAgo = (dateString: string) => {
  const diff = Math.floor((Date.now() - new Date(dateString).getTime()) / 60000);
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return `${Math.floor(diff / 1440)}d ago`;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    padding: 16,
    marginVertical: 8,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 3,
  },
  title: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  summary: { fontSize: 14, color: '#555' },
  footer: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  source: { fontSize: 12, color: '#007aff' },
  date: { fontSize: 12, color: '#999' },
});
