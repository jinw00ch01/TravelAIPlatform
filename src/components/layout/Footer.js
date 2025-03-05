import React from 'react';
import { Link } from 'react-router-dom';

function Footer() {
  return (
    <footer className="bg-white">
      <div className="max-w-7xl mx-auto py-12 px-4 overflow-hidden sm:px-6 lg:px-8">
        <nav className="-mx-5 -my-2 flex flex-wrap justify-center" aria-label="Footer">
          <div className="px-5 py-2">
            <Link to="/" className="text-base text-gray-500 hover:text-gray-900">
              홈
            </Link>
          </div>
          <div className="px-5 py-2">
            <Link to="/plan" className="text-base text-gray-500 hover:text-gray-900">
              여행 계획하기
            </Link>
          </div>
          <div className="px-5 py-2">
            <a href="/terms" className="text-base text-gray-500 hover:text-gray-900">
              이용약관
            </a>
          </div>
          <div className="px-5 py-2">
          <a href="/privacy" className="text-gray-300 hover:text-white">
              개인정보처리방침
          </a>
          </div>
        </nav>
        <p className="mt-8 text-center text-base text-gray-400">
          &copy; 2023 AI 여행 서비스 플랫폼. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

export default Footer;