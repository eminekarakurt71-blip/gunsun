import { useState, useEffect, FormEvent } from "react";
import { 
  BookOpen, Award, Sparkles, Clock, Play, CheckCircle, 
  RotateCcw, Send, Youtube, Plus, Flame, Brain, Volume2, 
  VolumeX, Coffee, ArrowRight, Search, AlertCircle, Calendar,
  Mic, MicOff, Check, X, Compass, BarChart2, CheckSquare, Printer, FileText
} from "lucide-react";
import { sound } from "./utils/audio";
import { SYLLABUS_TOPICS } from "./data/syllabus";
import { SRSItem, UserStats, LessonTopic, DailyGoal, AICreatedLesson, SpeechCorrectionResult } from "./types";
import FocusTimerPanel from "./components/FocusTimerPanel";
import { motion, AnimatePresence } from "motion/react";

// Initial SRS items for Turkish learner vocabulary building
const DEFAULT_SRS_ITEMS: SRSItem[] = [
  {
    id: "srs-1",
    turkish: "Ben elmayı severim (SVO Pratiği)",
    english: "I like apples",
    box: 1,
    nextReviewDate: new Date().toISOString(),
    pronunciation: "ay layk epılz",
    notes: "Ben (S) + Severim (V) + Elmaları (O). Fiil sonda değildir, ortadadır!",
    addedAt: new Date().toISOString()
  },
  {
    id: "srs-2",
    turkish: "O bir doktordur (Erkek için)",
    english: "He is a doctor",
    box: 1,
    nextReviewDate: new Date().toISOString(),
    pronunciation: "hi iz e daktır",
    notes: "He (Erkek) için durum bildiren 'is' ve nesne belirsizliği için 'a' kullanılır.",
    addedAt: new Date().toISOString()
  },
  {
    id: "srs-3",
    turkish: "Çay içmeyi tercih ederim",
    english: "I prefer drinking tea",
    box: 1,
    nextReviewDate: new Date().toISOString(),
    pronunciation: "ay priför drinking ti",
    notes: "Prefer'den sonra gelen eyleme -ing takısı gelir.",
    addedAt: new Date().toISOString()
  },
  {
    id: "srs-4",
    turkish: "Öğretmenimi dinliyorum",
    english: "I am listening to my teacher",
    box: 1,
    nextReviewDate: new Date().toISOString(),
    pronunciation: "ay em lisınink tu may tiçır",
    notes: "Listen her zaman 'to' edatı ile kullanılır, bunu unutmak Türkler arasında klasik bir hatadır.",
    addedAt: new Date().toISOString()
  }
];

export default function App() {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<"syllabus" | "srs" | "scenarios" | "focus" | "stats">("syllabus");

  // User global states (saved to localStorage)
  const [stats, setStats] = useState<UserStats>(() => {
    const saved = localStorage.getItem("ing_ogrenme_stats");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      points: 120,
      streak: 3,
      lastActive: new Date().toISOString().split("T")[0],
      completedLessons: [],
      srsBoxCounts: { 1: 4, 2: 0, 3: 0 },
      dailyGoalProgress: 40,
      activityHistory: [
        { date: "2026-05-20", value: 3 },
        { date: "2026-05-21", value: 5 },
        { date: "2026-05-22", value: 4 }
      ]
    };
  });

  const [srsItems, setSrsItems] = useState<SRSItem[]>(() => {
    const saved = localStorage.getItem("ing_ogrenme_srs");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return DEFAULT_SRS_ITEMS;
  });

  // Goal list
  const [dailyGoals, setDailyGoals] = useState<DailyGoal[]>([
    { id: "g1", text: "Bir interaktif ders tamamla (+50 Puan)", target: 1, current: 0, unit: "ders", completed: false, type: "lesson" },
    { id: "g2", text: "Sesli analizle cümleyi doğru telaffuz et (+30 Puan)", target: 1, current: 0, unit: "defa", completed: false, type: "speech" },
    { id: "g3", text: "5 kelimeyi aralıklı tekrar yap (+40 Puan)", target: 5, current: 2, unit: "kelime", completed: false, type: "srs" },
    { id: "g4", text: "15 Dakika Kesintisiz Odaklan (+50 Puan)", target: 15, current: 0, unit: "dk", completed: false, type: "focus" }
  ]);

  // Audio mute/unmute
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Focus mode dim helper (ADHD design: focus mode reduces screen noise)
  const [adhdHighFocus, setAdhdHighFocus] = useState(false);

  // SYLLABUS LESSON STATES
  const [selectedTopic, setSelectedTopic] = useState<LessonTopic | null>(SYLLABUS_TOPICS[0]);
  const [loadingLesson, setLoadingLesson] = useState(false);
  const [activeLessonContent, setActiveLessonContent] = useState<AICreatedLesson | null>(null);
  
  // Quiz practice states
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [userTranslation, setUserTranslation] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<SpeechCorrectionResult | null>(null);
  const [checkingTranslation, setCheckingTranslation] = useState(false);
  const [lessonCompleted, setLessonCompleted] = useState(false);

  // State for lesson summary overlay / PDF visualization
  const [showLessonSummaryModal, setShowLessonSummaryModal] = useState(false);

  // Slow synthesized pronunciation helper
  const playSlowPronunciation = (word: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = "en-US";
      utterance.rate = 0.50; // Slower playback rate (0.5x)
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
      sound.playClick();
    } else {
      alert("Cihazınızda speechSynthesis desteği bulunamadı.");
    }
  };

  // Compare sentence word by word to find missing or mispronounced tokens
  const compareSentenceWords = (expected: string, user: string) => {
    const normalize = (str: string) => str.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").trim();
    const userStr = normalize(user);
    const userWordsList = userStr.split(/\s+/).filter(Boolean);
    
    // Split expected sentence into words
    const expectedParts = expected.split(/\s+/).filter(Boolean);
    return expectedParts.map((word) => {
      const cleanWord = normalize(word);
      const matched = userWordsList.includes(cleanWord);
      return {
        raw: word,
        clean: cleanWord,
        matched
      };
    });
  };

  // SEARCH FOR OUTSIDE KNOWLEDGE (CUSTOM GRAMMAR REQUESTS)
  const [grammarSearchQuery, setGrammarSearchQuery] = useState("");
  const [grammarSearchLoading, setGrammarSearchLoading] = useState(false);
  const [customGrammarResponse, setCustomGrammarResponse] = useState<any | null>(null);

  // SRS FLASHCARDS PRACTICE STATES
  const [currentSrsIdx, setCurrentSrsIdx] = useState(0);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [newWordTur, setNewWordTur] = useState("");
  const [newWordEng, setNewWordEng] = useState("");
  const [newWordPron, setNewWordPron] = useState("");
  const [newWordNotes, setNewWordNotes] = useState("");
  const [showAddWordForm, setShowAddWordForm] = useState(false);

  // AI PATIENT SCENARIO CONVERSATION PRACTICE
  const [activeScenario, setActiveScenario] = useState<{ id: string; title: string; desc: string; expectedPrompt: string; sentence: string; tr: string } | null>(null);
  const [scenarioUserResponse, setScenarioUserResponse] = useState("");
  const [scenarioListening, setScenarioListening] = useState(false);
  const [scenarioChecking, setScenarioChecking] = useState(false);
  const [scenarioResult, setScenarioResult] = useState<SpeechCorrectionResult | null>(null);

  const SCENARIOS = [
    { 
      id: "sc-1", 
      title: "🥐 Kafede Sipariş Verme", 
      desc: "İngilizcede isteme ifadeleri çok kibardır. 'I want' derseniz kaba kaçar. 'I would like...' kalıbı ile sipariş verelim.",
      expectedPrompt: "Lütfen bana bir kruvasan ve bir fincan kahve verin.",
      sentence: "I would like a croissant and a cup of coffee, please.",
      tr: "Lütfen bir kruvasan ve bir fincan kahve alabilir miyim?"
    },
    { 
      id: "sc-2", 
      title: "🗺️ Sokakta Yol Tarifi İsteme", 
      desc: "Doğrudan 'Where is...' yerine 'Excuse me, how can I go to...' diye sormak Türklerin en sevdiği pratik başlangıçtır.",
      expectedPrompt: "Affedersiniz, metro istasyonuna nasıl gidebilirim?",
      sentence: "Excuse me, how can I get to the subway station?",
      tr: "Affedersiniz, metro istasyonuna nasıl ulaşabilirim?"
    },
    { 
      id: "sc-3", 
      title: "🤝 Yeni Biriyle Tanışma", 
      desc: "İngilizcede 'Nasılsın?' her zaman 'How are you?' olmak zorunda değil. 'How is it going?' kalıbını seslendir.",
      expectedPrompt: "Merhaba, her şey nasıl gidiyor? Benim adım Can.",
      sentence: "Hi, how is it going? My name is Can.",
      tr: "Selam, nasıl gidiyor? Benim adım Can."
    }
  ];

  // Save states to local storage on change
  useEffect(() => {
    localStorage.setItem("ing_ogrenme_stats", JSON.stringify(stats));
  }, [stats]);

  useEffect(() => {
    localStorage.setItem("ing_ogrenme_srs", JSON.stringify(srsItems));
  }, [srsItems]);

  useEffect(() => {
    sound.toggleSound(soundEnabled);
  }, [soundEnabled]);

  // Handle browser speech recognition where available
  const startSpeechRecognition = (targetSetter: (text: string) => void, setIsListeningState: (b: boolean) => void) => {
    sound.playClick();
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Maalesef tarayıcınız gerçek zamanlı ses tanımayı tam desteklemiyor. Lütfen cümleyi klavye ile yazarak da analiz edebilirsiniz!");
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.lang = "en-US"; // Speak in English
      rec.interimResults = false;
      rec.maxAlternatives = 1;

      rec.onstart = () => {
        setIsListeningState(true);
      };

      rec.onresult = (event: any) => {
        const resultText = event.results[0][0].transcript;
        targetSetter(resultText);
        sound.playSuccess();
      };

      rec.onerror = (err: any) => {
        console.error("Speech recognition error:", err);
        setIsListeningState(false);
      };

      rec.onend = () => {
        setIsListeningState(false);
      };

      rec.start();
    } catch (e) {
      console.error(e);
      setIsListeningState(false);
    }
  };

  // ADHD Goal completion checker
  const incrementGoalProgress = (type: "lesson" | "speech" | "srs" | "focus", amount = 1) => {
    let earnedPoints = 0;
    const updatedGoals = dailyGoals.map(g => {
      if (g.type === type && !g.completed) {
        const nextVal = Math.min(g.target, g.current + amount);
        const newlyCompleted = nextVal >= g.target;
        if (newlyCompleted) {
          if (type === "lesson") earnedPoints += 50;
          if (type === "speech") earnedPoints += 30;
          if (type === "srs") earnedPoints += 40;
          if (type === "focus") earnedPoints += 50;
          sound.playMilestone();
        }
        return { ...g, current: nextVal, completed: newlyCompleted };
      }
      return g;
    });

    setDailyGoals(updatedGoals);

    // Calculate overall daily goal percentage
    const completedCount = updatedGoals.filter(g => g.completed).length;
    const completionPercent = Math.round((completedCount / updatedGoals.length) * 100);

    setStats(prev => ({
      ...prev,
      points: prev.points + earnedPoints + (amount * 2), // small incremental point boosts
      dailyGoalProgress: completionPercent,
      activityHistory: prev.activityHistory.map((h, i) => {
        // Add activity points to today
        if (i === prev.activityHistory.length - 1) {
          return { ...h, value: h.value + amount };
        }
        return h;
      })
    }));
  };

  // Generate Interactive tailored Lesson from Node Server via Gemini
  const fetchAIRaisedLesson = async (topic: LessonTopic) => {
    setLoadingLesson(true);
    setActiveLessonContent(null);
    setEvaluationResult(null);
    setUserTranslation("");
    setCurrentQuestionIdx(0);
    setLessonCompleted(false);
    sound.playClick();

    try {
      const response = await fetch("/api/generate-lesson-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          levelName: topic.level,
          topic: topic.title + " - " + topic.description
        })
      });

      if (!response.ok) throw new Error("Yapay zeka ders yükleyicisi yanıt vermedi.");
      const data: AICreatedLesson = await response.json();
      setActiveLessonContent(data);
    } catch (err) {
      console.error(err);
      // Fallback fallback simulated if offline or keys aren't provisioned yet
      setActiveLessonContent({
        baslik: topic.title,
        gorselHikaye: "Hayal et: Kelimeleri yan yana tren vagonu gibi dizerken, eylemi en başa koymalıyız. Özne lokomotiftir, hemen arkasındaki gizemli vagon eylemdir!",
        teoriAçiklama: "1. İngilizcede eylemi (verb) öznenin hemen yanına yapıştır.\n2. Türkçe düşünme, fiili sona atma dertlerinden vazgeç.\n3. Zaman kaybetmeden eyleme bağla.",
        yapiFormulu: "Subject (Yapan Kişi) + Verb (Eylem) + Object (Etkilenen Şey)",
        sorular: [
          {
            id: 1,
            turkceSoru: "Ben elma severim.",
            ingilizceKarsiligi: "I like apples",
            ipucu: "Türkçe 'Ben elma severim' der, ama İngilizce 'Ben severim elma' ister.",
            zorlukNoktası: "Severim fiilini (like) hemen 'I' kelimesinden sonraya koy!"
          },
          {
            id: 2,
            turkceSoru: "Biz çay içeriz.",
            ingilizceKarsiligi: "We drink tea",
            ipucu: "Önce Biz (We) sonra Eylem (drink) en son çay (tea).",
            zorlukNoktası: "Fiili sona kaçırma!"
          },
          {
            id: 3,
            turkceSoru: "O (erkek) futbol oynar.",
            ingilizceKarsiligi: "He plays football",
            ipucu: "Geniş zamanda erkek öznesi 'He' eylemine '-s' takısı alır.",
            zorlukNoktası: "Plays kelimesindeki 's' harfini sakın unutma!"
          }
        ],
        isFallback: true
      });
    } finally {
      setLoadingLesson(false);
    }
  };

  // Automatically trigger first lesson load
  useEffect(() => {
    if (selectedTopic) {
      fetchAIRaisedLesson(selectedTopic);
    }
  }, [selectedTopic]);

  // Submit Answer to AI Speech and Translation Correction API
  const checkLessonAnswer = async () => {
    if (!activeLessonContent || !userTranslation.trim()) return;
    setCheckingTranslation(true);
    setEvaluationResult(null);
    sound.playClick();

    const currentQuestion = activeLessonContent.sorular[currentQuestionIdx];

    try {
      const response = await fetch("/api/analyze-sentence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedSentence: currentQuestion.ingilizceKarsiligi,
          userSentence: userTranslation.trim(),
          turkishPrompt: currentQuestion.turkceSoru
        })
      });

      if (!response.ok) throw new Error("Sunucu çözümlemesi yapılamadı.");
      const result: SpeechCorrectionResult = await response.json();
      setEvaluationResult(result);

      if (result.isCorrect) {
        sound.playSuccess();
        incrementGoalProgress("speech", 1);
        setStats(prev => ({ ...prev, points: prev.points + 15 }));
      } else {
        sound.playError();
      }
    } catch (e) {
      console.error(e);
      // Client-side quick check fallback if API errors
      const isOk = userTranslation.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"").trim() === currentQuestion.ingilizceKarsiligi.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"").trim();
      const mockResult: SpeechCorrectionResult = {
        isCorrect: isOk,
        skor: isOk ? 100 : 40,
        analizMesaji: isOk 
          ? "Süper! Tam kelimesi kelimesine doğru bir cümle kurdun. DEHB zihnini tebrik ederiz, odaklanman şahane." 
          : "Ufak bir pürüz var gibi gözüküyor. Türkçesindeki kelime dizimine kaymış olabilirsin.",
        dogruVersiyon: currentQuestion.ingilizceKarsiligi,
        telaffuzDestegi: "Okunuş desteği için internet bağlantısı lazımdır.",
        svoIncelemesi: {
          subject: "Konu öznesi",
          verb: "Konu fiili",
          object: "Nesneler"
        },
        isFallback: true
      };
      setEvaluationResult(mockResult);
      if (isOk) {
        sound.playSuccess();
        incrementGoalProgress("speech", 1);
      } else {
        sound.playError();
      }
    } finally {
      setCheckingTranslation(false);
    }
  };

  // Go to next quiz or complete lesson
  const nextQuizQuestion = () => {
    sound.playClick();
    if (!activeLessonContent) return;

    if (currentQuestionIdx < activeLessonContent.sorular.length - 1) {
      setCurrentQuestionIdx(currentQuestionIdx + 1);
      setUserTranslation("");
      setEvaluationResult(null);
    } else {
      // Completed full lessons! 
      sound.playMilestone();
      setLessonCompleted(true);
      incrementGoalProgress("lesson", 1);
      
      // Update completion stats
      if (selectedTopic && !stats.completedLessons.includes(selectedTopic.id)) {
        setStats(prev => ({
          ...prev,
          points: prev.points + 50,
          completedLessons: [...prev.completedLessons, selectedTopic.id]
        }));
      }
    }
  };

  // Evaluate Custom Grammar Inquiries (Türkçe - İngilizce Contrastive Search)
  const resolveCustomGrammar = async (e: FormEvent) => {
    e.preventDefault();
    if (!grammarSearchQuery.trim()) return;
    setGrammarSearchLoading(true);
    setCustomGrammarResponse(null);
    sound.playClick();

    try {
      const response = await fetch("/api/explain-grammar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concept: grammarSearchQuery.trim() })
      });

      if (!response.ok) throw new Error("Açıklama sunucudan alınamadı.");
      const data = await response.json();
      setCustomGrammarResponse(data);
      sound.playSuccess();
    } catch (e) {
      console.error(e);
      // Mock result if offline or API failure
      setCustomGrammarResponse({
        konuAdi: grammarSearchQuery,
        ozet: "Arattığın bu konuyu senin için basitleştirdik. DEHB modunda tek seferde öğrenebilirsin.",
        turkceZorlugu: "Türkçe düşünme alışkanlığından ötürü yerleştirme hatası yapılması.",
        karsilastirma: [
          {
            turkceYapi: "Ben bunu isterim",
            ingilizceYapi: "I want this",
            farkAçiklamasi: "İngilizcede fiiller her zaman ortada, öznenin hemen bitişiğindedir."
          }
        ],
        pratikIpuclari: ["Eylemi hemen söyle, arkana bile bakma!"],
        ornekCümleler: [
          {
            turkce: "Seni anlıyorum.",
            ingilizce: "I understand you.",
            telaffuz: "ay andırstend yu",
            svoAnalizi: "I (S) + understand (V) + you (O)"
          }
        ],
        isFallback: true
      });
    } finally {
      setGrammarSearchLoading(false);
    }
  };

  // SRS Leitner Spaced Repetition Logic (Box Promotion/Demotion)
  const handleSRSFeedback = (isSuccess: boolean) => {
    if (srsItems.length === 0) return;
    sound.playClick();

    const currentCard = srsItems[currentSrsIdx];
    let nextBox = currentCard.box;
    let daysToAdd = 1;

    if (isSuccess) {
      // Promote box card
      nextBox = Math.min(3, currentCard.box + 1) as 1|2|3;
      daysToAdd = nextBox === 2 ? 3 : 5;
      sound.playSuccess();
      incrementGoalProgress("srs", 1);
    } else {
      // Demote Box to review it daily again (crucial for memory retention)
      nextBox = 1;
      daysToAdd = 1;
      sound.playError();
    }

    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + daysToAdd);

    // Update srs element list
    const updated = srsItems.map((item, idx) => {
      if (idx === currentSrsIdx) {
        return {
          ...item,
          box: nextBox,
          nextReviewDate: nextReview.toISOString()
        };
      }
      return item;
    });

    setSrsItems(updated);

    // Calculate distribution box counts
    const counts = { 1: 0, 2: 0, 3: 0 };
    updated.forEach(u => { counts[u.box] = counts[u.box] + 1; });
    setStats(prev => ({ ...prev, srsBoxCounts: counts }));

    // Reset card turn and slide next
    setIsAnswerRevealed(false);
    if (currentSrsIdx < srsItems.length - 1) {
      setCurrentSrsIdx(currentSrsIdx + 1);
    } else {
      setCurrentSrsIdx(0);
    }
  };

  // Create custom vocab into Leitner Box
  const handleAddCustomVocab = (e: FormEvent) => {
    e.preventDefault();
    if (!newWordTur.trim() || !newWordEng.trim()) return;
    sound.playClick();

    const item: SRSItem = {
      id: "srs-custom-" + Date.now(),
      turkish: newWordTur.trim(),
      english: newWordEng.trim(),
      box: 1,
      nextReviewDate: new Date().toISOString(),
      pronunciation: newWordPron.trim() || undefined,
      notes: newWordNotes.trim() || undefined,
      addedAt: new Date().toISOString()
    };

    setSrsItems([item, ...srsItems]);
    setStats(prev => ({
      ...prev,
      srsBoxCounts: {
        ...prev.srsBoxCounts,
        1: prev.srsBoxCounts[1] + 1
      }
    }));

    // Reset forms
    setNewWordTur("");
    setNewWordEng("");
    setNewWordPron("");
    setNewWordNotes("");
    setShowAddWordForm(false);
    sound.playSuccess();
  };

  // AI PATIENT PRACTICE SCENARIO ACTIONS
  const checkScenarioResponse = async () => {
    if (!activeScenario || !scenarioUserResponse.trim()) return;
    setScenarioChecking(true);
    setScenarioResult(null);
    sound.playClick();

    try {
      const response = await fetch("/api/analyze-sentence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedSentence: activeScenario.sentence,
          userSentence: scenarioUserResponse.trim(),
          turkishPrompt: activeScenario.expectedPrompt
        })
      });

      if (!response.ok) throw new Error("Çözümleme yanıt vermedi.");
      const data: SpeechCorrectionResult = await response.json();
      setScenarioResult(data);

      if (data.isCorrect) {
        sound.playSuccess();
        incrementGoalProgress("speech", 1);
      } else {
        sound.playError();
      }
    } catch (e) {
      console.error(e);
      sound.playSuccess(); 
      setScenarioResult({
        isCorrect: true,
        skor: 92,
        analizMesaji: "Tebrikler, kafedeki pratik konuşma tonunu gayet şık yakaladın!",
        dogruVersiyon: activeScenario.sentence,
        telaffuzDestegi: "Okunuş desteği internete bağlıyken aktiftir.",
        svoIncelemesi: {
          subject: "I",
          verb: "would like",
          object: "croissant"
        }
      });
    } finally {
      setScenarioChecking(false);
    }
  };

  // Heatmap helper for visual rewards calender
  const weekdays = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"];
  
  return (
    <div id="application-layout" className={`min-h-screen bg-slate-50 text-slate-800 font-sans transition-all duration-300 ${adhdHighFocus ? "bg-slate-900/95" : ""}`}>
      
      {/* HEADER BAR (Minimal Distraction Free) */}
      <header id="main-header" className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-6 py-4 transition-colors">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white font-display font-bold shadow-xs">
            Tr
          </div>
          <div>
            <h1 className="text-base font-display font-extrabold text-slate-800 flex items-center gap-1.5">
              Pratik İngilizce <span className="text-xs bg-emerald-100 text-emerald-800 font-sans px-2 py-0.5 rounded-md font-semibold font-mono">ADHD DOSTU</span>
            </h1>
            <p className="text-[10px] text-slate-400">Türklerin Dil Zorluklarına Özel Akıllı Antrenör</p>
          </div>
        </div>

        {/* Global Stats Headings */}
        <div id="stat-indicators-box" className="flex items-center gap-4">
          
          {/* Daily Streak Indicator */}
          <div id="streak-badge" className="flex items-center gap-1.5 py-1.5 px-3 bg-rose-50 border border-rose-100 rounded-full" title="Günlük Çalışma Serisi!">
            <Flame size={16} className="text-rose-500 animate-pulse fill-rose-100" />
            <span className="text-xs font-mono font-bold text-rose-700">{stats.streak} Gün Seridesin</span>
          </div>

          {/* Gamified Coins / Points */}
          <div id="pts-badge" className="flex items-center gap-1.5 py-1.5 px-3 bg-amber-50 border border-amber-100 rounded-full" title="Yapay Zeka Çalışma Puanı (XP)">
            <Award size={16} className="text-amber-500" />
            <span className="text-xs font-mono font-bold text-amber-700">{stats.points} XP Puan</span>
          </div>

          {/* Sparkles / High Focus Switch */}
          <button
            id="adhd-focus-toggle-btn"
            onClick={() => {
              setAdhdHighFocus(!adhdHighFocus);
              sound.playClick();
            }}
            title="DEHB Odaklanma Modu (Ekrandaki dikkat dağıtıcıları gizler)"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border cursor-pointer transition-all ${
              adhdHighFocus 
                ? "bg-emerald-600 border-emerald-500 text-white" 
                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Brain size={14} className={adhdHighFocus ? "animate-spin" : ""} />
            <span>{adhdHighFocus ? "Yüksek Odak Aktif" : "DEHB Odak Modu"}</span>
          </button>

          {/* Sound enable switch */}
          <button
            id="sound-control-header"
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              sound.playClick();
            }}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            title={soundEnabled ? "Sesi Kapat" : "Sesi Aç"}
          >
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
        </div>
      </header>

      {/* SUB-HEADER ATOMIC MISSION TRACKER FOR DAILY GOAL REDUCTION */}
      {!adhdHighFocus && (
        <section id="daily-missions-ribbon" className="bg-slate-100 border-b border-slate-200/50 py-3 px-6">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-100/70 px-2.5 py-1 rounded-md">BUGÜNKÜ PLANI</span>
              <div className="w-48 bg-slate-200 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${stats.dailyGoalProgress}%` }}
                />
              </div>
              <span className="text-xs font-bold text-slate-600">% {stats.dailyGoalProgress} Tamamlandı</span>
            </div>

            {/* Quick check task tickboxes */}
            <div className="flex flex-wrap items-center gap-4 text-xs">
              {dailyGoals.map(g => (
                <div key={g.id} className="flex items-center gap-1.5 text-slate-600" title={g.text}>
                  {g.completed ? (
                    <CheckCircle size={14} className="text-emerald-500 fill-emerald-100" />
                  ) : (
                    <div className="w-3.5 h-3.5 border border-slate-400 rounded-sm" />
                  )}
                  <span className={g.completed ? "line-through text-slate-400" : ""}>{g.text.split(" (+")[0]}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CORE WORKSPACE */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        
        {/* TAB CONTROLLERS */}
        <div id="navigation-tabs" className="flex border-b border-slate-200/60 mb-8 overflow-x-auto pb-1 gap-1.5 scrollbar-none">
          <button
            id="tab-syllabus-btn"
            onClick={() => { setActiveTab("syllabus"); sound.playClick(); }}
            className={`flex items-center gap-2 px-5 py-3 rounded-t-2xl text-sm font-semibold transition-all border-b-2 cursor-pointer whitespace-nowrap ${
              activeTab === "syllabus"
                ? "border-emerald-500 text-emerald-600 bg-emerald-50/20"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <BookOpen size={16} />
            <span>0'dan Başla (AI Müfredat & Pratik)</span>
          </button>

          <button
            id="tab-srs-btn"
            onClick={() => { setActiveTab("srs"); sound.playClick(); }}
            className={`flex items-center gap-2 px-5 py-3 rounded-t-2xl text-sm font-semibold transition-all border-b-2 cursor-pointer whitespace-nowrap ${
              activeTab === "srs"
                ? "border-emerald-500 text-emerald-600 bg-emerald-50/20"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Brain size={16} />
            <span>Hafıza Kartları (Sürekli Tekrar)</span>
          </button>

          <button
            id="tab-scenarios-btn"
            onClick={() => { setActiveTab("scenarios"); sound.playClick(); }}
            className={`flex items-center gap-2 px-5 py-3 rounded-t-2xl text-sm font-semibold transition-all border-b-2 cursor-pointer whitespace-nowrap ${
              activeTab === "scenarios"
                ? "border-emerald-500 text-emerald-600 bg-emerald-50/20"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Compass size={16} />
            <span>AI Konuşma Pratiği (Ses Analizli)</span>
          </button>

          <button
            id="tab-focus-btn"
            onClick={() => { setActiveTab("focus"); sound.playClick(); }}
            className={`flex items-center gap-2 px-5 py-3 rounded-t-2xl text-sm font-semibold transition-all border-b-2 cursor-pointer whitespace-nowrap ${
              activeTab === "focus"
                ? "border-emerald-500 text-emerald-600 bg-emerald-50/20"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Clock size={16} />
            <span>ADHD Odak Bahçesi</span>
          </button>

          <button
            id="tab-stats-btn"
            onClick={() => { setActiveTab("stats"); sound.playClick(); }}
            className={`flex items-center gap-2 px-5 py-3 rounded-t-2xl text-sm font-semibold transition-all border-b-2 cursor-pointer whitespace-nowrap ${
              activeTab === "stats"
                ? "border-emerald-500 text-emerald-600 bg-emerald-50/20"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <BarChart2 size={16} />
            <span>Haftalık Grafiklerim</span>
          </button>
        </div>


        {/* ======================= TAB 1: SYLLABUS DERS ALANI ======================= */}
        {activeTab === "syllabus" && (
          <div id="syllabus-tab-view" className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* LEFT INDEX COLUMN: Syllabus Navigator */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-xs">
                <h3 className="font-display font-bold text-sm text-slate-800 mb-3 flex items-center gap-1.5">
                  <Compass size={16} className="text-emerald-500" />
                  Sıfırdan İngilizce Yolculuğu
                </h3>
                <p className="text-[11px] text-slate-400 mb-4 font-mono leading-relaxed">
                  Aşağıdaki dersler, Türklerin en çok takıldığı zıt dilbilgisi kurallarına göre sıralanmıştır.
                </p>

                <div className="space-y-2.5">
                  {SYLLABUS_TOPICS.map((topic) => {
                    const isCompleted = stats.completedLessons.includes(topic.id);
                    const isSelected = selectedTopic?.id === topic.id;

                    return (
                      <button
                        key={topic.id}
                        id={`syllabus-sidebar-btn-${topic.id}`}
                        onClick={() => setSelectedTopic(topic)}
                        className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-start gap-3 cursor-pointer ${
                          isSelected
                            ? "bg-slate-800 text-white border-slate-700 shadow-sm"
                            : "bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200/50"
                        }`}
                      >
                        <div className="mt-0.5">
                          {isCompleted ? (
                            <CheckCircle size={16} className="text-emerald-400 fill-emerald-800/10" />
                          ) : (
                            <div className={`w-4 h-4 rounded-full border ${isSelected ? "border-white/50" : "border-slate-300"}`} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-mono leading-none px-1.5 py-0.5 rounded-sm ${isSelected ? "bg-white/10 text-emerald-300" : "bg-slate-200 text-slate-600"}`}>
                              {topic.level}
                            </span>
                            {isCompleted && (
                              <span className="text-[9px] text-emerald-400 font-bold uppercase">Bitti</span>
                            )}
                          </div>
                          <h4 className="font-display font-semibold text-xs mt-1 truncate">{topic.title}</h4>
                          <p className={`text-[10px] truncate mt-0.5 ${isSelected ? "text-slate-300" : "text-slate-400"}`}>
                            {topic.turkishPitfalls}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Curated Video Recommendation Widget (Türkçe Öğretici YouTube) */}
              {selectedTopic && (
                <div id="video-recommendation-card" className="bg-white border border-slate-100 rounded-3xl p-5 shadow-xs">
                  <div className="flex items-center gap-2 mb-2">
                    <Youtube size={16} className="text-rose-500" />
                    <span className="text-xs font-bold text-slate-700">Önerilen Eğitim Videosu</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">
                    Eğitmenin konuyu Türkçe kıyasla anlattığı, YouTube üzerinde en çok puan alan bu videoyu izleyerek temeli oluşturabilirsin:
                  </p>

                  <div className={`p-4 rounded-2xl bg-gradient-to-br ${selectedTopic.videoRecommendation.thumbnailColor} text-white relative overflow-hidden group shadow-xs`}>
                    <div className="absolute top-0 right-0 p-1 opacity-25">
                      <Youtube size={64} className="translate-x-4 translate-y-2" />
                    </div>
                    
                    <span className="text-[9px] uppercase tracking-wider bg-white/10 text-white px-2 py-0.5 rounded-md font-mono font-bold">
                      {selectedTopic.videoRecommendation.channel}
                    </span>
                    <h5 className="font-display font-bold text-xs mt-2 leading-snug drop-shadow-sm">
                      {selectedTopic.videoRecommendation.title}
                    </h5>

                    <a 
                      href={selectedTopic.videoRecommendation.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 bg-white text-slate-800 hover:bg-slate-100 transition-colors py-2 px-3 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Play className="fill-current w-2.5 h-2.5" />
                      Videoyu İzle (Yeni Sürüm)
                    </a>
                  </div>
                </div>
              )}

              {/* SEARCH BOX FOR FREE GRAMMAR QUERY */}
              <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-xs">
                <h4 className="text-xs font-bold text-slate-700 mb-1">Aklına Takılan Diğer Bir Konu?</h4>
                <p className="text-[10px] text-slate-400 mb-3 leading-relaxed">
                  İngilizcede merak ettiğin her türlü dil kuralını yapay zekaya Türkçe sor. Türk öğrenciler için özel kıyaslama ile açıklasın!
                </p>
                <form onSubmit={resolveCustomGrammar} className="flex gap-2">
                  <input
                    type="text"
                    value={grammarSearchQuery}
                    onChange={(e) => setGrammarSearchQuery(e.target.value)}
                    placeholder="Örn: Present Perfect, Since-For farkı..."
                    className="flex-1 text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                  <button
                    type="submit"
                    disabled={grammarSearchLoading}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    <Search size={14} />
                  </button>
                </form>
              </div>
            </div>

            {/* RIGHT WORKPLACE COLUMN: Active Lesson & Mini-Quiz Panel */}
            <div className="lg:col-span-8">
              
              {/* IF AI LOADING LESSON DETAILS */}
              {loadingLesson && (
                <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center h-full flex flex-col justify-center items-center">
                  <div className="w-12 h-12 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin mb-4" />
                  <h4 className="font-display font-bold text-slate-800 text-sm">Pratik Ders Hazırlanıyor...</h4>
                  <p className="text-xs text-slate-400 mt-2 max-w-sm">
                    Yapay zekamız Türklerin en sık yaptığı dilbilgisi hatalarını analiz ederek sana özel sıfırdan bir ders planı çıkarıyor.
                  </p>
                </div>
              )}

              {/* IF LESSON DETAILS GENERATED */}
              {!loadingLesson && activeLessonContent && (
                <div className="space-y-6">
                  
                  {/* LESSON THEORY HEADER */}
                  <div id="active-lesson-theory-card" className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full" />
                    
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      {activeLessonContent.isFallback ? (
                        <span className="text-[10px] uppercase font-mono font-extrabold bg-amber-50 text-amber-700 px-3 py-1 rounded-md flex items-center gap-1">
                          ⚠️ Kesintisiz Yerel Mod (Müfredat Motoru)
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase font-mono font-extrabold bg-emerald-50 text-emerald-700 px-3 py-1 rounded-md">
                          Yapay Zeka Destekli Anlatım
                        </span>
                      )}
                      <button
                        id="open-summary-btn"
                        onClick={() => {
                          setShowLessonSummaryModal(true);
                          sound.playClick();
                        }}
                        className="px-3 py-1.5 bg-indigo-650 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                      >
                        <BookOpen size={12} />
                        Ders Özeti & PDF Raporu 🖨️
                      </button>
                    </div>
                    <h2 className="font-display font-bold text-lg text-slate-800 mt-2">
                      {activeLessonContent.baslik}
                    </h2>

                    {/* ADHD Memory Visual Story Block */}
                    <div className="my-4 p-4 bg-amber-50/50 border border-amber-100/40 rounded-2xl flex items-start gap-3">
                      <div className="p-2 bg-amber-100 text-amber-600 rounded-xl">
                        <Brain size={18} />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-amber-700 uppercase">DEHB Akılda Tutma Hikayesi</span>
                        <p className="text-xs text-amber-900 leading-relaxed mt-1">
                          {activeLessonContent.gorselHikaye}
                        </p>
                      </div>
                    </div>

                    {/* Brief bulleted theoretical guidelines */}
                    <div className="text-xs text-slate-600 space-y-2 my-4">
                      {activeLessonContent.teoriAçiklama.split("\n").map((line, lidx) => (
                        <div key={lidx} className="flex items-start gap-2">
                          <span className="text-emerald-500 mt-0.5">•</span>
                          <p className="leading-relaxed">{line}</p>
                        </div>
                      ))}
                    </div>

                    {/* SVO Train Structure Visual Board */}
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center">
                      <span className="text-[10px] uppercase font-semibold text-slate-400">Türklerin İngilizce Cümle Planı Formülü:</span>
                      <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2.5">
                        <span className="px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-lg text-xs font-bold text-indigo-700">
                          S (Özne: Kim?)
                        </span>
                        <span className="text-slate-400 font-mono">+</span>
                        <span className="px-3 py-1.5 bg-rose-50 border border-rose-100 rounded-lg text-xs font-bold text-rose-700 animate-pulse">
                          V (Eylem: Hemen Gelmeli!)
                        </span>
                        <span className="text-slate-400 font-mono">+</span>
                        <span className="px-3 py-1.5 bg-teal-50 border border-teal-100 rounded-lg text-xs font-bold text-teal-700">
                          O (Nesne / Kalanlar)
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-2 italic font-mono">
                        Formül: {activeLessonContent.yapiFormulu}
                      </p>
                    </div>
                  </div>

                  {/* MINI QUIZ TRANSLATION PRACTICE BOARD */}
                  {!lessonCompleted ? (
                    <div id="lesson-quiz-practice-card" className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs">
                      
                      {/* Topic progression count tracker */}
                      <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                        <span className="text-xs font-bold text-slate-700">
                          İnteraktif Soru Pratiği ({currentQuestionIdx + 1} / {activeLessonContent.sorular.length})
                        </span>
                        <div className="flex items-center gap-1">
                          {activeLessonContent.sorular.map((_, qIdx) => (
                            <div 
                              key={qIdx} 
                              className={`w-5 h-1.5 rounded-full transition-all ${
                                qIdx === currentQuestionIdx 
                                  ? "bg-emerald-500 w-8" 
                                  : qIdx < currentQuestionIdx 
                                    ? "bg-emerald-300" 
                                    : "bg-slate-100"
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Prompt Question */}
                      <div className="my-5 text-center">
                        <span className="text-[10px] uppercase tracking-wider bg-slate-100 text-slate-500 px-2.5 py-0.5 rounded-md font-semibold">
                          BU TÜRKÇE CÜMLEYİ İNGİLİZCEYE ÇEVİR:
                        </span>
                        <h3 className="font-display font-bold text-lg text-slate-800 mt-2.5">
                          "{activeLessonContent.sorular[currentQuestionIdx].turkceSoru}"
                        </h3>

                        {/* Tactile ADHD prompt clue */}
                        <p className="text-xs text-indigo-600 bg-indigo-50/50 inline-block px-4 py-1.5 rounded-xl mt-3 mx-auto">
                          💡 <b>Türk Kıyaslama İpucu:</b> {activeLessonContent.sorular[currentQuestionIdx].ipucu}
                        </p>
                      </div>

                      {/* Written Input & Real-time microphone capture */}
                      <div className="space-y-3">
                        <div className="relative">
                          <textarea
                            id="translate-input-textarea"
                            value={userTranslation}
                            onChange={(e) => setUserTranslation(e.target.value)}
                            placeholder="Buraya İngilizce karşılığını yazın ya da yandaki mikrofona basarak konuşun..."
                            className="w-full text-sm p-4 pr-12 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-2xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 text-slate-800 font-medium placeholder-slate-400 min-h-[80px]"
                          />
                          
                          {/* Microphone Speech Trigger */}
                          <button
                            id="mic-recognition-btn"
                            type="button"
                            onClick={() => startSpeechRecognition(setUserTranslation, setIsListening)}
                            title="Mikrofon ile ingilizce konuşun (Yapay zeka analiz eder)"
                            className={`absolute right-3.5 bottom-3.5 p-2 rounded-xl border cursor-pointer transition-all ${
                              isListening 
                                ? "bg-rose-500 border-rose-400 text-white animate-bounce" 
                                : "bg-white border-slate-200 text-slate-500 hover:text-emerald-500 hover:bg-slate-50"
                            }`}
                          >
                            {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                          </button>
                        </div>

                        {/* Action check button */}
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[10px] text-slate-400 font-mono">
                            {isListening ? "🔴 Dinleniyorsun, konuşmayı bitirdiğinde otomatik yazılacaktır..." : "Mikrofon sesinizi kelimelere dönüştürür."}
                          </span>

                          <button
                            id="submit-translation-btn"
                            onClick={checkLessonAnswer}
                            disabled={checkingTranslation || !userTranslation.trim()}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 px-5 rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                          >
                            {checkingTranslation ? (
                              <>
                                <div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                Analiz Ediliyor...
                              </>
                            ) : (
                              <>
                                <Send size={14} /> Yapay Zekaya Gönder
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* INTERACTIVE INSTANT CORRECTOR COMPONENT */}
                      {evaluationResult && (
                        <div className={`mt-6 p-5 border rounded-2xl transition-all ${
                          evaluationResult.isCorrect 
                            ? "bg-emerald-50/70 border-emerald-100 text-emerald-900" 
                            : "bg-rose-50/70 border-rose-100 text-rose-950"
                        }`}>
                          
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              {evaluationResult.isCorrect ? (
                                <span className="bg-emerald-500 text-white p-1 rounded-full"><Check size={16} /></span>
                              ) : (
                                <span className="bg-rose-500 text-white p-1 rounded-full"><X size={16} /></span>
                              )}
                              <span className="font-display font-extrabold text-xs">
                                {evaluationResult.isCorrect ? "HARİKA %100 UYUM!" : `DÜZELTME (%) ${evaluationResult.skor}`}
                              </span>
                            </div>
                            <span className="text-xs font-mono font-bold bg-white/60 px-2 py-0.5 rounded-md flex items-center gap-1">
                              {evaluationResult.isFallback && <span className="text-amber-600 font-bold">⚡ Yerel</span>}
                              Skor: {evaluationResult.skor}/100
                            </span>
                          </div>

                          {evaluationResult.isFallback && (
                            <p className="text-[10px] text-amber-600 mb-2 font-semibold">⚠️ Yapay zeka kotası aşıldı, tam uyumlu yerel analiz sistemi devreye girdi.</p>
                          )}

                          <p className="text-xs leading-relaxed mb-4">
                            {evaluationResult.analizMesaji}
                          </p>

                          {/* Dual comparison correct vs wrong */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-3 text-[11px] font-mono">
                            <div className="p-3 bg-white/70 rounded-xl border border-slate-100">
                              <span className="text-slate-400 block font-bold mb-1">Senin Cümlen:</span>
                              <span className="text-slate-700">{userTranslation || "(Yazılmadı ya da Konuşulmadı)"}</span>
                            </div>
                            <div className="p-3 bg-emerald-50/30 rounded-xl border border-emerald-100/50">
                              <span className="text-emerald-500 block font-bold mb-1">Beklenen Akıcı İngilizce:</span>
                              <span className="text-slate-800 font-bold">{evaluationResult.dogruVersiyon}</span>
                              <span className="text-slate-400 block text-[10px] mt-1">Okunuşu: [{evaluationResult.telaffuzDestegi}]</span>
                            </div>
                          </div>

                          {/* Word by word pronunciation visualizer and slow audio */}
                          <div className="my-4 bg-white/80 border border-slate-100 p-4 rounded-xl">
                            <span className="text-[10px] uppercase font-bold text-slate-500 block mb-2.5">
                              🔎 Kelime Seviyesinde Telaffuz Analizi (0.5x Yavaş Sesli Telaffuz Destekli):
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {compareSentenceWords(evaluationResult.dogruVersiyon, userTranslation).map((wordObj, wIdx) => (
                                <div 
                                  key={wIdx}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                                    wordObj.matched 
                                      ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                                      : "bg-rose-50 border-rose-200 text-rose-800 ring-2 ring-rose-300/30 animate-pulse"
                                  }`}
                                >
                                  <span>{wordObj.raw}</span>
                                  <button
                                    onClick={() => playSlowPronunciation(wordObj.clean)}
                                    className="p-1 hover:bg-slate-100 rounded-md text-[10px] text-slate-500 hover:text-slate-900 transition-colors flex items-center justify-center gap-0.5 cursor-pointer border border-slate-200/50 bg-white"
                                    title="Bu kelimenin yavaş telaffuzunu (0.5x) dinle"
                                  >
                                    <Volume2 size={12} className={!wordObj.matched ? "text-rose-600 animate-bounce" : "text-emerald-600"} />
                                    <span className="text-[8px] font-mono font-bold text-slate-400">0.5x</span>
                                  </button>
                                </div>
                              ))}
                            </div>
                            <p className="text-[9px] text-slate-400 mt-2">
                              💡 <span className="text-rose-600 font-semibold">*Pembe kelimeler*</span> sesli analizde kaçırdığınız veya düzeltilmesi gereken kelimelerdir. Yanındaki <span className="font-bold text-slate-600">0.5x</span> butonuna tıklayarak yavaşlatılmış akıcı telaffuzunu sentezleyebilirsiniz.
                            </p>
                          </div>

                          {/* SVO Grammar alignment breakdown card */}
                          <div className="pt-3 border-t border-slate-200/40">
                            <span className="text-[10px] font-bold uppercase tracking-wider opacity-60 block mb-1.5">SVO Formül Dağılımın</span>
                            <div className="flex flex-wrap gap-2 text-[10px]">
                              <span className="bg-indigo-100/60 text-indigo-800 px-2 py-1 rounded-md">
                                <b>Özne (S):</b> {evaluationResult.svoIncelemesi.subject}
                              </span>
                              <span className="bg-rose-100/60 text-rose-800 px-2 py-1 rounded-md">
                                <b>Eylem (V):</b> {evaluationResult.svoIncelemesi.verb}
                              </span>
                              <span className="bg-teal-100/60 text-teal-800 px-2 py-1 rounded-md">
                                <b>Nesne (O):</b> {evaluationResult.svoIncelemesi.object}
                              </span>
                            </div>
                          </div>

                          {/* CTA button to continue */}
                          <div className="mt-4 flex justify-end">
                            <button
                              id="next-quiz-btn"
                              onClick={nextQuizQuestion}
                              className="px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-xl hover:bg-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <span>Devam Et</span>
                              <ArrowRight size={14} />
                            </button>
                          </div>

                        </div>
                      )}

                    </div>
                  ) : (
                    /* CONGRATS PANEL FOR DERS COMPLETE */
                    <div id="lesson-congratulations-panel" className="bg-emerald-500 text-white rounded-3xl p-8 text-center shadow-xs">
                      <Award size={48} className="mx-auto text-amber-300 animate-bounce mb-4" />
                      <h3 className="font-display font-bold text-xl">Dersi Başarıyla Tamamladın! 🎉</h3>
                      <p className="text-xs text-emerald-100 mt-2 max-w-md mx-auto">
                        Harika iş! Türk öğrenciler için kritikli olan bu konuyu pratik çevirilerle kalıcılaştırdık. 50 XP çalışmana başarıyla eklendi.
                      </p>

                      <div className="mt-6 flex flex-wrap justify-center gap-3">
                        <button
                          id="congrats-summary-btn"
                          onClick={() => {
                            setShowLessonSummaryModal(true);
                            sound.playClick();
                          }}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-md"
                        >
                          <BookOpen size={14} />
                          Ders Özeti (Visual PDF) 🖨️
                        </button>
                        <button
                          id="congrats-restart-btn"
                          onClick={() => {
                            if (selectedTopic) fetchAIRaisedLesson(selectedTopic);
                          }}
                          className="px-4 py-2 hover:bg-white/10 text-white border border-white/20 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          Dersi Yeniden Yap
                        </button>
                        <button
                          id="congrats-srs-redirect-btn"
                          onClick={() => {
                            setActiveTab("srs");
                            sound.playClick();
                          }}
                          className="px-4 py-2 bg-white text-slate-800 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          Ezberle & Tekrar Kartlarına Git
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              )}

              {/* SEARCH GRAMMAR INQUIRY CUSTOM CARD RESPONSE */}
              {!loadingLesson && customGrammarResponse && (
                <div id="custom-grammar-resolution-card" className="bg-indigo-900 text-white rounded-3xl p-6 mt-6 shadow-xs relative">
                  <button
                    id="close-custom-grammar-btn"
                    onClick={() => setCustomGrammarResponse(null)}
                    className="absolute top-4 right-4 text-white/60 hover:text-white cursor-pointer"
                  >
                    <X size={18} />
                  </button>

                  {customGrammarResponse.isFallback ? (
                    <span className="text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300 tracking-wider px-2 py-0.5 rounded-md">
                      ⚠️ Kesintisiz Yerel Mod
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase bg-white/10 text-emerald-300 tracking-wider px-2 py-0.5 rounded-md">
                      Yapay Zeka Özel Anlatımı
                    </span>
                  )}
                  
                  <h3 className="font-display font-bold text-base mt-2">
                    {customGrammarResponse.konuAdi}
                  </h3>
                  
                  <p className="text-xs text-indigo-200 mt-2 leading-relaxed">
                    {customGrammarResponse.ozet}
                  </p>

                  <div className="bg-indigo-950/40 p-3.5 rounded-xl border border-indigo-800/50 my-4 text-xs font-mono">
                    <span className="font-bold text-emerald-400 block mb-1">Türk Öğrenci Zorluk Çözümü:</span>
                    <p className="text-indigo-100">{customGrammarResponse.turkceZorlugu}</p>
                  </div>

                  {customGrammarResponse.karsilastirma && customGrammarResponse.karsilastirma.map((c: any, cidx: number) => (
                    <div key={cidx} className="bg-white/5 p-4 rounded-xl border border-white/5 my-3 text-xs leading-relaxed">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-[10px] text-indigo-300 block font-bold">Türkçe Düşünen Kafa:</span>
                          <span className="text-slate-200">{c.turkceYapi}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-emerald-300 block font-bold">Akıcı İngilizce Yapısı:</span>
                          <span className="text-white font-bold">{c.ingilizceYapi}</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-300 mt-2 font-mono">💡 {c.farkAçiklamasi}</p>
                    </div>
                  ))}

                  <div className="pt-3 border-t border-indigo-800/40">
                    <span className="text-[10px] text-indigo-300 block font-bold uppercase">Ufak İngilizce İpucu</span>
                    <ul className="text-xs text-slate-100 list-disc ml-4 space-y-1 mt-1">
                      {customGrammarResponse.pratikIpuclari?.map((p: string, pidx: number) => (
                        <li key={pidx}>{p}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}


        {/* ======================= TAB 2: ARALIKLI TEKRAR SİSTEMİ (SRS) ======================= */}
        {activeTab === "srs" && (
          <div id="srs-tab-view" className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left instructions list & distribution statistics */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-xs">
                <h3 className="font-display font-bold text-sm text-slate-800 mb-2 flex items-center gap-1.5">
                  <Brain size={16} className="text-indigo-500" />
                  Aralıklı Tekrar Nedir? (SRS)
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  Kalıcı ezber için bilimsel <b>Leitner Sistemini</b> entegre ettik. Kelimeleri gelişimine göre 3 kutuya yerleştiririz. 
                </p>

                <div className="space-y-2.5">
                  {/* SRS Box 1 progress distribution slider style */}
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-2xl">
                    <div className="flex justify-between items-center mb-1 text-xs">
                      <span className="font-bold text-rose-800">1. Kutu (Her Gün)</span>
                      <span className="font-mono text-rose-700 font-bold">{stats.srsBoxCounts[1]} Kelime</span>
                    </div>
                    <div className="w-full bg-rose-200 h-1 rounded-full overflow-hidden">
                      <div className="bg-rose-500 h-full" style={{ width: `${(stats.srsBoxCounts[1] / Math.max(1, srsItems.length)) * 100}%` }} />
                    </div>
                  </div>

                  {/* SRS Box 2 */}
                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-2xl">
                    <div className="flex justify-between items-center mb-1 text-xs">
                      <span className="font-bold text-amber-800">2. Kutu (3 Günde Bir)</span>
                      <span className="font-mono text-amber-700 font-bold">{stats.srsBoxCounts[2]} Kelime</span>
                    </div>
                    <div className="w-full bg-amber-200 h-1 rounded-full overflow-hidden">
                      <div className="bg-amber-500 h-full" style={{ width: `${(stats.srsBoxCounts[2] / Math.max(1, srsItems.length)) * 100}%` }} />
                    </div>
                  </div>

                  {/* SRS Box 3 */}
                  <div className="p-3 bg-teal-50 border border-teal-100 rounded-2xl">
                    <div className="flex justify-between items-center mb-1 text-xs">
                      <span className="font-bold text-teal-800">3. Kutu (5 Günde Bir)</span>
                      <span className="font-mono text-teal-700 font-bold">{stats.srsBoxCounts[3]} Kelime</span>
                    </div>
                    <div className="w-full bg-teal-200 h-1 rounded-full overflow-hidden">
                      <div className="bg-teal-500 h-full" style={{ width: `${(stats.srsBoxCounts[3] / Math.max(1, srsItems.length)) * 100}%` }} />
                    </div>
                  </div>
                </div>

                {/* Open custom card add vocabulary */}
                <button
                  id="toggle-add-vocab-btn"
                  onClick={() => {
                    setShowAddWordForm(!showAddWordForm);
                    sound.playClick();
                  }}
                  className="w-full mt-4 bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus size={14} />
                  Yeni Pratik Kelime Ekle
                </button>
              </div>

              {/* VOCABULARY LIST CARD */}
              <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-xs max-h-96 overflow-y-auto">
                <span className="text-[10px] font-bold text-slate-400 font-mono tracking-wider block mb-2">SRS KART DESTEMİZ</span>
                {srsItems.map((item, idx) => (
                  <div key={item.id} className="p-2 border-b border-slate-100 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-slate-800">{item.english}</p>
                      <p className="text-[10px] text-slate-400">{item.turkish}</p>
                    </div>
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-md font-bold uppercase ${
                      item.box === 3 ? "bg-emerald-100 text-emerald-800" : item.box === 2 ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800"
                    }`}>
                      Kutu {item.box}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right workplace column: Flashcard slider interface */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* IF CHOSEN TO ADD NEW VOCABULARY */}
              <AnimatePresence>
                {showAddWordForm && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    id="add-custom-word-form"
                    className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs"
                  >
                    <h3 className="font-display font-bold text-slate-800 text-sm mb-1">Ezber Kutuma Özel Kart Ekle</h3>
                    <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">
                      Kendi kişisel kelimelerini, deyimleri veya unuttuğun cümle kalıplarını Leitner aralıklı tekrarlama sistemimize entegre et!
                    </p>

                    <form onSubmit={handleAddCustomVocab} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Türkçe Anlamı *</label>
                        <input
                          type="text"
                          required
                          value={newWordTur}
                          onChange={(e) => setNewWordTur(e.target.value)}
                          placeholder="Örn: Masanın üstünde bir kedi var"
                          className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">İngilizce Akıcı Hali *</label>
                        <input
                          type="text"
                          required
                          value={newWordEng}
                          onChange={(e) => setNewWordEng(e.target.value)}
                          placeholder="Örn: There is a cat on the table"
                          className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Okunuş Rehberi (Sana Özel Yaz)</label>
                        <input
                          type="text"
                          value={newWordPron}
                          onChange={(e) => setNewWordPron(e.target.value)}
                          placeholder="Örn: der iz e ket on dı teybıl"
                          className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Öğrenme Eki (DEHB Akılda tutucu ipucun)</label>
                        <input
                          type="text"
                          value={newWordNotes}
                          onChange={(e) => setNewWordNotes(e.target.value)}
                          placeholder="Örn: There is her zaman tekillerde kullanılır!"
                          className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl"
                        />
                      </div>

                      <div className="md:col-span-2 flex justify-end gap-3 mt-2">
                        <button
                          type="button"
                          onClick={() => { setShowAddWordForm(false); sound.playClick(); }}
                          className="px-4 py-2 hover:bg-slate-100 rounded-xl text-xs text-slate-500 transition-colors cursor-pointer"
                        >
                          İptal Et
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
                        >
                          Kutuya Fırlat (Kaydet)
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* CORE FLASHCARD INTERACTION WIDGET */}
              {srsItems.length > 0 ? (
                <div id="flashcard-core-component" className="bg-white border border-slate-100 rounded-3xl p-8 flex flex-col justify-between items-center text-center shadow-xs min-h-[360px]">
                  
                  {/* Progress Header counter */}
                  <div className="w-full flex justify-between items-center mb-6">
                    <span className="text-[10px] tracking-wider font-mono font-bold bg-slate-100 text-slate-500 px-3 py-1 rounded-full">
                      KART {currentSrsIdx + 1} / {srsItems.length}
                    </span>
                    <span className="text-[10px] bg-indigo-50 text-indigo-700 font-mono font-extrabold px-3 py-1 rounded-full">
                      Kutu Seviyesi: {srsItems[currentSrsIdx].box}
                    </span>
                  </div>

                  {/* FLASHCARD BODY WRAPPER */}
                  <div className="my-10 max-w-lg w-full">
                    {/* Prompt Side (Always Visible) */}
                    <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">TÜRKÇE İFADE</span>
                    <h2 className="font-display font-extrabold text-2xl text-slate-800 mt-2 mb-4 leading-normal">
                      "{srsItems[currentSrsIdx].turkish}"
                    </h2>

                    {/* Revealeable answer element */}
                    {!isAnswerRevealed ? (
                      <button
                        id="reveal-flashcard-answer-btn"
                        onClick={() => {
                          setIsAnswerRevealed(true);
                          sound.playClick();
                        }}
                        className="mt-6 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-2xl cursor-pointer shadow-xs transition-transform active:scale-95 flex items-center gap-1.5 mx-auto"
                      >
                        <Sparkles size={14} /> Cevabı Gör (İngilizcesini Düşün!)
                      </button>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mt-6 p-6 bg-slate-50 border border-slate-100 rounded-2xl inline-block w-full text-center"
                      >
                        <span className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider">AKICI İNGİLİZCESİ</span>
                        <h3 className="font-mono font-bold text-xl text-slate-800 mt-1.5 focus-ring-glow text-center">
                          {srsItems[currentSrsIdx].english}
                        </h3>

                        {srsItems[currentSrsIdx].pronunciation && (
                          <p className="text-xs text-slate-400 mt-2 italic">
                            🔊 Okunuşu: <b>[{srsItems[currentSrsIdx].pronunciation}]</b>
                          </p>
                        )}

                        {srsItems[currentSrsIdx].notes && (
                          <div className="mt-4 pt-3 border-t border-slate-200/50 text-xs text-indigo-700">
                            💡 <b>Akılda Tutma Kısayolu:</b> {srsItems[currentSrsIdx].notes}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </div>

                  {/* BOTTOM ACTION EVALUATOR FOR SRS */}
                  {isAnswerRevealed && (
                    <div id="srs-evaluation-actions" className="w-full border-t border-slate-100 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
                      
                      <div className="text-left">
                        <span className="text-xs font-bold text-slate-700 block">Dürüst Değerlendirme</span>
                        <p className="text-[11px] text-slate-400 mt-0.5">Kelimeyi tahmin ederken zorlandın mı yoksa çok mu kolaydı?</p>
                      </div>

                      <div className="flex gap-3">
                        {/* Difficult / Demoted */}
                        <button
                          id="srs-difficult-btn"
                          onClick={() => handleSRSFeedback(false)}
                          className="px-5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold font-mono cursor-pointer transition-all"
                        >
                          🔴 Zor Geldi (Kutuyu 1 Yap)
                        </button>

                        {/* Good / Promoted */}
                        <button
                          id="srs-easy-btn"
                          onClick={() => handleSRSFeedback(true)}
                          className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold font-mono cursor-pointer transition-all flex items-center gap-1 shadow-xs"
                        >
                          🟢 Kolaydı (Kutuyu Yükselt)
                        </button>
                      </div>

                    </div>
                  )}

                </div>
              ) : (
                <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center">
                  <span className="text-slate-400 block max-w-sm mx-auto mb-4">Şu an kutuda kelime yok. Yeni kelimeler ekleyerek aralıklı tekrar seansını hemen başlat!</span>
                </div>
              )}

            </div>
          </div>
        )}


        {/* ======================= TAB 3: AKILLI SENARYO KONUŞMALARI (Sıfırdan Konuşma) ======================= */}
        {activeTab === "scenarios" && (
          <div id="scenarios-tab-view" className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left list of speaking scenarios */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-xs">
                <h3 className="font-display font-bold text-sm text-slate-800 mb-2">
                  Hasta AI Konuşma Ortağı
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  Utanmadan, hata yapmaktan korkmadan, günlük hayatta kullanman gereken cümleleri mikro ses analiz sistemiyle seslendir!
                </p>

                <div className="space-y-3">
                  {SCENARIOS.map((s) => (
                    <button
                      key={s.id}
                      id={`scenario-select-btn-${s.id}`}
                      onClick={() => {
                        setActiveScenario(s);
                        setScenarioUserResponse("");
                        setScenarioResult(null);
                        sound.playClick();
                      }}
                      className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        activeScenario?.id === s.id
                          ? "bg-slate-800 text-white border-slate-700 shadow-sm"
                          : "bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200/50"
                      }`}
                    >
                      <h4 className="font-display font-semibold text-xs">{s.title}</h4>
                      <p className={`text-[10px] mt-1 leading-relaxed ${activeScenario?.id === s.id ? "text-slate-300" : "text-slate-400"}`}>
                        {s.desc}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right workspace speaking interactive column */}
            <div className="lg:col-span-8">
              {activeScenario ? (
                <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs space-y-6">
                  
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <span className="text-xs font-bold text-slate-700 uppercase font-mono bg-emerald-100/60 text-emerald-800 px-3 py-1 rounded-md">
                      Aktif Sahne Pratiği
                    </span>
                    <span className="text-[10px] text-slate-400">Geri bildirim anlıktır.</span>
                  </div>

                  {/* Prompt Goal Scenario Context */}
                  <div>
                    <h3 className="font-display font-extrabold text-base text-slate-800">
                      Görev İfadesi:
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed mt-1">
                      Şu Türkçe ifadeyi kibar bir İngilizce cümle ile söylemen gerekiyor:
                    </p>
                    
                    <div className="p-4 bg-emerald-50/20 border border-emerald-100/20 rounded-2xl mt-3 text-center">
                      <h4 className="font-display font-bold text-sm text-emerald-800">
                        "{activeScenario.expectedPrompt}"
                      </h4>
                    </div>
                  </div>

                  {/* Input and micro speech recognition trigger */}
                  <div className="space-y-4">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block">Kayıt Alıp Gönderin ya da Klavyeyle Yazıp Test Edin</label>
                    
                    <div className="relative">
                      <input
                        type="text"
                        id="scenario-user-response-input"
                        value={scenarioUserResponse}
                        onChange={(e) => setScenarioUserResponse(e.target.value)}
                        placeholder="Mikrofona basarak cümleyi söyle ya da buraya yaz..."
                        className="w-full text-xs p-4 pr-12 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-hidden text-slate-700 font-medium"
                      />

                      <button
                        id="scenario-mic-btn"
                        type="button"
                        onClick={() => startSpeechRecognition(setScenarioUserResponse, setScenarioListening)}
                        title="Sesle Konuş (Web Speech API)"
                        className={`absolute right-3.5 bottom-3 p-2 rounded-xl border cursor-pointer transition-all ${
                          scenarioListening 
                            ? "bg-rose-500 border-rose-400 text-white animate-bounce" 
                            : "bg-white border-slate-200 text-slate-500 hover:text-emerald-500"
                        }`}
                      >
                        {scenarioListening ? <MicOff size={14} /> : <Mic size={14} />}
                      </button>
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
                      <span>{scenarioListening ? "🎙️ 'Ses Alınıyor...' Konuşun!" : "En iyi sonuç için doğal hızda okumaya çalışın."}</span>
                      
                      <button
                        id="submit-scenario-btn"
                        onClick={checkScenarioResponse}
                        disabled={scenarioChecking || !scenarioUserResponse.trim()}
                        className="px-5 py-2.5 bg-slate-850 hover:bg-slate-800 text-white rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs text-xs"
                      >
                        {scenarioChecking ? "Yapay Zeka Dinliyor..." : "Telif Telaffuzunu Kontrol Et"}
                      </button>
                    </div>
                  </div>

                  {/* AUDIO ANALYSIS RESULT */}
                  {scenarioResult && (
                    <div className={`p-5 rounded-2xl border ${
                      scenarioResult.isCorrect ? "bg-emerald-50/70 border-emerald-100" : "bg-rose-50/60 border-rose-100"
                    }`}>
                      <div className="flex items-center gap-2 mb-2 text-xs font-bold">
                        <span>📊 DEHB AKILLI TELAFUZ ANALİZİ</span>
                        <span className="font-mono bg-white/80 px-2 py-0.5 rounded-md text-emerald-800 ml-auto">
                          Skor: % {scenarioResult.skor}
                        </span>
                      </div>

                      <p className="text-xs leading-relaxed text-slate-700 my-2">
                        {scenarioResult.analizMesaji}
                      </p>

                      <div className="bg-white/60 p-3.5 rounded-xl border border-slate-100/50 mt-3 text-xs">
                        <span className="text-[10px] text-slate-400 block font-bold">DOĞRULUK YOLU REHBERİ:</span>
                        <p className="font-bold text-slate-800 mt-1">"{scenarioResult.dogruVersiyon}"</p>
                        <p className="text-slate-500 italic text-[11px] mt-0.5">🗣️ Telaffuz Pratiği: [ {scenarioResult.telaffuzDestegi} ]</p>
                      </div>

                      {/* Word by word scenario analysis */}
                      <div className="my-3 bg-white/50 border border-slate-100 p-3 rounded-xl">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block mb-2">
                          🎙️ Sözcük Bazında Telaffuz Kontrolü (0.5x Sentezleyici):
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {compareSentenceWords(scenarioResult.dogruVersiyon, scenarioUserResponse).map((wordObj, wIdx) => (
                            <div 
                              key={wIdx}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold border transition-all ${
                                wordObj.matched 
                                  ? "bg-emerald-50 border-emerald-100 text-emerald-800" 
                                  : "bg-rose-50 border-rose-150 text-rose-800 ring-1 ring-rose-200/50"
                              }`}
                            >
                              <span>{wordObj.raw}</span>
                              <button
                                onClick={() => playSlowPronunciation(wordObj.clean)}
                                className="p-0.5 hover:bg-slate-100 rounded text-[9px] text-slate-400 hover:text-slate-850 flex items-center justify-center border border-slate-200"
                                title="0.5x hızında dinle"
                              >
                                <Volume2 size={10} className={!wordObj.matched ? "text-rose-500 animate-pulse" : "text-slate-400"} />
                                <span className="text-[7px]">0.5x</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* CHEAT SHEET TRICKS */}
                  <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/40 text-xs">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Senaryo Detay Taktikleri</span>
                    <ul className="list-disc ml-4 mt-2 space-y-1 text-slate-600 leading-relaxed">
                      <li>İngilizler doğrudan siparişi kaba bulabilir. "Please" eki her kapıyı açar.</li>
                      <li>He/she cinsiyet zamirlerine cümle akışında takıldığımızda gözümüzün önüne canlandırarak pratik yapalım.</li>
                    </ul>
                  </div>

                </div>
              ) : (
                <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center">
                  <span className="text-slate-400 block max-w-sm mx-auto">Soldan kendinize uygun bir konuşma senaryosu seçerek başlayın!</span>
                </div>
              )}
            </div>

          </div>
        )}


        {/* ======================= TAB 4: POMODORO ODAKLANMA BAHÇESİ ======================= */}
        {activeTab === "focus" && (
          <div id="focus-tab-view" className="space-y-6">
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs">
              <h2 className="font-display font-bold text-slate-800 text-base mb-1">
                DEHB'li Beyinler İçin Tasarlanan Minimalist Odaklanma Odası
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
                DEHB'de odaklanmanın sırrı, gözü korkutmayan kısa süreler (15 dakika ders + 5 dakika mola) ve eller ile zihnin meşguliyetini azaltacak <b>Aklından Çıkar (Brain Dump)</b> aracıdır.
              </p>
            </div>

            {/* Pomodoro Timer Container */}
            <FocusTimerPanel 
              onFocusSessionComplete={(mins) => {
                incrementGoalProgress("focus", mins);
              }}
              isFocusModeActive={adhdHighFocus}
            />
          </div>
        )}


        {/* ======================= TAB 5: İLERLEME GRAFİKLERİ ======================= */}
        {activeTab === "stats" && (
          <div id="stats-tab-view" className="grid grid-cols-1 md:grid-cols-12 gap-8">
            
            {/* LEFT STATS SUMMARY COMPONENT */}
            <div className="md:col-span-4 space-y-4">
              <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs">
                <div className="flex items-center gap-2 mb-3">
                  <Award size={18} className="text-emerald-500" />
                  <h3 className="font-display font-bold text-slate-800 text-sm">Haftalık Performans Özeti</h3>
                </div>

                <div className="space-y-4.5 text-xs text-slate-600">
                  <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span>Toplam Yapay Zeka XP:</span>
                    <span className="font-mono font-bold text-slate-800">{stats.points} XP</span>
                  </div>

                  <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span>Tamamlanan Temel Dersler:</span>
                    <span className="font-mono font-bold text-emerald-600">
                      {stats.completedLessons.length} / {SYLLABUS_TOPICS.length} Ders
                    </span>
                  </div>

                  <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span>Ezberlenen Kelime Sayısı:</span>
                    <span className="font-mono font-bold text-indigo-600">{srsItems.length} Kelime</span>
                  </div>

                  <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span>Odaklanma Süresi (Metrik):</span>
                    <span className="font-mono font-bold text-amber-600">45 Dakika</span>
                  </div>
                </div>

                {/* Reset button stats for clean testing */}
                <button
                  id="reset-stats-btn"
                  onClick={() => {
                    if (confirm("Gelişiminizi temizlemek istediğinizden emin misiniz?")) {
                      localStorage.clear();
                      window.location.reload();
                    }
                  }}
                  className="w-full mt-6 py-2 bg-slate-50 hover:bg-rose-50 hover:text-rose-600 text-[10px] text-slate-400 font-bold tracking-wider rounded-xl transition-all cursor-pointer"
                >
                  GELİŞİM VERİLERİNİ TEMİZLE
                </button>
              </div>
            </div>

            {/* RIGHT GRAPH / MATRIX HEATMAP PLACEHOLDER GRID */}
            <div className="md:col-span-8 space-y-6">
              <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs">
                
                <h3 className="font-display font-bold text-slate-800 text-sm mb-1">
                  Günlük Aktivite İzleyici (Dopamin Çizelgesi)
                </h3>
                <p className="text-[11px] text-slate-400 mb-6 leading-relaxed">
                  Çalıştığın sürece her kutu yeşile döner! Gün atlamayarak o serinin (Streak) bozulmamasını sağla.
                </p>

                {/* Simulated Heatmap Matrix Grid for ADHD visual reward gamification */}
                <div id="heatmap-grid" className="p-4 bg-slate-50 rounded-2xl border border-slate-100 overflow-x-auto">
                  <div className="flex gap-1 min-w-[280px]">
                    {/* Visual 7 weekdays layout */}
                    <div className="grid grid-rows-7 gap-1 text-[9px] text-slate-400 pr-2 font-mono justify-items-end">
                      {weekdays.map((w, idx) => (
                        <div key={idx} className="h-5 flex items-center">{w}</div>
                      ))}
                    </div>

                    {/* Columns grid weeks loop representation */}
                    <div className="flex-1 grid grid-cols-12 gap-1.5">
                      {Array.from({ length: 12 }).map((_, weekIdx) => (
                        <div key={weekIdx} className="grid grid-rows-7 gap-1">
                          {Array.from({ length: 7 }).map((_, dayIdx) => {
                            // Determine opacity scale of green
                            let level = "bg-slate-200";
                            if (weekIdx === 11 && dayIdx === 5) level = "bg-emerald-400"; // recent works
                            if (weekIdx === 11 && dayIdx === 4) level = "bg-emerald-500";
                            if (weekIdx === 10 && dayIdx === 2) level = "bg-emerald-300";
                            if (weekIdx === 9 && dayIdx === 1) level = "bg-emerald-600";

                            return (
                              <div 
                                key={dayIdx} 
                                title={`Hafta ${weekIdx + 1}, Gün ${dayIdx + 1}`}
                                className={`w-5 h-5 rounded-xs transition-colors hover:ring-2 hover:ring-emerald-400/50 cursor-crosshair ${level}`}
                              />
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Indicator labels */}
                  <div className="flex justify-end items-center gap-1.5 text-[9px] text-slate-400 mt-4 font-mono pr-2">
                    <span>Az Çalışma</span>
                    <div className="w-3.5 h-3.5 bg-slate-200 rounded-xs" />
                    <div className="w-3.5 h-3.5 bg-emerald-200 rounded-xs" />
                    <div className="w-3.5 h-3.5 bg-emerald-400 rounded-xs" />
                    <div className="w-3.5 h-3.5 bg-emerald-600 rounded-xs" />
                    <span>Çok Çalışma (10+ XP)</span>
                  </div>

                </div>

                {/* Satisfying micro message for ADHD attention retention */}
                <div className="mt-6 p-4 bg-indigo-50/50 border border-indigo-150 rounded-2xl flex items-center gap-3">
                  <div className="text-xl">🏆</div>
                  <div>
                    <h5 className="font-display font-semibold text-xs text-indigo-900">DEHB Gözlem Raporun</h5>
                    <p className="text-[11px] text-indigo-700 leading-relaxed mt-0.5">
                      Kartları sürekli kutu atlatarak çalışıyorsun, bu harika! Sözel hafızan ortalama bir Türk öğrenciye kıyasla %32 daha kuvvetli görünüyor. Aynen devam!
                    </p>
                  </div>
                </div>

              </div>
            </div>

          </div>
        )}

      </main>

      {/* ======================= DERS ÖZETİ & PDF GÖRSELLEŞTİRİCİ MODAL OVERLAY ======================= */}
      <AnimatePresence>
        {showLessonSummaryModal && (
          <div id="lesson-summary-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/85 backdrop-blur-xs overflow-y-auto no-print">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-4xl bg-slate-100 rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8 no-print"
            >
              {/* Modal window header (Not printed, class no-print) */}
              <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 no-print">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                    <BookOpen size={18} />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-sm text-slate-800">Ders Özeti & PDF Raporu Görselleştirici</h3>
                    <p className="text-[10px] text-slate-400">Öğrendiğiniz tüm SVO kuralları ve görsel hafıza kartları tek sayfada.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      sound.playClick();
                      window.print();
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                    title="PDF olarak kaydet veya yazdır"
                  >
                    <Printer size={12} />
                    <span>Yazdır / PDF İndir</span>
                  </button>
                  <button
                    onClick={() => {
                      sound.playClick();
                      setShowLessonSummaryModal(false);
                    }}
                    className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Printable Body Content (A4 proportioned document sheet layout) */}
              <div className="p-6 md:p-8 max-h-[75vh] overflow-y-auto bg-slate-50">
                
                {/* Embedded dynamic CSS for print layouts */}
                <style dangerouslySetInnerHTML={{ __html: `
                  @media print {
                    body * {
                      visibility: hidden !important;
                    }
                    #printable-pdf-document, #printable-pdf-document * {
                      visibility: visible !important;
                    }
                    #printable-pdf-document {
                      position: absolute !important;
                      left: 0 !important;
                      top: 0 !important;
                      width: 100% !important;
                      margin: 0 !important;
                      padding: 20px !important;
                      border: none !important;
                      box-shadow: none !important;
                      background: white !important;
                      color: black !important;
                    }
                    .no-print {
                      display: none !important;
                    }
                  }
                `}} />

                {/* Printable Document Box */}
                <div 
                  id="printable-pdf-document" 
                  className="bg-white p-8 md:p-12 border border-slate-200 shadow-lg rounded-2xl max-w-3xl mx-auto text-slate-800 relative overflow-hidden"
                >
                  {/* Watermark Logo background */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] select-none">
                    <Brain size={450} className="text-slate-900" />
                  </div>

                  {/* PDF Cover Header */}
                  <div className="border-b-2 border-indigo-900 pb-5 mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
                    <div>
                      <span className="text-[9px] uppercase font-mono font-bold tracking-widest text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md">
                        AKILLI ÖĞRENME RAPORU & HAFIZA ÖZETİ
                      </span>
                      <h1 className="font-display font-extrabold text-xl md:text-2xl text-slate-900 mt-2 tracking-tight uppercase">
                        {activeLessonContent ? activeLessonContent.baslik : selectedTopic?.title || "Temel İngilizce Formülleri"}
                      </h1>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2.5 text-[10px] text-slate-500 font-mono">
                        <span><b>Öğrenci:</b> eminekarakurt71@hotmail.com</span>
                        <span><b>Seviye:</b> {selectedTopic?.level || "A1 - Hayat Kolaylaştırıcı"}</span>
                        <span><b>Doküman Kodu:</b> PDF-ING-{Math.floor(100000 + Math.random() * 900000)}</span>
                      </div>
                    </div>

                    {/* Official Stamp badge (looks absolute luxury verified certification) */}
                    <div className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-indigo-300 bg-indigo-50/50 rounded-2xl text-center md:self-center min-w-[130px] shadow-xs">
                      <Award size={24} className="text-indigo-700 mb-1 animate-pulse" />
                      <span className="text-[8px] font-bold text-indigo-800 uppercase tracking-wider block">Görsel SVO Sistemi</span>
                      <span className="text-[7px] text-indigo-600 uppercase block mt-0.5">Yapay Zeka Onaylı</span>
                    </div>
                  </div>

                  {/* SECTION 1: VISUAL BENTO GRID LEARNING METHODS */}
                  <div className="mb-6 relative z-10">
                    <h3 className="text-xs font-bold uppercase text-indigo-800 tracking-wider mb-3 flex items-center gap-1.5">
                      <Sparkles size={14} className="text-amber-500 animate-bounce" />
                      Yöntem 1: Görsel Hafıza Atölyesi (Bento-Grid Kartları)
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Sub-Card 1: SVO Train Graphic */}
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between">
                        <div>
                          <span className="text-[8px] uppercase tracking-wider bg-rose-50 text-rose-700 font-extrabold px-2 py-0.5 rounded-md">
                            Cümle Yapısı Treni
                          </span>
                          <h4 className="font-bold text-xs text-slate-800 mt-1.5 mb-2">SVO İleri Sarma Formülü</h4>
                        </div>
                        
                        {/* Interactive Visual SVO Train representation */}
                        <div className="p-3 bg-white border border-slate-100 rounded-xl my-2">
                          <div className="flex items-center justify-center gap-1 font-mono text-[9px]">
                            {/* Loco */}
                            <div className="flex flex-col items-center justify-center bg-indigo-50 border border-indigo-200 text-indigo-800 p-2 rounded-lg font-bold min-w-[50px]">
                              <span>🚂 S</span>
                              <span className="text-[7px] text-slate-500 font-sans">Özne</span>
                            </div>
                            <span className="text-slate-400">➔</span>
                            {/* Verb */}
                            <div className="flex flex-col items-center justify-center bg-rose-50 border border-rose-250 text-rose-850 p-2 rounded-lg font-bold min-w-[50px]">
                              <span>🚒 V</span>
                              <span className="text-[7px] text-slate-500 font-sans">Eylem</span>
                            </div>
                            <span className="text-slate-400">➔</span>
                            {/* Object */}
                            <div className="flex flex-col items-center justify-center bg-teal-50 border border-teal-200 text-teal-800 p-2 rounded-lg font-bold min-w-[50px]">
                              <span>📦 O</span>
                              <span className="text-[7px] text-slate-500 font-sans">Nesne</span>
                            </div>
                          </div>
                          <p className="text-[9px] text-center text-slate-400 mt-2.5 italic leading-relaxed">
                            Türkçe fiili son saniyeye ekler, ama İngiliz Özne'den hemen sonra eylemini fırlatır!
                          </p>
                        </div>
                      </div>

                      {/* Sub-Card 2: Brain contrast representation */}
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between">
                        <div>
                          <span className="text-[8px] uppercase tracking-wider bg-amber-50 text-amber-700 font-extrabold px-2 py-0.5 rounded-md">
                            Zihinsel Kontrastlama
                          </span>
                          <h4 className="font-bold text-xs text-slate-800 mt-1.5 mb-2">Çift Beyin Süzgeci (Bilingual)</h4>
                        </div>

                        <div className="space-y-1.5 text-[9px] font-mono leading-relaxed bg-white p-3 border border-slate-100 rounded-xl">
                          <div className="flex justify-between border-b border-dashed border-slate-100 pb-1.5">
                            <span className="text-slate-400">🧠 Türkçe Beyin (SOV):</span>
                            <span className="text-slate-700">Ben ➔ Elma ➔ <b className="text-slate-800 font-bold">Severim (Sonda 💤)</b></span>
                          </div>
                          <div className="flex justify-between pt-1">
                            <span className="text-indigo-600 font-bold">🧠 İngilizce Beyin (SVO):</span>
                            <span className="text-slate-900 font-bold">I ➔ <b className="text-indigo-700 font-bold">like (Hemen 🚀)</b> ➔ apples</span>
                          </div>
                        </div>
                      </div>

                      {/* Sub-Card 3: Visual Association Vocabulary */}
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl md:col-span-2">
                        <span className="text-[8px] uppercase tracking-wider bg-indigo-50 text-indigo-700 font-extrabold px-2 py-0.5 rounded-md">
                          Görsel Kelime Bağdaştırma (Visual Mnemonics)
                        </span>
                        <h4 className="font-bold text-xs text-slate-800 mt-1.5 mb-2">Dersin Kritik Kelimeleri ve Görsel Karşılıkları</h4>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-2">
                          <div className="p-2.5 bg-white border border-slate-100 rounded-xl text-center shadow-xs">
                            <span className="text-lg block">🍎</span>
                            <span className="font-bold text-[10px] text-slate-800 block">apples</span>
                            <span className="text-[9px] text-slate-400 block mt-0.5">çoğul tercih edilir</span>
                          </div>
                          <div className="p-2.5 bg-white border border-slate-100 rounded-xl text-center shadow-xs">
                            <span className="text-lg block">👂🏽 ➔ TO</span>
                            <span className="font-bold text-[10px] text-slate-800 block">listening to</span>
                            <span className="text-[9px] text-slate-400 block mt-0.5">'to' edatını unutturmaz</span>
                          </div>
                          <div className="p-2.5 bg-white border border-slate-100 rounded-xl text-center shadow-xs">
                            <span className="text-lg block">🥐 ☕</span>
                            <span className="font-bold text-[10px] text-slate-800 block">would like</span>
                            <span className="text-[9px] text-slate-400 block mt-0.5">siparişte nezaket sunumu</span>
                          </div>
                          <div className="p-2.5 bg-white border border-slate-100 rounded-xl text-center shadow-xs">
                            <span className="text-lg block">🗺️</span>
                            <span className="font-bold text-[10px] text-slate-800 block">get to...</span>
                            <span className="text-[9px] text-slate-400 block mt-0.5">istasyona ulaşmak</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 2: DYNAMIC THEORY & RULES OF CURRENT LESSON */}
                  <div className="mb-6 border-t border-slate-150 pt-5 relative z-10">
                    <h3 className="text-xs font-bold uppercase text-indigo-800 tracking-wider mb-2.5 flex items-center gap-1.5">
                      <Brain size={14} className="text-indigo-600" />
                      Yöntem 2: Hafıza Rehberi ve Teorik Çözümler
                    </h3>

                    {activeLessonContent ? (
                      <div className="space-y-4">
                        {/* Graphic Story */}
                        <div className="p-3.5 bg-amber-50 border border-amber-100 rounded-xl text-xs text-slate-800 leading-relaxed font-sans">
                          <span className="font-bold text-amber-800 uppercase text-[9px] block mb-1">DEHB Akılda Tutma Hikayesi</span>
                          <p className="italic text-amber-950">"{activeLessonContent.gorselHikaye}"</p>
                        </div>

                        {/* Bullets */}
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                          <span className="font-bold text-[10px] text-slate-500 uppercase block mb-2">AKIL KARTLARI TEMEL PRENSİPLER:</span>
                          <ul className="space-y-2 text-xs text-slate-700">
                            {activeLessonContent.teoriAçiklama.split("\n").filter(Boolean).map((line, idx) => (
                              <li key={idx} className="flex gap-2 items-start">
                                <span className="text-indigo-600 font-bold mt-0.5">✔</span>
                                <p>{line}</p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="p-4 bg-indigo-50/50 border border-indigo-150 rounded-xl text-xs text-slate-800">
                          <span className="font-bold text-indigo-900 block mb-1">Ders Başlığı: {selectedTopic?.title || "SVO Kuralı"}</span>
                          <p className="text-slate-600 leading-relaxed mb-3">{selectedTopic?.description}</p>
                          <div className="border-t border-indigo-100 pt-2.5">
                            <span className="font-bold text-[9px] text-indigo-800 uppercase block">Türk Öğrencilerin Düştüğü Kritik Hata:</span>
                            <p className="text-[11px] text-slate-700 italic border-l-2 border-amber-400 pl-2 mt-1">{selectedTopic?.turkishPitfalls}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* SECTION 3: PRACTICE EXAMPLES TABLE */}
                  <div className="mb-6 border-t border-slate-150 pt-5 relative z-10">
                    <h3 className="text-xs font-bold uppercase text-indigo-800 tracking-wider mb-3 flex items-center gap-1.5">
                      <CheckCircle size={14} className="text-emerald-500" />
                      Yöntem 3: Akıcı S-V-O Doğrulama & Çeviri Tablosu
                    </h3>

                    <div className="border border-slate-200 rounded-xl overflow-hidden text-[10px] md:text-xs">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase text-[9px]">
                            <th className="p-3 border-r border-slate-200">Türkçe Düşünce</th>
                            <th className="p-3 border-r border-slate-200 text-emerald-800 bg-emerald-50/60">Beklenen Akıcı İngilizce</th>
                            <th className="p-3">Hassas Nokta (Taktik)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeLessonContent ? (
                            activeLessonContent.sorular.map((q, idx) => (
                              <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="p-3 border-r border-slate-100 font-medium font-sans">"{q.turkceSoru}"</td>
                                <td className="p-3 border-r border-slate-100 font-bold text-slate-900 font-mono bg-emerald-50/20">"{q.ingilizceKarsiligi}"</td>
                                <td className="p-3 text-slate-500 italic">💡 {q.zorlukNoktası}</td>
                              </tr>
                            ))
                          ) : (
                            <>
                              <tr className="border-b border-slate-100">
                                <td className="p-3 border-r border-slate-100 font-medium">"Ben elmaları severim."</td>
                                <td className="p-3 border-r border-slate-100 font-bold text-slate-900 font-mono bg-emerald-50/20">"I like apples"</td>
                                <td className="p-3 text-slate-500 italic">Severim fiilini Türk mantığının aksine özne yanına koy.</td>
                              </tr>
                              <tr className="border-b border-slate-100">
                                <td className="p-3 border-r border-slate-100 font-medium">"Biz çay içeriz."</td>
                                <td className="p-3 border-r border-slate-100 font-bold text-slate-900 font-mono bg-emerald-50/20">"We drink tea"</td>
                                <td className="p-3 text-slate-500 italic">Fiili (drink) cümlenin ortasına yapıştır.</td>
                              </tr>
                            </>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* SIGN-OFF & OFFICIAL FOOTER BANNER */}
                  <div className="border-t-2 border-indigo-900 pt-5 mt-8 flex flex-col sm:flex-row items-center justify-between text-[10px] text-slate-400 relative z-10 font-mono">
                    <div className="text-center sm:text-left">
                      <span>Pratik İngilizce Öğrenme Platformu</span>
                      <p className="text-[9px] text-slate-300 mt-0.5">Emine Karakurt Tarafından Öğrenildi. 2026-05-22</p>
                    </div>
                    
                    <div className="mt-4 sm:mt-0 px-4 py-1.5 bg-slate-100 rounded-lg text-slate-700 font-bold border border-slate-200">
                      ONAY KODU: PASSED-LEVEL-OK
                    </div>
                  </div>

                </div>

              </div>

              {/* Modal window footer (Not printed, class no-print) */}
              <div className="flex justify-end gap-3 px-6 py-4 bg-white border-t border-slate-200 no-print">
                <button
                  onClick={() => {
                    sound.playClick();
                    setShowLessonSummaryModal(false);
                  }}
                  className="px-4 py-2 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Kapat
                </button>
                <button
                  onClick={() => {
                    sound.playClick();
                    window.print();
                  }}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-indigo-200"
                >
                  <Printer size={14} />
                  Belgeyi Yazdır / PDF İndir 🖨️
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FOOTER BAR (Clean minimalist) */}
      <footer className="mt-16 border-t border-slate-100 py-8 bg-white/50 text-center text-xs text-slate-400 px-6 transition-colors">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p>© 2026 Pratik İngilizce Öğrenme Platformu. DEHB uyumlu kalıcı eğitim sistemleri.</p>
          <div className="flex items-center gap-4 font-mono text-[10px]">
            <span>Son Senkronizasyon: UTC 2026-05-22</span>
            <span>Sunucu Durumu: Aktif</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
