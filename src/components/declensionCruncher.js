function cruncherRun(arrayDeclensions)
{
    this.newDeclensions = [];

    /**
     * 
     * @param string[] baseRow Base row to combine with matching rows
     * @param int[] matchingVals Positions of values which match across relevant rows
     * @param int[] matchingRows Rows with values that match base row in the relevant positions
     * @param array[] arrayDeclensions All declensions (i.e. all rows)
     * @returns 
     */
    this.crunchRow = function(baseRow, matchingVals, matchingRows, arrayDeclensions)
    {
        var crunchedRow = [];
        for (let i = 0; i < baseRow.length; ++i) {
            if (matchingVals.includes(i)) {
                crunchedRow.push(baseRow[i])
            } else {
                let crunchVals = [baseRow[i]];
                for (let j = 0 ; j < matchingRows.length; ++j) {
                    let idx = matchingRows[j];
                    let crunchVal = arrayDeclensions[idx][i];
                    if (crunchVals.includes(crunchVal)) {
                        continue;
                    }
                    crunchVals.push(crunchVal);
                }
                crunchedRow.push(crunchVals.join('/'));
            }
        }

        return crunchedRow;
    }

    /**
     * 
     * @param int i Index of current declension (in arrayDeclensions)
     * @param array[] processed List of indexes of processed declensions
     */
    this.crunchMatching = function(i, processed)
    {
        let row1 = arrayDeclensions[i];
        let matchingVals = [];
        let matchingRows = [];
        for (let j = 0; j < arrayDeclensions.length; ++j) {
            if (i == j || processed.includes(j)) {
                continue;
            }
            let row2 = arrayDeclensions[j];
            if (row1.length != row2.length) {
                continue;
            }

            if (matchingVals.length == 0) {
                // set up matchingVals
                for (let k = 0; k < row1.length; ++k) {
                    if (row1[k] == row2[k]) {
                        matchingVals.push(k);
                    }
                }

                // Can only crunch if X-1/X values match
                if (matchingVals.length != row1.length - 1) {
                    matchingVals = [];
                    continue;
                }
            } else {
                // check existing matchingVals; can crunch if they match
                let numMatchingVals = 0;
                for (let k = 0; k < matchingVals.length; ++k) {
                    let key = matchingVals[k];
                    if (row1[key] == row2[key]) {
                        ++numMatchingVals;
                    }
                }
                if (numMatchingVals != matchingVals.length) {
                    continue;
                }
            }

            if (!processed.includes(i)) {
                processed.push(i);
            }
            processed.push(j);

            matchingRows.push(j);
        }

        if (matchingRows.length == 0) {
            if (!processed.includes(i)) {
                processed.push(i);
                this.newDeclensions.push(row1);
            }
            return;
        }

        let matchingRowList = [i];
        matchingRowList.push(...matchingRows);

        let crunchedRow = this.crunchRow(row1, matchingVals, matchingRows, arrayDeclensions);

        this.newDeclensions.push(crunchedRow);
    }
}

/**
 * Convert list of {attr1:val1, attr2:val2, ...} mappings to just the values [val1, val2, ...]
 * 
 * @param array objectDeclensions 
 * @returns 
 */
function convertDeclensionsToValues(objectDeclensions)
{
    var arrayDeclensions = [];
    for (let i = 0; i < objectDeclensions.length; ++i) {
        let keys = Object.keys(objectDeclensions[i]);
        let vals = [];
        for (let j = 0; j < keys.length; ++j) {
            vals.push(objectDeclensions[i][keys[j]]);
        }
        arrayDeclensions.push(vals);
    }
    return arrayDeclensions;
}

function crunchDeclensions(objectDeclensions) {
    var arrayDeclensions = convertDeclensionsToValues(objectDeclensions);

    // Perform multiple rounds of crunching rows whose values match except for 1
    let roundNum = 1;
    var newDeclensions = [];
    do {
        let cruncher = new cruncherRun(arrayDeclensions);
        let processed = [];
        for (let i = 0; i < arrayDeclensions.length; ++i) {
            if (processed.includes(i)) {
                continue;
            }
            cruncher.crunchMatching(i, processed);
        }

        newDeclensions = cruncher.newDeclensions;
        if (newDeclensions.length == arrayDeclensions.length) {
            break;
        }

        arrayDeclensions = newDeclensions;
    } while (++roundNum < 6);

    return newDeclensions;
}