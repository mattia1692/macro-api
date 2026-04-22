import { z } from 'zod';

export const per100gSchema = z.object({
  kcal: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
  satfat: z.number(),
  fiber: z.number(),
});

export const customFoodBodySchema = z.object({
  name: z.string().min(1),
  brand: z.string().optional(),
  per100g: per100gSchema,
});

export const idParamSchema = z.object({
  id: z.string().min(1),
});

export const aiAnalyzeSchema = z.object({
  food: z.string().min(1).max(500),
});

export const aiSuggestSchema = z.object({
  type: z.literal('suggest'),
  remaining: z.object({
    kcal: z.number(),
    protein: z.number(),
    carbs: z.number(),
    fat: z.number(),
  }),
});

export const aiPlanSchema = z.object({
  type: z.literal('plan'),
  kcal: z.number(),
  protein: z.number().optional(),
  carbs: z.number().optional(),
  fat: z.number().optional(),
  notes: z.string().optional(),
});

export type CustomFoodBody = z.infer<typeof customFoodBodySchema>;
