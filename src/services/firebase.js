// Firebase 가져오기 대신 AWS 서비스를 사용하도록 변경
import apiClient, { travelApi } from './api';

// Firebase/Firestore 데이터베이스 참조 대신 API 클라이언트 익스포트
export const db = {
  // Firebase의 컬렉션, 문서 접근 대신 API 호출 제공
  collection: {
    // 여행 계획 컬렉션
    travelPlans: {
      // AWS API를 통해 데이터 추가
      add: async (data) => {
        try {
          // API 호출을 통해 DynamoDB에 데이터 저장
          const response = await travelApi.createTravelPlan(data);
          return { id: response.planId }; // docRef 형태로 반환
        } catch (error) {
          console.error("AWS API 호출 실패:", error);
          throw error;
        }
      },
      // 문서 가져오기
      doc: (id) => ({
        get: async () => {
          try {
            const data = await travelApi.getTravelPlan(id);
            return {
              exists: !!data,
              data: () => data,
              id: id
            };
          } catch (error) {
            console.error("여행 계획 조회 실패:", error);
            throw error;
          }
        },
        // 문서 업데이트
        update: async (updates) => {
          try {
            await apiClient.put(`/travel/plan/${id}`, updates);
            return true;
          } catch (error) {
            console.error("여행 계획 업데이트 실패:", error);
            throw error;
          }
        },
        // 문서 삭제
        delete: async () => {
          try {
            await apiClient.delete(`/travel/plan/${id}`);
            return true;
          } catch (error) {
            console.error("여행 계획 삭제 실패:", error);
            throw error;
          }
        }
      })
    }
  }
};

// Firebase serverTimestamp 함수 대체
export const serverTimestamp = () => new Date().toISOString();

// Firebase 관련 함수 대체
export const addDoc = async (collectionRef, data) => {
  // travelApi를 통해 데이터 추가
  const response = await travelApi.createTravelPlan(data);
  return { id: response.planId };
};

export const collection = (db, collectionName) => {
  // 지원되는 컬렉션 타입에 따라 다른 핸들러 반환
  if (collectionName === 'travelPlans') {
    return db.collection.travelPlans;
  }
  
  throw new Error(`지원되지 않는 컬렉션: ${collectionName}`);
};

// 이 모듈은 AWS 서비스를 사용하도록 변환된 Firebase 대체 모듈입니다.
// Firebase에서 AWS로의 마이그레이션 단계입니다.
console.warn('Firebase 가져오기가 AWS 서비스로 대체되었습니다. 코드를 업데이트하세요.'); 