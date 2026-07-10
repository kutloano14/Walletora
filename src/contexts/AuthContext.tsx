import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, type UserProfile } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    userData: { full_name: string; role: 'customer' | 'driver' | 'restaurant' }
  ) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub: (() => void) | undefined;

    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      setSession(sessionData.session ?? null);
      setUser(sessionData.session?.user ?? null);

      if (sessionData.session?.user) {
        await loadProfile(sessionData.session.user.id);
      } else {
        setLoading(false);
      }

      const { data } = supabase.auth.onAuthStateChange(async (_evt, s) => {
        setSession(s ?? null);
        setUser(s?.user ?? null);
        if (s?.user) {
          await loadProfile(s.user.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      });

      unsub = () => data.subscription.unsubscribe();
    })();

    return () => unsub?.();
  }, []);

  const loadProfile = async (userId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('[Auth] select profile error:', error);
        setProfile(null);
      } else {
        setProfile(data as UserProfile);
      }
    } catch (e) {
      console.error('[Auth] unexpected profile error:', e);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

const signUp: AuthContextType['signUp'] = async (email, password, userData) => {
  // 1️⃣ Create the user in Supabase auth
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });

  if (error) throw error;

  if (data.user) {
    // 2️⃣ Manually insert into user_profiles
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert([
        {
          id: data.user.id,         // link profile to auth user
          email,
          full_name: userData.full_name,
          role: userData.role,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]);

    if (profileError) throw profileError;

    // 3️⃣ Load profile into context
    await loadProfile(data.user.id);
  }
};

  const signIn: AuthContextType['signIn'] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut: AuthContextType['signOut'] = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setProfile(null);
  };

  const updateProfile: AuthContextType['updateProfile'] = async (updates) => {
    if (!user) throw new Error('No user logged in');
    const { error } = await supabase
      .from('user_profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) throw error;
    await loadProfile(user.id);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signUp, signIn, signOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}