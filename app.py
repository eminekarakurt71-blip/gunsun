import os
import json
import re
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from typing import List, Optional

load_dotenv()

app = Flask(__name__, static_folder="dist")
CORS(app)  # Enable Cross-Origin Resource Sharing for easy local development testing

# Lazy helper to dynamically retrieve client and guarantee API key updates
client = None

def get_genai_client():
    global client
    if client is None:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable is not defined.")
        client = genai.Client(api_key=api_key)
    return client

def clean_json_text(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    return cleaned.strip()


# ==========================================
# PYDANTIC SCHEMAS FOR STRUCTURED GEMINI API
# ==========================================

class ComparisonItem(BaseModel):
    turkceYapi: str = Field(description="Turkce cümle yapisi (örn: Ben elma severim)")
    ingilizceYapi: str = Field(description="SVO renkli sablonu (örn: I (S) + love (V) + apples (O))")
    farkAciklamasi: str = Field(description="Neden böyle kuruldugu aciklamasi")

class ExampleSentence(BaseModel):
    turkce: str = Field(description="Turkce anlami")
    ingilizce: str = Field(description="Ingilizce asli")
    telaffuz: str = Field(description="Turkce harfleriyle telaffuz okunusu (örn: wednesday -> venzdey)")
    svoAnalizi: str = Field(description="Cümlenin SVO (Özne, Eylem, Nesne) etiketli hali")

class ExplainGrammarResponse(BaseModel):
    konuAdi: str = Field(description="Konunun kisa ve net adi")
    ozet: str = Field(description="Konunun DEHB dostu, cok sade ve eglenceli 2 cümlelik özeti")
    turkceZorlugu: str = Field(description="Türklerin bu konuda en cok yaptıgı hata nedir (örn: eki karıstırma, fiili sona atma)")
    karsilastirma: List[ComparisonItem] = Field(description="Turkce ve Ingilizce cümle yapisi karsılastırması")
    pratikIpuclari: List[str] = Field(description="DEHB'li akıllar icin akılda kalıcı 1-2 kısayol ipucu")
    ornekCumleler: List[ExampleSentence] = Field(description="Konuya dair pratik örnek cümleler")


class LessonQuestion(BaseModel):
    id: int = Field(description="Sorunun sirasi (1, 2, 3)")
    turkceSoru: str = Field(description="Cevirmesi istenecek Turkce cümle (örn: 'Ben bir kedi görürüm')")
    ingilizceKarsiligi: str = Field(description="Dogru Ingilizce ceviri (örn: 'I see a cat')")
    ipucu: str = Field(description="Turkce kelimelerin sirasi ile Ingilizce sirasina dair bir hatirlatma ipucu")
    zorlukNoktası: str = Field(description="Turkce düsünen birinin burada kacirabilecegi ek veya detay")

class GenerateLessonResponse(BaseModel):
    baslik: str = Field(description="Dersin adi")
    gorselHikaye: str = Field(description="Dersi canlandiracak DEHB uyumlu, eglenceli ve akilda kalici mini hikaye")
    teoriAciklama: str = Field(description="Tek seferde okunabilecek, 3 kisa madde halinde Türkçe anlatim")
    yapiFormulu: str = Field(description="Cümle kurulum formülü (örn: Subject (Özne) + Verb (Fiil) + Object (Nesne))")
    sorular: List[LessonQuestion] = Field(description="Ögrencinin yapacagi 3 adet interaktif ceviri sorusu")


class SvoAnalysis(BaseModel):
    subject: str = Field(description="Özne hangisi ve nerede durmali")
    verb: str = Field(description="Eylem hangisi ve Turkce akistan farkli olarak nerede durmali")
    object: str = Field(description="Varsa geriye kalan nesne tahlili")

class AnalyzeSentenceResponse(BaseModel):
    isCorrect: bool = Field(description="Harf hatalari ve noktalama isaretlerini cok siki tutmadan, anlam ve yapi dogruysa true de")
    skor: int = Field(description="0 ile 100 arasinda bir basari puani")
    analizMesaji: str = Field(description="DEHB dostu, kisa ve samimi aciklama mesaji. Neyi harika yapti, neyi gözden kacirdi?")
    dogruVersiyon: str = Field(description="Cümlenin tam dogru, dogal yazilisi")
    telaffuzDestegi: str = Field(description="Dogru yazilan cümlenin Turkce okunus rehberi (örn: 'I have a dog' -> 'Ay hev e dog')")
    svoIncelemesi: SvoAnalysis = Field(description="Cümlenin SVO (Özne-Fiil-Nesne) analizi")


# ==========================================
# GEMINI GENERATE HELPER
# ==========================================

def ask_gemini(prompt: str, system_instruction: str = None, is_json: bool = False, response_schema = None) -> str:
    models = ["gemini-2.5-flash", "gemini-1.5-flash"]
    last_error = None

    for model_name in models:
        try:
            genai_client = get_genai_client()
            
            config = types.GenerateContentConfig()
            if system_instruction:
                config.system_instruction = system_instruction
            if is_json:
                config.response_mime_type = "application/json"
            if response_schema:
                config.response_schema = response_schema

            response = genai_client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=config,
            )

            text = response.text or ""
            if is_json and text:
                text = clean_json_text(text)
            return text
        except Exception as e:
            last_error = e
            print(f"Model {model_name} failed: {e}. Retrying next model.")

    print(f"All models failed. Last Gemini API Error: {last_error}")
    raise last_error if last_error else RuntimeError("All AI models failed to generate content.")


# ==========================================
# FALLBACK GENERATORS (RESILIENCY FIRST)
# ==========================================

def get_fallback_grammar(concept: str) -> dict:
    norm = concept.lower()
    topic_name = concept
    summary = f"İngilizcedeki '{concept}' konusu, Türk dillerindeki cümle dizilimi farkları bilindiğinde son derece sadeleşmektedir."
    pitfall = "Türkçedeki ek odaklı ve fiili sona yerleştiren düşünme yapısını doğrudan İngilizceye kopyalamaya çalışmak."
    
    comparison = [
        {
            "turkceYapi": "Ben çay içerim. (Özne + Nesne + Fiil)",
            "ingilizceYapi": "I (S) + drink (V) + tea (O).",
            "farkAçiklamasi": "Türkçe fiili en sona alırken, İngilizce hemen öznenin ardına ekler."
        }
    ]
    tips = [
        "Daima önce kimin yaptığını söyle, ardından yapılan eylemi hemen yapıştır!",
        "Nesneleri ve zamanları cümlenin son vagonuna sakla."
    ]
    examples = [
        {
            "turkce": "Ben çay severim.",
            "ingilizce": "I like tea",
            "telaffuz": "Ay layk tiy",
            "svoAnalizi": "I (S) - like (V) - tea (O)"
        },
        {
            "turkce": "O (erkek) futbol oynar.",
            "ingilizce": "He plays football",
            "telaffuz": "Hi pleyz futbol",
            "svoAnalizi": "He (S) - plays (V) - football (O)"
        }
    ]

    if "svo" in norm or "cümle" in norm or "yapi" in norm or "s-v-o" in norm:
        topic_name = "İngilizce Temel Cümle Yapısı (SVO)"
        summary = "İngilizcede cümleler daima Özne (S) + Fiil (V) + Nesne (O) formülüyle kurulur. Türkçe gibi fiil sona saklanmaz!"
        pitfall = "Türkçe düşünerek fiili sona atmak veya özne ile nesne arasına koymamak."
        comparison = [
            {
                "turkceYapi": "Ben bir kedi görüyorum. (Kedi sonda fiilden önce)",
                "ingilizceYapi": "I see a cat. (See fiili doğrudan I kelimesinin yanındadır)",
                "farkAçiklamasi": "İngilizce SVO tren sırasını hiç bozmaz, önce kimin gördüğü sonra fiil gelir."
            }
        ]
    elif any(k in norm for k in ["am", "is", "are", "be", "oldurma", "durum"]):
        topic_name = "Gizli Durum Ekleri - Am, Is, Are"
        summary = "İçinde hareket/eylem bulunmayan, durum veya isim bildiren cümlelerde am/is/are köprü kurucularıdır."
        pitfall = "Eylem varmış gibi hareket etmek veya özneyi desteksiz bırakmak ('I doctor' yerine 'I am a doctor')."
        comparison = [
            {
                "turkceYapi": "Ben mutluyum. (-um eki kelime sonunda)",
                "ingilizceYapi": "I am happy. ('am' kelimesi 'mutluyum' durumunu sağlar)",
                "farkAçiklamasi": "Ek kullanılmadığından kelime yanına köprü olarak 'am' getirilir."
            }
        ]

    return {
        "konuAdi": topic_name,
        "ozet": summary,
        "turkceZorlugu": pitfall,
        "karsilastirma": comparison,
        "pratikIpuclari": tips,
        "ornekCümleler": examples
    }

def get_fallback_lesson(topic: str) -> dict:
    norm = topic.lower()
    
    if any(k in norm for k in ["svo", "cümle", "formül", "1. ders"]):
        return {
            "baslik": "Cümle Kurma Formülü (SVO)",
            "gorselHikaye": "Seyis (Subject) atına biner (Verb) ve samanlığa (Object) koşturur. İngilizcede seyis atına biner binmez samanlığa ulaşır, fiil asla geride kalmaz!",
            "teoriAçiklama": "1. Türkçe cümlenin sonundaki fiili (Yüklem) alıp İngilizcede hemen Öznenin sağ yanına ekliyoruz.\n2. Formülümüz SVO: Subject (Özne) + Verb (Eylem/Fiil) + Object (Etkilenen Nesne).\n3. 'Ben elma severim' yapısını 'Ben severim elma' şeklinde (I like apples) kurgulayacağız.",
            "yapiFormulu": "Subject (Özne) + Verb (Fiil) + Object (Nesne)",
            "sorular": [
                {
                    "id": 1,
                    "turkceSoru": "Ben elma severim.",
                    "ingilizceKarsiligi": "I like apples",
                    "ipucu": "Severim (like) kelimesini 'I'dan hemen sonra getirmelisin.",
                    "zorlukNoktası": "Türkçe düşünme, fiili sona atma!"
                },
                {
                    "id": 2,
                    "turkceSoru": "Biz çay içeriz.",
                    "ingilizceKarsiligi": "We drink tea",
                    "ipucu": "İçmek (drink) kelimesini 'We' ile başlatarak yerleştir.",
                    "zorlukNoktası": "Eylem ('drink') cümlenin ortasında yer almalıdır."
                },
                {
                    "id": 3,
                    "turkceSoru": "Onlar kitap okur.",
                    "ingilizceKarsiligi": "They read books",
                    "ipucu": "Buradaki eylemimiz 'read' (okumak). Kitap derken çoğul yapmalı veya nesne biçiminde eklemelisin.",
                    "zorlukNoktası": "They read books şeklinde nesneyi sona atıyoruz."
                }
            ]
        }

    if any(k in norm for k in ["he / she / it", "she", "he", "it", "o kim", "2. ders"]):
        return {
            "baslik": "'O' Kim? He / She / It Ayrımı",
            "gorselHikaye": "Erkek prens 'He' kılıcını taşır, prenses 'She' asasını sallar, sevimli köpek 'It' ise kuyruğunu sallayarak onları izler. Türkçedeki tek 'O' burada süzgeçten geçer!",
            "teoriAçiklama": "1. İngilizcede erkekler için her zaman 'He' öznesini seçmelisiniz.\n2. Kadınlardan bahsederken 'She' öznesi devreye girer.\n3. Cansız nesneler, hava durumu ve hayvanlar için özel tarafsız 'It' kelimesi kullanılır.",
            "yapiFormulu": "He (Erkek) / She (Kadın) / It (Cansız/Hayvan) + Verb + Object",
            "sorular": [
                {
                    "id": 1,
                    "turkceSoru": "O (erkek) İngilizce konuşur.",
                    "ingilizceKarsiligi": "He speaks English",
                    "ipucu": "Erkek özne için 'He' kullanmalı, geniş zamanda fiile '-s' takısı eklemelisin.",
                    "zorlukNoktası": "Speaks sonundaki '-s' takısını sakın unutma!"
                },
                {
                    "id": 2,
                    "turkceSoru": "O (kadın) kahve sever.",
                    "ingilizceKarsiligi": "She likes coffee",
                    "ipucu": "Kadın özne için 'She' seçmeli, sever (like) eylemine '-s' takısı getirmelisin.",
                    "zorlukNoktası": "She likes coffee dersen tam puan alacaksın."
                },
                {
                    "id": 3,
                    "turkceSoru": "O (kedi/köpek) süt içer.",
                    "ingilizceKarsiligi": "It drinks milk",
                    "ipucu": "Hayvan/nesne öznesi için 'It' kullanmalısın, fiili ('drink') eklemelisin.",
                    "zorlukNoktası": "It drinks milk..."
                }
            ]
        }

    if any(k in norm for k in ["gizli ekler", "am", "is", "are", "3. ders", "to-be"]):
        return {
            "baslik": "Gizli Ekler: Am, Is, Are",
            "gorselHikaye": "Kelimeler birer yapışkan gibidir. 'Am' sadece 'I' ile birleşir, 'Is' tekillere (He/She/It) sığınır, 'Are' ise çoğullar (We/You/They) ile dans eder!",
            "teoriAçiklama": "1. İsim veya durum bildiren, yani hareket/eylem içermeyen cümlelerde am/is/are köprü vazifesi görür.\n2. Türkçe cümledeki son şahıs eki (örneğin öğretmen-İM'deki -im), İngilizcede öznenin yanına gelen yardımcı fiildir.\n3. Eğer cümlede yürümek, sevmek gibi bir hareket varsa am/is/are kullanılmaz.",
            "yapiFormulu": "Subject + [am / is / are] + Noun/Adjective",
            "sorular": [
                {
                    "id": 1,
                    "turkceSoru": "Ben bir öğretmenim.",
                    "ingilizceKarsiligi": "I am a teacher",
                    "ipucu": "'Ben ... im' derken İngilizce 'I am' ile başlar. 'Bir' anlamına gelen 'a' kelimesini ekle.",
                    "zorlukNoktası": "'am' ve 'a' öğelerini bir arada kullanmalısın."
                },
                {
                    "id": 2,
                    "turkceSoru": "Biz mutluyuz.",
                    "ingilizceKarsiligi": "We are happy",
                    "ipucu": "Çoğul özne olduğu için 'We' yanına 'are' getir, mutluyuz (happy) yaz.",
                    "zorlukNoktası": "Herhangi bir fiil (eylem) olmadığı için 'are' kullandık."
                },
                {
                    "id": 3,
                    "turkceSoru": "Sen akıllısın.",
                    "ingilizceKarsiligi": "You are smart",
                    "ipucu": "'You' kelimesinden sonra durum bildiren 'are' getirilmelidir.",
                    "zorlukNoktası": "You are smart."
                }
            ]
        }

    return {
        "baslik": topic or "Akıcı İngilizce SVO Eğitimi",
        "gorselHikaye": "Düşünceleri İngilizceye dökerken bir tren vagonunu andıran Özne-Eylem-Nesne sırasını takip ederiz.",
        "teoriAçiklama": "1. Türkçe mantık fiili sona çekerken İngilizce en başa yaklaştırır.\n2. 'Ben süt içerim' ➔ 'Ben içerim süt' (SVO: I drink milk).\n3. Sıklıkla tekrarlanan cümle kalıplarında eylemin konumuna odaklanın.",
        "yapiFormulu": "Subject (Yapan) + Verb (Eylem) + Object (Etkilenen)",
        "sorular": [
            {
                "id": 1,
                "turkceSoru": "Ben süt içerim.",
                "ingilizceKarsiligi": "I drink milk",
                "ipucu": "Ben (I) - İçerim (drink) - Süt (milk). SVO sırasını koru.",
                "zorlukNoktası": "Fiili sona kaçırmamaya dikkat et."
            },
            {
                "id": 2,
                "turkceSoru": "Biz İngilizce öğreniriz.",
                "ingilizceKarsiligi": "We learn English",
                "ipucu": "Biz (We) - Öğreniriz (learn) - İngilizce (English).",
                "zorlukNoktası": "SVO trenini sırasıyla inşa et."
            },
            {
                "id": 3,
                "turkceSoru": "Sen müzik seversin.",
                "ingilizceKarsiligi": "You like music",
                "ipucu": "Sen (You) - Seversin (like) - Müzik (music).",
                "zorlukNoktası": "Fiili doğrudan sen kelimesinin yanına getir."
            }
        ]
    }

def get_fallback_analysis(expected: str, user: str, turkish_prompt: str) -> dict:
    def normalize(val: str) -> str:
        return re.sub(r"[.,\/#!$%\^&\*;:{}=\-_`~()?]", "", val.lower()).strip()
        
    clean_exp = normalize(expected)
    clean_user = normalize(user)

    if clean_exp == clean_user:
        return {
            "isCorrect": True,
            "skor": 100,
            "analizMesaji": "Tebrikler! Cümleniz tamamen akıcı ve hatasız bir şekilde kuruldu. SVO vagon düzeni harika uyum sağlıyor!",
            "dogruVersiyon": expected,
            "telaffuzDestegi": " ".join([f"[{w}]" for w in expected.split()]),
            "svoIncelemesi": {
                "subject": "Öznemiz mükemmel yerleşimde.",
                "verb": "Eylem olması gerektiği gibi özneyle yapışık.",
                "object": "Nesnemiz de sonda yer alıyor."
            }
        }

    exp_words = clean_exp.split()
    user_words = clean_user.split()
    
    matches = sum(1 for w in user_words if w in exp_words)
    score_pct = int((matches / max(len(exp_words), 1)) * 100)
    is_correct = score_pct >= 80

    msg = "Cümlenizde ufak tefek farklılıklar mevcut. Lütfen S-V-O düzenini ve ekleri kontrol edin."
    if score_pct >= 80:
        msg = "Harika! Ufak tefek yazım veya kural farkları dışında cümleniz tamamen anlaşılır ve kabul edilebilir seviyede."
    elif score_pct < 40:
        msg = "İngilizcedeki SVO kurallarına bağlı kalmaya çalışın. Türkçe cümle yapısı zihninizi karıştırıyor olabilir. Özne yanına hemen eylemi yerleştirin!"

    return {
        "isCorrect": is_correct,
        "skor": min(max(score_pct, 10), 99),
        "analizMesaji": msg,
        "dogruVersiyon": expected,
        "telaffuzDestegi": expected,
        "svoIncelemesi": {
            "subject": "Özne doğru konumlanmış görünüyor.",
            "verb": f"Cümle ortasında '{exp_words[1] if len(exp_words) > 1 else 'fiil'}' eyleminin olup olmadığını kontrol edin.",
            "object": "Nesneyi en sona, tüm yapının bittiği yere yerleştirin."
        }
    }


# ==========================================
# API ENDPOINTS
# ==========================================

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "mode": os.environ.get("FLASK_ENV", "production")
    })

@app.route("/api/explain-grammar", methods=["POST"])
def explain_grammar():
    data = request.json or {}
    concept = data.get("concept")
    
    if not concept:
        return jsonify({"error": "Lütfen incelemek istediğiniz konuyu belirtin."}), 400

    system_instruction = (
        "Sen deneyimli ve cana yakın bir İngilizce öğretmenisin. Öğrencilerin Türk olduğu için, "
        "İngilizce ve Türkçe arasındaki dilbilgisi farklılıklarına (özellikle Türkçe Nesne-Yüklem sırası olan SOV ile "
        "İngilizce SVO Öznesel yapısı) çok iyi hakimsin. "
        "Açıklamalarını DEHB'li bireyleri sıkmayacak, minimalist, kısa, net başlıklar halinde, "
        "gereksiz akademik laf kalabalığından uzak, heyecan verici ve motive edici şekilde Türkçe yap. "
        "Yanıtını mutlaka JSON formatında döndür."
    )
    
    prompt = f'Konu şudur: "{concept}". Bu konuyu Türk öğrenciler için özel bir kontrast (karşılaştırma) kurarak anlat.'

    try:
        response_text = ask_gemini(
            prompt=prompt,
            system_instruction=system_instruction,
            is_json=True,
            response_schema=ExplainGrammarResponse
        )
        if not response_text:
            raise ValueError("Yapay zekadan boş cevap alındı.")
        parsed = json.loads(response_text)
        return jsonify(parsed)
    except Exception as e:
        print("Grammar Explanation AI Error, serving fallback:", e)
        fallback = get_fallback_grammar(concept)
        fallback["isFallback"] = True
        return jsonify(fallback)


@app.route("/api/generate-lesson-content", methods=["POST"])
def generate_lesson_content():
    data = request.json or {}
    level_name = data.get("levelName")
    topic = data.get("topic")

    system_instruction = (
        "Türkler için optimize edilmiş, DEHB dostu, aşırı sadeleştirilmiş bir İngilizce ders müfredat jeneratörüsün. "
        "Seçilen konuyu 0'dan başlayarak öğret. Anlatımı adım adım, görsel canlandırmalar içeren örneklerle yap. "
        "Sonunda da öğrencinin yapabileceği 3 adet interaktif çeviri sorusu ekle. "
        "Lütfen yanıtını tamamen JSON formatında dön."
    )

    prompt = (
        f'Konu: "{topic}" (Seviye: {level_name}). '
        f"Sıfırdan başlayan bir Türk için bu konuyu anlat. Türkçede olmayıp İngilizcede bulunan farklara odaklan "
        f"(örn: Am, Is, Are farkı veya He/She/It ayrımı Türkçede sadece 'O' olduğu için zor gelir)."
    )

    try:
        response_text = ask_gemini(
            prompt=prompt,
            system_instruction=system_instruction,
            is_json=True,
            response_schema=GenerateLessonResponse
        )
        if not response_text:
            raise ValueError("Yapay zekadan boş cevap alındı.")
        parsed = json.loads(response_text)
        return jsonify(parsed)
    except Exception as e:
        print("Lesson Generator AI Error, serving fallback:", e)
        fallback = get_fallback_lesson(topic or "")
        fallback["isFallback"] = True
        return jsonify(fallback)


@app.route("/api/analyze-sentence", methods=["POST"])
def analyze_sentence():
    data = request.json or {}
    expected_sentence = data.get("expectedSentence")
    user_sentence = data.get("userSentence")
    turkish_prompt = data.get("turkishPrompt")

    if not user_sentence:
        return jsonify({"error": "Lütfen bir cevap yazın ya da ses kaydı ile söyleyin."}), 400

    system_instruction = (
        "Sen akıllı bir İngilizce konuşma ve yazma analiz asistanısın. Görevin, öğrencinin Türkçe ifadeyi İngilizceye çevirirken "
        "yazdığı ya da sesle söylediği cümleyi analiz etmek, "
        "varsa dilbilgisi hatalarını, SVO sırasındaki hataları veya telaffuz kaymasından kaynaklı yazım hatalarını bulup sevecen bir dille anında düzeltmektir. "
        "Lütfen Türkçe karakter kullanarak ve DEHB öğrencisini teşvik edecek şekilde kısa ve öz Türkçe geri bildirim yap. "
        "Yanıtını JSON olarak döndür."
    )

    prompt = (
        f'Türkçe İfade: "{turkish_prompt}"\n'
        f'Beklenen Doğru İngilizce: "{expected_sentence}"\n'
        f'Öğrencinin Kurduğu İngilizce Cümle: "{user_sentence}"\n\n'
        f"Bu iki cümleyi karşılaştır. Eğer öğrenci doğru kurduysa harika bir tebrik mesajı ver. "
        f"Hatalıysa, tam hatasını göster. Türkçe öğrenci kafasına uygun bir dilbilgisi düzeltmesi "
        f"(özellikle do/does, he/she/it, am/is/are, fiilin sona atılması veya ek eksiklikleri) yap."
    )

    try:
        response_text = ask_gemini(
            prompt=prompt,
            system_instruction=system_instruction,
            is_json=True,
            response_schema=AnalyzeSentenceResponse
        )
        if not response_text:
            raise ValueError("Geri bildirim analiz edilirken boş yanıt alındı.")
        parsed = json.loads(response_text)
        return jsonify(parsed)
    except Exception as e:
        print("Sentence Analyzer AI Error, serving fallback:", e)
        fallback = get_fallback_analysis(expected_sentence, user_sentence, turkish_prompt)
        fallback["isFallback"] = True
        return jsonify(fallback)


# ==========================================
# STATIC FILE SERVING (PRODUCTION MODE)
# ==========================================

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, "index.html")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3000))
    # Bind to 0.0.0.0:3000 for standard Docker, Google Cloud Run or local environments
    app.run(host="0.0.0.0", port=port, debug=os.environ.get("FLASK_DEBUG", "True") == "True")
