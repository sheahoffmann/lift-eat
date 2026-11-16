import { describe, expect, it } from 'vitest'
import { applyMyLabels, myLabelsOn } from './myLabels'
import { groceryItems } from './groceryItems'

describe('my label numbers', () => {
  it('swaps in label values and restores the originals', () => {
    const before = groceryItems['whey'].protein
    applyMyLabels(true)
    expect(groceryItems['whey'].protein).toBe(30)
    expect(groceryItems['chicken-strips'].protein * 84).toBeCloseTo(22)
    applyMyLabels(false)
    expect(groceryItems['whey'].protein).toBe(before)
  })

  it('defaults on for Athletic Strength only, setting wins', () => {
    expect(myLabelsOn('athletic', undefined)).toBe(true)
    expect(myLabelsOn('glute', undefined)).toBe(false)
    expect(myLabelsOn('athletic', false)).toBe(false)
  })
})
