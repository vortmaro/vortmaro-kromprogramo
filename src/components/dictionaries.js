function targetName(dictionaryName) {
    var name = '_vortmaro_' + dictionaryName.replace(/\s+/, '_');
    return name.replace(/[^a-zA-Z]/, '');
};

// Add links to look up word in various 3rd-party dictionaries
function addLookupLinks(wrapperNode, lookupResult, wordDetails) {
    const lookupP = document.createElement('p');
    const intro = document.createElement('strong');
    intro.appendChild(document.createTextNode('Lookup via:'));
    lookupP.appendChild(intro);

    // TODO: get list from server at startup
    // (N.B. depends on languages found on page)
    const dictionaries = [
        {
            name: 'Wiktionary',
            icon: '/img/wiktionary.png',
            lang: 'en',
            url: 'https://en.wiktionary.org/w/index.php',
            params: {
                search: '$word',
                ns0: 1,
            }
        },
        {
            name: 'Wikipedia',
            icon: '/img/wikipedia.png',
            lang: '$lang',
            url: 'https://$lang.wikipedia.org/w/index.php',
            params: {
                search: '$word',
                ns0: 1,
            }
        },
    ];

    dictionaries.forEach(function(dict) {
        const sourceLang = langTo2cc(wordDetails.lang);

        // TODO: support other languages
        const targetLang = 'en';

        let langs = [sourceLang];
        if (sourceLang !== targetLang) {
            langs.push(targetLang);
        }
        langs.forEach(function(lang) {
            var linkWord = wordDetails.word;

            // Only show link to dictionary appropriate for the language
            if (dict.lang !== '$lang' && dict.lang !== lang) {
                return;
            }

            // Get word in relevant language
            // This currently only applies for Wikipedia
            if (dict.lang === '$lang' && lang === targetLang) {
                if (!lookupResult || !lookupResult.Words) {
                    return;
                }
                const resultDefs = lookupResult.Words[0].Definitions;
                if (!resultDefs) {
                    return;
                }
                linkWord = resultDefs[0].TranslatedWord;
                if (!linkWord) {
                    return;
                }
            }

            const link = document.createElement('a');
            var url = dict.url.replace('$lang', lang) + '?';
            var params = Object.keys(dict.params);
            for (let i = 0; i < params.length; ++i) {
                let key = params[i];
                let val = dict.params[key];
                if (val == '$word') {
                    val = linkWord;
                }
                if (i > 0) {
                    url += '&';
                }
                url += encodeURIComponent(key) + '=' + encodeURIComponent(val);
            }
            link.setAttribute('href', url);
            link.setAttribute('target', targetName(dict.name));
            link.setAttribute('title', dict.name);
            // TODO: find a way to load from within addon rather than fetching from server
            let img = document.createElement('img');
            img.setAttribute('src', urlBase + dict.icon);
            img.setAttribute('class', 'dict-icon');
            link.appendChild(img);
            lookupP.appendChild(document.createTextNode(' '));
            lookupP.appendChild(link);
        });
    });
    wrapperNode.appendChild(lookupP);
}
