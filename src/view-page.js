    // Delay (in ms) between mouse movement ending and showing word definition
    const showDelay = 0;
    // Actually look up the words; false for testing just extracting words
    const doLookups = true;
    const body = document.getElementsByTagName('body').item(0);
    const urlBase = 'https://vortmaro.org';
    const wordLookupUrl = urlBase + '/api/word/fetch';
    const wordReportUrl = urlBase + '/api/word/report';

    let definitionDiv = null;
    let loadingP = null;

    const jsonFetch = function(url, handlerFunc, ...additionalArgs) {
        fetch(url).then(function(response) {
            if (!response.ok || response.status != 200) {
                console.error("Server error");
                return {error: true};
            }
            return response.json();
        }).then(function (json) {
            handlerFunc(json, ...additionalArgs);
        });
    };

    const fetchDefinition = function(result, displayFunc) {
        const l = window.location;
        const source = l.protocol + '//' + l.host + l.pathname + l.search;
        const pos = result.word.indexOf('-');
        let words = [result.word];
        if (pos != -1) {
            // console.log("Found '-' at pos " + pos + " in ", result);
            let subWord = '';
            if (pos < result.offset) {
                subWord = result.word.substring(pos + 1);
            } else {
                subWord = result.word.substring(0, pos);
            }
            // console.log("Subword: " + subWord);
            words.push(subWord);
        }
        let fetchResult = null;
        for (let i = 0; i < words.length; ++i) {
            let word = words[i];
            let url = wordLookupUrl + '?word=' + encodeURIComponent(word)
                + '&source=' + encodeURIComponent(source)
                + '&lang=' + encodeURIComponent(result.lang.toLowerCase());
            fetchResult = jsonFetch(url, displayFunc, result);
            // console.log("Result for " + word, fetchResult);
            if (fetchResult && fetchResult.Words) {
                return fetchResult
            }
        }
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
            || char == '„' || char == '“'
            || char == '\xa0'
            || typeof char === 'undefined'
        ) {
            return false;
        }
        return true;
    };

    const getNodeWordAtOffset = function(node, offset) {
        let elementText = node.innerText || node.data;

        if (elementText.length == 0 || !isWordChar(elementText[offset])) {
            return;
        }

        let prevSpace = -1;
        let nextSpace = elementText.length;
        let seenPrev = [];
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
        return {
            start: start,
            offset: offset - start,
            word: word
        };
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

        wrapperNode.appendChild(form)
    }

    const showDefinition = function(
        // Definition fetched from Vortmaro
        wordDefinition,

        // Details of word chosen on page for lookup; 'result' elsewhere
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

        const closeDiv = document.createElement('div');
        closeDiv.setAttribute('class', 'popover-close');
        closeDiv.appendChild(document.createTextNode('X'));
        closeDiv.addEventListener('mouseup', hideDefinition);
        definitionDiv.appendChild(closeDiv);

        if (!wordDefinition.Words) {
            const errNode = document.createElement('p');
            let errText = '- not found -';
            if (wordDefinition.error) {
                errText = '- ' + wordDefinition.error + ' -';
            }
            errNode.setAttribute('class', 'vortmaro-reader-error');
            errNode.appendChild(document.createTextNode(errText));
            definitionDiv.appendChild(errNode);
            addLookupLinks(definitionDiv, wordDetails);
            addErrorReportBox(definitionDiv, wordDetails);
            return;
        }

        let includedAudio = [];
        let words = [];

        // Split words when there are child and non-child definitions with a parent word
        for (const word of wordDefinition.Words) {
            if (word.BaseWord.Word == "" || word.Definitions === null) {
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
            wordWithoutParent.BaseWord.Word = ""
            wordWithoutParent.BaseWord.Id = 0;
            words.push(wordWithoutParent);

            let wordWithParent = structuredClone(word);
            if (parentDefns[0].UseParent) {
                wordWithParent.Definitions = null;
            } else {
                wordWithParent.Definitions = parentDefns;
            }
            words.push(wordWithParent);
        }

        let dict, dictName, copyrightText = '';
        words.forEach(function(word) {
            if (word.Dict != dict) {
                dict = word.Dict;

                // TODO: have the server return the actual name & copyright
                // (or preload list of dict details on startup)
                if (dict == 'wktn') {
                    dictName = 'Wiktionary';
                    copyrightText = '© CC BY-SA 3.0';
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
            let baseWord = null;
            if (word.Images && word.Images.length > 0) {
                word.Images.forEach(function(image) {
                    let imgNode = document.createElement('img');
                    imgNode.setAttribute('src', urlBase + image.Filename);
                    definitionDiv.appendChild(imgNode);
                });
            }

            // Word
            let p = document.createElement('p');
            let strong = document.createElement('strong');
            strong.innerText = word.DisplayAs || word.Word;
            if (word.BaseWord && word.BaseWord.Word) {
                baseWord = word.BaseWord;
                strong.innerText = (baseWord.DisplayAs || baseWord.Word) + arrow + strong.innerText;
            }
            p.appendChild(strong);
            definitionDiv.appendChild(p);

            addAudio(definitionDiv, word, includedAudio);

            let attrs = [];
            if (baseWord && baseWord.Attributes) {
                attrs = Object.values(baseWord.Attributes);
            } else if (word.Attributes) {
                attrs = Object.values(word.Attributes);
            }

            // Show role and attributes
            p = document.createElement('p');
            p.innerText = word.Role;
            if (attrs.length > 0) {
                p.innerText += ' (' + attrs.join(', ') + ')';
            }
            definitionDiv.appendChild(p);

            if (word.Declensions && word.Declensions.length > 0) {
                let ul = document.createElement('ul');

                // Crunch declension list down into manageable list
                // E.g. German adjectives can have >20 matching declensions
                let crunched = crunchDeclensions(word.Declensions);
                ul = document.createElement('ul');
                for (let i = 0; i < crunched.length; ++i) {
                    let decl = crunched[i];
                    let li = document.createElement('li');
                    let liText = crunched[i].join(', ');
                    li.appendChild(document.createTextNode(liText));
                    ul.appendChild(li);
                }
                definitionDiv.appendChild(ul);
            }

            let defns = [];
            if (word.Definitions) {
                defns = word.Definitions;
            } else if (baseWord && baseWord.Definitions) {
                defns = baseWord.Definitions;
            }
            if (defns.length > 0) {
                let ol = document.createElement('ol');
                definitionDiv.appendChild(ol);
                defns.forEach(function(defn) {
                    let li = document.createElement('li');
                    li.innerText = defn.DefnText;
                    ol.appendChild(li);
                });
            }
        });
        addLookupLinks(definitionDiv, wordDetails);
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
        if (node.hasAttribute && node.hasAttribute('lang')) {
            return node.getAttribute('lang');
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
                return meta.getAttribute('content');
            }
        }
        return null;
    };

    const showClickedWord = function(node, offset, ev) {
        const result = getNodeWordAtOffset(node, offset);
        showWord(node, result, ev);
    }

    const showWord = function(node, result, ev) {
        if (!result) {
            hideDefinition();
            return;
        }
        if (lastWord.node !== node || lastWord.start !== result.start) {
            // console.log('Current word:', result.word);
            lastWord.node = node;
            lastWord.start = result.start;
            result.lang = determineLanguage(node);
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
        }
    };

    function partialLookup() {
        if (!window.getSelection) {
            return;
        }
        const selection = window.getSelection();
        if (selection.anchorNode != selection.focusNode) {
            // can't grab text over 2 different nodes
            return;
        }

        const nodeText = selection.anchorNode.innerText || selection.anchorNode.data;
        const result = {
            start: selection.anchorOffset,
            offset: selection.focusOffset - selection.anchorOffset,
            word: nodeText.substring(selection.anchorOffset, selection.focusOffset),
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

    if (body) {
        body.addEventListener('keydown', handleKeyDown);
        body.addEventListener('click', handleClick);
        body.addEventListener('mouseup', handleMouseUp);
        body.addEventListener('mouseout', function(event) {
            if (nodeIsInDefinition(event.target)) {
                return;
            }
        });

        addAltText();

        const observer = new MutationObserver(function() {
            addAltText();
        });
        observer.observe(document, {subtree: true, childList: true});
    }
