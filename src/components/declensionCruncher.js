function cruncherRun(arrayInflections)
{
    this.newInflections = [];

    /**
     * 
     * @param string[] baseRow Base row to combine with matching rows
     * @param int[] matchingVals Positions of values which match across relevant rows
     * @param int[] matchingRows Rows with values that match base row in the relevant positions
     * @param array[] arrayInflections All declensions (i.e. all rows)
     * @returns 
     */
    this.crunchRow = function(baseRow, matchingVals, matchingRows, arrayInflections)
    {
        var crunchedRow = [];
        for (let i = 0; i < baseRow.length; ++i) {
            if (matchingVals.includes(i)) {
                crunchedRow.push(baseRow[i])
            } else {
                let crunchVals = [baseRow[i]];
                for (let j = 0 ; j < matchingRows.length; ++j) {
                    let idx = matchingRows[j];
                    let crunchVal = arrayInflections[idx][i];
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
     * @param int i Index of current declension (in arrayInflections)
     * @param array[] processed List of indexes of processed declensions
     */
    this.crunchMatching = function(i, processed)
    {
        let row1 = arrayInflections[i];
        let matchingVals = [];
        let matchingRows = [];
        for (let j = 0; j < arrayInflections.length; ++j) {
            if (i == j || processed.includes(j)) {
                continue;
            }
            let row2 = arrayInflections[j];
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
                this.newInflections.push(row1);
            }
            return;
        }

        let matchingRowList = [i];
        matchingRowList.push(...matchingRows);

        let crunchedRow = this.crunchRow(row1, matchingVals, matchingRows, arrayInflections);

        this.newInflections.push(crunchedRow);
    }
}

/**
 * Convert list of {attr1:val1, attr2:val2, ...} mappings to just the values [val1, val2, ...]
 * 
 * @param array objectInflections 
 * @returns 
 */
function convertInflectionsToValues(objectInflections)
{
    var arrayInflections = [];
    for (let i = 0; i < objectInflections.length; ++i) {
        let keys = Object.keys(objectInflections[i]);
        let vals = [];
        for (let j = 0; j < keys.length; ++j) {
            vals.push(objectInflections[i][keys[j]]);
        }
        arrayInflections.push(vals);
    }
    return arrayInflections;
}

function crunchInflections(objectInflections) {
    var arrayInflections = convertInflectionsToValues(objectInflections);

    // Perform multiple rounds of crunching rows whose values match except for 1
    let roundNum = 1;
    var newInflections = [];
    do {
        let cruncher = new cruncherRun(arrayInflections);
        let processed = [];
        for (let i = 0; i < arrayInflections.length; ++i) {
            if (processed.includes(i)) {
                continue;
            }
            cruncher.crunchMatching(i, processed);
        }

        newInflections = cruncher.newInflections;
        if (newInflections.length == arrayInflections.length) {
            break;
        }

        arrayInflections = newInflections;
    } while (++roundNum < 6);

    return newInflections;
}
