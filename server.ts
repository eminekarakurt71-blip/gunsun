import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

const app = express();
const PORT = 3000;

// Lazy helper to guarantee we read the latest key dynamically inside request handlers
let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  const currentKey = process.env.GEMINI_API_KEY;
  if (!currentKey) {
    throw new Error("GEMINI_API_KEY environment variable is not defined.");
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: currentKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Robust clean-up of markdown code blocks wrapping JSON responses (e.g. ```json ... ```)
function cleanJsonText(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  return cleaned.trim();
}

app.use(express.json());

// API: Health probe
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", mode: process.env.NODE_ENV || "development" });
});

// Helper: Custom prompt executor for Gemini
async function askGemini(prompt: string, systemInstruction?: string, isJson = false, responseSchema?: any) {
  const models = ["gemini-2.5-flash", "gemini-3.5-flash", "gemini-1.5-flash"];
  let lastError: any = null;

  for (const modelName of models) {
    try {
      const client = getAiClient();
      const config: any = {};
      if (systemInstruction) {
        config.systemInstruction = systemInstruction;
      }
      if (isJson) {
        config.responseMimeType = "application/json";
      }
      if (responseSchema) {
        config.responseSchema = responseSchema;
      }

      const response = await client.models.generateContent({
        model: modelName,
        contents: prompt,
        config: config,
      });

      let text = response.text || "";
      if (isJson && text) {
        text = cleanJsonText(text);
      }
      return text;
    } catch (error: any) {
      lastError = error;
      console.warn(`Model ${modelName} trial failed: ${error.message || error}. Trying next model...`);
    }
  }

  console.error("All Gemini API models failed. Last error:", lastError);
  throw lastError || new Error("All AI models failed to generate content.");
}

// ENDPOINT 1: AI Grammar Helper tailored for Turkish contrastive grammar
function getFallbackGrammar(concept: string) {
  const norm = concept.toLowerCase();
  let topicName = concept;
  let summary = `İngilizcedeki "${concept}" konusu, Türk dillerindeki cümle dizilimi farkları bilindiğinde son derece sadeleşmektedir.`;
  let pitfall = "Türkçedeki ek odaklı ve fiili sona yerleştiren düşünme yapısını doğrudan İngilizceye kopyalamaya çalışmak.";
  
  let comparison = [
    {
      turkceYapi: "Ben çay içerim. (Özne + Nesne + Fiil)",
      ingilizceYapi: "I (S) + drink (V) + tea (O).",
      farkAçiklamasi: "Türkçe fiili en sona alırken, İngilizce hemen öznenin ardına ekler."
    }
  ];
  let tips = [
    "Daima önce kimin yaptığını söyle, ardından yapılan eylemi hemen yapıştır!",
    "Nesneleri ve zamanları cümlenin son vagonuna sakla."
  ];
  let examples = [
    {
      turkce: "Ben çay severim.",
      ingilizce: "I like tea",
      telaffuz: "Ay layk tiy",
      svoAnalizi: "I (S) - like (V) - tea (O)"
    },
    {
      turkce: "O (erkek) futbol oynar.",
      ingilizce: "He plays football",
      telaffuz: "Hi pleyz futbol",
      svoAnalizi: "He (S) - plays (V) - football (O)"
    }
  ];

  if (norm.includes("svo") || norm.includes("cümle") || norm.includes("yapi") || norm.includes("s-v-o")) {
    topicName = "İngilizce Temel Cümle Yapısı (SVO)";
    summary = "İngilizcede cümleler daima Özne (S) + Fiil (V) + Nesne (O) formülüyle kurulur. Türkçe gibi fiil sona saklanmaz!";
    pitfall = "Türkçe düşünerek fiili sona atmak veya özne ile nesne arasına koymamak.";
    comparison = [
      {
        turkceYapi: "Ben bir kedi görüyorum. (Kedi sonda fiilden önce)",
        ingilizceYapi: "I see a cat. (See fiili doğrudan I kelimesinin yanındadır)",
        farkAçiklamasi: "İngilizce SVO tren sırasını hiç bozmaz, önce kimin gördüğü sonra fiil gelir."
      }
    ];
  } else if (norm.includes("am") || norm.includes("is") || norm.includes("are") || norm.includes("be") || norm.includes("oldurma") || norm.includes("durum")) {
    topicName = "Gizli Durum Ekleri - Am, Is, Are";
    summary = "İçinde hareket/eylem bulunmayan, durum veya isim bildiren cümlelerde am/is/are köprü kurucularıdır.";
    pitfall = "Eylem varmış gibi hareket etmek veya özneyi desteksiz bırakmak ('I doctor' yerine 'I am a doctor').";
    comparison = [
      {
        turkceYapi: "Ben mutluyum. (-um eki kelime sonunda)",
        ingilizceYapi: "I am happy. ('am' kelimesi 'mutluyum' durumunu sağlar)",
        farkAçiklamasi: "Ek kullanılmadığından kelime yanına köprü olarak 'am' getirilir."
      }
    ];
  }

  return {
    konuAdi: topicName,
    ozet: summary,
    turkceZorlugu: pitfall,
    karsilastirma: comparison,
    pratikIpuclari: tips,
    ornekCümleler: examples
  };
}

function getFallbackLesson(topic: string) {
  const norm = topic.toLowerCase();
  
  if (norm.includes("svo") || norm.includes("cümle") || norm.includes("formül") || norm.includes("1. ders")) {
    return {
      baslik: "Cümle Kurma Formülü (SVO)",
      gorselHikaye: "Seyis (Subject) atına biner (Verb) ve samanlığa (Object) koşturur. İngilizcede seyis atına biner binmez samanlığa ulaşır, fiil asla geride kalmaz!",
      teoriAçiklama: "1. Türkçe cümlenin sonundaki fiili (Yüklem) alıp İngilizcede hemen Öznenin sağ yanına ekliyoruz.\n2. Formülümüz SVO: Subject (Özne) + Verb (Eylem/Fiil) + Object (Etkilenen Nesne).\n3. 'Ben elma severim' yapısını 'Ben severim elma' şeklinde (I like apples) kurgulayacağız.",
      yapiFormulu: "Subject (Özne) + Verb (Fiil) + Object (Nesne)",
      sorular: [
        {
          id: 1,
          turkceSoru: "Ben elma severim.",
          ingilizceKarsiligi: "I like apples",
          ipucu: "Severim (like) kelimesini 'I'dan hemen sonra getirmelisin.",
          zorlukNoktası: "Türkçe düşünme, fiili sona atma!"
        },
        {
          id: 2,
          turkceSoru: "Biz çay içeriz.",
          ingilizceKarsiligi: "We drink tea",
          ipucu: "İçmek (drink) kelimesini 'We' ile başlatarak yerleştir.",
          zorlukNoktası: "Eylem ('drink') cümlenin ortasında yer almalıdır."
        },
        {
          id: 3,
          turkceSoru: "Onlar kitap okur.",
          ingilizceKarsiligi: "They read books",
          ipucu: "Buradaki eylemimiz 'read' (okumak). Kitap derken çoğul yapmalı veya nesne biçiminde eklemelisin.",
          zorlukNoktası: "They read books şeklinde nesneyi sona atıyoruz."
        }
      ]
    };
  }

  if (norm.includes("he / she / it") || norm.includes("she") || norm.includes("he") || norm.includes("it") || norm.includes("o kim") || norm.includes("2. ders")) {
    return {
      baslik: "'O' Kim? He / She / It Ayrımı",
      gorselHikaye: "Erkek prens 'He' kılıcını taşır, prenses 'She' asasını sallar, sevimli köpek 'It' ise kuyruğunu sallayarak onları izler. Türkçedeki tek 'O' burada süzgeçten geçer!",
      teoriAçiklama: "1. İngilizcede erkekler için her zaman 'He' öznesini seçmelisiniz.\n2. Kadınlardan bahsederken 'She' öznesi devreye girer.\n3. Cansız nesneler, hava durumu ve hayvanlar için özel tarafsız 'It' kelimesi kullanılır.",
      yapiFormulu: "He (Erkek) / She (Kadın) / It (Cansız/Hayvan) + Verb + Object",
      sorular: [
        {
          id: 1,
          turkceSoru: "O (erkek) İngilizce konuşur.",
          ingilizceKarsiligi: "He speaks English",
          ipucu: "Erkek özne için 'He' kullanmalı, geniş zamanda fiile '-s' takısı eklemelisin.",
          zorlukNoktası: "Speaks sonundaki '-s' takısını sakın unutma!"
        },
        {
          id: 2,
          turkceSoru: "O (kadın) kahve sever.",
          ingilizceKarsiligi: "She likes coffee",
          ipucu: "Kadın özne için 'She' seçmeli, sever (like) eylemine '-s' takısı getirmelisin.",
          zorlukNoktası: "She likes coffee dersen tam puan alacaksın."
        },
        {
          id: 3,
          turkceSoru: "O (kedi/köpek) süt içer.",
          ingilizceKarsiligi: "It drinks milk",
          ipucu: "Hayvan/nesne öznesi için 'It' kullanmalısın, fiili ('drink') eklemelisin.",
          zorlukNoktası: "It drinks milk..."
        }
      ]
    };
  }

  if (norm.includes("gizli ekler") || norm.includes("am") || norm.includes("is") || norm.includes("are") || norm.includes("3. ders") || norm.includes("to-be")) {
    return {
      baslik: "Gizli Ekler: Am, Is, Are",
      gorselHikaye: "Kelimeler birer yapışkan gibidir. 'Am' sadece 'I' ile birleşir, 'Is' tekillere (He/She/It) sığınır, 'Are' ise çoğullar (We/You/They) ile dans eder!",
      teoriAçiklama: "1. İsim veya durum bildiren, yani hareket/eylem içermeyen cümlelerde am/is/are köprü vazifesi görür.\n2. Türkçe cümledeki son şahıs eki (örneğin öğretmen-İM'deki -im), İngilizcede öznenin yanına gelen yardımcı fiildir.\n3. Eğer cümlede yürümek, sevmek gibi bir hareket varsa am/is/are kullanılmaz.",
      yapiFormulu: "Subject + [am / is / are] + Noun/Adjective",
      sorular: [
        {
          id: 1,
          turkceSoru: "Ben bir öğretmenim.",
          ingilizceKarsiligi: "I am a teacher",
          ipucu: "'Ben ... im' derken İngilizce 'I am' ile başlar. 'Bir' anlamına gelen 'a' kelimesini ekle.",
          zorlukNoktası: "'am' ve 'a' öğelerini bir arada kullanmalısın."
        },
        {
          id: 2,
          turkceSoru: "Biz mutluyuz.",
          ingilizceKarsiligi: "We are happy",
          ipucu: "Çoğul özne olduğu için 'We' yanına 'are' getir, mutluyuz (happy) yaz.",
          zorlukNoktası: "Herhangi bir fiil (eylem) olmadığı için 'are' kullandık."
        },
        {
          id: 3,
          turkceSoru: "Sen akıllısın.",
          ingilizceKarsiligi: "You are smart",
          ipucu: "'You' kelimesinden sonra durum bildiren 'are' getirilmelidir.",
          zorlukNoktası: "You are smart."
        }
      ]
    };
  }

  if (norm.includes("do") || norm.includes("does") || norm.includes("soru") || norm.includes("4. ders")) {
    return {
      baslik: "Do & Does ile Soru Sorma Sanatı",
      gorselHikaye: "Do ve Does, cümlelerin başına yerleşen iki koruma gibidir. Soru sormak istiyorsanız hemen en başa geçip 'Durun bakalım!' derler.",
      teoriAçiklama: "1. İngilizcede genel sorularda cümlenin sonuna değil, en başına soru kelimesi 'Do' veya 'Does' gelir.\n2. Tekil kişilerde (He/She/It) başa 'Does' yerleşir ve asıl fiilin sonundaki '-s' takısını kendi içine çeker.\n3. Çoğul ve diğer kişilerde (I/We/You/They) ise 'Do' kelimesi cümlenin başına kurulur.",
      yapiFormulu: "[Do / Does] + Subject + Verb (Yalın/Sade) + Object + ?",
      sorular: [
        {
          id: 1,
          turkceSoru: "Sen kahve sever misin?",
          ingilizceKarsiligi: "Do you like coffee",
          ipucu: "Sene sorduğumuz için en başa 'Do' soru yardımcısını koyup 'you like coffee' diye devam et.",
          zorlukNoktası: "Do başa gelir, fiil 'like' yalın kalır."
        },
        {
          id: 2,
          turkceSoru: "O (erkek) futbol oynar mı?",
          ingilizceKarsiligi: "Does he play football",
          ipucu: "O (Erkek) yani 'He' için soru yaparken başa 'Does' getir. Does geldiğinde 'play' fiiline '-s' ekleme!",
          zorlukNoktası: "Does he play... ('plays' değil, çünkü 's' harfi Does'ın içinde zaten var!)"
        },
        {
          id: 3,
          turkceSoru: "Onlar burada mı yaşar?",
          ingilizceKarsiligi: "Do they live here",
          ipucu: "Çoğul nesne 'They' olduğu için başa 'Do' ekleyerek cümleyi kur.",
          zorlukNoktası: "Do they live here?"
        }
      ]
    };
  }

  if (norm.includes("a") || norm.includes("an") || norm.includes("the") || norm.includes("nightmare") || norm.includes("belirteç") || norm.includes("5. ders")) {
    return {
      baslik: "'A', 'An' ve Gizemli 'The' Belirteci",
      gorselHikaye: "Herhangi bir elma 'an apple' iken, masadaki o özel ve tek kırmızı elma 'the apple' olur. 'The' bilinen, özel nesnelerin üzerine asılan bir tabela gibidir!",
      teoriAçiklama: "1. İngilizcede isimlerden önce mutlaka bir belirteç seçmemiz gerekir.\n2. Sessiz harfle başlayan rastgele isimlerden önce 'a', sesli harfle başlayanlardan önce 'an' deriz.\n3. Dinleyicinin de gayet iyi bildiği, belirli bir nesneden bahsediyorsak 'the' kelimesini yapıştırırız.",
      yapiFormulu: "[a / an / the] + Noun (İsim)",
      sorular: [
        {
          id: 1,
          turkceSoru: "Ben bir kitap okurum.",
          ingilizceKarsiligi: "I read a book",
          ipucu: "Kitap kelimesi sessizle başlar, bu yüzden 'a book' demelisin.",
          zorlukNoktası: "'a' belirtecini eklemeyi unutma!"
        },
        {
          id: 2,
          turkceSoru: "Ben elma yerim.",
          ingilizceKarsiligi: "I eat an apple",
          ipucu: "Elma (apple) sesli harfle başladığı için 'an apple' ifadesi kullanılır.",
          zorlukNoktası: "Sesli uyumu: an apple."
        },
        {
          id: 3,
          turkceSoru: "Ben kapıyı açarım.",
          ingilizceKarsiligi: "I open the door",
          ipucu: "Bahsedilen kapı rastgele bir kapı değil, odadaki bilinen 'o kapı' olduğu için 'the' kullanmalısın.",
          zorlukNoktası: "Belirtili nesneye 'the door' diyoruz."
        }
      ]
    };
  }

  // Generic
  return {
    baslik: topic || "Akıcı İngilizce SVO Eğitimi",
    gorselHikaye: "Düşünceleri İngilizceye dökerken bir tren vagonunu andıran Özne-Eylem-Nesne sırasını takip ederiz.",
    teoriAçiklama: "1. Türkçe mantık fiili sona çekerken İngilizce en başa yaklaştırır.\n2. 'Ben süt içerim' ➔ 'Ben içerim süt' (SVO: I drink milk).\n3. Sıklıkla tekrarlanan cümle kalıplarında eylemin konumuna odaklanın.",
    yapiFormulu: "Subject (Yapan) + Verb (Eylem) + Object (Etkilenen)",
    sorular: [
      {
        id: 1,
        turkceSoru: "Ben süt içerim.",
        ingilizceKarsiligi: "I drink milk",
        ipucu: "Ben (I) - İçerim (drink) - Süt (milk). SVO sırasını koru.",
        zorlukNoktası: "Fiili sona kaçırmamaya dikkat et."
      },
      {
        id: 2,
        turkceSoru: "Biz İngilizce öğreniriz.",
        ingilizceKarsiligi: "We learn English",
        ipucu: "Biz (We) - Öğreniriz (learn) - İngilizce (English).",
        zorlukNoktası: "SVO trenini sırasıyla inşa et."
      },
      {
        id: 3,
        turkceSoru: "Sen müzik seversin.",
        ingilizceKarsiligi: "You like music",
        ipucu: "Sen (You) - Seversin (like) - Müzik (music).",
        zorlukNoktası: "Fiili doğrudan sen kelimesinin yanına getir."
      }
    ]
  };
}

function getFallbackAnalysis(expected: string, user: string, turkishPrompt: string) {
  const norm = (str: string) => str.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").trim();
  const cleanExp = norm(expected);
  const cleanUser = norm(user);

  if (cleanExp === cleanUser) {
    return {
      isCorrect: true,
      skor: 100,
      analizMesaji: "Tebrikler! Cümleniz tamamen akıcı ve hatasız bir şekilde kuruldu. SVO vagon düzeni harika uyum sağlıyor!",
      dogruVersiyon: expected,
      telaffuzDestegi: expected.split(" ").map(w => `[${w}]`).join(" "),
      svoIncelemesi: {
        subject: "Öznemiz mükemmel yerleşimde.",
        verb: "Eylem olması gerektiği gibi özneyle yapışık.",
        object: "Nesnemiz de sonda yer alıyor."
      }
    };
  }

  const expWords = cleanExp.split(/\s+/).filter(Boolean);
  const userWords = cleanUser.split(/\s+/).filter(Boolean);
  
  let matches = 0;
  for (const w of userWords) {
    if (expWords.includes(w)) {
      matches++;
    }
  }

  const scorePct = Math.round((matches / Math.max(expWords.length, 1)) * 100);
  const isCorrect = scorePct >= 80;

  let msg = `Cümlenizde ufak tefek farklılıklar mevcut. Lütfen S-V-O düzenini ve ekleri kontrol edin.`;
  if (scorePct >= 80) {
    msg = `Harika! Ufak tefek yazım veya kural farkları dışında cümleniz tamamen anlaşılır ve kabul edilebilir seviyede.`;
  } else if (scorePct < 40) {
    msg = `İngilizcedeki SVO kurallarına bağlı kalmaya çalışın. Türkçe cümle yapısı zihninizi karıştırıyor olabilir. Özne yanına hemen eylemi yerleştirin!`;
  }

  return {
    isCorrect,
    skor: Math.min(Math.max(scorePct, 10), 99),
    analizMesaji: msg,
    dogruVersiyon: expected,
    telaffuzDestegi: expected,
    svoIncelemesi: {
      subject: `Özne doğru konumlanmış görünüyor.`,
      verb: `Cümle ortasında '${expWords[1] || "fiil"}' eyleminin olup olmadığını kontrol edin.`,
      object: `Nesneyi en sona, tüm yapının bittiği yere yerleştirin.`
    }
  };
}

app.post("/api/explain-grammar", async (req, res) => {
  const { concept } = req.body;
  
  if (!concept) {
    return res.status(400).json({ error: "Lütfen incelemek istediğiniz konuyu belirtin." });
  }

  const systemInstruction = 
    "Sen deneyimli ve cana yakın bir İngilizce öğretmenisin. Öğrencilerin Türk olduğu için, İngilizce ve Türkçe arasındaki dilbilgisi farklılıklarına (özellikle Türkçe Nesne-Yüklem sırası olan SOV ile İngilizce SVO Öznesel yapısı) çok iyi hakimsin. " +
    "Açıklamalarını DEHB'li bireyleri sıkmayacak, minimalist, kısa, net başlıklar halinde, gereksiz akademik laf kalabalığından uzak, heyecan verici ve motive edici şekilde Türkçe yap. " +
    "Yanıtını mutlaka JSON formatında döndür.";

  const prompt = `Konu şudur: "${concept}". 
  Bu konuyu Türk öğrenciler için özel bir kontrast (karşılaştırma) kurarak anlat.`;

  const explainGrammarSchema = {
    type: Type.OBJECT,
    properties: {
      konuAdi: { type: Type.STRING, description: "Konunun kısa ve net adı" },
      ozet: { type: Type.STRING, description: "Konunun DEHB dostu, çok sade ve eğlenceli 2 cümlelik özeti" },
      turkceZorlugu: { type: Type.STRING, description: "Türklerin bu konuda en çok yaptığı hata nedir (örn: eki karıştırma, fiili sona atma)" },
      karsilastirma: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            turkceYapi: { type: Type.STRING, description: "Türkçe cümle yapısı" },
            ingilizceYapi: { type: Type.STRING, description: "SVO renkli şablonu" },
            farkAçiklamasi: { type: Type.STRING, description: "Neden böyle kurulduğu açıklaması" }
          },
          required: ["turkceYapi", "ingilizceYapi", "farkAçiklamasi"]
        }
      },
      pratikIpuclari: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "DEHB'li akıllar için akılda kalıcı 1-2 kısayol ipucu"
      },
      ornekCümleler: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            turkce: { type: Type.STRING, description: "Türkçe anlamı" },
            ingilizce: { type: Type.STRING, description: "İngilizce aslı" },
            telaffuz: { type: Type.STRING, description: "Türkçe harfleriyle telaffuz okunuşu" },
            svoAnalizi: { type: Type.STRING, description: "Cümlenin SVO (Özne, Eylem, Nesne) etiketli hali" }
          },
          required: ["turkce", "ingilizce", "telaffuz", "svoAnalizi"]
        }
      }
    },
    required: ["konuAdi", "ozet", "turkceZorlugu", "karsilastirma", "pratikIpuclari", "ornekCümleler"]
  };

  try {
    const responseText = await askGemini(prompt, systemInstruction, true, explainGrammarSchema);
    if (!responseText) throw new Error("Yapay zekadan boş cevap alındı.");
    const parsed = JSON.parse(responseText);
    res.json(parsed);
  } catch (error: any) {
    console.error("Grammar Explanation AI Error, serving fallback:", error);
    const fallback = getFallbackGrammar(concept);
    res.json({ ...fallback, isFallback: true });
  }
});

// ENDPOINT 2: Interactive personalized lesson generator based on Turkish difficulty spots
app.post("/api/generate-lesson-content", async (req, res) => {
  const { levelName, topic } = req.body; // e.g., levelName: "A1-Sıfırdan Başlangıç", topic: "Subject Pronouns (Ben, Sen, O)"
  
  const systemInstruction = 
    "Türkler için optimize edilmiş, DEHB dostu, aşırı sadeleştirilmiş bir İngilizce ders müfredat jeneratörüsün. " +
    "Seçilen konuyu 0'dan başlayarak öğret. Anlatımı adım adım, görsel canlandırmalar içeren örneklerle yap. Sonunda da öğrencinin yapabileceği 3 adet interaktif çeviri sorusu ekle. " +
    "Lütfen yanıtını tamamen JSON formatında dön.";

  const prompt = `Konu: "${topic}" (Seviye: ${levelName}).
  Sıfırdan başlayan bir Türk için bu konuyu anlat. Türkçede olmayıp İngilizcede bulunan farklara odaklan (örn: Am, Is, Are farkı veya He/She/It ayrımı Türkçede sadece 'O' olduğu için zor gelir).`;

  const generateLessonSchema = {
    type: Type.OBJECT,
    properties: {
      baslik: { type: Type.STRING, description: "Dersin adı" },
      gorselHikaye: { type: Type.STRING, description: "Dersi canlandıracak DEHB uyumlu, eğlenceli ve akılda kalıcı 1-2 cümlelik mini hikaye" },
      teoriAçiklama: { type: Type.STRING, description: "Tek seferde okunabilecek, 3 kısa madde halinde Türkçe anlatım" },
      yapiFormulu: { type: Type.STRING, description: "Cümle kurulum formülü" },
      sorular: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.INTEGER, description: "Sorunun sırası (örn: 1, 2, 3)" },
            turkceSoru: { type: Type.STRING, description: "Türkçe cümle (Çevirmesi istenecek, örn: 'Ben bir kedi görürüm')" },
            ingilizceKarsiligi: { type: Type.STRING, description: "Doğru İngilizce çeviri (örn: 'I see a cat')" },
            ipucu: { type: Type.STRING, description: "Türkçe kelimelerin sırası ile İngilizce sırasına dair bir hatırlatma ipucu" },
            zorlukNoktası: { type: Type.STRING, description: "Türkçe düşünen birinin burada kaçırabileceği ek/detay" }
          },
          required: ["id", "turkceSoru", "ingilizceKarsiligi", "ipucu", "zorlukNoktası"]
        }
      }
    },
    required: ["baslik", "gorselHikaye", "teoriAçiklama", "yapiFormulu", "sorular"]
  };

  try {
    const responseText = await askGemini(prompt, systemInstruction, true, generateLessonSchema);
    if (!responseText) throw new Error("Yapay zekadan boş cevap alındı.");
    const parsed = JSON.parse(responseText);
    res.json(parsed);
  } catch (error: any) {
    console.error("Lesson Generator AI Error, serving fallback:", error);
    const fallback = getFallbackLesson(topic || "");
    res.json({ ...fallback, isFallback: true });
  }
});

// ENDPOINT 3: AI Instant Sentence and Audio Speech Feedback Analyzer
app.post("/api/analyze-sentence", async (req, res) => {
  const { expectedSentence, userSentence, turkishPrompt } = req.body;

  if (!userSentence) {
    return res.status(400).json({ error: "Lütfen bir cevap yazın ya da ses kaydı ile söyleyin." });
  }

  const systemInstruction = 
    "Sen akıllı bir İngilizce konuşma ve yazma analiz asistanısın. Görevin, öğrencinin Türkçe ifadeyi İngilizceye çevirirken " +
    "yazdığı ya da sesle söylediği cümleyi analiz etmek, " +
    "varsa dilbilgisi hatalarını, SVO sırasındaki hataları veya telaffuz kaymasından kaynaklı yazım hatalarını bulup sevecen bir dille anında düzeltmektir. " +
    "Lütfen Türkçe karakter kullanarak ve DEHB öğrencisini teşvik edecek şekilde kısa ve öz Türkçe geri bildirim yap. Yanıtını JSON olarak döndür.";

  const prompt = `Türkçe İfade: "${turkishPrompt}"
  Beklenen Doğru İngilizce: "${expectedSentence}"
  Öğrencinin Kurduğu İngilizce Cümle: "${userSentence}"
  
  Bu iki cümleyi karşılaştır. Eğer öğrenci doğru kurduysa harika bir tebrik mesajı ver. 
  Hatalıysa, tam hatasını göster. Türkçe öğrenci kafasına uygun bir dilbilgisi düzeltmesi (özellikle do/does, he/she/it, am/is/are, fiilin sona atılması veya ek eksiklikleri) yap.`;

  const analyzeSentenceSchema = {
    type: Type.OBJECT,
    properties: {
      isCorrect: { type: Type.BOOLEAN, description: "Harf hataları ve noktalama işaretlerini çok sıkı tutma, anlam doğruysa ve yapı düzgünse true de" },
      skor: { type: Type.INTEGER, description: "0 ile 100 arasında bir puan" },
      analizMesaji: { type: Type.STRING, description: "DEHB dostu, kısa ve samimi açıklama mesajı. Neyi harika yaptı, neyi gözden kaçırdı?" },
      dogruVersiyon: { type: Type.STRING, description: "Cümlenin tam doğru, doğal yazılışı" },
      telaffuzDestegi: { type: Type.STRING, description: "Doğru yazılan cümlenin Türkçe okunuş rehberi (örn: 'I have a dog' -> 'Ay hev e dog')" },
      svoIncelemesi: {
        type: Type.OBJECT,
        properties: {
          subject: { type: Type.STRING, description: "Özne hangisi ve nerede durmalı" },
          verb: { type: Type.STRING, description: "Eylem hangisi ve Türkçe akıştan farklı olarak nerede durmalı" },
          object: { type: Type.STRING, description: "Varsa geriye kalan nesne tahlili" }
        },
        required: ["subject", "verb", "object"]
      }
    },
    required: ["isCorrect", "skor", "analizMesaji", "dogruVersiyon", "telaffuzDestegi", "svoIncelemesi"]
  };

  try {
    const responseText = await askGemini(prompt, systemInstruction, true, analyzeSentenceSchema);
    if (!responseText) throw new Error("Geri bildirim analiz edilirken boş yanıt alındı.");
    const parsed = JSON.parse(responseText);
    res.json(parsed);
  } catch (error: any) {
    console.error("Sentence Analyzer AI Error, serving fallback:", error);
    const fallback = getFallbackAnalysis(expectedSentence, userSentence, turkishPrompt);
    res.json({ ...fallback, isFallback: true });
  }
});


// Serve files with Vite middleware in development or express.static in production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running beautifully at http://localhost:${PORT}`);
  });
}

startServer();
