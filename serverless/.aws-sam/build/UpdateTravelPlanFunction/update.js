const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  try {
    const planId = event.pathParameters.id;
    const userId = event.requestContext.authorizer.claims.sub;
    const requestBody = JSON.parse(event.body);
    
    // 여행 계획 존재 여부 및 소유권 확인
    const getParams = {
      TableName: process.env.TRAVEL_PLANS_TABLE,
      Key: { id: planId }
    };
    
    const planData = await dynamoDB.get(getParams).promise();
    
    if (!planData.Item) {
      return {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: '여행 계획을 찾을 수 없습니다.' })
      };
    }
    
    if (planData.Item.userId !== userId) {
      return {
        statusCode: 403,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: '이 여행 계획을 수정할 권한이 없습니다.' })
      };
    }
    
    // 여행 계획 업데이트
    const updateParams = {
      TableName: process.env.TRAVEL_PLANS_TABLE,
      Key: { id: planId },
      UpdateExpression: 'set title = :title, description = :description, destinations = :destinations, startDate = :startDate, endDate = :endDate, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':title': requestBody.title,
        ':description': requestBody.description,
        ':destinations': requestBody.destinations,
        ':startDate': requestBody.startDate,
        ':endDate': requestBody.endDate,
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    };
    
    const result = await dynamoDB.update(updateParams).promise();
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(result.Attributes)
    };
  } catch (error) {
    console.error('Error updating travel plan:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: '여행 계획 업데이트 중 오류가 발생했습니다.' })
    };
  }
};
