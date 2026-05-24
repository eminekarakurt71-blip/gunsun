/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SRSItem {
  id: string;
  turkish: string;
  english: string;
  box: 1 | 2 | 3; // Box 1 = daily, Box 2 = every 3 days, Box 3 = every 5 days
  nextReviewDate: string; // ISO String
  pronunciation?: string;
  notes?: string;
  addedAt: string;
}

export interface QuizQuestion {
  id: number;
  turkceSoru: string;
  ingilizceKarsiligi: string;
  ipucu: string;
  zorlukNoktası: string;
}

export interface AICreatedLesson {
  baslik: string;
  gorselHikaye: string;
  teoriAçiklama: string;
  yapiFormulu: string;
  sorular: QuizQuestion[];
  isFallback?: boolean;
}

export interface LessonTopic {
  id: string;
  title: string;
  description: string;
  level: "A1-0" | "A1-Beginner" | "A2-Elementary";
  turkishPitfalls: string; // Turkish-speaker specific struggle
  videoRecommendation: {
    title: string;
    channel: string;
    url: string;
    thumbnailColor: string;
  };
}

export interface DailyGoal {
  id: string;
  text: string;
  target: number;
  current: number;
  unit: string;
  completed: boolean;
  type: "lesson" | "speech" | "srs" | "focus";
}

export interface UserStats {
  points: number;
  streak: number;
  lastActive: string; // Date string
  completedLessons: string[]; // Topic IDs
  srsBoxCounts: { 1: number; 2: number; 3: number };
  dailyGoalProgress: number; // percentage
  activityHistory: { date: string; value: number }[]; // for the calendar heatmap
}

export interface SpeechCorrectionResult {
  isCorrect: boolean;
  skor: number;
  analizMesaji: string;
  dogruVersiyon: string;
  telaffuzDestegi: string;
  svoIncelemesi: {
    subject: string;
    verb: string;
    object: string;
  };
  isFallback?: boolean;
}
