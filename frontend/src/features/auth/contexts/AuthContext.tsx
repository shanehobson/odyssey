import { createContext, JSX, ReactNode, useContext } from 'react';
import { useUser } from '../data/useUser';
import { useAuthMutations } from '../data/useAuthMutations';
import type { User } from '@/shared/types/trip';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  signUp: (data: { email: string; password: string; name?: string }) => void;
  confirmEmail: (data: { email: string; confirmationCode: string }) => void;
  signIn: (data: { email: string; password: string }) => void;
  logout: () => void;
  forgotPassword: (data: { email: string }) => void;
  resetPassword: (data: { email: string; code: string; newPassword: string }) => void;
  resendConfirmation: (email: string) => void;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): JSX.Element {
  const { data: user, isLoading: loading, refetch: refreshUser } = useUser();
  const authMutations = useAuthMutations();
  
  const contextValue: AuthContextValue = {
    user: user ?? null,
    loading,
    isAuthenticated: !!user,
    refreshUser: () => { refreshUser(); },
    ...authMutations,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}