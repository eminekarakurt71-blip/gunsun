import streamlit as st
import json
import re
import os
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from typing import List
from dotenv import load_dotenv

load_dotenv()

# ==========================================
# PAGE CONFIG
# ==========================================
st.set_page_config(
    page_title="🌞 Gunsun - İngilizce Öğrenme",
    page_icon="🌞",
    layout="wide",
    initial_sidebar_state="expanded"
)

# ==========================================
# SIDEBAR
# ==========================================
st.sidebar.title("🌞 Gunsun")
st.sidebar.write("Türk öğrenciler için SVO tabanlı İngilizce öğrenme platformu")
st.sidebar.divider()
st.sidebar.markdown("### 📚 Hakkında")
st.sidebar.write("""
Bu platform Türk öğrencilerin İngilizce öğrenmesini kolaylaştırmak için yapılmıştır.
SVO (Özne-Fiil-Nesne) yapısına odaklanarak Türkçe ile İngilizce arasındaki farkları öğretiyor.
""")

# ==========================================
# PYDANTIC SCHEMAS
# ==========================================
class ComparisonItem(BaseModel):
    turkceYapi: str = Field(description="Turkce cümle yapisi")
    ingilizceYapi: str = Field(description="SVO renkli sablonu")
    farkAciklamasi: str = Field(description="Neden böyle kuruldugu aciklamasi")

class ExampleSentence(BaseModel):
    turkce: str = Field(description="Turkce anlami")
    ingilizce: str = Field(description="Ingilizce asli")
    telaffuz: str = Field(description="Turkce harfleriyle telaffuz okunusu")
    svoAnalizi: str = Field(description="SVO etiketli hali")

class ExplainGrammarResponse(BaseModel):
    konuAdi: str = Field(description="Konunun kisa ve net adi")
    ozet: str = Field(description="Konunun 2 cümlelik özeti")
    turkceZorlugu: str = Field(description="Türklerin bu konuda yaptıgı hata")
    karsilastirma: List[ComparisonItem] = Field(description="Karşılaştırma")
    pratikIpuclari: List[str] = Field(description="1-2 kısayol ipucu")
    ornekCumleler: List[ExampleSentence] = Field(description="Örnek cümleler")

class LessonQuestion(BaseModel):
    id: int = Field(description="Sorunun sirasi")
    turkceSoru: str = Field(description="Turkce cümle")
    ingilizceKarsiligi: str = Field(description="Dogru Ingilizce ceviri")
    ipucu: str = Field(description="Turkce kelimelerin sirasi ipucu")
    zorlukNoktası: str = Field(description="Kacirabilecegi detay")

class GenerateLessonResponse(BaseModel):
    baslik: str = Field(description="Dersin adi")
    gorselHikaye: str = Field(description="DEHB uyumlu mini hikaye")
    teoriAciklama: str = Field(description="3 kisa madde halinde anlatim")
    yapiFormulu: str = Field(description="Cümle kurulum formülü")
    sorular: List[LessonQuestion] = Field(description="3 adet interaktif soru")

class SvoAnalysis(BaseModel):
    subject: str = Field(description="Özne hangisi ve nerede durmali")
    verb: str = Field(description="Eylem hangisi ve nerede durmali")
    object: str = Field(description="Nesne tahlili")

class AnalyzeSentenceResponse(BaseModel):
    isCorrect: bool = Field(description="Cümle doğru mu")
    skor: int = Field(description="0-100 basari puani")
    analizMesaji: str = Field(description="Kisa aciklama mesaji")
    dogruVersiyon: str = Field(description="Tam dogru yazilisi")
    telaffuzDestegi: str = Field(description="Okunus rehberi")
    svoIncelemesi: SvoAnalysis = Field(description="SVO analizi")

# ==========================================
# GEMINI HELPER
# ==========================================
def get_genai_client():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        st.error("❌ GEMINI_API_KEY not set in Secrets!")
        st.stop()
    return genai.Client(api_key=api_key)

def ask_gemini(prompt: str, system_instruction: str = None, response_schema = None) -> str:
    try:
        client = get_genai_client()
        
        config = types.GenerateContentConfig()
        if system_instruction:
            config.system_instruction = system_instruction
        config.response_mime_type = "application/json"
        if response_schema:
            config.response_schema = response_schema

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=config,
        )
        return response.text or ""
    except Exception as e:
        st.warning(f"⚠️ Gemini API Hatası: {str(e)}")
        return ""

# ==========================================
# FALLBACK DATA
# ==========================================
def get_fallback_grammar(concept: str) -> dict:
    return {
        "konuAdi": "İngilizce Temel Cümle Yapısı (SVO)",
        "ozet": "İngilizcede cümleler daima Özne (S) + Fiil (V) + Nesne (O) formülüyle kurulur.",
        "turkceZorlugu": "Türkçe düşünerek fiili sona atmak veya özne ile nesne arasına koymamak.",
        "karsilastirma": [
            {
                "turkceYapi": "Ben bir kedi görüyorum.",
                "ingilizceYapi": "I see a cat.",
                "farkAciklamasi": "İngilizce SVO tren sırasını hiç bozmaz."
            }
        ],
        "pratikIpuclari": [
            "Daima önce kimin yaptığını söyle, ardından yapılan eylemi hemen yapıştır!",
            "Nesneleri cümlenin sonuna sakla."
        ],
        "ornekCumleler": [
            {
                "turkce": "Ben çay severim.",
                "ingilizce": "I like tea",
                "telaffuz": "Ay layk tiy",
                "svoAnalizi": "I (S) - like (V) - tea (O)"
            }
        ]
    }

def get_fallback_lesson(topic: str) -> dict:
    return {
        "baslik": "Cümle Kurma Formülü (SVO)",
        "gorselHikaye": "Seyis atına biner ve samanlığa koşturur. İngilizcede fiil asla geride kalmaz!",
        "teoriAciklama": "1. Türkçe cümlenin sonundaki fiili alıp İngilizcede hemen Öznenin sağ yanına ekliyoruz.\n2. Formülümüz SVO: Subject (Özne) + Verb (Eylem) + Object (Nesne)\n3. Sıklıkla tekrarlayarak bu sırayı alışkanlık haline getirin.",
        "yapiFormulu": "Subject (Özne) + Verb (Fiil) + Object (Nesne)",
        "sorular": [
            {
                "id": 1,
                "turkceSoru": "Ben elma severim.",
                "ingilizceKarsiligi": "I like apples",
                "ipucu": "Severim (like) kelimesini 'I'dan hemen sonra getirmelisin.",
                "zorlukNoktası": "Türkçe düşünme, fiili sona atma!"
            }
        ]
    }

def get_fallback_analysis(expected: str, user: str) -> dict:
    def normalize(val: str) -> str:
        return re.sub(r"[.,\/#!$%\^&\*;:{}=\-_`~()?]", "", val.lower()).strip()
    
    clean_exp = normalize(expected)
    clean_user = normalize(user)
    
    if clean_exp == clean_user:
        return {
            "isCorrect": True,
            "skor": 100,
            "analizMesaji": "Tebrikler! Cümleniz tamamen akıcı ve hatasız bir şekilde kuruldu.",
            "dogruVersiyon": expected,
            "telaffuzDestegi": " ".join([f"[{w}]" for w in expected.split()]),
            "svoIncelemesi": {
                "subject": "Öznemiz mükemmel yerleşimde.",
                "verb": "Eylem olması gerektiği gibi özneyle yapışık.",
                "object": "Nesnemiz de sonda yer alıyor."
            }
        }
    
    matches = sum(1 for w in clean_user.split() if w in clean_exp.split())
    score = int((matches / max(len(clean_exp.split()), 1)) * 100)
    
    return {
        "isCorrect": score >= 80,
        "skor": min(max(score, 10), 99),
        "analizMesaji": "SVO düzenini ve ekleri kontrol edin.",
        "dogruVersiyon": expected,
        "telaffuzDestegi": expected,
        "svoIncelemesi": {
            "subject": "Özne doğru konumlanmış görünüyor.",
            "verb": "Cümle ortasında eylem olmalı.",
            "object": "Nesneyi en sona yerleştirin."
        }
    }

# ==========================================
# MAIN CONTENT
# ==========================================
st.title("🌞 Gunsun - İngilizce Öğrenme Platform")
st.subheader("Türkçeden İngilizceye: SVO Yapısını Öğren")

tab1, tab2, tab3 = st.tabs(["📚 Dilbilgisi", "🎓 Dersler", "✍️ Cümle Analizi"])

# ==========================================
# TAB 1: DILBILGISI
# ==========================================
with tab1:
    st.header("📚 Dilbilgisi Konularını Öğren")
    
    concept = st.text_input(
        "İncelemek istediğiniz dilbilgisi konusunu yazın:",
        placeholder="Örn: SVO, am/is/are, He/She/It"
    )
    
    if st.button("🔍 Açıkla", key="grammar_btn", use_container_width=True):
        if concept:
            with st.spinner("Açıklama hazırlanıyor..."):
                system_instruction = (
                    "Sen deneyimli bir İngilizce öğretmenisin. Türk öğrenciler için "
                    "İngilizce ve Türkçe arasındaki farkları açıkla. DEHB-dostu, kısa, net başlıklar yap. "
                    "JSON formatında yanıt ver."
                )
                prompt = f'Konu: "{concept}". Bu konuyu Türk öğrenciler için özel olarak açıkla.'
                
                response_text = ask_gemini(prompt, system_instruction, ExplainGrammarResponse)
                
                if response_text:
                    try:
                        data = json.loads(response_text)
                        st.success("✅ Açıklama hazır!")
                        
                        st.markdown(f"### {data.get('konuAdi', 'Konu')}")
                        st.info(data.get('ozet', ''))
                        
                        st.markdown("#### ⚠️ Türklerin Sık Yaptığı Hata")
                        st.warning(data.get('turkceZorlugu', ''))
                        
                        st.markdown("#### 🔄 Türkçe vs İngilizce Karşılaştırması")
                        for item in data.get('karsilastirma', []):
                            col1, col2 = st.columns(2)
                            with col1:
                                st.write(f"**Türkçe:** {item.get('turkceYapi', '')}")
                            with col2:
                                st.write(f"**İngilizce:** {item.get('ingilizceYapi', '')}")
                            st.write(f"*{item.get('farkAciklamasi', '')}*")
                            st.divider()
                        
                        st.markdown("#### 💡 Pratik İpuçları")
                        for i, tip in enumerate(data.get('pratikIpuclari', []), 1):
                            st.write(f"{i}. {tip}")
                        
                        st.markdown("#### 📝 Örnek Cümleler")
                        for example in data.get('ornekCumleler', []):
                            with st.expander(f"{example.get('turkce', '')}"):
                                st.write(f"**Türkçe:** {example.get('turkce', '')}")
                                st.write(f"**İngilizce:** {example.get('ingilizce', '')}")
                                st.write(f"**Telaffuz:** {example.get('telaffuz', '')}")
                                st.write(f"**SVO Analizi:** {example.get('svoAnalizi', '')}")
                    except:
                        fallback = get_fallback_grammar(concept)
                        fallback["isFallback"] = True
                        st.markdown(f"### {fallback.get('konuAdi', 'Konu')}")
                        st.info(fallback.get('ozet', ''))
                else:
                    fallback = get_fallback_grammar(concept)
                    st.markdown(f"### {fallback.get('konuAdi', 'Konu')}")
                    st.info(fallback.get('ozet', ''))
        else:
            st.warning("Lütfen bir konu yazın!")

# ==========================================
# TAB 2: DERSLER
# ==========================================
with tab2:
    st.header("🎓 İnteraktif Dersler")
    
    col1, col2 = st.columns(2)
    with col1:
        level = st.selectbox(
            "Seviye Seçin:",
            ["Başlangıç", "Orta", "İleri"]
        )
    
    with col2:
        topic = st.text_input(
            "Ders Konusu:",
            placeholder="Örn: SVO, He/She/It, Am/Is/Are"
        )
    
    if st.button("📖 Dersi Başlat", key="lesson_btn", use_container_width=True):
        if topic:
            with st.spinner("Ders hazırlanıyor..."):
                system_instruction = (
                    "Türler için optimize edilmiş, DEHB dostu bir İngilizce ders jeneratörüsün. "
                    "Seçilen konuyu 0'dan başlayarak öğret. JSON formatında yanıt ver."
                )
                prompt = f'Konu: "{topic}" (Seviye: {level}). Sıfırdan başlayan bir Türk için bu konuyu anlat.'
                
                response_text = ask_gemini(prompt, system_instruction, GenerateLessonResponse)
                
                if response_text:
                    try:
                        data = json.loads(response_text)
                        st.success("✅ Ders hazır!")
                        st.markdown(f"## {data.get('baslik', 'Ders')}")
                        
                        st.markdown("### 🎬 Görsel Hikaye")
                        st.info(data.get('gorselHikaye', ''))
                        
                        st.markdown("### 📚 Teori Açıklaması")
                        st.write(data.get('teoriAciklama', ''))
                        
                        st.markdown("### 🔧 Yapı Formülü")
                        st.code(data.get('yapiFormulu', ''))
                        
                        st.markdown("### ❓ Pratik Sorular")
                        for question in data.get('sorular', []):
                            with st.expander(f"Soru {question.get('id', '')}: {question.get('turkceSoru', '')}"):
                                st.write(f"**Türkçe:** {question.get('turkceSoru', '')}")
                                st.write(f"**Doğru Cevap:** {question.get('ingilizceKarsiligi', '')}")
                                st.write(f"**İpucu:** {question.get('ipucu', '')}")
                                st.write(f"**Zorluk Noktası:** {question.get('zorlukNoktası', '')}")
                    except:
                        fallback = get_fallback_lesson(topic)
                        st.markdown(f"## {fallback.get('baslik', 'Ders')}")
                        st.info(fallback.get('gorselHikaye', ''))
                else:
                    fallback = get_fallback_lesson(topic)
                    st.markdown(f"## {fallback.get('baslik', 'Ders')}")
                    st.info(fallback.get('gorselHikaye', ''))
        else:
            st.warning("Lütfen bir konu yazın!")

# ==========================================
# TAB 3: CÜMLE ANALİZİ
# ==========================================
with tab3:
    st.header("✍️ Cümle Analizi ve Geri Bildirim")
    
    st.write("Türkçe bir cümle yazın, İngilizceye çevirmeyi deneyin ve yapay zeka geri bildirim versin!")
    
    col1, col2 = st.columns(2)
    with col1:
        turkish_prompt = st.text_input(
            "Türkçe Cümle:",
            placeholder="Örn: Ben elma severim."
        )
    
    with col2:
        expected_sentence = st.text_input(
            "Beklenen İngilizce:",
            placeholder="Örn: I like apples"
        )
    
    user_sentence = st.text_area(
        "Sizin İngilizce Cümleniz:",
        placeholder="Yazdığınız veya söylediğiniz cümleyi yazın..."
    )
    
    if st.button("🔍 Cümleyi Analiz Et", key="analyze_btn", use_container_width=True):
        if user_sentence and expected_sentence:
            with st.spinner("Analiz ediliyor..."):
                system_instruction = (
                    "Sen akıllı bir İngilizce konuşma analiz asistanısın. Türkçe öğrencinin cümlesini analiz et. "
                    "JSON formatında yanıt ver."
                )
                prompt = (
                    f'Türkçe: "{turkish_prompt}"\n'
                    f'Beklenen: "{expected_sentence}"\n'
                    f'Öğrencinin: "{user_sentence}"\n\n'
                    f"Karşılaştır ve geri bildirim ver."
                )
                
                response_text = ask_gemini(prompt, system_instruction, AnalyzeSentenceResponse)
                
                if response_text:
                    try:
                        data = json.loads(response_text)
                        
                        skor = data.get('skor', 0)
                        if skor == 100:
                            st.success(f"🎉 Tebrikler! Puan: {skor}/100")
                        elif skor >= 80:
                            st.info(f"👍 İyi! Puan: {skor}/100")
                        else:
                            st.warning(f"📝 Devam Et! Puan: {skor}/100")
                        
                        st.write(f"**Geri Bildirim:** {data.get('analizMesaji', '')}")
                        
                        st.markdown("### ✅ Doğru Versiyon")
                        st.code(data.get('dogruVersiyon', ''))
                        
                        st.markdown("### 🔊 Telaffuz")
                        st.write(data.get('telaffuzDestegi', ''))
                        
                        st.markdown("### 🔍 SVO Analizi")
                        svo = data.get('svoIncelemesi', {})
                        col1, col2, col3 = st.columns(3)
                        with col1:
                            st.write(f"**S (Özne):** {svo.get('subject', '')}")
                        with col2:
                            st.write(f"**V (Fiil):** {svo.get('verb', '')}")
                        with col3:
                            st.write(f"**O (Nesne):** {svo.get('object', '')}")
                    except:
                        fallback = get_fallback_analysis(expected_sentence, user_sentence)
                        skor = fallback.get('skor', 0)
                        if skor >= 80:
                            st.info(f"👍 İyi! Puan: {skor}/100")
                        else:
                            st.warning(f"📝 Devam Et! Puan: {skor}/100")
                else:
                    fallback = get_fallback_analysis(expected_sentence, user_sentence)
                    st.warning(f"📝 Devam Et! Puan: {fallback.get('skor', 0)}/100")
        else:
            st.warning("Lütfen tüm alanları doldurun!")

# ==========================================
# FOOTER
# ==========================================
st.divider()
st.markdown("""
<div style='text-align: center; color: #888;'>
    <p>🌞 Gunsun - Türk Öğrenciler İçin İngilizce Öğrenme Platformu</p>
    <p>SVO Yapısı ile Akıcı İngilizce Öğren</p>
    <p style='font-size: 0.8em;'>Powered by Google Gemini AI</p>
</div>
""", unsafe_allow_html=True)
