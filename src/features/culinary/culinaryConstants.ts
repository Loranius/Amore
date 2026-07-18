// ============================================================
// Culinary — константи (порт DISH_CATS / CUL_STEPS / RCP_UNITS)
// ============================================================
import type { DishCategory, CulinaryStepDef } from '@/types';

export const DISH_CATS: Record<DishCategory, { label: string; color: string }> = {
  meat: { label: "🥩 М'ясне", color: '#C45B79' },
  vegan: { label: '🥦 Вега', color: '#5FA777' },
  fast: { label: '⚡ Швидке', color: '#D9A441' },
  other: { label: '🍽️ Інше', color: '#9B6EA8' },
};

export const DISH_CAT_ORDER: DishCategory[] = ['meat', 'vegan', 'fast', 'other'];

export const RCP_UNITS = ['г', 'кг', 'мл', 'л', 'шт', 'ст.л', 'ч.л', 'пучок', 'за смаком'] as const;

export const CUL_STEPS: CulinaryStepDef[] = [
  {
    key: 'type', title: 'Що готуємо?', hint: 'Один варіант', multi: false,
    options: ['Основна страва', 'Суп', 'Салат', 'Сніданок', 'Швидкий перекус', 'Десерт'],
  },
  {
    key: 'taste', title: 'Якого смаку хочеться?', hint: 'До двох варіантів', multi: true, max: 2,
    options: ['Солоне', 'Кисле', 'Солодке', 'Гостре-пряне', 'Вершкове-ніжне', 'Копчено-димне', 'Кисло-солодке'],
  },
  {
    key: 'base', title: 'Основа страви', hint: 'До трьох варіантів', multi: true, max: 3,
    options: ['Курка', 'Свинина', 'Яловичина', 'Риба', 'Морепродукти', 'Овочі', 'Гриби', 'Злаки та крупи', 'Боби', 'Яйця', 'Сир'],
  },
  {
    key: 'ingredients', title: 'Наскільки прості інгредієнти?', hint: 'Один варіант', multi: false,
    options: ['Тільки базові — все є в АТБ, Сільпо чи Варусі', 'Можна щось особливе, пошукаємо'],
  },
  {
    key: 'effort', title: 'Час і складність', hint: 'Один варіант', multi: false,
    options: ['Просте, до 30 хвилин', 'Середнє, до години', 'Можна заморочитись'],
  },
  {
    key: 'cuisine', title: 'Кухня світу', hint: 'Один варіант', multi: false,
    options: ['Здивуй мене', 'Українська', 'Італійська', 'Грузинська', 'Азійська', 'Мексиканська', 'Близькосхідна', 'Французька', '✨ Авторська вигадка Клода'],
  },
];
