// 시간 정렬 함수 (숙박편은 같은 시간대에서 뒤로 배치)
export const sortSchedulesByTime = (schedules) => {
  if (!schedules || !Array.isArray(schedules) || schedules.length <= 1) {
    return schedules;
  }

  const sorted = schedules.slice().sort((a, b) => {
    // 시간 파싱 함수
    const parseTime = (timeStr) => {
      if (!timeStr || typeof timeStr !== 'string') return 0;
      
      // 특수 케이스 처리
      if (timeStr === '체크인') return 1400; // 14:00
      if (timeStr === '체크아웃') return 1100; // 11:00
      
      // HH:MM 형식 파싱
      const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
      if (timeMatch) {
        const hours = parseInt(timeMatch[1], 10);
        const minutes = parseInt(timeMatch[2], 10);
        return hours * 100 + minutes;
      }
      
      // 숫자만 있는 경우 (예: 1400)
      const numMatch = timeStr.match(/\d+/);
      if (numMatch) {
        const num = parseInt(numMatch[0], 10);
        if (num >= 0 && num <= 2359) {
          return num;
        }
      }
      
      return 0; // 파싱할 수 없는 경우 0으로 처리
    };
    
    const timeA = parseTime(a.time);
    const timeB = parseTime(b.time);
    
    // 시간이 같으면 숙박편을 뒤로 배치
    if (timeA === timeB) {
      const isAccommodationA = a.type === 'accommodation';
      const isAccommodationB = b.type === 'accommodation';
      
      if (isAccommodationA && !isAccommodationB) return 1; // A가 숙박편이면 뒤로
      if (!isAccommodationA && isAccommodationB) return -1; // B가 숙박편이면 A를 앞으로
      return 0; // 둘 다 숙박편이거나 둘 다 일반 일정이면 순서 유지
    }
    
    return timeA - timeB;
  });

  return sorted;
}; 