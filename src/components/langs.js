const langMap = {
    'ar': 'arb',
    'cy': 'cym',
    'de': 'deu',
    'el': 'ell',
    'en': 'eng',
    'eo': 'epo',
    'es': 'spa',
    'fr': 'fra',
    'id': 'ind',
    'ja': 'jpn',
    'ko': 'kor',
    'ru': 'rus',
    'sv': 'swe',
    'tr': 'tur',
    'zh': 'zho',
};

function langTo3cc(lang) {
    if (langMap[lang]) {
        return langMap[lang];
    }
    return lang;
}

function langTo2cc(lang) {
    const entries = Object.entries(langMap);
    for (let i = 0; i < entries.length; ++i) {
        if (entries[i][1] === lang) {
            return entries[i][0];
        }
    }
    return lang;
}
