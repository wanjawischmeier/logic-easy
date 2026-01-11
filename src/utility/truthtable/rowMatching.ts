/**
 * Get all row indices in the full truth table that match the selected input pattern of the given row
 * 
 * @param rowIdx - The row index in the full truth table to match
 * @param totalInputs - Total number of input variables
 * @param totalRows - Total number of rows in the truth table
 * @param inputSelection - Boolean array indicating which inputs are selected (undefined means all selected)
 * @returns Array of row indices that match the selected input pattern
 */
export function getAllMatchingRows(
    rowIdx: number,
    totalInputs: number,
    totalRows: number,
    inputSelection?: boolean[]
): number[] {
    // If no selection or all inputs selected, return just the single row
    if (!inputSelection) {
        return [rowIdx]
    }

    const selectedInputIndices = inputSelection
        .map((selected, idx) => selected ? idx : -1)
        .filter(idx => idx !== -1)

    // If all inputs are selected, return just the single row
    if (selectedInputIndices.length === totalInputs) {
        return [rowIdx]
    }

    const matchingRows: number[] = []

    // Extract the values of selected inputs from the given row
    const selectedInputValues = selectedInputIndices.map(inputIdx => {
        const shiftAmount = totalInputs - 1 - inputIdx
        return (rowIdx >> shiftAmount) & 1
    })

    // Check all rows to find matches
    for (let i = 0; i < totalRows; i++) {
        let matches = true
        for (let j = 0; j < selectedInputIndices.length; j++) {
            const inputIdx = selectedInputIndices[j]
            if (inputIdx === undefined) continue

            const shiftAmount = totalInputs - 1 - inputIdx
            const bitValue = (i >> shiftAmount) & 1

            if (bitValue !== selectedInputValues[j]) {
                matches = false
                break
            }
        }
        if (matches) {
            matchingRows.push(i)
        }
    }

    return matchingRows
}
