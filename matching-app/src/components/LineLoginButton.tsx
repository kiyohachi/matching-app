'use client';

import { useState } from 'react';

interface LineLoginButtonProps {
  className?: string;
  disabled?: boolean;
}

export default function LineLoginButton({ className = '', disabled = false }: LineLoginButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleLineLogin = () => {
    if (disabled || isLoading) return;
    
    setIsLoading(true);
    console.log('LINEログイン開始');
    
    // LINE認証APIエンドポイントにリダイレクト
    window.location.href = '/api/auth/line';
  };

  return (
    <button
      onClick={handleLineLogin}
      disabled={disabled || isLoading}
      className={`
        w-full flex items-center justify-center gap-3 
        bg-[#06C755] hover:bg-[#05B84F] disabled:bg-gray-400
        text-white font-semibold text-base
        px-6 py-3 rounded-lg
        transition-all duration-200 ease-in-out
        shadow-md hover:shadow-lg
        disabled:cursor-not-allowed disabled:opacity-50
        ${className}
      `}
    >
      {isLoading ? (
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          <span>認証中...</span>
        </div>
      ) : (
        <>
          {/* LINE公式アイコン */}
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="flex-shrink-0"
          >
            <path
              d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.2 0-.393-.078-.535-.219l-2.443-2.418v2.006c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .392.078.536.219l2.44 2.418V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771h.006zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"
              fill="currentColor"
            />
          </svg>
          <span>LINEでログイン</span>
        </>
      )}
    </button>
  );
} 