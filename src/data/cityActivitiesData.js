// 각 도시별 액티비티 데이터를 import
import { seoulActivities } from "./cities/seoul";
import { busanActivities } from "./cities/busan";
import { tokyoActivities } from "./cities/tokyo";
import { osakaActivities } from "./cities/osaka";
import { newyorkActivities } from "./cities/newyork";
import { parisActivities } from "./cities/paris";
import { bangkokActivities } from "./cities/bangkok";

// 도시별 액티비티 데이터를 통합한 객체
export const CITY_ACTIVITIES = {
  "서울": seoulActivities,
  "부산": busanActivities,
  "도쿄": tokyoActivities,
  "오사카": osakaActivities,
  "뉴욕": newyorkActivities,
  "파리": parisActivities,
  "방콕": bangkokActivities
}; 