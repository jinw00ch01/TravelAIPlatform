import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';

const HomeScreen = () => {
  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 섹션 */}
      <View style={styles.header}>
        <Text style={styles.title}>AI와 함께하는</Text>
        <Text style={styles.subtitle}>스마트한 여행 계획</Text>
        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>시작하기</Text>
        </TouchableOpacity>
      </View>

      {/* 서비스 섹션 */}
      <View style={styles.serviceSection}>
        <Text style={styles.sectionTitle}>스마트한 여행의 시작</Text>
        <View style={styles.cardContainer}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>맞춤형 여행 계획</Text>
            <Text style={styles.cardDesc}>AI가 당신의 취향을 분석하여 최적의 여행 코스를 제안합니다.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>실시간 날씨와 정보</Text>
            <Text style={styles.cardDesc}>실시간 날씨와 현지 정보를 반영한 스마트한 일정을 제공합니다.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>원스톱 예약</Text>
            <Text style={styles.cardDesc}>호텔부터 관광지까지 한번에 예약하고 관리할 수 있습니다.</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0052CC',
  },
  header: {
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    color: 'white',
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 28,
    color: '#FFA500',
    fontWeight: 'bold',
    marginTop: 10,
  },
  button: {
    backgroundColor: '#FFA500',
    padding: 15,
    borderRadius: 25,
    marginTop: 30,
    width: 200,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  serviceSection: {
    backgroundColor: 'white',
    padding: 20,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: 40,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  cardContainer: {
    gap: 15,
  },
  card: {
    backgroundColor: '#F5F5F5',
    padding: 20,
    borderRadius: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  cardDesc: {
    color: '#666',
  },
});

export default HomeScreen;