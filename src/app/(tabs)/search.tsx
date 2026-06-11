import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Searchbar, Card, Text, useTheme, Divider, ActivityIndicator, IconButton, FAB } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { searchCases } from '../../database/db';
import { Case } from '../../types/db';
import { ScreenBackground } from '../../components/ScreenBackground';

export default function SearchScreen() {
  const theme = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<Case[]>([]);
  const [loading, setLoading] = useState(false);

  // FAB visibility & scroll tracking
  const [fabVisible, setFabVisible] = useState(true);
  const scrollY = useRef(0);

  const handleScroll = (event: any) => {
    const currentOffset = event.nativeEvent.contentOffset.y;
    if (Math.abs(currentOffset - scrollY.current) > 10) {
      if (currentOffset > scrollY.current && currentOffset > 50) {
        setFabVisible(false);
      } else {
        setFabVisible(true);
      }
      scrollY.current = currentOffset;
    }
  };

  // Hide the default navigation header to render our own custom header search bar
  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  // Trigger search on query change
  useEffect(() => {
    let isMounted = true;
    async function performSearch() {
      setLoading(true);
      try {
        const data = await searchCases(searchQuery);
        if (isMounted) {
          setResults(data);
        }
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    const delayDebounceFn = setTimeout(() => {
      performSearch();
    }, 150); // Small debounce of 150ms for instant search feel

    return () => {
      isMounted = false;
      clearTimeout(delayDebounceFn);
    };
  }, [searchQuery]);

  const renderItem = ({ item }: { item: Case }) => (
    <Card
      style={styles.card}
      onPress={() => router.push(`/case/${item.id}`)}
      elevation={1}
    >
      <Card.Content>
        <View style={styles.headerRow}>
          <Text variant="titleMedium" style={[styles.clientName, { color: theme.colors.primary }]}>
            {item.client_name}
          </Text>
          <Text variant="labelMedium" style={[styles.fileNumber, { color: theme.colors.secondary }]}>
            {item.file_number}
          </Text>
        </View>

        <Text variant="bodySmall" style={styles.caseDetails}>
          Case No: {item.case_number} • Type: {item.case_type}
        </Text>

        {item.client_phone ? (
          <Text variant="bodySmall" style={styles.phoneText}>
            Phone: {item.client_phone}
          </Text>
        ) : null}

        <Divider style={styles.divider} />

        <View style={styles.footerRow}>
          <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
            Location: Rack {item.rack_number || 'N/A'} • Shelf {item.shelf_number || 'N/A'}
          </Text>
          <Text variant="bodySmall" style={[styles.statusText, { color: theme.colors.primary }]}>
            Status: {item.file_status || 'In Office'}
          </Text>
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <ScreenBackground>
      <View style={[styles.container, { backgroundColor: 'transparent' }]}>
        {/* Custom Header Search bar */}
        <View style={[styles.customHeader, { 
          paddingTop: insets.top + 8,
          backgroundColor: theme.dark ? theme.colors.surface : theme.colors.primary 
        }]}>
          <Searchbar
            placeholder="Search files by client, file, phone..."
            onChangeText={setSearchQuery}
            value={searchQuery}
            elevation={0}
            style={[styles.headerSearchbar, { 
              backgroundColor: theme.dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.18)' 
            }]}
            inputStyle={{ 
              color: '#ffffff',
              minHeight: 0,
            }}
            placeholderTextColor="rgba(255,255,255,0.7)"
            iconColor="#ffffff"
            theme={{
              colors: {
                onSurface: '#ffffff',
                onSurfaceVariant: 'rgba(255,255,255,0.7)',
              }
            }}
            clearIcon={() => searchQuery ? (
              <IconButton 
                icon="close" 
                iconColor="#ffffff" 
                size={20} 
                style={{ margin: 0 }} 
                onPress={() => setSearchQuery('')} 
              />
            ) : null}
          />
        </View>

        {loading && searchQuery ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
          </View>
        ) : null}

        <FlatList
          data={results}
          renderItem={renderItem}
          keyExtractor={(item) => item.id?.toString() || ''}
          contentContainerStyle={[styles.listContainer, { paddingBottom: 88 }]}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="magnify-close" size={48} color={theme.colors.outline} />
              <Text variant="bodyLarge" style={{ color: theme.colors.outline, marginTop: 8 }}>
                No matching files found
              </Text>
            </View>
          }
        />
        <FAB
          icon="plus"
          style={[styles.fab, { backgroundColor: theme.colors.primary }]}
          color="#ffffff"
          visible={fabVisible}
          onPress={() => router.push('/case/add')}
        />
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  customHeader: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  headerSearchbar: {
    borderRadius: 12,
    height: 46,
  },
  loadingContainer: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  listContainer: {
    padding: 16,
    paddingTop: 16,
  },
  card: {
    marginBottom: 12,
    borderRadius: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  clientName: {
    fontWeight: 'bold',
    flex: 1,
    marginRight: 8,
  },
  fileNumber: {
    fontWeight: 'bold',
  },
  caseDetails: {
    opacity: 0.8,
    marginBottom: 2,
  },
  phoneText: {
    opacity: 0.6,
    marginBottom: 4,
  },
  divider: {
    marginVertical: 8,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusText: {
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 16,
    borderRadius: 28,
  },
});
