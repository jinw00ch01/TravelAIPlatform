import axios from 'axios';
import { TranslateClient, TranslateTextCommand } from "@aws-sdk/client-translate";

// CORS 응답 헤더
const getCorsHeaders = (allowedMethods = 'OPTIONS,POST') => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': allowedMethods
});

// AWS Translate v3 클라이언트 생성
const translateClient = new TranslateClient({ region: 'ap-northeast-2' });

export const handler = async (event) => {
  console.log('✅ Received event');

  try {
    const API_KEY = process.env.AMADEUS_API_KEY;
    const API_SECRET = process.env.AMADEUS_API_SECRET;

    if (!API_KEY || !API_SECRET) {
      console.error('❌ API 키 또는 시크릿이 설정되지 않음');
      return {
        statusCode: 500,
        headers: getCorsHeaders(),
        body: JSON.stringify({ error: 'API key/secret not configured in environment variables' })
      };
    }

    // Amadeus 인증 토큰 요청
    const authResponse = await axios({
      method: 'POST',
      url: 'https://api.amadeus.com/v1/security/oauth2/token',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: `grant_type=client_credentials&client_id=${API_KEY}&client_secret=${API_SECRET}`
    });

    const token = authResponse.data.access_token;
    console.log('✅ Access token obtained');

    // 요청 본문 파싱
    const body = JSON.parse(event.body || '{}');
    const { latitude, longitude, radius = 5, startDate, endDate } = body;

    if (!latitude || !longitude || !startDate || !endDate) {
      return {
        statusCode: 400,
        headers: getCorsHeaders(),
        body: JSON.stringify({ error: 'Missing required parameters: latitude, longitude, startDate, endDate' })
      };
    }

    // Amadeus 활동 검색 요청
    const activityResponse = await axios({
      method: 'GET',
      url: 'https://api.amadeus.com/v1/shopping/activities',
      headers: {
        Authorization: `Bearer ${token}`
      },
      params: {
        latitude,
        longitude,
        radius,
        startDate,
        endDate
      }
    });

    const rawData = activityResponse.data.data?.slice(0, 20) || [];

    // 이름 번역 요청
    const translatedNames = await Promise.all(
      rawData.map(async (item) => {
        try {
          const command = new TranslateTextCommand({
            Text: item.name,
            SourceLanguageCode: 'en',
            TargetLanguageCode: 'ko'
          });

          const result = await translateClient.send(command);
          return result.TranslatedText;
        } catch (err) {
          console.warn(`⚠ 번역 실패 (${item.name}): ${err.message}`);
          return item.name; // 실패 시 원래 영어 이름 반환
        }
      })
    );

    const slimData = rawData.map((item, idx) => ({
      id: item.id,
      name: item.name,
      translatedName: translatedNames[idx],
      shortDescription: item.shortDescription,
      price: item.price?.amount ? `${item.price.amount} ${item.price.currencyCode}` : 'N/A',
      bookingLink: item.bookingLink,
      images: item.pictures?.slice(0, 1) || []
    }));

    const response = {
      data: slimData,
      count: slimData.length
    };

    return {
      statusCode: 200,
      headers: getCorsHeaders(),
      body: JSON.stringify(response)
    };

  } catch (error) {
    console.error('❌ Error occurred while calling Amadeus API or Translate');

    return {
      statusCode: error.response?.status || 500,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        message: 'Failed to retrieve or translate activities',
        error: error.response?.data || error.message
      })
    };
  }
};
