import { Context, SessionFlavor } from "grammy";
import { ConversationFlavor } from "@grammyjs/conversations";
import type { RelationshipStage, RetentionState } from "../services/retention.js";

export interface SessionData {
  setupStep?: string;
  girlfriendDraft?: {
    name?: string;
    age?: number;
    race?: string;
    bodyType?: string;
    hairColor?: string;
    hairStyle?: string;
    eyeColor?: string;
    personality?: string;
  };
  fantasyMode?: string;
}

export interface UserData {
  telegramId: number;
  username?: string;
  firstName?: string;
  tier: string;
  isBanned: boolean;
}

export interface GirlfriendProfile {
  telegramId: number;
  isActive?: boolean;
  slotIndex?: number;
  voiceId?: string;
  name: string;
  age: number;
  race: string;
  bodyType: string;
  hairColor: string;
  hairStyle: string;
  eyeColor?: string;
  personality: string;
  backstory?: string;
  referenceImageUrl?: string;
  isConfirmed: boolean;
}

export type BotContext = Context &
  SessionFlavor<SessionData> &
  ConversationFlavor & {
    user?: UserData;
    girlfriend?: GirlfriendProfile;
    retention?: RetentionState & { stage: RelationshipStage };
  };
