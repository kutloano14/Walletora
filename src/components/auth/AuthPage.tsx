import { useState } from 'react';
import { Truck } from 'lucide-react';
import { LoginForm } from './LoginForm';
import { SignUpForm } from './SignUpForm';

export function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fff8dd_0%,_#f4fbff_35%,_#f8fafc_100%)] flex items-center justify-center p-4">
      <div className="w-full max-w-6xl flex items-center justify-center">
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-center p-12">
          <div className="text-center">
            <div className="flex items-center justify-center mb-8">
              <div className="bg-gradient-to-br from-[#f4c95d] to-[#7ec8ff] p-4 rounded-2xl shadow-lg shadow-[#f4c95d]/30">
                <Truck className="w-12 h-12 text-[#143c5b]" />
              </div>
            </div>
            <h1 className="text-4xl font-bold text-[#173b57] mb-4">
              Walletora Platform
            </h1>
            <p className="text-xl text-[#2e4966] mb-8">
              Connect customers, warehouses, and drivers in one seamless platform
            </p>
            <div className="grid grid-cols-1 gap-4 text-left">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-[#f4c95d] rounded-full"></div>
                <span className="text-[#2e4966]">Real-time order tracking</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-[#7ec8ff] rounded-full"></div>
                <span className="text-[#2e4966]">Multi-role authentication</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-[#f4c95d] rounded-full"></div>
                <span className="text-[#2e4966]">Secure payment processing</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="w-full lg:w-1/2 flex items-center justify-center">
          {isLogin ? (
            <LoginForm onToggleMode={() => setIsLogin(false)} />
          ) : (
            <SignUpForm onToggleMode={() => setIsLogin(true)} />
          )}
        </div>
      </div>
    </div>
  );
}