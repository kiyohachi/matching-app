'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [scrollY, setScrollY] = useState(0);
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        router.push('/dashboard');
      } else {
        setLoading(false);
      }
    }
    
    checkAuth();
  }, [router]);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 背景画像の透明度を決定する関数
  const getBackgroundOpacity = () => {
    const scrollProgress = scrollY / (document.body.scrollHeight - window.innerHeight);
    
    if (scrollProgress < 0.25) {
      return {
        classroom: 1,
        schoolyard: 0,
        gymnasium: 0
      };
    } else if (scrollProgress < 0.35) {
      // 教室から校庭への切り替え
      const transition = (scrollProgress - 0.25) / 0.1;
      return {
        classroom: 1 - transition,
        schoolyard: transition,
        gymnasium: 0
      };
    } else if (scrollProgress < 0.55) {
      return {
        classroom: 0,
        schoolyard: 1,
        gymnasium: 0
      };
    } else if (scrollProgress < 0.65) {
      // 校庭から体育館への切り替え
      const transition = (scrollProgress - 0.55) / 0.1;
      return {
        classroom: 0,
        schoolyard: 1 - transition,
        gymnasium: transition
      };
    } else {
      return {
        classroom: 0,
        schoolyard: 0,
        gymnasium: 1
      };
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-orange-400 via-red-500 to-yellow-500">
        <div className="text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-white font-bold text-xl">R</span>
          </div>
          <p className="text-white text-lg font-medium">読み込み中...</p>
        </div>
      </div>
    );
  }

  const backgroundOpacity = getBackgroundOpacity();

  return (
    <div className="relative min-h-screen bg-black">
      {/* 固定背景画像 - フェード効果 */}
      <div className="fixed inset-0 z-0">
        {/* 教室の画像 */}
        <div 
          className="absolute inset-0 transition-opacity duration-500 ease-in-out"
          style={{ opacity: backgroundOpacity.classroom }}
        >
          <Image
            src="/images/classroom-students.jpg"
            alt="教室で談笑する学生たち"
            fill
            className="object-cover"
            style={{ objectPosition: 'center center' }}
            priority
          />
        </div>
        
        {/* 校庭の画像 */}
        <div 
          className="absolute inset-0 transition-opacity duration-500 ease-in-out"
          style={{ opacity: backgroundOpacity.schoolyard }}
        >
          <Image
            src="/images/schoolyard-baseball.jpg"
            alt="校庭で野球をする仲間たち"
            fill
            className="object-cover"
            style={{ objectPosition: 'center 30%' }}
          />
        </div>
        
        {/* 体育館の画像 */}
        <div 
          className="absolute inset-0 transition-opacity duration-500 ease-in-out"
          style={{ opacity: backgroundOpacity.gymnasium }}
        >
          <Image
            src="/images/gymnasium-music.jpg"
            alt="体育館で音楽を演奏する仲間たち"
            fill
            className="object-cover"
            style={{ objectPosition: 'center 40%' }}
          />
        </div>
        
        {/* 真っ黒オーバーレイ */}
        <div className="absolute inset-0 bg-black/70"></div>
      </div>

      {/* ヘッダー */}
      <header className="relative z-50 bg-black/40 backdrop-blur-sm border-b border-white/10 sticky top-0">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-orange-500 via-red-500 to-yellow-500 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-lg">R</span>
              </div>
              <h1 className="text-2xl font-bold text-white drop-shadow-lg">Reunion</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/auth')}
                className="text-white/80 hover:text-white font-medium transition-colors"
              >
                ログイン
              </button>
              <button
                onClick={() => router.push('/auth?mode=signup')}
                className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-2 rounded-full hover:from-orange-600 hover:to-red-600 transition-all duration-300 font-medium shadow-lg hover:shadow-xl"
              >
                無料で始める
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="relative z-10 text-white">
        {/* ヒーローセクション */}
        <section className="min-h-screen flex items-center justify-center px-6">
          <div className="text-center max-w-4xl mx-auto">
            <h2 className="text-6xl md:text-8xl font-bold mb-8 leading-tight drop-shadow-2xl">
              昔の友達と<br />
              再び繋がろう
            </h2>
            
            <p className="text-3xl md:text-4xl text-white/95 mb-12 font-light drop-shadow-lg">
              懐かしい同級生、部活の仲間と再会
            </p>
            
            <p className="text-2xl text-orange-300 mb-16 font-medium drop-shadow-md">
              お互いに「いいね」するまで相手には絶対にバレません
            </p>

            <div className="flex flex-col sm:flex-row gap-6 justify-center max-w-lg mx-auto">
              <button
                onClick={() => router.push('/auth?mode=signup')}
                className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xl py-5 px-10 rounded-full hover:from-orange-600 hover:to-red-600 transition-all duration-300 font-semibold shadow-2xl transform hover:-translate-y-1"
              >
                無料で始める
              </button>
              
              <button
                onClick={() => router.push('/auth')}
                className="flex-1 bg-white/20 backdrop-blur-sm text-white border-2 border-white/50 text-xl py-5 px-10 rounded-full hover:bg-white/30 transition-all duration-300 font-medium"
              >
                ログイン
              </button>
            </div>
          </div>
        </section>

        {/* 使い方セクション */}
        <section className="py-32 px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h3 className="text-5xl md:text-6xl font-bold mb-20 drop-shadow-2xl">
              簡単3ステップで再会
            </h3>
            
            <div className="space-y-24">
              <div className="text-center">
                <div className="text-8xl mb-8">📱</div>
                <h4 className="text-4xl font-bold mb-8 drop-shadow-lg">
                  1. URLを送信
                </h4>
                <p className="text-2xl text-white/90 leading-relaxed max-w-2xl mx-auto">
                  同窓会やクラス会のLINEグループに<br />
                  ReunionのURLを送信するだけで開始
                </p>
              </div>

              <div className="text-center">
                <div className="text-8xl mb-8">💝</div>
                <h4 className="text-4xl font-bold mb-8 drop-shadow-lg">
                  2. いいねを送信
                </h4>
                <p className="text-2xl text-white/90 leading-relaxed max-w-2xl mx-auto">
                  会いたい人を選んでいいねを送信<br />
                  相手には絶対にバレません
                </p>
              </div>

              <div className="text-center">
                <div className="text-8xl mb-8">🎉</div>
                <h4 className="text-4xl font-bold mb-8 drop-shadow-lg">
                  3. マッチング成立
                </h4>
                <p className="text-2xl text-white/90 leading-relaxed max-w-2xl mx-auto">
                  相互にいいねでマッチング成立！<br />
                  連絡先を交換して再会しよう
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* セキュリティーセクション */}
        <section className="py-32 px-6">
          <div className="max-w-4xl mx-auto text-center">
            <div className="text-8xl mb-12">🔒</div>
            
            <h3 className="text-5xl md:text-6xl font-bold mb-12 drop-shadow-2xl">
              完全プライバシー保護
            </h3>
            
            <p className="text-3xl md:text-4xl text-white/95 mb-20 font-light drop-shadow-lg leading-relaxed">
              <span className="text-orange-300 font-semibold">相互にマッチングするまで、<br />お互いの気持ちは絶対に秘密</span>
            </p>

            <div className="space-y-20">
              <div className="text-center">
                <div className="text-6xl mb-8">🛡️</div>
                <h4 className="text-3xl font-bold mb-6 drop-shadow-lg">完全匿名システム</h4>
                <p className="text-xl text-white/90 leading-relaxed max-w-2xl mx-auto">
                  お互いがいいねするまで、あなたの気持ちは相手に一切知られません。<br />
                  気軽に「会いたい」を表現できます。
                </p>
              </div>

              <div className="text-center">
                <div className="text-6xl mb-8">🔐</div>
                <h4 className="text-3xl font-bold mb-6 drop-shadow-lg">プライバシー保護</h4>
                <p className="text-xl text-white/90 leading-relaxed max-w-2xl mx-auto">
                  マッチング後にのみ連絡先を交換。<br />
                  個人情報は厳重に保護され、安心してご利用いただけます。
                </p>
              </div>

              <div className="text-center">
                <div className="text-6xl mb-8">⚡</div>
                <h4 className="text-3xl font-bold mb-6 drop-shadow-lg">簡単操作</h4>
                <p className="text-xl text-white/90 leading-relaxed max-w-2xl mx-auto">
                  LINEグループから始める簡単な操作。<br />
                  複雑な設定は不要で、誰でも気軽に始められます。
                </p>
              </div>

              <div className="text-center">
                <div className="text-6xl mb-8">🎓</div>
                <h4 className="text-3xl font-bold mb-6 drop-shadow-lg">学校時代の絆</h4>
                <p className="text-xl text-white/90 leading-relaxed max-w-2xl mx-auto">
                  同級生、部活の仲間、文化祭で共演した仲間など、<br />
                  学校時代の様々な絆を大切にします。
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ユーザーの声セクション */}
        <section className="py-32 px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h3 className="text-5xl md:text-6xl font-bold mb-20 drop-shadow-2xl">
              ユーザーの声
            </h3>
            
            <div className="space-y-16">
              <div className="text-center">
                <div className="text-4xl mb-4">💬</div>
                <h4 className="text-2xl font-bold mb-4 drop-shadow-lg">Aさん（20代女性）</h4>
                <p className="text-lg text-white/90 leading-relaxed max-w-2xl mx-auto">
                  「高校の同級生と20年ぶりに再会できました！<br />
                  お互いに気持ちを伝えるのは恥ずかしかったけど、<br />
                  匿名だったから安心でした。」
                </p>
              </div>

              <div className="text-center">
                <div className="text-4xl mb-4">💬</div>
                <h4 className="text-2xl font-bold mb-4 drop-shadow-lg">Bさん（30代男性）</h4>
                <p className="text-lg text-white/90 leading-relaxed max-w-2xl mx-auto">
                  「大学のサークル仲間と15年ぶりに再会！<br />
                  お互いに今でも気になっていたことがわかって<br />
                  嬉しかったです。」
                </p>
              </div>

              <div className="text-center">
                <div className="text-4xl mb-4">💬</div>
                <h4 className="text-2xl font-bold mb-4 drop-shadow-lg">Cさん（40代女性）</h4>
                <p className="text-lg text-white/90 leading-relaxed max-w-2xl mx-auto">
                  「中学の部活仲間と25年ぶりに再会！<br />
                  当時の思い出話に花が咲いて、<br />
                  青春時代に戻ったような気持ちになりました。」
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTAセクション */}
        <section className="py-32 px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h3 className="text-5xl md:text-6xl font-bold mb-12 drop-shadow-2xl">
              今すぐ懐かしい仲間と再会しよう
            </h3>
            
            <p className="text-2xl mb-16 text-white/90 leading-relaxed">
              学校時代の大切な思い出を共有した仲間たちが、<br />
              あなたとの再会を待っています。
            </p>
            
            <div className="flex flex-col sm:flex-row gap-6 justify-center max-w-lg mx-auto">
              <button
                onClick={() => router.push('/auth?mode=signup')}
                className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xl py-5 px-10 rounded-full hover:from-orange-600 hover:to-red-600 transition-all duration-300 font-semibold shadow-2xl transform hover:-translate-y-1"
              >
                無料で始める
              </button>
              <button
                onClick={() => router.push('/auth')}
                className="flex-1 bg-white/20 backdrop-blur-sm text-white border-2 border-white/50 text-xl py-5 px-10 rounded-full hover:bg-white/30 hover:border-white/70 transition-all duration-300 font-semibold"
              >
                ログイン
              </button>
            </div>
            
            <p className="mt-12 text-white/70 text-lg">
              ※ 完全無料でご利用いただけます
            </p>
          </div>
        </section>
      </main>

      {/* フッター */}
      <footer className="relative z-10 bg-black/80 backdrop-blur-sm text-white py-16">
        <div className="container mx-auto px-6 text-center">
          <div className="flex items-center justify-center space-x-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-r from-orange-500 via-red-500 to-yellow-500 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-xl">R</span>
            </div>
            <h3 className="text-3xl font-bold">Reunion</h3>
          </div>
          <p className="text-gray-300 text-lg mb-8 max-w-2xl mx-auto">
            学校時代の仲間との再会をサポートする安全なマッチングアプリ
          </p>
          <div className="flex justify-center space-x-8 mb-8">
            <a href="#" className="text-gray-400 hover:text-white transition-colors">プライバシーポリシー</a>
            <a href="#" className="text-gray-400 hover:text-white transition-colors">利用規約</a>
            <a href="#" className="text-gray-400 hover:text-white transition-colors">お問い合わせ</a>
          </div>
          <p className="text-gray-500">&copy; 2024 Reunion. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
