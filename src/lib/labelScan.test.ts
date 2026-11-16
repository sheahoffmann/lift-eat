import { describe, expect, it } from 'vitest'
import { guessItem, piecesPerServing, toCatalog } from './labelScan'
import { groceryItems } from '../data/groceryItems'

const label = (name: string, servingLabel: string, servingGrams: number | null, calories: number, protein: number) => ({ name, servingLabel, servingGrams, calories, protein, carbs: 0, fat: 0, note: '' })

describe('label scan', () => {
  it('guesses the planner ingredient from the label name', () => {
    expect(guessItem('Tyson Grilled Chicken Breast Strips')).toBe('chicken-strips')
    expect(guessItem("Member's Mark Italian Style Beef Meatballs")).toBe('turkey-meatballs')
    expect(guessItem('Wholly Guacamole Minis')).toBe('guac-cups')
    expect(guessItem('Kodiak Honey Oat Granola')).toBe('granola')
    expect(guessItem('Optimum Nutrition Gold Standard Casein')).toBe('casein')
    expect(guessItem('Herdez Salsa Verde')).toBe('salsa')
    expect(guessItem('Chobani Greek Yogurt Vanilla')).toBe('greek-yogurt')
    expect(guessItem('Totally unrelated thing')).toBeNull()
  })

  it('counts pieces per serving for counted items', () => {
    expect(piecesPerServing('4 meatballs (85g)')).toBe(4)
    expect(piecesPerServing('1 scoop (38 g)')).toBe(1)
    expect(piecesPerServing('1 cup (125g)')).toBe(1)
    expect(piecesPerServing('2/3 cup (62g)')).toBe(1)
  })

  it('converts per serving to per base unit', () => {
    const meat = toCatalog(groceryItems['turkey-meatballs'], label('Beef meatballs', '4 meatballs (85g)', 85, 250, 12))!
    expect(meat.cal).toBe(62.5)
    const chicken = toCatalog(groceryItems['chicken-strips'], label('Chicken', '3 oz (84g)', 84, 120, 22))!
    expect(chicken.protein * 84).toBeCloseTo(22)
    expect(toCatalog(groceryItems['chicken-strips'], label('Chicken', '3 oz', null, 120, 22))).toBeNull()
  })
})
