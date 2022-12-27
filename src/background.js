function onCreated() {
    if (browser.runtime.lastError) {
        console.log(`Error: ${browser.runtime.lastError}`);
    }
}

browser.contextMenus.create(
    {
        id: "vortmaro-partial-lookup",
        title: browser.i18n.getMessage("menuItemLookup"),
        contexts: ["selection"],
    },
    onCreated
);

browser.contextMenus.onClicked.addListener((info, tab) => {
    switch (info.menuItemId) {
        case "vortmaro-partial-lookup":
            browser.tabs.executeScript(tab.id, {
                code: 'partialLookup();'
            });
            break;
    }
});
