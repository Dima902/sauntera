// src/screens/HistoryScreen.js
import React, { useEffect, useState, useMemo, useContext, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image, Alert, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../config/firebaseConfig';
import { collection, getDocs, deleteDoc, doc, getDoc } from 'firebase/firestore';
import BottomNav from '../components/BottomNav';
import GuestPrompt from '../components/GuestPrompt';
import { useTheme } from '../styles/theme';
import { createHistoryScreenStyles } from '../styles/HistoryScreenStyles';
import { useUserStatus } from '../hooks/useUserStatus';
import { AuthContext } from '../context/AuthContext';

export default function HistoryScreen({ navigation }) {
  const theme = useTheme();
  const styles = useMemo(() => createHistoryScreenStyles(theme), [theme]);

  const { isGuest } = useUserStatus();
  const { user } = useContext(AuthContext);

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const ref = collection(db, `users/${user.uid}/history`);
      const snapshot = await getDocs(ref);
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => b.completedAt?.toMillis?.() - a.completedAt?.toMillis?.());
      setHistory(data);
    } catch (err) {
      console.error('❌ Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (isGuest) {
      setHistory([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchHistory();
  }, [isGuest, fetchHistory]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (!isGuest && user?.uid) {
        setLoading(true);
        fetchHistory();
      }
    });
    return unsubscribe;
  }, [navigation, isGuest, user?.uid, fetchHistory]);

  const handleDeleteHistoryItem = async (itemId) => {
    if (!user?.uid) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/history`, itemId));
      setHistory(prev => prev.filter(item => item.id !== itemId));
    } catch (err) {
      console.error('❌ Failed to delete history item:', err);
    }
  };

  const renderEmptyState = () => (
    <View style={styles.emptyStateContainer}>
      <Ionicons name="time-outline" size={80} color={theme.primary} />
      <Text style={styles.emptyText}>No completed activities yet</Text>
      <TouchableOpacity
        style={styles.ctaButton}
        onPress={() => navigation.navigate('HomeScreen')}
      >
        <Text style={styles.ctaButtonText}>Explore Ideas</Text>
      </TouchableOpacity>
    </View>
  );

  if (isGuest) {
    return (
      <View style={styles.profilecontainer}>
        <GuestPrompt navigation={navigation} />
        <View style={styles.bottomNavWrapper}>
          <BottomNav navigation={navigation} />
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={styles.profilecontainer}>
      <Text style={styles.savedtitle}>Completed Dates</Text>

      {history.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.savedlistContainer}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={async () => {
                if (!user?.uid) return;
                try {
                  const ref = doc(db, `users/${user.uid}/history`, item.id.toString());
                  const snap = await getDoc(ref);
                  if (snap.exists()) {
                    const fullIdea = { id: snap.id, ...snap.data() };
                    navigation.navigate('DateIdeaDetails', { idea: fullIdea });
                  } else {
                    Alert.alert('Not Found', 'This idea could not be loaded.');
                  }
                } catch (err) {
                  console.error('❌ Failed to fetch idea:', err);
                  Alert.alert('Error', 'Failed to load idea details.');
                }
              }}
            >
              <View style={styles.savedcard}>
                {item.image && (
                  <Image
                    source={{ uri: item.image }}
                    style={styles.savedcardImage}
                  />
                )}
                <View style={styles.savedcardContent}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Text style={[styles.savedcardTitle, { flex: 1, marginRight: 12 }]}>{item.title}</Text>
                    <TouchableOpacity
                      onPress={() => handleDeleteHistoryItem(item.id)}
                      style={styles.saveddeleteButton}
                    >
                      <Ionicons name="trash-outline" size={20} color="red" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.savedcardDescription}>{item.address || 'No address'}</Text>
                  <Text style={styles.savedcardPrice}>
                    Completed: {item.completedAt?.seconds ? new Date(item.completedAt.seconds * 1000).toLocaleString() : '—'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      <View style={styles.bottomNavWrapper}>
        <BottomNav navigation={navigation} />
      </View>
    </View>
  );
}
