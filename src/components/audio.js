function addAudio(definitionDiv, word, includedAudio)
{
    let wordAudioUrls = [];
    if (word.Audio != null) {
        for (let i = 0; i < word.Audio.length; ++i) {
            let url = word.Audio[i].Url;
            if (!includedAudio.includes(url)) {
                wordAudioUrls.push(url);
                includedAudio.push(url);
            }
        }
    }
    if (word.ParentWord.Audio != null) {
        for (let i = 0; i < word.ParentWord.Audio.length; ++i) {
            let url = word.ParentWord.Audio[i].Url;
            if (!includedAudio.includes(url)) {
                wordAudioUrls.push(url);
                includedAudio.push(url);
            }
        }
    }
    if (wordAudioUrls.length == 0) {
        return;
    }
    audioP = document.createElement('p');
    audioP.setAttribute("class", "audio-list");
    definitionDiv.appendChild(audioP);
    for (let i = 0; i < wordAudioUrls.length; ++i) {
        let src = wordAudioUrls[i];
        let audioNode = document.createElement('audio');
        audioNode.setAttribute('controls', 'y');

        // Chromium-based browsers have CSP restrictions on adding <audio> from external sources
        // So fetch the audio and add it as a blob URL instead (seems really stupid but what can ya do?)
        if (!navigator.userAgent.match(/Firefox\//)) {
            getBlobFromUrl(src).then(function(blob) {
                if (!blob) {
                    return;
                }

                // TODO - ideally grab a MediaStream from the blob, then
                // audioNode.srcObject = theMediaStream;
                // That doesn't seem possible.

                // Instead, for now, use the old approach:
                audioNode.setAttribute('src', URL.createObjectURL(blob));
                audioP.appendChild(audioNode);
            });
        } else {
            audioNode.setAttribute('src', src);
            audioP.appendChild(audioNode);
        }
    }
}
