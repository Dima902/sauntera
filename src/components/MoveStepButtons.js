// 📄 components/MoveStepButtons.js
import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/colors';

export default function MoveStepButtons({ index, length, moveStepUp, moveStepDown }) {
  return (
    <View style={{ flexDirection: 'column', alignItems: 'center', marginRight: 8 }}>
      <TouchableOpacity
        onPress={moveStepUp}
        disabled={index === 0}
        style={{ opacity: index === 0 ? 0.3 : 1, marginBottom: 2 }}
      >
        <Ionicons name="arrow-up" size={22} color={index === 0 ? '#ccc' : Colors.primary} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={moveStepDown}
        disabled={index === length - 1}
        style={{ opacity: index === length - 1 ? 0.3 : 1 }}
      >
        <Ionicons name="arrow-down" size={22} color={index === length - 1 ? '#ccc' : Colors.primary} />
      </TouchableOpacity>
    </View>
  );
}