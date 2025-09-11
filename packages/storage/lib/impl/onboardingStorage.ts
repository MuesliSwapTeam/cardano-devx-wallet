import { StorageEnum } from '../base/enums';
import { createStorage } from '../base/base';
import type { BaseStorage } from '../base/types';

// --- Onboarding flow types ---
export type OnboardingFlow = 'create' | 'import' | 'spoof';
export type OnboardingStep =
  | 'welcome'
  | 'legal'
  | 'select-method'
  | 'create-form'
  | 'import-form'
  | 'spoof-form'
  | 'api-key-setup'
  | 'success'
  | 'completed';

// Form data interfaces for each flow
export interface CreateWalletFormData {
  walletName?: string;
  network?: 'Mainnet' | 'Preprod';
  seedPhrase?: string[];
  confirmedSeedPhrase?: string[];
  password?: string;
}

export interface ImportWalletFormData {
  walletName?: string;
  seedPhrase?: string;
  network?: 'Mainnet' | 'Preprod';
  password?: string;
}

export interface SpoofWalletFormData {
  walletName?: string;
  walletAddress?: string;
  network?: 'Mainnet' | 'Preprod';
}

export interface ApiKeySetupData {
  network?: 'Mainnet' | 'Preprod';
  apiKey?: string;
  requiredFor?: OnboardingFlow;
}

// Main onboarding state interface
export interface OnboardingState {
  isActive: boolean;
  currentFlow: OnboardingFlow | null;
  currentStep: OnboardingStep;
  progress: number; // 0-100

  // Form data for each flow
  createFormData: CreateWalletFormData;
  importFormData: ImportWalletFormData;
  spoofFormData: SpoofWalletFormData;
  apiKeySetupData: ApiKeySetupData;

  // Navigation state
  lastVisitedRoute?: string;
  stepHistory: OnboardingStep[];

  // Track current route and any route-specific state
  currentRoute?: string;
}

// Progress mapping for each step
export const STEP_PROGRESS: Record<OnboardingStep, number> = {
  welcome: 0,
  legal: 20,
  'select-method': 40,
  'create-form': 60,
  'import-form': 60,
  'spoof-form': 60,
  'api-key-setup': 80,
  success: 90,
  completed: 100,
};

// Default onboarding state
const defaultOnboardingState: OnboardingState = {
  isActive: false,
  currentFlow: null,
  currentStep: 'welcome',
  progress: 0,
  createFormData: {},
  importFormData: {},
  spoofFormData: {},
  apiKeySetupData: {},
  stepHistory: [],
};

// Custom methods for onboarding storage
export interface OnboardingStorage extends BaseStorage<OnboardingState> {
  // Flow management
  startOnboarding: (flow?: OnboardingFlow) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;

  // Step navigation
  setCurrentStep: (step: OnboardingStep) => Promise<void>;
  setCurrentFlow: (flow: OnboardingFlow) => Promise<void>;
  updateProgress: (progress: number) => Promise<void>;
  goToStep: (step: OnboardingStep, updateProgress?: boolean) => Promise<void>;

  // Form data management
  updateCreateFormData: (data: Partial<CreateWalletFormData>) => Promise<void>;
  updateImportFormData: (data: Partial<ImportWalletFormData>) => Promise<void>;
  updateSpoofFormData: (data: Partial<SpoofWalletFormData>) => Promise<void>;
  updateApiKeySetupData: (data: Partial<ApiKeySetupData>) => Promise<void>;
  clearFormData: (flow?: OnboardingFlow) => Promise<void>;

  // Navigation
  setLastVisitedRoute: (route: string) => Promise<void>;
  setCurrentRoute: (route: string) => Promise<void>;
  addToStepHistory: (step: OnboardingStep) => Promise<void>;
}

// Create the base storage instance
const storage = createStorage<OnboardingState>('onboarding-state-key', defaultOnboardingState, {
  storageEnum: StorageEnum.Local,
  liveUpdate: true,
});

// Export the complete onboarding storage object
export const onboardingStorage: OnboardingStorage = {
  ...storage,

  startOnboarding: async (flow?: OnboardingFlow) => {
    await storage.set(state => ({
      ...state,
      isActive: true,
      currentFlow: flow || null,
      currentStep: flow ? 'select-method' : 'welcome',
      progress: flow ? STEP_PROGRESS['select-method'] : STEP_PROGRESS['welcome'],
    }));
  },

  completeOnboarding: async () => {
    await storage.set(state => ({
      ...state,
      isActive: false,
      currentStep: 'completed',
      progress: 100,
    }));
  },

  resetOnboarding: async () => {
    await storage.set(() => defaultOnboardingState);
  },

  setCurrentStep: async (step: OnboardingStep) => {
    await storage.set(state => ({
      ...state,
      currentStep: step,
      progress: STEP_PROGRESS[step],
      stepHistory: [...state.stepHistory, step],
    }));
  },

  setCurrentFlow: async (flow: OnboardingFlow) => {
    await storage.set(state => ({
      ...state,
      currentFlow: flow,
    }));
  },

  updateProgress: async (progress: number) => {
    await storage.set(state => ({
      ...state,
      progress: Math.min(100, Math.max(0, progress)),
    }));
  },

  goToStep: async (step: OnboardingStep, updateProgress = true) => {
    await storage.set(state => ({
      ...state,
      currentStep: step,
      progress: updateProgress ? STEP_PROGRESS[step] : state.progress,
      stepHistory: [...state.stepHistory, step],
    }));
  },

  updateCreateFormData: async (data: Partial<CreateWalletFormData>) => {
    await storage.set(state => ({
      ...state,
      createFormData: { ...state.createFormData, ...data },
    }));
  },

  updateImportFormData: async (data: Partial<ImportWalletFormData>) => {
    await storage.set(state => ({
      ...state,
      importFormData: { ...state.importFormData, ...data },
    }));
  },

  updateSpoofFormData: async (data: Partial<SpoofWalletFormData>) => {
    await storage.set(state => ({
      ...state,
      spoofFormData: { ...state.spoofFormData, ...data },
    }));
  },

  updateApiKeySetupData: async (data: Partial<ApiKeySetupData>) => {
    await storage.set(state => ({
      ...state,
      apiKeySetupData: { ...state.apiKeySetupData, ...data },
    }));
  },

  clearFormData: async (flow?: OnboardingFlow) => {
    await storage.set(state => {
      if (flow === 'create') {
        return { ...state, createFormData: {} };
      } else if (flow === 'import') {
        return { ...state, importFormData: {} };
      } else if (flow === 'spoof') {
        return { ...state, spoofFormData: {} };
      } else {
        // Clear all form data
        return {
          ...state,
          createFormData: {},
          importFormData: {},
          spoofFormData: {},
          apiKeySetupData: {},
        };
      }
    });
  },

  setLastVisitedRoute: async (route: string) => {
    await storage.set(state => ({
      ...state,
      lastVisitedRoute: route,
    }));
  },

  setCurrentRoute: async (route: string) => {
    await storage.set(state => ({
      ...state,
      currentRoute: route,
      lastVisitedRoute: route,
    }));
  },

  addToStepHistory: async (step: OnboardingStep) => {
    await storage.set(state => ({
      ...state,
      stepHistory: [...state.stepHistory, step],
    }));
  },
};
