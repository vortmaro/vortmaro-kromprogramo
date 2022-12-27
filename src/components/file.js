function getBlobFromUrl(url, func, ...additionalArgs)
{
    return fetch(url).then(function(response) {
        if (!response.ok || response.status != 200) {
            return false;
        }
        return response.blob();
    });
}