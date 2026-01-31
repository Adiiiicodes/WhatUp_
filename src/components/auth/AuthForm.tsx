// src/components/auth/AuthForm.tsx
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { SiGoogle } from 'react-icons/si';
import { FiEye, FiEyeOff, FiCheck, FiX } from 'react-icons/fi';
import apiClient from '@/lib/api';

type FormMode = 'login' | 'signup' | 'set-password';

// Password validation rules (matching mobile app)
const PASSWORD_RULES = {
  minLength: 8,
  hasUppercase: /[A-Z]/,
  hasLowercase: /[a-z]/,
  hasNumber: /[0-9]/,
};

interface PasswordStrength {
  isValid: boolean;
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
}

function validatePassword(password: string): PasswordStrength {
  return {
    hasMinLength: password.length >= PASSWORD_RULES.minLength,
    hasUppercase: PASSWORD_RULES.hasUppercase.test(password),
    hasLowercase: PASSWORD_RULES.hasLowercase.test(password),
    hasNumber: PASSWORD_RULES.hasNumber.test(password),
    get isValid() {
      return this.hasMinLength && this.hasUppercase && this.hasLowercase && this.hasNumber;
    },
  };
}

export function AuthForm() {
  const [mode, setMode] = useState<FormMode>('login');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const passwordStrength = useMemo(
    () => validatePassword(formData.password),
    [formData.password]
  );

  const passwordsMatch = formData.password === formData.confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validate password for signup
    if (mode === 'signup') {
      if (!passwordStrength.isValid) {
        setError('Password does not meet requirements');
        return;
      }
      if (!passwordsMatch) {
        setError('Passwords do not match');
        return;
      }
    }

    setLoading(true);

    try {
      let res;

      if (mode === 'set-password') {
        res = await apiClient.setPassword(formData.email, formData.password);
        if (res.success) {
          setSuccess('Password set successfully! You can now log in.');
          setMode('login');
          setFormData({ ...formData, password: '' });
          setLoading(false);
          return;
        }
      } else if (mode === 'login') {
        res = await apiClient.login(formData.email, formData.password);
      } else {
        res = await apiClient.signup(formData.email, formData.password, formData.name);
      }

      if (!res.success) {
        const errorMsg = typeof res.error === 'string' ? res.error : res.error?.message || 'Something went wrong';

        // If user is OAuth-only, suggest setting a password
        if (errorMsg.includes('OAuth') || errorMsg.includes('Google')) {
          setError('This account was created with Google. Set a password below to enable email login.');
          setMode('set-password');
          setLoading(false);
          return;
        }

        setError(errorMsg);
        return;
      }

      router.push('/chat');
    } catch (_err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch (mode) {
      case 'login': return 'Welcome back!';
      case 'signup': return 'Create your account';
      case 'set-password': return 'Set your password';
    }
  };

  const getButtonText = () => {
    if (loading) return 'Please wait...';
    switch (mode) {
      case 'login': return 'Sign In';
      case 'signup': return 'Sign Up';
      case 'set-password': return 'Set Password';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] p-4">
      <div className="w-full max-w-md">
        <div className="bg-[var(--bg-secondary)] rounded-lg shadow-xl p-6 sm:p-8">
          {/* Logo/Header */}
          <div className="text-center mb-6 sm:mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-[var(--accent-primary)] rounded-full mb-3 sm:mb-4">
              <svg
                className="w-7 h-7 sm:w-8 sm:h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] mb-2">
              WhatUp Chat
            </h1>
            <p className="text-sm sm:text-base text-[var(--text-secondary)]">
              {getTitle()}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            {mode === 'signup' && (
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-[var(--text-primary)] mb-2"
                >
                  Full Name
                </label>
                <input
                  id="name"
                  type="text"
                  required={mode === 'signup'}
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="input-chat w-full"
                  placeholder="John Doe"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-[var(--text-primary)] mb-2"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="input-chat w-full"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-[var(--text-primary)] mb-2"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="input-chat w-full pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                </button>
              </div>
            </div>

            {/* Password Requirements (signup only) */}
            {mode === 'signup' && formData.password && (
              <div className="space-y-1.5 text-xs">
                <p className="text-[var(--text-secondary)] font-medium mb-1">Password must have:</p>
                <div className="grid grid-cols-2 gap-1">
                  <PasswordRule met={passwordStrength.hasMinLength} text="8+ characters" />
                  <PasswordRule met={passwordStrength.hasUppercase} text="Uppercase letter" />
                  <PasswordRule met={passwordStrength.hasLowercase} text="Lowercase letter" />
                  <PasswordRule met={passwordStrength.hasNumber} text="Number" />
                </div>
              </div>
            )}

            {/* Confirm Password (signup only) */}
            {mode === 'signup' && (
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-[var(--text-primary)] mb-2"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={formData.confirmPassword}
                    onChange={(e) =>
                      setFormData({ ...formData, confirmPassword: e.target.value })
                    }
                    className={`input-chat w-full pr-10 ${
                      formData.confirmPassword && !passwordsMatch
                        ? 'border-red-500 focus:border-red-500'
                        : ''
                    }`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    {showConfirmPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                  </button>
                </div>
                {formData.confirmPassword && !passwordsMatch && (
                  <p className="text-red-500 text-xs mt-1">Passwords do not match</p>
                )}
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-500/10 border border-green-500 text-green-500 px-4 py-3 rounded-lg text-sm">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base py-2.5 sm:py-3"
            >
              {getButtonText()}
            </button>
          </form>

          {/* OAuth / Toggle Form */}
          <div className="mt-4 sm:mt-6 text-center space-y-3">
            {mode !== 'set-password' && (
              <div>
                <a
                  href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/auth/google/redirect`}
                  className="inline-flex items-center justify-center w-full border border-[var(--border-primary)] rounded-lg py-2 sm:py-2.5 px-4 hover:bg-[var(--bg-hover)] transition-colors text-sm"
                  aria-label={mode === 'signup' ? 'Sign up with Google' : 'Sign in with Google'}
                >
                  <SiGoogle className="w-5 h-5 mr-2" />
                  {mode === 'signup' ? 'Sign up with Google' : 'Sign in with Google'}
                </a>
              </div>
            )}

            <div>
              {mode === 'set-password' ? (
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                    setSuccess('');
                  }}
                  className="text-[var(--accent-primary)] hover:text-[var(--accent-hover)] text-sm font-medium"
                >
                  Back to Sign In
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === 'login' ? 'signup' : 'login');
                    setError('');
                    setSuccess('');
                  }}
                  className="text-[var(--accent-primary)] hover:text-[var(--accent-hover)] text-sm font-medium"
                >
                  {mode === 'login'
                    ? "Don't have an account? Sign up"
                    : 'Already have an account? Sign in'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper component for password requirements
function PasswordRule({ met, text }: { met: boolean; text: string }) {
  return (
    <div className={`flex items-center gap-1.5 ${met ? 'text-green-500' : 'text-[var(--text-tertiary)]'}`}>
      {met ? <FiCheck size={12} /> : <FiX size={12} />}
      <span>{text}</span>
    </div>
  );
}


