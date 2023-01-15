chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
    if (msg.action == 'partial_lookup') {
        console.log("Doing partial_lookup");
        partialLookup();
    }
});

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
