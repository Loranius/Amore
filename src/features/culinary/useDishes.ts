// ============================================================
// useDishes — пул улюблених страв (порт loadDishes + мутації)
// ------------------------------------------------------------
// Припускаємо, що в таблиці dishes вже є колонки category + recipe
// (jsonb) — старий трикаскадний фолбек-select більше не потрібен.
// culSaveFavorite мапить конструкторну страву в категорію за
// відповідями; addToShopping ллє інгредієнти в shopping_items.
// ============================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import { useToast } from '@/providers/ToastProvider';
import { useCurrentUser } from '@/providers/AuthProvider';
import type {
  DishRow,
  DishCategory,
  Recipe,
  RecipeIngredient,
  CulinaryDish,
  CulinaryAnswers,
  InsertRow,
} from '@/types';

async function loadDishes(): Promise<DishRow[]> {
  const { data, error } = await supabase
    .from('dishes')
    .select('id,title,category,recipe')
    .order('id', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((d) => ({
    ...d,
    category: d.category ?? 'other',
    recipe: d.recipe ?? null,
  }));
}

export function useDishes() {
  return useQuery({ queryKey: qk.dishes(), queryFn: loadDishes });
}

/** Категорія улюбленої страви з відповідей конструктора. */
export function mapDishCategory(answers: CulinaryAnswers): DishCategory {
  const bases = (answers.base ?? []).join(' ').toLowerCase();
  if (/курка|свинина|яловичина|риба|морепродукти/.test(bases)) return 'meat';
  if (/овочі|гриби|боби/.test(bases)) return 'vegan';
  if ((answers.effort ?? [])[0] === 'Просте, до 30 хвилин') return 'fast';
  return 'other';
}

/** Інгредієнт рецепта → рядок кошика. */
function ingredientToShoppingRow(i: RecipeIngredient, userId: number) {
  const qty =
    i.unit === 'за смаком'
      ? 'за смаком'
      : [i.amount, i.unit].filter(Boolean).join(' ') || null;
  return {
    title: i.name,
    qty,
    category: i.shop_cat ?? 'Інше',
    created_by: userId,
  };
}

export function useDishMutations() {
  const client = useQueryClient();
  const user = useCurrentUser();
  const toast = useToast();
  const invalidate = () => void client.invalidateQueries({ queryKey: qk.dishes() });

  const add = useMutation({
    mutationFn: async (v: { title: string; category: DishCategory; recipe: Recipe | null }) => {
      const row: InsertRow<'dishes'> = {
        title: v.title,
        category: v.category,
        recipe: v.recipe,
        created_by: user.id,
      };
      const { error } = await supabase.from('dishes').insert(row);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast.show('Не вдалось зберегти страву'),
  });

  const edit = useMutation({
    mutationFn: async (v: { id: number; title: string; category: DishCategory; recipe: Recipe | null }) => {
      const { error } = await supabase
        .from('dishes')
        .update({ title: v.title, category: v.category, recipe: v.recipe })
        .eq('id', v.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast.show('Не вдалось зберегти страву'),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('dishes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast.show('Не вдалось видалити'),
  });

  // Зберегти згенеровану страву в улюблені.
  const saveFavorite = useMutation({
    mutationFn: async (v: { dish: CulinaryDish; answers: CulinaryAnswers }) => {
      const recipe: Recipe = {
        servings: v.dish.servings ?? 2,
        ingredients: v.dish.ingredients,
        steps: v.dish.steps ?? [],
      };
      const row: InsertRow<'dishes'> = {
        title: v.dish.title,
        category: mapDishCategory(v.answers),
        recipe,
        created_by: user.id,
      };
      const { error } = await supabase.from('dishes').insert(row);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.show('❤️ Збережено в улюблені');
    },
    onError: (e) => toast.show('Не вдалось зберегти: ' + (e as Error).message),
  });

  // Інгредієнти рецепта → кошик.
  const toShopping = useMutation({
    mutationFn: async (ingredients: RecipeIngredient[]) => {
      const rows = ingredients.map((i) => ingredientToShoppingRow(i, user.id));
      if (!rows.length) return 0;
      const { error } = await supabase.from('shopping_items').insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (count) => {
      void client.invalidateQueries({ queryKey: qk.shopping() });
      if (count) toast.show(`🛒 ${count} інгр. додано в покупки`);
    },
    onError: () => toast.show('Не вдалось додати в покупки'),
  });

  return { add, edit, remove, saveFavorite, toShopping };
}
