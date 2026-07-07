(function(){
    let translations={
        "en":{
            "splash.pageTitle":"Training Generator — Loading",
            "splash.title":"Training Generator",
            "splash.subtitle":"Converting documents to AI training data using Ollama",
            "splash.loading":"Initializing application...",
            "splash.footer":"Version {{version}} • Loading please wait...",
            "splash.step.initializing":"Initializing application...",
            "splash.step.loadingCore":"Loading core modules...",
            "splash.step.fileParser":"Setting up file parser...",
            "splash.step.connectingOllama":"Connecting to Ollama...",
            "splash.step.preparingUI":"Preparing user interface...",
            "splash.step.almostReady":"Almost ready...",
            "splash.ready":"Ready! Starting application..."
        },
        "zh-Hans":{
            "splash.pageTitle":"训练生成器 — 加载中",
            "splash.title":"训练生成器",
            "splash.subtitle":"使用 Ollama 将文档转换为 AI 训练数据",
            "splash.loading":"正在初始化应用...",
            "splash.footer":"版本 {{version}} • 请稍候，正在加载...",
            "splash.step.initializing":"正在初始化应用...",
            "splash.step.loadingCore":"正在加载核心模块...",
            "splash.step.fileParser":"正在设置文件解析器...",
            "splash.step.connectingOllama":"正在连接 Ollama...",
            "splash.step.preparingUI":"正在准备用户界面...",
            "splash.step.almostReady":"即将完成...",
            "splash.ready":"准备就绪！正在启动应用..."
        },
        "zh-Hant":{
            "splash.pageTitle":"訓練生成器 — 載入中",
            "splash.title":"訓練生成器",
            "splash.subtitle":"使用 Ollama 將文件轉換為 AI 訓練資料",
            "splash.loading":"正在初始化應用程式...",
            "splash.footer":"版本 {{version}} • 請稍候，正在載入...",
            "splash.step.initializing":"正在初始化應用程式...",
            "splash.step.loadingCore":"正在載入核心模組...",
            "splash.step.fileParser":"正在設定文件解析器...",
            "splash.step.connectingOllama":"正在連線 Ollama...",
            "splash.step.preparingUI":"正在準備使用者介面...",
            "splash.step.almostReady":"即將完成...",
            "splash.ready":"準備就緒！正在啟動應用程式..."
        },
        "ja":{
            "splash.pageTitle":"トレーニングジェネレーター — 読み込み中",
            "splash.title":"トレーニングジェネレーター",
            "splash.subtitle":"Ollamaを使用してドキュメントをAIトレーニングデータに変換",
            "splash.loading":"アプリケーションを初期化しています...",
            "splash.footer":"バージョン {{version}} • 読み込み中ですお待ちください...",
            "splash.step.initializing":"アプリケーションを初期化しています...",
            "splash.step.loadingCore":"コアモジュールを読み込んでいます...",
            "splash.step.fileParser":"ファイル解析器を設定しています...",
            "splash.step.connectingOllama":"Ollamaに接続しています...",
            "splash.step.preparingUI":"ユーザーインターフェースを準備しています...",
            "splash.step.almostReady":"もう少しで完了です...",
            "splash.ready":"準備完了！アプリケーションを起動しています..."
        },
        "ko":{
            "splash.pageTitle":"트레이닝 생성기 — 로딩 중",
            "splash.title":"트레이닝 생성기",
            "splash.subtitle":"Ollama를 사용하여 문서를 AI 훈련 데이터로 변환",
            "splash.loading":"애플리케이션을 초기화하는 중...",
            "splash.footer":"버전 {{version}} • 로딩 중입니다 잠시만 기다려 주세요...",
            "splash.step.initializing":"애플리케이션을 초기화하는 중...",
            "splash.step.loadingCore":"핵심 모듈을 로드하는 중...",
            "splash.step.fileParser":"파일 파서를 설정하는 중...",
            "splash.step.connectingOllama":"Ollama에 연결하는 중...",
            "splash.step.preparingUI":"사용자 인터페이스를 준비하는 중...",
            "splash.step.almostReady":"거의 준비되었습니다...",
            "splash.ready":"준비 완료! 애플리케이션을 시작하는 중..."
        },
        "es":{
            "splash.pageTitle":"Generador de Entrenamiento — Cargando",
            "splash.title":"Generador de Entrenamiento",
            "splash.subtitle":"Convertir documentos en datos de entrenamiento de IA usando Ollama",
            "splash.loading":"Inicializando aplicación...",
            "splash.footer":"Versión {{version}} • Cargando, por favor espere...",
            "splash.step.initializing":"Inicializando aplicación...",
            "splash.step.loadingCore":"Cargando módulos principales...",
            "splash.step.fileParser":"Configurando el analizador de archivos...",
            "splash.step.connectingOllama":"Conectando a Ollama...",
            "splash.step.preparingUI":"Preparando la interfaz de usuario...",
            "splash.step.almostReady":"Casi listo...",
            "splash.ready":"¡Listo! Iniciando aplicación..."
        },
        "fr":{
            "splash.pageTitle":"Générateur d'Entraînement — Chargement",
            "splash.title":"Générateur d'Entraînement",
            "splash.subtitle":"Convertir des documents en données d'entraînement IA avec Ollama",
            "splash.loading":"Initialisation de l'application...",
            "splash.footer":"Version {{version}} • Chargement en cours, veuillez patienter...",
            "splash.step.initializing":"Initialisation de l'application...",
            "splash.step.loadingCore":"Chargement des modules principaux...",
            "splash.step.fileParser":"Configuration de l'analyseur de fichiers...",
            "splash.step.connectingOllama":"Connexion à Ollama...",
            "splash.step.preparingUI":"Préparation de l'interface utilisateur...",
            "splash.step.almostReady":"Presque prêt...",
            "splash.ready":"Prêt ! Démarrage de l'application..."
        },
        "de":{
            "splash.pageTitle":"Trainingsgenerator — Wird geladen",
            "splash.title":"Trainingsgenerator",
            "splash.subtitle":"Dokumente mit Ollama in KI-Trainingsdaten umwandeln",
            "splash.loading":"Anwendung wird initialisiert...",
            "splash.footer":"Version {{version}} • Wird geladen, bitte warten...",
            "splash.step.initializing":"Anwendung wird initialisiert...",
            "splash.step.loadingCore":"Kernmodule werden geladen...",
            "splash.step.fileParser":"Dateiparser wird eingerichtet...",
            "splash.step.connectingOllama":"Verbindung mit Ollama wird hergestellt...",
            "splash.step.preparingUI":"Benutzeroberfläche wird vorbereitet...",
            "splash.step.almostReady":"Fast fertig...",
            "splash.ready":"Bereit! Anwendung wird gestartet..."
        }
    }
    function detectLocale(){
        let lang=typeof navigator!=="undefined"?navigator.language||"en":"en"
        let map={"zh-CN":"zh-Hans","zh-SG":"zh-Hans","zh-TW":"zh-Hant","zh-HK":"zh-Hant","zh-MO":"zh-Hant"}
        if(map[lang])return map[lang]
        let base=lang.split("-")[0]
        let supported=["en","zh-Hans","zh-Hant","es","fr","de","ja","ko"]
        if(supported.includes(base))return base
        try{
            let stored=localStorage.getItem("train-generator-ui-lang")
            if(stored&&translations[stored])return stored
        }
        catch{}
        return "en"
    }
    let currentLang=detectLocale()
    function t(key,params){
        let value=translations[currentLang]?.[key]??translations["en"]?.[key]??key
        if(params){
            value=value.replace(/\{\{(\w+)\}\}/g,function(_,name){return params[name]??""})
        }
        return value
    }
    function setElementText(el,text){
        if(el instanceof HTMLTitleElement){
            el.textContent=text
            return
        }
        for(let node of Array.from(el.childNodes)){
            if(node.nodeType===Node.TEXT_NODE&&node.textContent&&node.textContent.trim().length>0){
                node.textContent=text
                return
            }
        }
        if(el.childNodes.length===0){
            el.textContent=text
        }
    }
    function applyLanguage(){
        document.documentElement.lang=currentLang
        document.querySelectorAll("[data-i18n]").forEach(el=>{
            let key=el.getAttribute("data-i18n")
            if(!key)return
            let params={}
            if(el.hasAttribute("data-i18n-version")){
                let versionText=el.querySelector("#version-text")
                if(versionText){
                    params.version=versionText.textContent||"1.0.0"
                }
            }
            setElementText(el,t(key,params))
        })
    }
    function getPlatform(){
        let ua=navigator.userAgentData
        if(ua&&ua.platform){
            let p=ua.platform.toLowerCase()
            if(p.includes("win"))return "windows"
            if(p.includes("mac"))return "macos"
            return "linux"
        }
        let legacy=(navigator.platform||"").toLowerCase()
        if(legacy.includes("win"))return "windows"
        if(legacy.includes("mac"))return "macos"
        return "linux"
    }
    document.documentElement.setAttribute("data-platform", getPlatform())
    let prefersDark=window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.add(prefersDark ? "theme-dark" : "theme-light");
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e)=>{
        document.documentElement.classList.remove("theme-light", "theme-dark");
        document.documentElement.classList.add(e.matches ? "theme-dark" : "theme-light");
    });
    try{
        let fontUrl=new URL("../assets/NotoSans-VariableFont_wdth_wght.ttf", window.location.href).href
        let style=document.createElement("style")
        style.textContent=`@font-face{font-family:"Noto Sans";src:url("${fontUrl}") format("truetype");font-display:swap;font-weight:1 1000}`
        document.head.appendChild(style)
    }
    catch{}
    let progressBar=document.getElementById("progress-bar")
    let loadingText=document.getElementById("loading-text")
    let versionText=document.getElementById("version-text")
    if(versionText&&window.__appVersion){
        versionText.textContent=window.__appVersion
    }
    applyLanguage()
    let steps=[
        t("splash.step.initializing"),
        t("splash.step.loadingCore"),
        t("splash.step.fileParser"),
        t("splash.step.connectingOllama"),
        t("splash.step.preparingUI"),
        t("splash.step.almostReady")
    ]
    let currentStep=0
    let timers=[]
    function schedule(fn,delay){
        let id=setTimeout(fn,delay)
        timers.push(id)
        return id
    }
    function clearAllTimers(){
        timers.forEach(id=>clearTimeout(id))
        timers=[]
    }
    function updateProgress(){
        if(!progressBar||!loadingText)return
        if(currentStep<steps.length){
            let progress=(currentStep/steps.length)*100
            progressBar.style.width=`${progress}%`
            loadingText.textContent=steps[currentStep]
            currentStep++
            let nextDelay=300+Math.random()*700
            schedule(updateProgress,nextDelay)
        }
        else{
            progressBar.style.width="100%"
            loadingText.textContent=t("splash.ready")
        }
    }
    if(progressBar&&loadingText){
        schedule(updateProgress,500)
    }
    window.addEventListener("pagehide",clearAllTimers)
})()
