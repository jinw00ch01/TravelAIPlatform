/**
 * 날짜를 형식화하는 함수
 * @param {Date} date - 형식화할 날짜 객체
 * @param {string} format - 날짜 형식 (기본값: 'YYYY-MM-DD')
 * @returns {string} 형식화된 날짜 문자열
 */
export function formatDate(date, format = 'YYYY-MM-DD') {
    if (!date) return '';
    
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    
    let result = format;
    result = result.replace('YYYY', year);
    result = result.replace('MM', month);
    result = result.replace('DD', day);
    
    return result;
  }
  
  /**
   * 두 날짜 사이의 일수를 계산하는 함수
   * @param {Date} startDate - 시작 날짜
   * @param {Date} endDate - 종료 날짜
   * @returns {number} 두 날짜 사이의 일수
   */
  export function getDaysBetween(startDate, endDate) {
    if (!startDate || !endDate) return 0;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // 밀리초 차이를 일수로 변환
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  }