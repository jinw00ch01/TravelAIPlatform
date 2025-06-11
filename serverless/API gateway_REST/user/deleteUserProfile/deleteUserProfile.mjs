const AWS = require('aws-sdk');
const dynamoDb = new AWS.DynamoDB.DocumentClient();
const cognito = new AWS.CognitoIdentityServiceProvider();

const USERS_TABLE = process.env.USERS_TABLE || 'Users_Table'; //환경 변수로 해도 무방함
const TRAVEL_PLANS_TABLE = process.env.TRAVEL_PLANS_TABLE || 'travel-plans';
const SAVED_PLANS_TABLE = process.env.SAVED_PLANS_TABLE || 'saved_plans';
const USER_POOL_ID = process.env.USER_POOL_ID || 'ap-northeast-2_XLrwYHphs';

exports.handler = async (event) => {
    let email = null;
if (event.queryStringParameters && event.queryStringParameters.email) {
  email = event.queryStringParameters.email;
} else if (event.body) {
  try {
    const body = JSON.parse(event.body);
    email = body.email;
  } catch (e) {}
}
    console.log("수신된 이벤트:", JSON.stringify(event));

    if (!email) {
        console.log("오류: 이메일이 전달되지 않았습니다.");
        return {
            statusCode: 400,
            body: JSON.stringify({ success: false, message: 'email이 필요합니다.' })
        };
    }

    try { //매커니즘 - emial이라는 동일한 키가 존재하기에 해당 칼럼으로 파티션 키를 검색하여 매칭 후 삭제 (모든 테이블, 코그니토)
        // 1. Users_Table에서 userId 검색 및 삭제 
        console.log(`Users 테이블에서 이메일(${email})로 사용자 검색 중...`);
        const userScan = await dynamoDb.scan({
            TableName: USERS_TABLE,
            FilterExpression: 'email = :email',
            ExpressionAttributeValues: { ':email': email }
        }).promise();

        console.log("Users 테이블 검색 결과:", userScan);

        if (userScan.Items && userScan.Items.length > 0) {
            const userId = userScan.Items[0].userId;
            console.log(`userId(${userId})를 가진 사용자 삭제 중...`);
            await dynamoDb.delete({
                TableName: USERS_TABLE,
                Key: { userId }
            }).promise();
        } else {
            console.log("해당 이메일을 가진 사용자가 없습니다.");
        }

        // 2. travel-plans 테이블에서 사용자 플랜 모두 삭제
        console.log(`travel-plans 테이블에서 user_id(${email})로 플랜 검색 중...`);
        const plansScan = await dynamoDb.scan({
            TableName: TRAVEL_PLANS_TABLE,
            FilterExpression: 'user_id = :email',
            ExpressionAttributeValues: { ':email': email }
        }).promise();

        console.log(`삭제할 플랜 개수: ${plansScan.Items?.length || 0}`);

        if (plansScan.Items && plansScan.Items.length > 0) {
            for (const item of plansScan.Items) {
                console.log(`플랜(planId: ${item.planId}) 삭제 중...`);
                await dynamoDb.delete({
                    TableName: TRAVEL_PLANS_TABLE,
                    Key: { planId: item.planId }
                }).promise();
            }
        }

        // 3. saved_plans 테이블에서 user_id로 plan_id들 찾아서 모두 삭제 (복합키)
        console.log(`saved_plans 테이블에서 user_id(${email})로 저장된 플랜 검색 중...`);
        const savedPlansScan = await dynamoDb.scan({
            TableName: SAVED_PLANS_TABLE,
            FilterExpression: 'user_id = :email',
            ExpressionAttributeValues: { ':email': email }
        }).promise();

        console.log("saved_plans scan 결과:", savedPlansScan.Items);

        if (savedPlansScan.Items && savedPlansScan.Items.length > 0) {
            for (const item of savedPlansScan.Items) {
                console.log("saved_plans에서 삭제할 user_id, plan_id:", item.user_id, item.plan_id);
                await dynamoDb.delete({
                    TableName: SAVED_PLANS_TABLE,
                    Key: {
                        user_id: item.user_id,
                        plan_id: item.plan_id
                    }
                }).promise();
            }
            console.log("saved_plans에서 삭제 완료");
        } else {
            console.log("saved_plans에서 해당 email의 plan_id를 찾지 못함");
        }

        // 4. Cognito 사용자 삭제
        console.log(`Cognito에서 이메일(${email})로 사용자 검색 중...`);
        const users = await cognito.listUsers({
            UserPoolId: USER_POOL_ID,
            Filter: `email = \"${email}\"`
        }).promise();

        console.log(`Cognito 사용자 수: ${users.Users?.length || 0}`);

        if (users.Users && users.Users.length > 0) {
            const username = users.Users[0].Username;
            console.log(`Cognito 사용자(username: ${username}) 삭제 중...`);
            await cognito.adminDeleteUser({
                UserPoolId: USER_POOL_ID,
                Username: username
            }).promise();
        } else {
            console.log("Cognito에서 해당 이메일 사용자를 찾을 수 없습니다.");
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, message: 'DynamoDB, Cognito 모든 데이터 삭제 완료' })
        };
    } catch (error) {
        console.error("오류 발생:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, message: '삭제 실패', error: error.message })
        };
    }
};
