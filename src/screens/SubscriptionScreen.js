// SubscriptionScreen.js - dark mode compatible
import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Platform } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import * as RNIap from 'react-native-iap';
import { PRODUCTS } from '../constants/Products';
import useCountdown from '../hooks/useCountdown';
import { useTheme } from '../styles/theme';
import { createSubscriptionScreenStyles } from '../styles/SubscriptionScreenStyles';

const SubscriptionScreen = ({ navigation }) => {
  const { days, hours, minutes, seconds } = useCountdown();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [purchasing, setPurchasing] = useState(false);

  const theme = useTheme();
  const styles = useMemo(() => createSubscriptionScreenStyles(theme), [theme]);

  useEffect(() => {
    const setupIAP = async () => {
      try {
        await RNIap.initConnection();
        const subs = await RNIap.getSubscriptions([PRODUCTS.SUBSCRIPTION]);
        const oneTime = await RNIap.getProducts([PRODUCTS.LIFETIME]);
        setSubscriptions(subs);
        setProducts(oneTime);
      } catch (err) {
        console.warn('IAP error', err);
      } finally {
        setLoading(false);
      }
    };
    setupIAP();
  }, []);

  const handlePurchase = async (productId) => {
    try {
      setPurchasing(true);
      const purchase = await RNIap.requestPurchase(productId);
      Alert.alert('Success', `Purchase complete: ${purchase.productId}`);
    } catch (e) {
      if (!e.userCancelled) {
        Alert.alert('Purchase Error', e.message);
      }
    } finally {
      setPurchasing(false);
    }
  };

  const isSubAvailable = subscriptions[0];
  const isOneTimeAvailable = products[0];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Unlock Premium</Text>

      <View style={styles.offerBadgeRow}>
        <Ionicons name="flame" size={20} color="#FF5733" />
        <Text style={styles.offerBadgeText}>Limited-time offer</Text>
      </View>

      <View style={styles.offerRow}>
        <Text style={styles.offerText}>
          Ends in: <Text style={styles.countdownText}>{days}d {hours}h {minutes}m {seconds}s</Text>
        </Text>
      </View>

      <View style={styles.featureCard}>
        <Text style={styles.sectionTitle}>What You Get:</Text>
        {["Unlimited saved date ideas","Unlimited steps in date plans","Smart AI recommendations","All categories unlocked","Map view, directions, and booking","Insider reviews & local secrets"].map((text, idx) => (
          <View style={styles.featureRow} key={idx}>
            <Ionicons name="checkmark-circle" size={20} color={theme.success || '#28a745'} />
            <Text style={styles.featureText}>{text}</Text>
          </View>
        ))}
      </View>

      {loading && <ActivityIndicator size="large" color={theme.primary} style={{ marginVertical: 24 }} />}

      <TouchableOpacity
        style={{ marginHorizontal: 16, marginTop: 10, minHeight: 48, borderRadius: 10, overflow: 'hidden' }}
        onPress={() => isSubAvailable && !purchasing && handlePurchase(PRODUCTS.SUBSCRIPTION)}
        disabled={!isSubAvailable || purchasing}
        accessibilityLabel="Start Free Trial"
      >
        <LinearGradient
          colors={['#FFD700', '#FFB300', '#FF9500']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientButton}
        >
          {purchasing && isSubAvailable ? (
            <ActivityIndicator size="small" color="#222" style={{ marginRight: 10 }} />
          ) : (
            <Ionicons name="star" size={18} color="#222" style={{ marginRight: 10 }} />
          )}
          <Text style={styles.upgradeButtonText}>
            Start Free Trial – {subscriptions[0]?.localizedPrice || '$4.99/mo'}
          </Text>
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity
        style={{ marginHorizontal: 16, marginTop: 12, minHeight: 48, borderRadius: 10, overflow: 'hidden' }}
        onPress={() => isOneTimeAvailable && !purchasing && handlePurchase(PRODUCTS.LIFETIME)}
        disabled={!isOneTimeAvailable || purchasing}
        accessibilityLabel="One-Time Purchase"
      >
        <LinearGradient
          colors={['#007AFF', '#005BBB', '#00C6FB']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientButton}
        >
          {purchasing && isOneTimeAvailable ? (
            <ActivityIndicator size="small" color="#fff" style={{ marginRight: 10 }} />
          ) : (
            <Ionicons name="diamond" size={18} color="#fff" style={{ marginRight: 10 }} />
          )}
          <Text style={styles.oneTimeButtonText}>
            One-Time Purchase – {products[0]?.localizedPrice || '$19.99'}
          </Text>
        </LinearGradient>
      </TouchableOpacity>

      <Text style={styles.specialPriceText}>
        Pay once: <Text style={{ fontWeight: 'bold' }}>$19.99</Text> <Text style={{ color: '#aaa', textDecorationLine: 'line-through' }}>$39.99</Text>
      </Text>

      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelButton}>
        <Text style={styles.cancelText}>Not now, take me back</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

export default SubscriptionScreen;
