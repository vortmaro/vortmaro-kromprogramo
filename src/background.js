function onCreated() {
    if (chrome.runtime.lastError) {
        console.log(`Error: ${chrome.runtime.lastError}`);
    }
}

chrome.contextMenus.create(
    {
        id: "vortmaro-partial-lookup",
        title: chrome.i18n.getMessage("menuItemLookup"),
        contexts: ["selection"],
    },
    onCreated
);

chrome.contextMenus.onClicked.addListener((info, tab) => {
    switch (info.menuItemId) {
        case "vortmaro-partial-lookup":
            chrome.tabs.executeScript(tab.id, {
                code: 'partialLookup();'
            });
            break;
    }
});
