/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LessonTopic } from "../types";

export const SYLLABUS_TOPICS: LessonTopic[] = [
  {
    id: "svo-basics",
    title: "1. Ders: Cümle Kurma Formülü (SVO)",
    description: "Türkçe 'Cümleyi fiille bitirir' (Özne-Nesne-Yüklem). İngilizce ise hemen eyleme geçer: Özne - Eylem - Nesne. Bu yapı farkını aşarak ilk cümlelerimizi hatasız kurmayı öğreniyoruz.",
    level: "A1-0",
    turkishPitfalls: "Türklerin en büyük hatası fiili (eylemi) Türkçe gibi cümlenin sonuna atmaktır. (Örn: 'I apples like' yerine 'I like apples' olmalıdır).",
    videoRecommendation: {
      title: "İngilizce Cümle Kurma Mantığı ve Sırrı",
      channel: "Özer Kiraz (İngilizce Konu Anlatımı)",
      url: "https://www.youtube.com/watch?v=F0f-x7eorCo",
      thumbnailColor: "from-blue-500 to-indigo-600"
    }
  },
  {
    id: "pronoun-clash",
    title: "2. Ders: 'O' Kim? He / She / It Ayrımı",
    description: "Türkçede sadece tek bir 'O' vardır. İngilizcede ise cinsiyete göre ayrılır: Erkekler için He, kadınlar için She, ve nesne/hayvanlar için It. Konuşurken takılmayı engelleme pratiği.",
    level: "A1-0",
    turkishPitfalls: "Konuşma sırasında He yerine She, ya da She yerine He diyerek kafanın karışması. Bu tamamen ana dildeki 'O' tekelinden kaynaklanır.",
    videoRecommendation: {
      title: "Personal Pronouns (Özne Zamirleri) ve Doğru Kullanım",
      channel: "Haluk Tatar (Sıfırdan İngilizce)",
      url: "https://www.youtube.com/watch?v=Q8lA1_3l0qA",
      thumbnailColor: "from-emerald-500 to-teal-600"
    }
  },
  {
    id: "to-be-verb",
    title: "3. Ders: Gizli Ekler: Am, Is, Are",
    description: "Türkçe 'Ben bir öğretmen-im' deriz (-im eki). İngilizcede kelime sonuna ek gelmez, onun yerine kelime önüne 'am' yerleşir: 'I am a teacher'. Durum belirtme cümlelerinin mantığı.",
    level: "A1-Beginner",
    turkishPitfalls: "Türkçedeki şahıs eklerinin (im, sin, dir) İngilizcedeki am/is/are karşılığını unutup sadece kelimeleri sıralamak. (Örn: 'I teacher' demek, doğrusu 'I am a teacher').",
    videoRecommendation: {
      title: "Am - Is - Are Mantığı: Neden ve Nasıl Kullanırız?",
      channel: "Anlat Kanka İngilizce",
      url: "https://www.youtube.com/watch?v=R9H_CAs0MVE",
      thumbnailColor: "from-amber-500 to-orange-600"
    }
  },
  {
    id: "question-struggle",
    title: "4. Ders: Do & Does ile Soru Sorma Sanatı",
    description: "Türkçede soru cümlenin en sonundaki 'mi?' ekiyle yapılır. İngilizcede ise soru sormak için cümlenin en başına 'Do' ya da 'Does' yardımcıları fırlatılır. Karşılaştırmalı pratik.",
    level: "A1-Beginner",
    turkishPitfalls: "Soru sorarken Türkçe gibi fiilin sonuna odaklanmak ve yardımcı fiilleri (Do/Does) cümlenin başına koymayı unutmak.",
    videoRecommendation: {
      title: "Simple Present Tense Soru Cümleleri (Do / Does)",
      channel: "Özer Kiraz",
      url: "https://www.youtube.com/watch?v=XscVb8M2pZg",
      thumbnailColor: "from-purple-500 to-violet-600"
    }
  },
  {
    id: "articles-nightmare",
    title: "5. Ders: 'A', 'An' ve Gizemli 'The' Belirteci",
    description: "Türkçede 'The' diye bir kelime yoktur! Herhangi bir masadan bahsederken 'a table', ama senin bildiğin o özel masadan bahsederken 'the table' deriz. En çok beğenilen pratik formül.",
    level: "A1-Beginner",
    turkishPitfalls: "Türkçede karşılığı olmadığı için 'the' kelimesini hiç kullanmamak veya nereye koyacağını bilemeyip her kelimenin başına yerleştirmek.",
    videoRecommendation: {
      title: "A, An, The Farkı ve Kesin Formülü",
      channel: "İngilizce Konu Anlatımı Özer Kiraz",
      url: "https://www.youtube.com/watch?v=J3Wk4B2O86E",
      thumbnailColor: "from-rose-500 to-pink-600"
    }
  }
];
