import streamlit as st
import requests
import json
import os

# Page config
st.set_page_config(
    page_title="Gunsun - İngilizce Öğrenme",
    page_icon="🌞",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Sidebar
st.sidebar.title("🌞 Gunsun")
st.sidebar.write("Türk öğrenciler için SVO tabanlı İngilizce öğrenme platformu")

# Get API base URL
API_BASE_URL = os.getenv("APP_URL", "http://localhost:3000")

# Main title
st.title("🌞 Gunsun - İngilizce Öğrenme Platform")
st.subheader("Türkçeden İngilizceye: SVO Yapısını Öğren")

# Tabs
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
                try:
                    response = requests.post(
                        f"{API_BASE_URL}/api/explain-grammar",
                        json={"concept": concept},
                        timeout=10
                    )
                    if response.status_code == 200:
                        data = response.json()
                        
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
                    else:
                        st.error(f"Hata: {response.status_code}")
                except Exception as e:
                    st.error(f"❌ Bağlantı hatası: {str(e)}")
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
                try:
                    response = requests.post(
                        f"{API_BASE_URL}/api/generate-lesson-content",
                        json={"levelName": level, "topic": topic},
                        timeout=10
                    )
                    if response.status_code == 200:
                        data = response.json()
                        
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
                    else:
                        st.error(f"Hata: {response.status_code}")
                except Exception as e:
                    st.error(f"❌ Bağlantı hatası: {str(e)}")
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
                try:
                    response = requests.post(
                        f"{API_BASE_URL}/api/analyze-sentence",
                        json={
                            "expectedSentence": expected_sentence,
                            "userSentence": user_sentence,
                            "turkishPrompt": turkish_prompt
                        },
                        timeout=10
                    )
                    if response.status_code == 200:
                        data = response.json()
                        
                        # Score
                        skor = data.get('skor', 0)
                        if skor == 100:
                            st.success(f"🎉 Tebrikler! Puan: {skor}/100")
                        elif skor >= 80:
                            st.info(f"👍 İyi! Puan: {skor}/100")
                        else:
                            st.warning(f"📝 Devam Et! Puan: {skor}/100")
                        
                        # Mesaj
                        st.write(f"**Geri Bildirim:** {data.get('analizMesaji', '')}")
                        
                        # Doğru Versiyon
                        st.markdown("### ✅ Doğru Versiyon")
                        st.code(data.get('dogruVersiyon', ''))
                        
                        # Telaffuz
                        st.markdown("### 🔊 Telaffuz")
                        st.write(data.get('telaffuzDestegi', ''))
                        
                        # SVO Analizi
                        st.markdown("### 🔍 SVO Analizi")
                        svo = data.get('svoIncelemesi', {})
                        col1, col2, col3 = st.columns(3)
                        with col1:
                            st.write(f"**S (Özne):** {svo.get('subject', '')}")
                        with col2:
                            st.write(f"**V (Fiil):** {svo.get('verb', '')}")
                        with col3:
                            st.write(f"**O (Nesne):** {svo.get('object', '')}")
                    else:
                        st.error(f"Hata: {response.status_code}")
                except Exception as e:
                    st.error(f"❌ Bağlantı hatası: {str(e)}")
        else:
            st.warning("Lütfen tüm alanları doldurun!")

# Footer
st.divider()
st.markdown("""
<div style='text-align: center; color: #888;'>
    <p>🌞 Gunsun - Türk Öğrenciler İçin İngilizce Öğrenme Platformu</p>
    <p>SVO Yapısı ile Akıcı İngilizce Öğren</p>
</div>
""", unsafe_allow_html=True)
