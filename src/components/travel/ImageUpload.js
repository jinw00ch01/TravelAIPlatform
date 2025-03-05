import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Storage } from 'aws-amplify/storage';
import { useAuth } from '../auth/AuthContext';
import { travelApi } from '../../services/api';

function ImageUpload() {
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // 이미지 파일 변경 핸들러
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 이미지 파일만 허용
    if (!file.type.match('image.*')) {
      setError('이미지 파일만 업로드 가능합니다.');
      return;
    }

    // 파일 크기 제한 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('이미지 크기는 5MB 이하여야 합니다.');
      return;
    }

    setImage(file);
    setError('');

    // 미리보기 생성
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  // 이미지 삭제 핸들러
  const handleRemoveImage = () => {
    setImage(null);
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 이미지 업로드 및 검색 요청
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!image) {
      setError('이미지를 업로드해주세요.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // AWS S3에 이미지 업로드
      const filename = `travel-images/${currentUser.username}/${Date.now()}-${image.name}`;
      
      // Amplify Storage 라이브러리를 사용하여 S3에 업로드
      const uploadResult = await Storage.put(filename, image, {
        contentType: image.type
      });
      
      // S3 URL 생성
      const imageUrl = uploadResult.key ? 
        `https://${process.env.REACT_APP_S3_BUCKET_NAME}.s3.${process.env.REACT_APP_REGION}.amazonaws.com/${uploadResult.key}` : 
        null;

      // API를 통해 이미지 검색 요청
      const searchResults = await travelApi.searchByImage(image, {
        userId: currentUser.uid,
        imageUrl: imageUrl
      });

      // 검색 결과 페이지로 이동
      navigate('/plan/image-results', { state: { results: searchResults, imageUrl } });
      
    } catch (err) {
      setError('이미지 검색에 실패했습니다. 다시 시도해주세요.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto my-8 p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">이미지로 여행지 찾기</h2>
      
      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-6">
          <label className="block text-gray-700 mb-2">
            원하는 여행지와 비슷한 이미지를 업로드하세요
          </label>
          
          <div className="mt-2 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
            <div className="space-y-1 text-center">
              {preview ? (
                <div className="relative">
                  <img
                    src={preview}
                    alt="미리보기"
                    className="mx-auto h-64 object-cover rounded-md"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1 m-1"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <>
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    stroke="currentColor"
                    fill="none"
                    viewBox="0 0 48 48"
                  >
                    <path
                      d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <div className="flex text-sm text-gray-600">
                    <label
                      htmlFor="file-upload"
                      className="relative cursor-pointer bg-white rounded-md font-medium text-primary hover:text-primary-dark"
                    >
                      <span>파일 업로드</span>
                      <input
                        id="file-upload"
                        name="file-upload"
                        type="file"
                        className="sr-only"
                        accept="image/*"
                        onChange={handleImageChange}
                        ref={fileInputRef}
                      />
                    </label>
                    <p className="pl-1">또는 파일을 여기에 드래그 앤 드롭하세요</p>
                  </div>
                  <p className="text-xs text-gray-500">PNG, JPG, GIF (최대 5MB)</p>
                </>
              )}
            </div>
          </div>
        </div>
        
        <div className="mb-6">
          <label className="block text-gray-700 mb-2" htmlFor="preferences">여행 선호도 (선택사항)</label>
          <select
            id="preferences"
            className="form-input"
          >
            <option value="">선택하지 않음</option>
            <option value="nature">자연/경치</option>
            <option value="city">도시/번화가</option>
            <option value="beach">해변/바다</option>
            <option value="mountain">산/등산</option>
            <option value="culture">문화/역사</option>
            <option value="food">음식/미식</option>
          </select>
          <p className="mt-1 text-sm text-gray-500">여행 선호도를 선택하면 더 정확한 추천을 받을 수 있습니다.</p>
        </div>
        
        <div className="flex items-center justify-between">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate('/plan')}
          >
            텍스트로 계획하기
          </button>
          
          <button
            type="submit"
            className="btn-primary"
            disabled={loading || !image}
          >
            {loading ? '검색 중...' : '이미지로 여행지 찾기'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ImageUpload;
