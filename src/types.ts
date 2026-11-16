export type AppTab = 'chat' | 'memory' | 'device' | 'vault';

export type ThinkingDepth = 'fast' | 'expert' | 'deep';

export type MemoryCategory = 'preference' | 'style' | 'goal' | 'fact';

export type ToneMode = 'direct' | 'analytical' | 'creative';

export type VerbosityMode = 'concise' | 'balanced' | 'exhaustive';

export interface MemoryItem {
  id: string;
  category: MemoryCategory;
  content: string;
  confidence: number;
  reinforcements: number;
  active: boolean;
  source: 'auto' | 'manual';
  createdAt: number;
  updatedAt: number;
}

export interface UserProfile {
  ownerName: string;
  toneMode: ToneMode;
  verbosity: VerbosityMode;
  autoLearn: boolean;
  webSearchDefault: boolean;
  includeHardwareContext: boolean;
  curvedEdgeSafeMode: boolean;
}

export interface HardwareSnapshot {
  deviceLabel: string;
  viewport: string;
  pixelRatio: number;
  isStandalonePwa: boolean;
  batteryLevel: number | null;
  batteryCharging: boolean | null;
  networkType: string | null;
  downlinkMbps: number | null;
  orientation: {
    alpha: number | null;
    beta: number | null;
    gamma: number | null;
  };
  geolocation: {
    latitude: number;
    longitude: number;
    accuracyMeters: number;
    capturedAt: number;
  } | null;
}

export interface ChatAttachment {
  id: string;
  mimeType: string;
  base64Data: string;
  previewUrl: string;
  label: string;
}

export interface GroundingSource {
  uri: string;
  title: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  thinkingDepth?: ThinkingDepth;
  webGrounded?: boolean;
  sources?: GroundingSource[];
  learnedNotes?: string[];
  attachmentPreview?: string;
  attachmentLabel?: string;
  latencyMs?: number;
  error?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

export interface VaultExport {
  schemaVersion: 1;
  exportedAt: number;
  profile: UserProfile;
  memories: MemoryItem[];
  sessions: ChatSession[];
}
