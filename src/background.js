let tabsEnabled = {};
let lastTabEnabled = false;

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

// When a new tab is created, mark it as disabled
// TODO: enable if current/parent tab is enabled
browser.tabs.onCreated.addListener((tab) => {
    tabsEnabled[tab.id] = false;
});

// When switching tabs, update icon & enable/disable lookups relevant to tab
browser.tabs.onActivated.addListener((info) => {
    updateTab(info.tabId);
});

// TODO: retain enabled status
browser.tabs.onUpdated.addListener((tabId) => {
    updateTab(tabId);
});

// Toggle enabled/disabled on the current tab when icon clicked
chrome.browserAction.onClicked.addListener((tab) => {
    tabsEnabled[tab.id] = !tabsEnabled[tab.id];
    updateTab(tab.id);
});

// Set the icon and enable/disable lookups in tab based on whether tab is enabled
function updateTab(tabId) {
    const enabledInfoString = JSON.stringify(tabsEnabled);
    let command = "";
    if (tabsEnabled[tabId]) {
        chrome.browserAction.setIcon({
            path: {
                "16": "img/logo-16.png",
                "32": "img/logo-32.png"
            }
        });
        command = "setEnabled(true);";
        lastTabEnabled = true;
    } else {
        chrome.browserAction.setIcon({
            path: {
                "16": "img/logo-disabled-16.png",
                "32": "img/logo-disabled-32.png"
            }
        });
        command = "setEnabled(false);";
        lastTabEnabled = false;
    }
    chrome.tabs.executeScript(tabId, {
        code: command
    });
}
