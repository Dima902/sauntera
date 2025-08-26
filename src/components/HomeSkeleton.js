// components/HomeSkeleton.js
import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function HomeSkeleton() {
  return (
    <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 20 }}>
      {/* Fake header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
        <View style={{ height: 24, width: 150, backgroundColor: '#e0e0e0', borderRadius: 10 }} />
        <View style={{ height: 24, width: 40, backgroundColor: '#e0e0e0', borderRadius: 10 }} />
      </View>

      {/* Skeleton cards */}
      <View style={{ height: 270, backgroundColor: '#e0e0e0', borderRadius: 12, marginBottom: 20 }} />
      <View style={{ height: 270, backgroundColor: '#e0e0e0', borderRadius: 12, marginBottom: 20 }} />
    </View>
  );
}
