/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, FormEvent } from "react";
import { Play, Pause, RotateCcw, Volume2, VolumeX, Lightbulb, Trash2, CheckCircle } from "lucide-react";
import { sound } from "../utils/audio";
import { motion, AnimatePresence } from "motion/react";

interface FocusTimerPanelProps {
  onFocusSessionComplete: (durationMins: number) => void;
  isFocusModeActive: boolean;
}

export default function FocusTimerPanel({ onFocusSessionComplete, isFocusModeActive }: FocusTimerPanelProps) {
  const [timeLeft, setTimeLeft] = useState(15 * 60); // 15-minute standard ADHD-friendly focus session
  const [isActive, setIsActive] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [tempNotes, setTempNotes] = useState("");
  const [focusTasks, setFocusTasks] = useState<string[]>([
    "Bugünkü İngilizce videosunu izle",
    "Yeni 5 kelimeyi Aralıklı Tekrar (SRS) ile çalış",
    "Sesli çeviri pratiğinden en az 3 cümleyi tamamla"
  ]);
  const [newTask, setNewTask] = useState("");
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    sound.toggleSound(soundEnabled);
  }, [soundEnabled]);

  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setIsActive(false);
            
            // Play success chime
            sound.playMilestone();
            
            if (!isBreak) {
              onFocusSessionComplete(15);
              setIsBreak(true);
              return 5 * 60; // 5-minute break
            } else {
              setIsBreak(false);
              return 15 * 60; // Back to study
            }
          }
          
          // Satisfying soft clock tick-tock every second for tactile anchoring
          if (soundEnabled && prev % 2 === 0) {
            // Unobtrusive tick
            sound.playClick();
          }
          
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, isBreak, soundEnabled]);

  const toggleTimer = () => {
    sound.playClick();
    setIsActive(!isActive);
  };

  const resetTimer = () => {
    sound.playClick();
    setIsActive(false);
    setTimeLeft(isBreak ? 5 * 60 : 15 * 60);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const addTask = (e: FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    setFocusTasks([...focusTasks, newTask.trim()]);
    setNewTask("");
    sound.playClick();
  };

  const removeTask = (index: number) => {
    setFocusTasks(focusTasks.filter((_, idx) => idx !== index));
    sound.playClick();
  };

  const progressPercent = ((isBreak ? 5 * 60 : 15 * 60) - timeLeft) / (isBreak ? 5 * 60 : 15 * 60);

  return (
    <div id="focus-timer-container" className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* COLUMN 1: Visual Timer Widget */}
      <div id="pomodoro-timer-widget" className={`md:col-span-1 bg-white border border-slate-100 rounded-3xl p-6 flex flex-col items-center justify-between text-center shadow-xs transition-all ${isActive ? "focus-ring-glow ring-2 ring-emerald-400/20" : ""}`}>
        <div>
          <span className="text-xs font-mono font-semibold uppercase tracking-wider bg-slate-100 text-slate-600 px-3 py-1 rounded-full">
            {isBreak ? "💆‍♂️ MOLA BAHÇESİ (5 Dk)" : "⚡ ODAKLANMA SEANSI (15 Dk)"}
          </span>
          <p className="text-xs text-slate-400 mt-2 max-w-[180px] mx-auto">
            {isBreak ? "Zihnini dinlendir, derin nefes al." : "DEHB dostu kısa ve yoğun 15 dakikalık çalışma."}
          </p>
        </div>

        {/* Visual Clock Face */}
        <div className="relative my-8 flex items-center justify-center w-48 h-48">
          <svg className="absolute inset-0 w-full h-full -rotate-90">
            <circle
              cx="96"
              cy="96"
              r="80"
              className="stroke-slate-100 fill-none"
              strokeWidth="10"
            />
            <motion.circle
              cx="96"
              cy="96"
              r="80"
              className={`fill-none ${isBreak ? "stroke-teal-500" : "stroke-emerald-500"}`}
              strokeWidth="10"
              strokeDasharray={2 * Math.PI * 80}
              strokeDashoffset={2 * Math.PI * 80 * (1 - progressPercent)}
              transition={{ ease: "linear" }}
            />
          </svg>
          <div className="flex flex-col items-center justify-center">
            <span className="text-4xl font-display font-bold text-slate-800 tracking-tight select-none">
              {formatTime(timeLeft)}
            </span>
            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-mono mt-0.5">
              {isActive ? "Tık-Tık..." : "Beklemede"}
            </span>
          </div>
        </div>

        {/* Buttons Controls */}
        <div className="w-full flex flex-col gap-3">
          <div className="flex items-center justify-center gap-3">
            <button
              id="toggle-timer-btn"
              onClick={toggleTimer}
              className={`p-4 rounded-2xl flex items-center justify-center transition-all shadow-sm cursor-pointer ${
                isActive 
                  ? "bg-slate-800 text-white hover:bg-slate-700" 
                  : "bg-emerald-500 text-white hover:bg-emerald-600 active:scale-95"
              }`}
            >
              {isActive ? <Pause size={20} className="fill-current" /> : <Play size={20} className="fill-current" />}
            </button>

            <button
              id="reset-timer-btn"
              onClick={resetTimer}
              title="Süreyi Sıfırla"
              className="p-4 bg-slate-50 border border-slate-100 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-2xl transition-all cursor-pointer"
            >
              <RotateCcw size={20} />
            </button>

            <button
              id="sound-toggle-btn"
              onClick={() => {
                setSoundEnabled(!soundEnabled);
                sound.playClick();
              }}
              title={soundEnabled ? "Sesi Kapat" : "Sesi Aç"}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                soundEnabled 
                  ? "bg-emerald-50/50 border-emerald-100 text-emerald-600 hover:bg-emerald-100" 
                  : "bg-slate-50 border-slate-100 text-slate-400 hover:text-slate-600"
              }`}
            >
              {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* COLUMN 2: ADHD Brain Dump Tool (Aklındakileri Çıkar) */}
      <div id="adhd-brain-dump-card" className="bg-white border border-slate-100 rounded-3xl p-6 flex flex-col shadow-xs">
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb size={18} className="text-amber-500 animate-pulse" />
          <h3 className="font-display font-bold text-slate-800 text-sm">Aklından Çıkar & Rahatla</h3>
        </div>
        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          Çalışırken aklına takılan veya dikkati dağıtan alakasız fikirleri (<i>'Şunu araştırmalıyım'</i>, <i>'Markete git'</i> vb.) buraya yazıp zihnini tamamen İngilizceye odakla!
        </p>

        <textarea
          id="brain-dump-textarea"
          value={tempNotes}
          onChange={(e) => setTempNotes(e.target.value)}
          placeholder="Aklına hücum eden her şeyi buraya yazıp unut gitsin..."
          className="w-full flex-1 min-h-[140px] text-xs p-4 bg-amber-50/50 hover:bg-amber-50/80 focus:bg-amber-50 border border-amber-100/60 rounded-2xl focus:outline-hidden focus:ring-2 focus:ring-amber-300/30 text-slate-700 placeholder-amber-700/40 resize-none transition-all leading-relaxed"
        />

        <div className="flex items-center justify-between mt-3 text-[10px] text-slate-400">
          <span className="font-mono">Kayıt kalıcı değildir, ekran kapandığında silinir.</span>
          {tempNotes.length > 0 && (
            <button
              id="clear-brain-dump-btn"
              onClick={() => {
                setTempNotes("");
                sound.playClick();
              }}
              className="text-amber-600 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Trash2 size={12} /> Temizle
            </button>
          )}
        </div>
      </div>

      {/* COLUMN 3: Mini-Tasks (Bite-sized micro goals) */}
      <div id="bite-sized-tasks-card" className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={18} className="text-emerald-500" />
            <h3 className="font-display font-bold text-slate-800 text-sm">Mikro Görevler (Gözünde Büyütme)</h3>
          </div>
          <p className="text-xs text-slate-400 mb-4 leading-relaxed">
            DEHB için en iyi çözüm, hedefleri atomik parçalara bölmektir. Tamamlandıkça işaretle!
          </p>

          <div id="tasks-list" className="space-y-2 mb-4">
            <AnimatePresence>
              {focusTasks.map((task, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="group flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100/70 border border-slate-100/50 rounded-xl transition-all"
                >
                  <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-700 select-none">
                    <input
                      type="checkbox"
                      onChange={() => {
                        // Play ticking/success sound
                        sound.playSuccess();
                        removeTask(idx);
                      }}
                      className="mt-0.5 rounded-sm border-slate-200 text-emerald-500 focus:ring-emerald-400"
                    />
                    <span>{task}</span>
                  </label>
                  <button
                    id={`delete-task-btn-${idx}`}
                    onClick={() => removeTask(idx)}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 transition-opacity p-0.5 cursor-pointer"
                  >
                    <Trash2 size={12} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>

            {focusTasks.length === 0 && (
              <div className="text-center py-6 text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                Tüm mikro görevler bitti! Tebrikler 🎉
              </div>
            )}
          </div>
        </div>

        {/* Add custom mission box */}
        <form onSubmit={addTask} className="flex gap-2">
          <input
            type="text"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="Kendi mikro görevini ekle..."
            className="flex-1 text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 text-slate-800"
          />
          <button
            type="submit"
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs transition-colors cursor-pointer"
          >
            Ekle
          </button>
        </form>
      </div>
    </div>
  );
}
