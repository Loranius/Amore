import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SHOPPING_CATEGORIES } from '@/app/constants';
import { TEMPLATE_GROUPS, listedKeys, templateKey } from './shoppingTemplates';

// ============================================================
// Полиця шаблона покупок.
// ------------------------------------------------------------
// Сторожить одну річ, яку легко зламати мовчки: **товар мусить лягати в ту
// саму групу списку незалежно від того, вписали його рукою чи взяли з
// полиці.** Рукою його розбирає Edge Function `shopping-parse`, полицею —
// таблиця в `shoppingTemplates.ts`; дві таблиці розходяться на першій же
// правці, і розходження видно тільки очима, в списку, де одне молоко стоїть
// у «Напої», а друге в «Інше».
// ============================================================

const ROOT = join(__dirname, '../../..');
const PARSER = readFileSync(join(ROOT, 'supabase/functions/shopping-parse/index.ts'), 'utf8');

const ALL_ITEMS = TEMPLATE_GROUPS.flatMap((group) => group.items);

describe('дані полиці', () => {
  it('усі три полиці власника на місці й не порожні', () => {
    // «вся продукція там вже розсортована по категоріям (їжа, побут,
    // хотілки)» — це три полиці, а не одна купа з фільтром.
    expect(TEMPLATE_GROUPS.map((group) => group.title)).toEqual(['Їжа', 'Побут', 'Хотілки']);
    for (const group of TEMPLATE_GROUPS) {
      expect(group.items.length, group.title).toBeGreaterThan(4);
    }
  });

  it('кожен товар має категорію, яку знає база', () => {
    // Категорія їде в БД як є. Вигадана сюди — це рядок, який жоден екран не
    // покаже в правильній групі.
    for (const item of ALL_ITEMS) {
      expect(SHOPPING_CATEGORIES as readonly string[], item.title).toContain(item.category);
    }
  });

  it('не повторює той самий товар на двох полицях', () => {
    // Дубль означає дві кнопки, з яких одна після дотику мертва, а друга ні.
    const keys = ALL_ITEMS.map((item) => templateKey(item.title));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('відповідність розбирачу', () => {
  // Правила беруться з тексту самої функції, а не переписуються сюди: якщо
  // промпт перепишуть, тест почне читати нові слова й покаже розбіжність
  // замість того, щоб і далі стверджувати вчорашнє.

  it('розбирач і далі відправляє молочку, хліб, бакалію та солодощі в «Інше»', () => {
    expect(PARSER).toMatch(/Молочка, крупи, хліб, бакалія, солодощі, заморозка — це "Інше"/);
    for (const title of ['Молоко', 'Хліб', 'Сир', 'Масло', 'Рис', 'Цукор', 'Морозиво', 'Цукерки']) {
      const item = ALL_ITEMS.find((candidate) => candidate.title === title);
      expect(item, title).toBeDefined();
      expect(item!.category, title).toBe('Інше');
    }
  });

  it('розбирач і далі відправляє побутову хімію в «Побут», а мило й пасту — в «Гігієна»', () => {
    expect(PARSER).toMatch(/Побутова хімія, засоби для прибирання, лампочки — "Побут"/);
    expect(PARSER).toMatch(/Мило, шампунь, зубна паста — "Гігієна"/);
    const category = (title: string) =>
      ALL_ITEMS.find((candidate) => candidate.title === title)?.category;
    expect(category('Пральний порошок')).toBe('Побут');
    expect(category('Лампочка')).toBe('Побут');
    expect(category('Мило')).toBe('Гігієна');
    expect(category('Шампунь')).toBe('Гігієна');
    expect(category('Зубна паста')).toBe('Гігієна');
  });

  it('не вигадує категорій, яких немає в переліку самої функції', () => {
    // Читається САМЕ масив `CATEGORIES`, а не будь-який рядок у лапках:
    // перша редакція цього тесту брала всі лапки у файлі й підбирала разом із
    // категоріями заголовки CORS і "POST". Такий перелік підтвердив би майже
    // що завгодно.
    const block = PARSER.match(/const CATEGORIES = \[([\s\S]*?)\];/);
    expect(block, 'у функції розбору більше немає масиву CATEGORIES').not.toBeNull();
    const declared = [...block![1]!.matchAll(/"([^"]+)"/g)].map((match) => match[1]!);
    expect(declared).toHaveLength(SHOPPING_CATEGORIES.length);

    for (const item of ALL_ITEMS) {
      expect(declared, `${item.title} → ${item.category}`).toContain(item.category);
    }
  });
});

describe('ключ порівняння назв', () => {
  it('не рахує регістр і зайві пробіли за інший товар', () => {
    // Інакше «молоко», вписане рукою, лишало б кнопку «Молоко» на полиці
    // живою — і в списку з'явилось би два молока.
    expect(templateKey('  Молоко ')).toBe(templateKey('молоко'));
    expect(templateKey('Туалетний  папір')).toBe(templateKey('туалетний папір'));
  });

  it('позначає доданим те, що вже лежить у списку', () => {
    const listed = listedKeys(['молоко', 'Зубна паста']);
    expect(listed.has(templateKey('Молоко'))).toBe(true);
    expect(listed.has(templateKey('зубна паста'))).toBe(true);
    expect(listed.has(templateKey('Хліб'))).toBe(false);
  });
});
