// Whether lookups are enabled
let enabled = false;
let lookupLangs = {};

browser.runtime.onMessage.addListener((request) => {
    if (Object.hasOwn(request, 'enableTab')) {
        setEnabled(request.enableTab)
    }
    if (Object.hasOwn(request, 'languages') && Object.keys(request.languages).length > 0) {
        lookupLangs = request.languages;
    }
});

function setEnabled(toEnable) {
    enabled = !!toEnable;
    if (!enabled) {
        hideDefinition();
    }
}

function logMessage(msg) {
    console.log(msg);
}

// Delay (in ms) between mouse movement ending and showing word definition
const showDelay = 0;
// Actually look up the words; false for testing just extracting words
const doLookups = true;
const body = document.getElementsByTagName('body').item(0);
const wordLookupUrl = urlBase + '/api/word/fetch';
const wordReportUrl = urlBase + '/api/word/report';
const cardAddUrl = urlBase + '/api/card/add';

let definitionDiv = null;
let loadingP = null;

const showCloseButton = function() {
    if (definitionDiv.getElementsByClassName('popover-close').length > 0) {
        return;
    }
    const closeDiv = document.createElement('div');
    closeDiv.setAttribute('class', 'popover-close');
    closeDiv.appendChild(document.createTextNode('X'));
    closeDiv.addEventListener('mouseup', hideDefinition);
    definitionDiv.appendChild(closeDiv);
}

const jsonFetch = function(url, handlerFunc, ...additionalArgs) {
    fetch(url).then(function(response) {
        if (!response.ok || response.status != 200) {
            try {
                return response.json();
            } catch (err) {
            }
            return {error: "Unknown error"};
        }
        return response.json();
    }).then(function (json) {
        handlerFunc(json, ...additionalArgs);
    }).catch((err) => {
        if (definitionDiv) {
            showCloseButton();

            // TODO: translate
            const errorEls = document.getElementsByClassName('vortmaro-reader-error');
            console.log(errorEls);
            if (errorEls.length > 0) {
                errorEls.item(0).innerText = 'Server error';
            } else {
                const errorP = document.createElement('p');
                errorP.classList.add('vortmaro-reader-error');
                errorP.innerText = 'Server error';
                definitionDiv.appendChild(errorP);
            }
            const loading = document.getElementById('vortmaro-reader-loading');
            if (loading) {
                loading.style.display = 'none';
            }
        }
    });
};

const getCurrentUrl = function() {
    const l = window.location;
    return l.protocol + '//' + l.host + l.pathname + l.search;
}

const fetchDefinition = function(result, displayFunc) {
    const source = getCurrentUrl();
    let word = result.word;
    let url = wordLookupUrl + '?word=' + encodeURIComponent(word)
        + '&source=' + encodeURIComponent(source)
        + '&lang=' + encodeURIComponent(result.lang.toLowerCase())
        // TODO: support multiple defn langs
        + '&defn=eng';
    if (result.followWord) {
        url += '&follow=' + encodeURIComponent(result.followWord);
    }
    if (result.asPartOf) {
        url += '&asPartOf=' + encodeURIComponent(result.asPartOf);
    }
    fetchResult = jsonFetch(url, displayFunc, result);
    return fetchResult;
};

const isWordChar = function(char) {
    // TODO: check is Unicode letter? This list is getting ridiculous
    if (char == ' ' || char == '.' || char == ',' || char == '?'
        || char == '' || char == '"' || char == '“' || char == '”'
        || char == ':' || char == ';' || char == '«' || char == '»'
        || char == '「' || char == '」' || char == '、' || char == '。'
        || char == '…' || char == '(' || char == ')' || char == '['
        || char == ']' || char == '{' || char == '}' || char == '!'
        || char == '\n' || char == '\r' || char == '\t'
        || char == '/' || char == '|' || char == '\\'
        || char == '„' || char == '“' || char == '¿' || char == '¡'
        || char == '\xa0'
        || typeof char === 'undefined'
    ) {
        return false;
    }
    return true;
};

/**
 * @return string
 */
const getPrecedingText = function(node) {
    let result = '';
    while (node.previousSibling) {
        node = node.previousSibling;
        let text = node.innerText;
        if (text === undefined) {
            text = node.data;
        }
        if (text === undefined) {
            continue;
        }
        result = text + result;
        if (text.indexOf('.') != -1 || text.indexOf('。') != -1) {
            break;
        }
    }

    return result;
}

/**
 * @return string
 */
const getFollowingText = function(node) {
    let result = '';
    while (node.nextSibling) {
        node = node.nextSibling;
        let text = node.innerText;
        if (text === undefined) {
            text = node.data;
        }
        if (text === undefined) {
            continue;
        }
        result += text;
        if (text.indexOf('.') != -1 || text.indexOf('。') != -1) {
            break;
        }
    }

    return result;
}

const getNodeWordAtOffset = function(node, offset, isFinal) {
    let elementText = node.innerText || node.data || (typeof node === 'string' ? node : '');
    if (elementText.length == 0 || !isWordChar(elementText[offset])) {
        return;
    }

    const precedingText = getPrecedingText(node);
    const followingText = getFollowingText(node);
    elementText = precedingText + elementText + followingText;
    offset += precedingText.length;

    let prevSpace = -1;
    let nextSpace = elementText.length;
    for (let i = offset - 1; i >= 0; --i) {
        let char = elementText[i];

        if (!isWordChar(char)) {
            prevSpace = i;
            break;
        }
    }
    for (let i = offset; i < elementText.length; ++i) {
        let char = elementText[i];
        if (!isWordChar(char)) {
            nextSpace = i;
            break;
        }
    }

    let start = prevSpace + 1;
    let word = elementText.substring(start, nextSpace);
    word = word.replace('‘', "'");
    word = word.replace("’", "'");
    word = word.replace("·", "");
    if (word[0] == "'") {
        word = word.substring(1);
        start += 1;
    }
    if (word[word.length - 1] == "'") {
        word = word.substring(0, word.length - 1);
    }

    let offsetFromStart = offset - start;
    let {startInSentence, sentence} = extractSentence(elementText, start)
    let result = {
        sentence: sentence,
        start: startInSentence,
        offset: offsetFromStart,
        word: word,
        lang: determineLanguage(node)
    };

    if (isFinal) {
        return result;
    }
    if (!result.lang || !result.lang.match(/^deu?($|[_-])/)) {
        return result;
    }

    // Provide the last word of the sentence or phrase for the server to identify German separable verbs
    let endPhraseChars = ['.', ',', ';', '!', '?'];
    let endPhrasePos = elementText.length -1;
    let i = nextSpace;
    while (i < elementText.length) {
        ++i;
        if (endPhraseChars.includes(elementText[i])) {
            endPhrasePos = i;
            break;
        }
    }
    if (endPhrasePos == -1) {
        return result;
    }
    let followWord = getNodeWordAtOffset(elementText, endPhrasePos - 1, true);
    if (followWord && followWord.word != result.word) {
        result.followWord = followWord.word;
    }

    return result;
};

const sendReport = function() {
    const form = document.forms['vortmaro-word-error-report'];

    const data = new FormData();
    data.append('lang', form.elements.lang.value);
    data.append('word', form.elements.word.value);
    data.append('problem', form.elements.problem.value);

    fetch(wordReportUrl, {
        method: 'POST',
        body: data,
    });
    form.parentNode.removeChild(form);
};

const addErrorReportBox = function(wrapperNode, wordDetails) {
    const form = document.createElement('form');
    form.setAttribute('id', 'vortmaro-word-error-report');

    const langInput = document.createElement('input');
    langInput.setAttribute('type', 'hidden');
    langInput.setAttribute('name', 'lang');
    langInput.setAttribute('value', wordDetails.lang);
    form.appendChild(langInput);

    const wordInput = document.createElement('input');
    wordInput.setAttribute('type', 'hidden');
    wordInput.setAttribute('name', 'word');
    wordInput.setAttribute('value', wordDetails.word);
    form.appendChild(wordInput);

    const problemP = document.createElement('p');
    const problemInput = document.createElement('textarea');
    problemInput.setAttribute('name', 'problem');
    problemP.appendChild(problemInput);
    form.appendChild(problemP);

    const submitP = document.createElement('p');
    const submitButton = document.createElement('button');
    submitButton.setAttribute('type', 'button');
    const submitText = document.createTextNode('Report problem with this word');
    submitButton.appendChild(submitText);
    submitButton.onclick = sendReport;
    form.appendChild(submitButton);

    wrapperNode.appendChild(form);
};

const getAuthToken = function() {
    return browser.storage.local.get('authToken').then((result) => {
        return result.authToken;
    }, (failure) => {
        console.log("Failure getting token: ", failure);
        return null;
    });
}

const sendFlashcardRequest = function(form, authToken) {
    const data = JSON.stringify({
        wordId: Number(form.elements['wordId'].value),
        ancestorIds: form.elements['ancestorIds'].value,
        cardTypes: ["from", "to", "sentence"],
        definitionId: Number(form.elements['definitionId'].value),
        url: getCurrentUrl(),
        sentence: form.elements['sentence'].value,
        start: form.elements['start'].value,
        xpath: ""
    });
    const wrapperNode = form.parentNode;

    const headers = new Headers();
    headers.append(
        'Authorization',
        'Bearer ' + authToken
    );
    headers.append(
        'Content-Type',
        'application/json'
    );

    fetch(cardAddUrl, {
        method: 'POST',
        headers: headers,
        body: data,
    })
    .then((response) => {
        return response.json();
    })
    .then((data) => {
        console.log(data);
        if (data.error) {
            window.alert("Failed to add flashcard");
        } else if (data.AddedToday) {
            let numWords = data.AddedToday;
            let msg = numWords + ' word' + (numWords == 1 ? '' : 's') + ' added today';
            let p = document.createElement('p');
            p.setAttribute('class', 'flashcard-added-msg');
            p.appendChild(document.createTextNode(msg));
            wrapperNode.appendChild(p);
        }
    });
}

const prepAndSendFlashcardRequest = function(form) {
    getAuthToken().then((authToken) => {
        if (authToken === null) {
            console.error("Failed to get auth token");
            return;
        }
        sendFlashcardRequest(form, authToken);

        let forms = document.getElementsByClassName('vortmaro-create-flashcards');
        for (let i = forms.length - 1; i >= 0; --i) {
            let flashcardForm = forms.item(i);
            flashcardForm.parentNode.removeChild(flashcardForm);
        }
    });
};

const extractSentence = function(text, start) {
    let sentence = text;
    let sentenceStartPos = 0;
    let startInSentence = start;
    for (let i = 0; i < start; ++i) {
        if (sentence[i] == '.' || sentence[i] == '。') {
            sentenceStartPos = i + 1;
            startInSentence = start - sentenceStartPos;
        }
    }
    let sentenceEndPos = sentence.length;
    for (let i = sentence.length - 1; i > start; --i) {
        if (sentence[i] == '.' || sentence[i] == '。') {
            sentenceEndPos = i + 1;
        }
    }
    sentence = sentence.substring(sentenceStartPos, sentenceEndPos).trimEnd();
    let trimmed = sentence.trimStart();
    if (trimmed.length < sentence.length) {
        let startTrim = sentence.length - trimmed.length;
        startInSentence -= startTrim;
        sentence = trimmed;
    }
    return {startInSentence, sentence};
}

const getWholeWord = function(text, selectionStart, selectionLength) {
    let wordStart = selectionStart;
    let wordEnd = wordStart + selectionLength;
    for (let pos = wordStart - 1; pos >= 0; --pos) {
        let char = text[pos];
        if (isWordChar(char)) {
            wordStart = pos;
        } else {
            break;
        }
    }

    const textLen = text.length;
    for (let pos = wordEnd + 1; pos < textLen; ++pos) {
        let char = text[pos];
        if (isWordChar(char)) {
            wordEnd = pos;
        } else {
            break;
        }
    }
    return text.substring(wordStart, wordEnd + 1);
}

// Set up a flashcard submission form for a word definition
const addFlashcardBox = function(wrapperNode, defnDetails, lookupDetails, authToken) {
    let form = document.createElement('form');
    form.setAttribute('class', 'vortmaro-create-flashcards');

    const wordIdField = document.createElement('input');
    wordIdField.setAttribute('type', 'hidden');
    wordIdField.setAttribute('name', 'wordId');
    wordIdField.setAttribute('value', defnDetails.wordId);
    form.appendChild(wordIdField);

    const ancestorsField = document.createElement('input');
    ancestorsField.setAttribute('type', 'hidden');
    ancestorsField.setAttribute('name', 'ancestorIds');
    ancestorsField.setAttribute('value', defnDetails.ancestorIds.join(','));
    form.appendChild(ancestorsField);

    const defnIdField = document.createElement('input');
    defnIdField.setAttribute('type', 'hidden');
    defnIdField.setAttribute('name', 'definitionId');
    defnIdField.setAttribute('value', defnDetails.id);
    form.appendChild(defnIdField);

    const sentenceField = document.createElement('input');
    sentenceField.setAttribute('type', 'hidden');
    sentenceField.setAttribute('name', 'sentence');
    sentenceField.setAttribute('value', lookupDetails.sentence);
    form.appendChild(sentenceField);

    // position in sentence
    let startPos = lookupDetails.start;
    if (lookupDetails.followWord) {
        const followWordPattern = new RegExp('\\s' + lookupDetails.followWord + '\\b');
        const followWordPos = lookupDetails.sentence.substring(startPos).search(followWordPattern);
        if (followWordPos != -1) {
            startPos += ',' + (1 + followWordPos + startPos);
        }
    }

    const startField = document.createElement('input');
    startField.setAttribute('type', 'hidden');
    startField.setAttribute('name', 'start');
    startField.setAttribute('value', startPos);
    form.appendChild(startField);
    form = wrapperNode.appendChild(form);

    const submitP = document.createElement('p');
    const submitButton = document.createElement('button');
    submitButton.setAttribute('type', 'button');
    const submitText = document.createTextNode(
        'Create flashcard(s) for this definition'
    );
    submitButton.appendChild(submitText);
    submitButton.onclick = function() {
        prepAndSendFlashcardRequest(form);
    };
    form.appendChild(submitButton);
};

const prepAndAddFlashcardBox = function(wrapperNode, defnDetails, lookupDetails) {
    getAuthToken().then((authToken) => {
        if (!authToken) {
            return;
        }
        addFlashcardBox(wrapperNode, defnDetails, lookupDetails, authToken);
    });
}

const showDefinition = function(
    // Definition fetched from Vortmaro
    wordDefinition,

    /**
     * Details of word chosen on page for lookup; 'result' elsewhere
     *
     * {
     *     sentence,
     *     start,
     *     offset,
     *     word,
     *     lang
     * }
     *
     * @see getNodeWordAtOffset
     */
    wordDetails
) {
    let defnWord = null;
    if (wordDefinition.Words) {
        if (wordDefinition.Words.length == 1) {
            defnWord = wordDefinition.Words[0];
        } else {
            defnWord = wordDefinition.Words;
        }
    }
    console.log('Showing definition', defnWord);

    loadingP.style.display = 'none';

    showCloseButton();

    // Show language block
    const langInfo = document.createElement('p');
    langInfo.setAttribute('class', 'lang-info')

    if (Object.keys(lookupLangs).length > 0) {
        langInfo.appendChild(document.createTextNode('Text language: '));
        const langSelect = document.createElement('select');
        const opt = document.createElement('option');
        opt.appendChild(document.createTextNode(""));
        langSelect.appendChild(opt);

        const textLang = wordDefinition.Words?.[0]?.Lang;
        for (const langKey in lookupLangs) {
            const opt = document.createElement('option');
            opt.setAttribute('value', langKey);
            if (langKey === textLang) {
                opt.setAttribute('selected', '');
            }
            let lang = lookupLangs[langKey];
            let langName = lang.Endo;
            if (lang.Exo) {
                langName += ' (' + lang.Exo + ')';
            }
            opt.appendChild(document.createTextNode(langName));
            langSelect.appendChild(opt);
        }
        langSelect.onchange = (ev) => {
            const docLang = ev.target.value;
            if (docLang) {
                document.documentElement.setAttribute('data-vortmaro-lang', docLang);

                // re-request definition(s) in selected language
                wordDetails.lang = docLang;
                showWord(wordDetails.node, wordDetails, wordDetails.ev);
            }
        };
        langInfo.appendChild(langSelect);
        definitionDiv.appendChild(langInfo);
    } else {
        langInfo.appendChild(document.createTextNode('Text language: ' + wordDetails.lang));
    }

    if (!wordDefinition.Words) {
        const errNode = document.createElement('p');
        let errText = '- not found -';
        if (wordDefinition.error) {
            errText = '- ' + wordDefinition.error + ' -';
        }
        errNode.setAttribute('class', 'vortmaro-reader-error');
        errNode.appendChild(document.createTextNode(errText));
        definitionDiv.appendChild(errNode);
        addLookupLinks(definitionDiv, null, wordDetails);
        addErrorReportBox(definitionDiv, wordDetails);
        return;
    }

    let includedAudio = [];
    let words = [];

    // Split words when there are child and non-child definitions with a parent word
    for (const word of wordDefinition.Words) {
        if (word.ParentWord.Word == "" || word.Definitions === null) {
            words.push(word);
            continue;
        }
        let parentDefns = [];
        let nonParentDefns = [];
        for (const defn of word.Definitions) {
            if (defn.ParentWord != "") {
                parentDefns.push(defn);
            } else {
                nonParentDefns.push(defn);
            }
        }

        // All defns have a parent word, or none have a parent word
        // No need to change anything
        if (parentDefns.length == 0 || nonParentDefns.length == 0) {
            if (word.Definitions && word.Definitions[0].UseParent) {
                word.Definitions = null;
            }
            words.push(word);
            continue;
        }

        let wordWithoutParent = structuredClone(word);
        wordWithoutParent.Definitions = nonParentDefns;
        wordWithoutParent.BaseForm = 0;
        wordWithoutParent.ParentWord.Word = ""
        wordWithoutParent.ParentWord.Id = 0;
        words.push(wordWithoutParent);

        let wordWithParent = structuredClone(word);
        if (parentDefns[0].UseParent) {
            wordWithParent.Definitions = null;
        } else {
            wordWithParent.Definitions = parentDefns;
        }
        words.push(wordWithParent);
    }

    // Counter for enumerating over words
    // multiple definitions with the same word (e.g. verb, noun) only count as 1 word
    let wordNum = 0;
    let charCount = 0;
    let dict, dictName, copyrightText = '', wordsSoFar = '', lastWord = '', currentWord = '';
    let flashcardWordDetails = wordDetails;
    const wholeWordStart = Number(String(flashcardWordDetails.start).replace(/,.*/, ''));
    clearAudioCount();
    words.forEach(function(word) {
        let isNewWord = false;
        currentWord = word.Word.replace(/^-+/, '').replace(/-+$/, '');
        if (currentWord.toLowerCase() != lastWord.toLowerCase()) {
            if (wordNum > 0) {
                charCount += lastWord.length
            }
            isNewWord = true;
            lastWord = currentWord;
            ++wordNum;
        }

        if (word.Dict != dict) {
            dict = word.Dict;

            // TODO: have the server return the actual name & copyright
            // (or preload list of dict details on startup)
            if (dict == 'wktn') {
                dictName = 'Wiktionary';
                copyrightText = '© CC BY-SA 4.0';
            } else if (dict == 'wkpd') {
                dictName = 'Wikipedia';
                copyrightText = '© CC BY-SA 4.0';
            }

            let dictP = document.createElement('p');
            let dictI = document.createElement('i');
            dictI.appendChild(document.createTextNode("Definitions from " + dictName));
            dictP.appendChild(dictI);
            dictP.appendChild(document.createTextNode(", "));
            let copyrightInfo = document.createElement('small');
            copyrightInfo.appendChild(document.createTextNode(copyrightText));
            dictP.appendChild(copyrightInfo);
            definitionDiv.appendChild(dictP);
        }

        const arrow = ' → ';
        let parentWord = null;
        let grandparentWord = null;
        if (word.Images && word.Images.length > 0) {
            word.Images.forEach(function(image) {
                let imgNode = document.createElement('img');
                let imgSrc = image.Filename;
                if (imgSrc.substring(0, 2) != '//') {
                    imgSrc = urlBase + imgSrc;
                }
                imgNode.setAttribute('src', imgSrc);
                definitionDiv.appendChild(imgNode);
            });
        }

        // Word
        let p = document.createElement('p');
        let strong = document.createElement('strong');
        strong.setAttribute('lang', langTo2cc(word.Lang));
        strong.innerText = word.DisplayAs || word.Word;
        if (word.ParentWord && word.ParentWord.Word) {
            parentWord = word.ParentWord;
            strong.innerText = (parentWord.DisplayAs || parentWord.Word) + arrow + strong.innerText;
        }
        if (word.GrandparentWord && word.GrandparentWord.Word) {
            grandparentWord = word.GrandparentWord;
            strong.innerText = (grandparentWord.DisplayAs || grandparentWord.Word) + arrow + strong.innerText;
        }
        p.appendChild(strong);

        let defns = word.Definitions;
        if (grandparentWord && grandparentWord.Definitions) {
            defns = grandparentWord.Definitions;
        } else if (parentWord && parentWord.Definitions) {
            defns = parentWord.Definitions;
        }

        if (defns.length == 1) {
            const firstTrans = defns[0].TranslatedWord;
            if (firstTrans && firstTrans != strong.innerText) {
                p.appendChild(document.createTextNode(' - ' + firstTrans));
            }
        }

        definitionDiv.appendChild(p);

        let autoplayWordAudio = false;
        if (offset >= charCount && offset < charCount + word.Word.length) {
            autoplayWordAudio = true;
        }
        addAudio(definitionDiv, word, includedAudio, autoplayWordAudio);

        let attrs = [];
        if (parentWord && parentWord.Attributes) {
            attrs = Object.values(parentWord.Attributes);
        } else if (word.Attributes) {
            attrs = Object.values(word.Attributes);
        }

        // Show role and attributes
        p = document.createElement('p');
        p.innerText = word.Role;
        if (parentWord && parentWord.Role != word.Role) {
            p.innerText = parentWord.Role + arrow + p.innerText;
            if (grandparentWord && grandparentWord.Role != parentWord.Role) {
                p.innerText = grandparentWord.Role + arrow + p.innerText;
            }
        }
        if (attrs.length > 0) {
            p.innerText += ' (' + attrs.join(', ') + ')';
        }

        // Show usage tip
        let usageTip = word.UsageTip;
        if (parentWord && parentWord.UsageTip) {
            usageTip = parentWord.UsageTip;
        }
        if (grandparentWord && grandparentWord.UsageTip) {
            usageTip = grandparentWord.UsageTip;
        }
        if (usageTip) {
            p.innerText += ' (' + usageTip + ')';
        }

        if (!['tbd', 'dis'].includes(p.innerText)) {
            definitionDiv.appendChild(p);
        }

        if (word.Inflections && word.Inflections.length > 0) {
            let ul = document.createElement('ul');

            // Crunch inflection list down into manageable list
            // E.g. German adjectives can have >20 matching declensions
            let crunched = crunchInflections(word.Inflections);
            for (let i = 0; i < crunched.length; ++i) {
                let decl = crunched[i];
                let li = document.createElement('li');
                let liText = crunched[i].join(', ');
                li.appendChild(document.createTextNode(liText));
                ul.appendChild(li);
            }
            definitionDiv.appendChild(ul);
        }

        let components = [];
        if (word.Components && word.Components.length > 0) {
            components = word.Components;
        } else if (parentWord && parentWord.Components) {
            components = parentWord.Components;
        }
        if (components.length > 0) {
            p = document.createElement('p');
            let em = document.createElement('em');
            em.innerText = 'Components: ';
            p.appendChild(em);
            let componentText = components.join(' + ');
            p.appendChild(document.createTextNode(componentText));
            definitionDiv.append(p);
        }

        let ancestorIds = [];
        if (parentWord && parentWord.Id) {
            ancestorIds.push(parentWord.Id)
        }
        if (grandparentWord && grandparentWord.Id) {
            ancestorIds.push(grandparentWord.Id)
        }
        if (dict == 'wkpd' && defns.length == 1) {
            let singleDefn = document.createElement('div');
            let p = document.createElement('p');
            let defn = defns[0];
            p.innerText = defn.DefnText;
            const defnParam = {
                id: defn.Id,
                wordId: word.Id,
                ancestorIds: ancestorIds
            };
            singleDefn.appendChild(p);
            singleDefn = definitionDiv.appendChild(singleDefn);
            if (word.Role != 'dis') {
                prepAndAddFlashcardBox(singleDefn, defnParam, wordDetails);
            }
        } else if (defns.length > 0) {
            let ol = document.createElement('ol');
            definitionDiv.appendChild(ol);
            defns.forEach(function(defn) {
                let li = document.createElement('li');
                let p = document.createElement('p');
                p.innerText = defn.DefnText;
                li.appendChild(p);
                const defnParam = {
                    id: defn.Id,
                    wordId: word.Id,
                    ancestorIds: ancestorIds
                };

                // add combined length of previous words to start position
                // e.g. if word is 2nd, 3rd or later component of a compound word
                if (isNewWord && wordsSoFar.length > 0) {
                    flashcardWordDetails = Object.assign({}, flashcardWordDetails, {
                        start: wholeWordStart + wordsSoFar.length
                    });
                }

                prepAndAddFlashcardBox(li, defnParam, flashcardWordDetails);
                ol.appendChild(li);
            });
        }

        if (isNewWord) {
            wordsSoFar += currentWord;
            if (wordDetails.word.substring(0, wordsSoFar.length + 1) == wordsSoFar + '-') {
                wordsSoFar += '-';
            }
        }
    });
    addLookupLinks(definitionDiv, wordDefinition, wordDetails);
    addErrorReportBox(definitionDiv, wordDetails);
    definitionDiv.style.display = 'block';
};

const hideDefinition = function() {
    if (!definitionDiv) {
        return;
    }
    if (showTimer) {
        window.clearTimeout(showTimer);
    }
    definitionDiv.style.display = 'none';
    lastWord.node = null;
};

let lastWord = {
    node: null,
    start: null
};
const determineLanguage = function(node)  {
    const overrideLang = document.documentElement.getAttribute('data-vortmaro-lang');
    if (overrideLang) {
        return overrideLang;
    }

    if (node.hasAttribute && node.hasAttribute('lang')) {
        return node.getAttribute('lang').toLowerCase();
    }
    if (node.parentNode) {
        return determineLanguage(node.parentNode);
    }
    const heads = document.getElementsByTagName('head');
    const head = heads.item(0);
    if (head) {
        const metas = head.getElementsByTagName('meta');
        for (let i = 0; i < metas.length; ++i) {
            let meta = metas.item(i);
            if (!meta || !meta.hasAttribute('name')) {
                continue;
            }
            if (meta.getAttribute('name').toLowerCase() != 'content-language') {
                continue;
            }
            return meta.getAttribute('content').toLowerCase();
        }
    }
    return null;
};

const showClickedWord = function(node, offset, ev) {
    const result = getNodeWordAtOffset(node, offset, false);
    showWord(node, result, ev);
}

const showWord = function(node, result, ev) {
    if (!result) {
        hideDefinition();
        return;
    }

    lastWord.node = node;
    lastWord.start = result.start;
    result.node = node;
    result.ev = ev;

    if (!result.lang) {
        // TODO: smarter detection method, and/or allow user to specify
        window.alert('Unable to determine text language, sorry');
        return;
    }

    if (!doLookups) {
        return;
    }

    if (!definitionDiv) {
        const newDiv = document.createElement('div');
        newDiv.setAttribute('id', 'vortmaro-reader-word-definition');
        newDiv.style.display = 'none';
        // console.log('Create DIV for ' + wordDefinition.Words[0].Word);
        definitionDiv = body.appendChild(newDiv);
        loadingP = document.createElement('p');
        loadingP.setAttribute('id', 'vortmaro-reader-loading');
        loadingP.appendChild(document.createTextNode('...'));
        loadingP = definitionDiv.appendChild(loadingP)
    } else {
        while (definitionDiv.childNodes.length > 1 ) {
            definitionDiv.removeChild(definitionDiv.lastChild);
        }
    }

    const newY = (ev.pageY + 20);
    const newX = Math.max(ev.pageX - 50, 10);
    definitionDiv.style.top = newY + 'px';
    definitionDiv.style.left = newX + 'px';
    loadingP.style.display = 'block';
    definitionDiv.style.display = 'block';
    fetchDefinition(result, showDefinition);
};

/**
 * @param {Node} node
 * @returns {Node|null}
 */
function nextTextNode(node) {
    if (node.nodeType == Node.TEXT_NODE && node.nextSibling == null) {
        return nextTextNode(node.parentNode);
    }
    return getFirstTextDescendant(node.nextSibling);
}

/**
 * @param {Node|null} node
 * @returns {Node|null}
 */
function getFirstTextDescendant(node) {
    if (!node) {
        return null;
    }
    if (node.nodeType == Node.TEXT_NODE) {
        return node;
    }
    return getFirstTextDescendant(node.childNodes.item(0));
}

/**
 * Extract surrounding text, and start and length corresponding to a selection
 *
 * @example
 * The asterisks mark where the Selection begins and ends
 * "The **night** is still young" -> ["The night is still young", 4, 5, anchorNode]
 * "The night is **still** young" -> ["The night is still young", 13, 5, anchorNode]
 *
 * @param {Selection} selection
 * @returns {array} [text: string, startOffset: int, length: int, foundIn: Node]
 */
function extractSelectionText(selection) {
    const {anchorNode, focusNode} = selection;
    const anchorText = anchorNode.innerText || anchorNode.data;
    if (anchorNode === focusNode) {
        let start = selection.anchorOffset;
        const end = selection.focusOffset;
        let length = end - start;

        if (end < start) {
            // selection is in reverse
            length = -length;
            start = end;
        }
        return [anchorText, start, length, anchorNode];
    }

    const focusText = focusNode.innerText || focusNode.data;
    let anchorSiblingText = '';
    let focusSiblingText = '';
    const anchorSibling = nextTextNode(anchorNode);
    const focusSibling = nextTextNode(focusNode);
    if (anchorSibling) {
        anchorSiblingText = anchorSibling.innerText || anchorSibling.data;
    }
    if (focusSibling) {
        focusSiblingText = focusSibling.innerText || focusSibling.data;
    }

    let focusStart, focusLength, anchorStart, anchorLength;
    if (anchorSiblingText == focusText) {
        anchorStart = selection.anchorOffset;
        anchorLength = anchorText.length - selection.anchorOffset;
        focusStart = 0;
        focusLength = selection.focusOffset;
    } else if (focusSiblingText == anchorText) {
        // selection is in reverse, so anchor and focus are swapped
        focusStart = selection.focusOffset;
        focusLength = focusText.length - selection.focusOffset;
        anchorStart = 0;
        anchorLength = selection.anchorOffset;
    } else {
        return [false, 0, 0, 'anchor'];
    }
    if (focusLength > anchorLength) {
        return [focusText, focusStart, focusLength, focusNode];
    } else {
        return [anchorText, anchorStart, anchorLength, anchorNode];
    }
}

function partialLookup() {
    if (!window.getSelection) {
        return;
    }
    const selection = window.getSelection();
    let [nodeText, start, offset, sourceNode] = extractSelectionText(selection);
    if (!nodeText) {
        return;
    }

    let selectedWord = nodeText.substring(start, start + offset);
    let matches = selectedWord.match(/^\s+/)
    if (matches && matches.length == 1 && matches[0].length > 0) {
        let wsLen = matches[0].length;
        selectedWord = selectedWord.substring(wsLen);
        start += wsLen;
    }
    matches = selectedWord.match(/\s+$/)
    if (matches && matches.length == 1 && matches[0].length > 0) {
        let wsLen = matches[0].length;
        selectedWord = selectedWord.substring(0, selectedWord.length - wsLen);
        offset -= wsLen;
    }

    // Ensure whole sentence is extracted (e.g. including hyperlinked portions)
    const resultFromSurrounds = getNodeWordAtOffset(sourceNode, start, true);
    const startInSentence = resultFromSurrounds.start + resultFromSurrounds.offset;
    const sentence = resultFromSurrounds.sentence;
    const wholeWord = getWholeWord(sentence, startInSentence, offset);

    const result = {
        sentence: sentence,
        start: startInSentence,
        offset: offset,
        word: selectedWord,
        asPartOf: wholeWord,
        lang: determineLanguage(selection.anchorNode),
    };

    showTimer = window.setTimeout(
        showWord,
        0,
        selection.focusNode,
        result,
        lastMouseUp
    );
}

let lastMouseUp;
const handleMouseUp = function (ev) {
    lastMouseUp = ev;
};

let showTimer = null;
const handleClick = function (ev) {
    // Only handle left-click events
    if (ev.button != 0) {
        return;
    }

    let inPopOver = false;
    let node = ev.target;

    while (node.parentNode) {
        if (node.id == 'vortmaro-reader-word-definition') {
            inPopOver = true;
            break;
        }
        node = node.parentNode;
    }
    if (inPopOver) {
        return;
    }

    if (!enabled) {
        return;
    }

    // TODO: allow different configs for causing word lookups
    ev.stopPropagation();
    if (showTimer) {
        window.clearTimeout(showTimer);
    }
    if (ev.rangeParent) {
        showTimer = window.setTimeout(
            showClickedWord,
            showDelay,
            ev.rangeParent,
            ev.rangeOffset,
            ev
        );
    } else if (window.getSelection) {
        const selection = window.getSelection();
        showTimer = window.setTimeout(
            showClickedWord,
            showDelay,
            selection.focusNode,
            selection.focusOffset,
            ev
        );
    } else {
        hideDefinition();
    }

};

const handleKeyDown = function(ev)
{
    if (ev.key == "Escape") {
        hideDefinition();
    }
}

const nodeIsInDefinition = function(node) {
    while (node) {
        if (node == definitionDiv) {
            return true;
        }
        node = node.parentNode
    }
    return false;
};

const addAltText = function() {
    if (!enabled) {
        return;
    }
    const imgs = body.getElementsByTagName('img');
    for (let i = 0; i < imgs.length; ++i) {
        let img = imgs.item(i);

        // TODO: detect if image has actually loaded (if not, the alt text will already be displayed by the browser)

        let parent = img.parentNode;
        if (parent.nodeName.toLowerCase() == 'figure') {
            continue;
        }
        if (parent.nodeName.toLowerCase() == 'a' && parent.parentNode.nodeName.toLocaleLowerCase() == 'figure') {
            continue;
        }
        if (img.classList.contains("dict-icon")) {
            continue;
        }
        let altText = img.getAttribute('alt');
        let altTextLcase = '';
        if (altText) {
            altTextLcase = altText.toLowerCase();
        }
        if (!altText
            || altTextLcase == 'image' || altTextLcase == 'icon'
            || altTextLcase == 'flag'
            || altTextLcase == 'embedded video'
            || altTextLcase == 'opens profile photo'
            || altText.match(/^[\p{Emoji}\p{Emoji_Component}]+$/u)
            || img.getAttribute('class') == 'emoji'
        ) {
            continue;
        }

        let wrapper = document.createElement('figure');
        if (parent.nodeName.toLowerCase() == 'a') {
            let a = parent;
            let aParent = a.parentNode;
            wrapper = aParent.insertBefore(wrapper, a);
            wrapper.appendChild(a);
        } else {
            wrapper = parent.insertBefore(wrapper, img);
            wrapper.appendChild(img);
        }

        let caption = document.createElement('figcaption');
        caption.setAttribute('class', 'vortmaro-caption');
        caption.appendChild(document.createTextNode('Alt: ' + altText + ''));
        wrapper.appendChild(caption);
    }
};
