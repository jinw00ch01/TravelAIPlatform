import React, { useState } from 'react';
import { Link } from 'react-router-dom';

function TravelResults({ results, searchQuery, onSaveItinerary }) {
  const [selectedResult, setSelectedResult] = useState(results?.[0] || null);
  
  // 결과가 없는 경우
  if (!results || results.length === 0) {
    return (
      <div className="text-center py-10">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">검색 결과가 없습니다</h3>
        <p className="mt-1 text-sm text-gray-500">다른 검색어나 조건으로 다시 시도해보세요.</p>
        <div className="mt-6">
          <Link to="/plan" className="btn-primary">
            다시 시도하기
          </Link>
        </div>
      </div>
    );
  }

  // 결과 저장 핸들러
  const handleSave = () => {
    if (selectedResult && onSaveItinerary) {
      onSaveItinerary(selectedResult);
    }
  };

  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden">
      <div className="p-4 border-b bg-gray-50">
        <h3 className="text-lg font-medium">AI 추천 여행 결과</h3>
        {searchQuery && (
          <p className="text-sm text-gray-500 mt-1">
            "{searchQuery}" 검색 결과 ({results.length}건)
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
        {/* 결과 목록 사이드바 */}
        <div className="col-span-1 border-r">
          <div className="p-4 bg-gray-50 border-b">
            <h4 className="font-medium">추천 여행 일정</h4>
            <p className="text-sm text-gray-500 mt-1">추천 일정을 선택하세요</p>
          </div>
          <div className="overflow-y-auto max-h-96">
            {results.map((result, index) => (
              <div
                key={index}
                className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${
                  selectedResult === result ? 'bg-blue-50 border-l-4 border-l-primary' : ''
                }`}
                onClick={() => setSelectedResult(result)}
              >
                <h5 className="font-medium text-gray-900">{result.title || `여행 계획 ${index + 1}`}</h5>
                <p className="text-sm text-gray-500 mt-1">
                  {result.destination || '여러 목적지'} • {result.days?.length || 0}일
                </p>
                {result.tags && result.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {result.tags.map((tag, tagIndex) => (
                      <span key={tagIndex} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 선택된 결과 상세 정보 */}
        <div className="col-span-1 md:col-span-2 p-4">
          {selectedResult ? (
            <div>
              <div className="mb-4">
                <h2 className="text-xl font-bold text-gray-900">{selectedResult.title || '여행 계획'}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedResult.destination && `목적지: ${selectedResult.destination}`}
                  {selectedResult.duration && ` • ${selectedResult.duration}`}
                </p>
                {selectedResult.summary && (
                  <p className="mt-4 text-gray-700">{selectedResult.summary}</p>
                )}
              </div>

              {/* 태그 */}
              {selectedResult.tags && selectedResult.tags.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">특징</h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedResult.tags.map((tag, index) => (
                      <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 일정 미리보기 */}
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-900 mb-2">일정 미리보기</h4>
                <div className="border rounded-md overflow-hidden">
                  {selectedResult.days && selectedResult.days.map((day, index) => (
                    <div key={index} className="border-b last:border-b-0">
                      <div className="p-3 bg-gray-50 border-b">
                        <h5 className="font-medium">{index + 1}일차: {day.title || ''}</h5>
                      </div>
                      <div className="p-3">
                        {day.activities && day.activities.length > 0 ? (
                          day.activities.slice(0, 3).map((activity, actIndex) => (
                            <div key={actIndex} className="mb-2 last:mb-0">
                              <p className="text-sm">
                                <span className="font-medium">{activity.time || '시간 미정'}</span>: {activity.description}
                              </p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-gray-500">상세 일정이 없습니다.</p>
                        )}
                        {day.activities && day.activities.length > 3 && (
                          <p className="text-xs text-gray-500 mt-2">...외 {day.activities.length - 3}개 활동</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 예산 정보 */}
              {selectedResult.budget && (
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">예산 정보</h4>
                  <div className="bg-gray-50 p-3 rounded-md">
                    <p className="font-medium">{selectedResult.budget.toLocaleString()} 원</p>
                  </div>
                </div>
              )}

              {/* 액션 버튼 */}
              <div className="mt-8 flex space-x-4">
                <button
                  className="btn-primary flex-1"
                  onClick={handleSave}
                >
                  이 계획으로 저장하기
                </button>
                <Link to="/plan" className="btn-secondary flex-1 text-center">
                  다시 검색하기
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">왼쪽에서 결과를 선택해주세요</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TravelResults;